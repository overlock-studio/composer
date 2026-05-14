import {
  Document,
  parseAllDocuments,
  YAMLMap,
  YAMLSeq,
  isMap,
  isSeq,
} from 'yaml';
import { Connector, Patch, Resource, Transformer } from '../api/types';
import { CrossplaneFile, OriginIndex, PackageDependency } from './parser';

export type ResourceEdgeInput = {
  direction: 'fromComposite' | 'toComposite';
  fromFieldPath: string;
  toFieldPath: string;
  transformers?: Transformer[];
};

export type SerializerResourceInput = {
  name: string;
  apiVersion: string;
  kind: string;
  edges: ResourceEdgeInput[];
};

export type SerializerCompositionInput = {
  resources: SerializerResourceInput[];
  metadata?: { name: string };
  compositeTypeRef?: { apiVersion: string; kind: string };
  connectors?: Connector[];
  originalName?: string;
};

export type SerializerInput = {
  files: CrossplaneFile[];
  origin: OriginIndex;
  crossplaneFile: string;
  compositions: Record<string, SerializerCompositionInput>;
  providers: PackageDependency[];
  functions: PackageDependency[];
};

const STRINGIFY_OPTIONS = { lineWidth: 0 } as const;

const buildPatchesForResource = (
  edges: ResourceEdgeInput[] | undefined,
): Patch[] => {
  if (!edges?.length) return [];
  const out: Patch[] = [];
  for (const e of edges) {
    const patch: Patch = {
      type:
        e.direction === 'fromComposite'
          ? 'FromCompositeFieldPath'
          : 'ToCompositeFieldPath',
      fromFieldPath: e.fromFieldPath,
      toFieldPath: e.toFieldPath,
    };
    if (e.transformers && e.transformers.length > 0) {
      patch.transforms = e.transformers;
    }
    out.push(patch);
  }
  return out;
};

const findResourcesSeq = (compositionDoc: Document): YAMLSeq | null => {
  const spec = compositionDoc.getIn(['spec'], true);
  if (!isMap(spec)) return null;
  const pipeline = (spec as YAMLMap).get('pipeline', true);
  if (isSeq(pipeline)) {
    const items = (pipeline as YAMLSeq).items;
    for (let i = 0; i < items.length; i++) {
      const stepNode = items[i];
      if (!isMap(stepNode)) continue;
      const step = (stepNode as YAMLMap).get('step');
      if (step !== 'patch-and-transform') continue;
      const input = (stepNode as YAMLMap).get('input', true);
      if (!isMap(input)) continue;
      const resources = (input as YAMLMap).get('resources', true);
      if (isSeq(resources)) return resources as YAMLSeq;
    }
  }
  const flat = (spec as YAMLMap).get('resources', true);
  if (isSeq(flat)) return flat as YAMLSeq;
  return null;
};

const resourceMapToJS = (node: unknown): Resource | null => {
  if (!isMap(node)) return null;
  try {
    const js = (node as YAMLMap).toJSON() as Resource;
    if (js && typeof js === 'object' && typeof js.name === 'string') return js;
  } catch {
    return null;
  }
  return null;
};

const buildResourceDoc = (
  resource: SerializerResourceInput,
  originalBase: Resource['base'] | undefined,
): Resource => {
  const base = originalBase ?? {
    apiVersion: resource.apiVersion,
    kind: resource.kind,
    spec: { forProvider: {} },
  };
  const built: Resource = {
    name: resource.name,
    base: {
      ...base,
      apiVersion: resource.apiVersion || base.apiVersion,
      kind: resource.kind || base.kind,
    },
  };
  const patches = buildPatchesForResource(resource.edges);
  if (patches.length > 0) built.patches = patches;
  return built;
};

const replaceCompositionResources = (
  doc: Document,
  input: SerializerCompositionInput,
): boolean => {
  const seq = findResourcesSeq(doc);
  if (!seq) return false;

  const originalByName = new Map<string, Resource>();
  for (const item of seq.items) {
    const js = resourceMapToJS(item);
    if (js) originalByName.set(js.name, js);
  }

  const rebuilt = input.resources.map((r) =>
    buildResourceDoc(r, originalByName.get(r.name)?.base),
  );

  const newSeq = doc.createNode(rebuilt) as YAMLSeq;
  seq.items = newSeq.items;
  return true;
};

