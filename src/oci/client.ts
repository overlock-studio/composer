import * as zlib from 'node:zlib';
import { Readable } from 'node:stream';
import { promisify } from 'node:util';
import * as tar from 'tar-stream';
import * as yaml from 'js-yaml';
import * as semver from 'semver';
import type { BlockType } from '../api/types';
import {
  crossplaneCoreBlockTypes,
  isCrossplaneCoreUrl,
} from '../lib/crossplaneCore';

const gunzip = promisify(zlib.gunzip);

const MANIFEST_ACCEPT = [
  'application/vnd.oci.image.manifest.v1+json',
  'application/vnd.docker.distribution.manifest.v2+json',
  'application/vnd.oci.image.index.v1+json',
  'application/vnd.docker.distribution.manifest.list.v2+json',
].join(', ');

export type ImageRef = {
  registry: string;
  repository: string;
  reference: string;
};

export function parseImageRef(image: string): ImageRef {
  const atIdx = image.indexOf('@');
  let head: string;
  let reference: string;
  if (atIdx > -1) {
    head = image.slice(0, atIdx);
    reference = image.slice(atIdx + 1);
  } else {
    const lastSlash = image.lastIndexOf('/');
    const colonIdx = image.indexOf(':', lastSlash);
    if (colonIdx > -1) {
      head = image.slice(0, colonIdx);
      reference = image.slice(colonIdx + 1);
    } else {
      head = image;
      reference = 'latest';
    }
  }
  const firstSlash = head.indexOf('/');
  const first = firstSlash === -1 ? head : head.slice(0, firstSlash);
  if (firstSlash === -1 || (!first.includes('.') && !first.includes(':'))) {
    return { registry: 'xpkg.crossplane.io', repository: head, reference };
  }
  return {
    registry: first,
    repository: head.slice(firstSlash + 1),
    reference,
  };
}

const tokenCache = new Map<string, string>();

function parseChallenge(header: string): Record<string, string> | null {
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const params: Record<string, string> = {};
  const re = /(\w+)="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(match[1])) !== null) {
    params[m[1]] = m[2];
  }
  return params;
}

async function fetchToken(challenge: Record<string, string>): Promise<string> {
  const url = new URL(challenge.realm);
  if (challenge.service) url.searchParams.set('service', challenge.service);
  if (challenge.scope) url.searchParams.set('scope', challenge.scope);
  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`token endpoint ${url} returned ${res.status}`);
  }
  const body = (await res.json()) as { token?: string; access_token?: string };
  const token = body.token ?? body.access_token;
  if (!token) throw new Error('token endpoint returned no token');
  return token;
}

async function authedFetch(
  url: string,
  init: RequestInit,
  cacheKey: string,
): Promise<Response> {
  const cached = tokenCache.get(cacheKey);
  const headers = new Headers(init.headers);
  if (cached) headers.set('Authorization', `Bearer ${cached}`);
  let res = await fetch(url, { ...init, headers });
  if (res.status !== 401) return res;

  const challengeHeader = res.headers.get('www-authenticate');
  if (!challengeHeader) return res;
  const challenge = parseChallenge(challengeHeader);
  if (!challenge?.realm) return res;
  const token = await fetchToken(challenge);
  tokenCache.set(cacheKey, token);
  headers.set('Authorization', `Bearer ${token}`);
  res = await fetch(url, { ...init, headers });
  return res;
}

type ManifestRef = { digest: string; mediaType?: string };
type ManifestDoc = {
  mediaType?: string;
  schemaVersion?: number;
  config?: ManifestRef;
  layers?: ManifestRef[];
  manifests?: (ManifestRef & {
    platform?: { os?: string; architecture?: string };
  })[];
};

async function getJson<T>(
  url: string,
  accept: string,
  cacheKey: string,
): Promise<T> {
  const res = await authedFetch(url, { headers: { Accept: accept } }, cacheKey);
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}

async function getBytes(url: string, cacheKey: string): Promise<Uint8Array> {
  const res = await authedFetch(url, {}, cacheKey);
  if (!res.ok) {
    throw new Error(`GET ${url} → ${res.status} ${res.statusText}`);
  }
  const buf = await res.arrayBuffer();
  return new Uint8Array(buf);
}

function pickPlatform(
  manifests: (ManifestRef & {
    platform?: { os?: string; architecture?: string };
  })[],
): ManifestRef {
  const linuxAmd64 = manifests.find(
    (m) => m.platform?.os === 'linux' && m.platform?.architecture === 'amd64',
  );
  return linuxAmd64 ?? manifests[0];
}

async function listTags(ref: ImageRef, cacheKey: string): Promise<string[]> {
  const url = `https://${ref.registry}/v2/${ref.repository}/tags/list`;
  const body = await getJson<{ tags?: string[] }>(
    url,
    'application/json',
    cacheKey,
  );
  return body.tags ?? [];
}

function isConstraint(reference: string): boolean {
  if (reference.startsWith('sha256:')) return false;
  if (semver.valid(reference, { loose: true })) return false;
  return /[*x~^>=<|\s]/.test(reference);
}

async function resolveTag(ref: ImageRef, cacheKey: string): Promise<string> {
  if (!isConstraint(ref.reference)) return ref.reference;
  let range: semver.Range;
  try {
    range = new semver.Range(ref.reference, { loose: true });
  } catch {
    return ref.reference;
  }
  const tags = await listTags(ref, cacheKey);
  const matching = tags
    .filter((t) => !!semver.valid(t, { loose: true }))
    .filter((t) => semver.satisfies(t, range, { loose: true }))
    .sort((a, b) => semver.rcompare(a, b, { loose: true }));
  if (matching.length === 0) {
    throw new Error(
      `no tags in ${ref.registry}/${ref.repository} satisfy "${ref.reference}"`,
    );
  }
  return matching[0];
}

async function resolveImageManifest(
  ref: ImageRef,
  cacheKey: string,
): Promise<ManifestDoc> {
  const tag = await resolveTag(ref, cacheKey);
  const baseUrl = `https://${ref.registry}/v2/${ref.repository}/manifests/${tag}`;
  const doc = await getJson<ManifestDoc>(baseUrl, MANIFEST_ACCEPT, cacheKey);
  if (
    doc.mediaType?.includes('manifest.list') ||
    doc.mediaType?.includes('image.index') ||
    doc.manifests?.length
  ) {
    if (!doc.manifests?.length) {
      throw new Error('image index has no manifests');
    }
    const picked = pickPlatform(doc.manifests);
    const childUrl = `https://${ref.registry}/v2/${ref.repository}/manifests/${picked.digest}`;
    return getJson<ManifestDoc>(childUrl, MANIFEST_ACCEPT, cacheKey);
  }
  return doc;
}

type ImageConfig = {
  config?: { Labels?: Record<string, string> };
};

const BASE_LAYER_LABEL_VALUE = 'base';

function findBaseLayerDigest(cfg: ImageConfig): string | null {
  const labels = cfg.config?.Labels;
  if (!labels) return null;
  for (const [key, value] of Object.entries(labels)) {
    if (value !== BASE_LAYER_LABEL_VALUE) continue;
    const colonIdx = key.indexOf(':');
    if (colonIdx === -1) continue;
    return key.slice(colonIdx + 1);
  }
  return null;
}

async function extractYamlDocs(tarball: Uint8Array): Promise<unknown[]> {
  let raw: Uint8Array;
  try {
    raw = await gunzip(tarball);
  } catch {
    raw = tarball;
  }
  return new Promise((resolve, reject) => {
    const extractor = tar.extract();
    const docs: unknown[] = [];
    extractor.on('entry', (header, stream, next) => {
      if (header.type !== 'file' || !/\.ya?ml$/i.test(header.name)) {
        stream.on('end', next);
        stream.resume();
        return;
      }
      const chunks: Buffer[] = [];
      stream.on('data', (c: Buffer) => chunks.push(c));
      stream.on('end', () => {
        try {
          const text = Buffer.concat(chunks).toString('utf8');
          for (const doc of yaml.loadAll(text)) {
            if (doc && typeof doc === 'object') docs.push(doc);
          }
        } catch {
          // skip malformed YAML entries
        }
        next();
      });
      stream.resume();
    });
    extractor.on('finish', () => resolve(docs));
    extractor.on('error', reject);
    Readable.from(raw).pipe(extractor);
  });
}