const replaceConfigurationDependsOn = (
  doc: Document,
  providers: PackageDependency[],
  functions: PackageDependency[],
): void => {
  const spec = doc.getIn(['spec'], true);
  if (!isMap(spec)) return;
  const list: Record<string, string>[] = [];
  for (const p of providers) {
    const entry: Record<string, string> = { provider: p.package };
    if (p.version) entry.version = p.version;
    list.push(entry);
  }
  for (const f of functions) {
    const entry: Record<string, string> = { function: f.package };
    if (f.version) entry.version = f.version;
    list.push(entry);
  }
  const node = doc.createNode(list) as YAMLSeq;
  (spec as YAMLMap).set('dependsOn', node);
};

const pluralize = (kind: string): string => {
  const lower = kind.toLowerCase();
  if (lower.endsWith('s') || lower.endsWith('x') || lower.endsWith('z'))
    return `${lower}es`;
  if (lower.endsWith('y') && !/[aeiou]y$/.test(lower))
    return `${lower.slice(0, -1)}ies`;
  return `${lower}s`;
};

const buildNewXrdDoc = (
  compositeTypeRef: { apiVersion: string; kind: string },
  connectors: Connector[] | undefined,
): string => {
  const [group, version] = compositeTypeRef.apiVersion.split('/');
  const kind = compositeTypeRef.kind;
  const plural = pluralize(kind);

  const doc = new Document({
    apiVersion: 'apiextensions.crossplane.io/v1',
    kind: 'CompositeResourceDefinition',
    metadata: { name: `${plural}.${group}` },
    spec: {
      group,
      names: { kind, plural },
      versions: [
        {
          name: version,
          served: true,
          referenceable: true,
          schema: {
            openAPIV3Schema: { type: 'object', properties: {} },
          },
        },
      ],
    },
  });

  replaceXrdSchema(doc, connectors ?? []);
  return doc.toString(STRINGIFY_OPTIONS);
};

const buildNewCompositionDoc = (
  name: string,
  input: SerializerCompositionInput,
): string => {
  const composition: Record<string, unknown> = {
    apiVersion: 'apiextensions.crossplane.io/v1',
    kind: 'Composition',
    metadata: { name },
  };
  const resources = input.resources.map((r) => buildResourceDoc(r, undefined));
  if (input.compositeTypeRef) {
    composition.spec = {
      compositeTypeRef: input.compositeTypeRef,
      mode: 'Pipeline',
      pipeline: [
        {
          step: 'patch-and-transform',
          functionRef: { name: 'function-patch-and-transform' },
          input: {
            apiVersion: 'pt.fn.crossplane.io/v1beta1',
            kind: 'Resources',
            resources,
          },
        },
      ],
    };
  } else {
    composition.spec = { resources };
  }
  const doc = new Document(composition);
  return doc.toString(STRINGIFY_OPTIONS);
};

const docName = (doc: Document): string | null => {
  const name = doc.getIn(['metadata', 'name']);
  return typeof name === 'string' ? name : null;
};

const docKind = (doc: Document): string | null => {
  const kind = doc.get('kind');
  return typeof kind === 'string' ? kind : null;
};

const mapKeys = (map: YAMLMap): string[] => {
  const out: string[] = [];
  for (const item of map.items) {
    const k = item.key;
    if (typeof k === 'string') out.push(k);
    else if (k && typeof k === 'object' && 'value' in k) {
      const v = (k as { value?: unknown }).value;
      if (typeof v === 'string') out.push(v);
    }
  }
  return out;
};

const ensureMap = (
  doc: Document,
  parent: YAMLMap,
  key: string,
  fresh: () => Record<string, unknown>,
): YAMLMap => {
  const existing = parent.get(key, true);
  if (isMap(existing)) return existing;
  const created = doc.createNode(fresh()) as YAMLMap;
  parent.set(key, created);
  return created;
};

const isPrimitiveLeaf = (entry: unknown): boolean => {
  if (!isMap(entry)) return false;
  const t = entry.get('type');
  const props = entry.get('properties', true);
  return typeof t === 'string' && t !== '' && !isMap(props);
};

const xrdRefKeys = (doc: Document): string[] => {
  const group = doc.getIn(['spec', 'group']);
  const namesKind = doc.getIn(['spec', 'names', 'kind']);
  const versions = doc.getIn(['spec', 'versions'], true);
  if (typeof group !== 'string' || typeof namesKind !== 'string') return [];
  if (!isSeq(versions)) return [];
  const keys: string[] = [];
  for (const v of versions.items) {
    if (!isMap(v)) continue;
    const versionName = v.get('name');
    if (typeof versionName !== 'string') continue;
    keys.push(`${group}/${versionName}|${namesKind}`);
  }
  return keys;
};

const applySectionConnectors = (
  doc: Document,
  topProps: YAMLMap,
  section: 'spec' | 'status',
  connectors: Connector[],
): void => {
  const targetTopKeys = new Set<string>();
  const directConnectors = new Map<string, Connector>();
  for (const c of connectors) {
    const rest = c.path.slice(section.length + 1);
    if (!rest) continue;
    const segs = rest.split('.');
    targetTopKeys.add(segs[0]);
    if (segs.length === 1) directConnectors.set(segs[0], c);
  }

  const existingSection = topProps.get(section, true);
  if (!isMap(existingSection) && connectors.length === 0) return;

  const sectionMap = ensureMap(doc, topProps, section, () => ({
    type: 'object',
  }));
  const sectionProps = ensureMap(doc, sectionMap, 'properties', () => ({}));

  for (const ek of mapKeys(sectionProps)) {
    if (targetTopKeys.has(ek)) continue;
    const entry = sectionProps.get(ek, true);
    if (isPrimitiveLeaf(entry)) sectionProps.delete(ek);
  }

  for (const [key, c] of directConnectors) {
    if (sectionProps.has(key)) continue;
    const fieldDef: Record<string, unknown> = { type: c.type || 'string' };
    if (c.description) fieldDef.description = c.description;
    sectionProps.set(key, doc.createNode(fieldDef));
  }

  if (section === 'spec') {
    const required: string[] = [];
    for (const [key, c] of directConnectors) {
      if (c.required) required.push(key);
    }
    if (required.length > 0) {
      sectionMap.set('required', doc.createNode(required));
    } else if (sectionMap.has('required')) {
      sectionMap.delete('required');
    }
  }
};

const replaceXrdSchema = (doc: Document, connectors: Connector[]): void => {
  const versions = doc.getIn(['spec', 'versions'], true);
  if (!isSeq(versions)) return;
  for (const v of versions.items) {
    if (!isMap(v)) continue;
    const schema = v.getIn(['schema', 'openAPIV3Schema'], true);
    if (!isMap(schema)) continue;
    const topProps = ensureMap(doc, schema, 'properties', () => ({}));
    const inputs = connectors.filter(
      (c) => c.connection !== 'output' && c.path.startsWith('spec.'),
    );
    const outputs = connectors.filter(
      (c) => c.connection === 'output' && c.path.startsWith('status.'),
    );
    applySectionConnectors(doc, topProps, 'spec', inputs);
    applySectionConnectors(doc, topProps, 'status', outputs);
  }
};