export type CrdLike = {
  kind?: string;
  spec?: {
    group?: string;
    names?: { kind?: string };
    versions?: {
      name?: string;
      schema?: {
        openAPIV3Schema?: {
          properties?: Record<string, unknown>;
          description?: string;
        };
      };
    }[];
  };
};

export async function fetchPackageCrds(image: string): Promise<CrdLike[]> {
  const ref = parseImageRef(image);
  const cacheKey = `${ref.registry}/${ref.repository}`;

  const manifest = await resolveImageManifest(ref, cacheKey);
  if (!manifest.config?.digest) {
    throw new Error('image manifest has no config digest');
  }
  const configBytes = await getBytes(
    `https://${ref.registry}/v2/${ref.repository}/blobs/${manifest.config.digest}`,
    cacheKey,
  );
  const cfg = JSON.parse(new TextDecoder().decode(configBytes)) as ImageConfig;

  const baseDigest = findBaseLayerDigest(cfg);
  const layerDigests: string[] = [];
  if (baseDigest) {
    layerDigests.push(baseDigest);
  } else {
    for (const l of manifest.layers ?? []) layerDigests.push(l.digest);
  }

  const allDocs: unknown[] = [];
  for (const digest of layerDigests) {
    const blob = await getBytes(
      `https://${ref.registry}/v2/${ref.repository}/blobs/${digest}`,
      cacheKey,
    );
    const docs = await extractYamlDocs(blob);
    allDocs.push(...docs);
  }

  return allDocs.filter(
    (d): d is CrdLike =>
      !!d &&
      typeof d === 'object' &&
      (d as { kind?: string }).kind === 'CustomResourceDefinition',
  );
}

export type BlockTypeLike = {
  id: string;
  name: string;
  kind: string;
  apiVersion: string;
  schema: {
    properties: {
      spec?: unknown;
      status?: unknown;
      metadata?: unknown;
    };
  };
  title: string;
  description?: string;
  leaf: boolean;
};

function hashId(input: string): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < input.length; i++) {
    const ch = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (
    (h2 >>> 0).toString(16).padStart(8, '0') +
    (h1 >>> 0).toString(16).padStart(8, '0')
  );
}

export function crdsToBlockTypes(crds: CrdLike[]): BlockTypeLike[] {
  const blockTypes: BlockTypeLike[] = [];
  for (const crd of crds) {
    const group = crd.spec?.group;
    const kind = crd.spec?.names?.kind;
    if (!group || !kind) continue;
    for (const v of crd.spec?.versions ?? []) {
      if (!v?.name) continue;
      const props = v.schema?.openAPIV3Schema?.properties;
      if (!props) continue;
      if (!props['spec'] && !props['status'] && !props['metadata']) continue;
      const apiVersion = `${group}/${v.name}`;
      const blockName = `${apiVersion}.${kind}`;
      blockTypes.push({
        id: hashId(blockName),
        name: blockName,
        kind,
        apiVersion,
        schema: {
          properties: {
            spec: props['spec'] ?? {},
            status: props['status'] ?? {},
            metadata: props['metadata'] ?? {},
          },
        },
        title: kind.replace(/([a-z])([A-Z])/g, '$1 $2'),
        description: v.schema?.openAPIV3Schema?.description,
        leaf: true,
      });
    }
  }
  return blockTypes;
}

export async function fetchBlockTypes(image: string): Promise<BlockType[]> {
  if (isCrossplaneCoreUrl(image)) {
    return crossplaneCoreBlockTypes;
  }
  const crds = await fetchPackageCrds(image);
  return crdsToBlockTypes(crds) as BlockType[];
}