export const serializeCrossplaneFiles = (
  input: SerializerInput,
): Record<string, string> => {
  const sanitizeFilename = (s: string): string =>
    s.replace(/[^a-zA-Z0-9._-]/g, '_');

  const knownCompositionFile = (name: string): string =>
    input.origin.compositions[name] ??
    `${sanitizeFilename(name)}-composition.yaml`;

  const docsByFile = new Map<string, Document[]>();
  for (const f of input.files) {
    const docs = parseAllDocuments(f.content).filter((d) => d.contents != null);
    docsByFile.set(f.name, docs);
  }

  const xrdsByRef = new Map<string, Document>();
  for (const [, docs] of docsByFile) {
    for (const doc of docs) {
      if (docKind(doc) !== 'CompositeResourceDefinition') continue;
      for (const key of xrdRefKeys(doc)) xrdsByRef.set(key, doc);
    }
  }

  const connectorsByXrdDoc = new Map<Document, Map<string, Connector>>();
  for (const [, comp] of Object.entries(input.compositions)) {
    if (!comp.compositeTypeRef || !comp.connectors?.length) continue;
    const ref = `${comp.compositeTypeRef.apiVersion}|${comp.compositeTypeRef.kind}`;
    const xrd = xrdsByRef.get(ref);
    if (!xrd) continue;
    let bag = connectorsByXrdDoc.get(xrd);
    if (!bag) {
      bag = new Map<string, Connector>();
      connectorsByXrdDoc.set(xrd, bag);
    }
    for (const c of comp.connectors) {
      if (!c?.path) continue;
      bag.set(c.path, c);
    }
  }

  const findCompositionInput = (
    docMetadataName: string,
  ): { name: string; comp: SerializerCompositionInput } | null => {
    if (input.compositions[docMetadataName]) {
      return {
        name: docMetadataName,
        comp: input.compositions[docMetadataName],
      };
    }
    for (const [currentName, comp] of Object.entries(input.compositions)) {
      if (comp.originalName === docMetadataName) {
        return { name: currentName, comp };
      }
    }
    return null;
  };

  for (const [, docs] of docsByFile) {
    for (const doc of docs) {
      const kind = docKind(doc);
      const name = docName(doc);
      if (kind === 'Composition' && name) {
        const match = findCompositionInput(name);
        if (match) {
          if (match.name !== name) {
            doc.setIn(['metadata', 'name'], match.name);
          }
          replaceCompositionResources(doc, match.comp);
        }
      } else if (kind === 'Configuration') {
        replaceConfigurationDependsOn(doc, input.providers, input.functions);
      } else if (kind === 'CompositeResourceDefinition') {
        const merged = connectorsByXrdDoc.get(doc);
        if (merged) replaceXrdSchema(doc, [...merged.values()]);
      }
    }
  }

  const output: Record<string, string> = {};
  for (const [name, docs] of docsByFile) {
    const parts: string[] = [];
    for (const doc of docs) {
      const text = doc.toString(STRINGIFY_OPTIONS).replace(/^\s+|\s+$/g, '');
      if (text.length > 0) parts.push(text);
    }
    output[name] = parts.join('\n---\n') + '\n';
  }

  const handledCompositions = new Set<string>();
  for (const [, docs] of docsByFile) {
    for (const doc of docs) {
      if (docKind(doc) === 'Composition') {
        const name = docName(doc);
        if (name) handledCompositions.add(name);
      }
    }
  }

  for (const [name, comp] of Object.entries(input.compositions)) {
    if (handledCompositions.has(name)) continue;
    const targetFile = knownCompositionFile(name);
    const fresh = buildNewCompositionDoc(name, comp).trim();
    if (!fresh) continue;
    const existing = output[targetFile] ?? '';
    output[targetFile] = existing
      ? `${existing.replace(/\n+$/, '')}\n---\n${fresh}\n`
      : `${fresh}\n`;
  }

  for (const [name, comp] of Object.entries(input.compositions)) {
    if (!comp.compositeTypeRef) continue;
    const ref = `${comp.compositeTypeRef.apiVersion}|${comp.compositeTypeRef.kind}`;
    if (xrdsByRef.has(ref)) continue;
    const targetFile = `${sanitizeFilename(name)}-xrd.yaml`;
    const fresh = buildNewXrdDoc(comp.compositeTypeRef, comp.connectors).trim();
    if (!fresh) continue;
    const existing = output[targetFile] ?? '';
    output[targetFile] = existing
      ? `${existing.replace(/\n+$/, '')}\n---\n${fresh}\n`
      : `${fresh}\n`;
  }

  return output;
};
