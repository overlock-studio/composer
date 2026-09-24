import {
  crossplaneCoreBlockTypes,
  isCrossplaneCoreUrl,
  type BlockType,
  type ConfigurationDB,
  type CrossplaneFunctionDB,
  type CrossplaneProviderDB,
  type EditorDataAdapter,
} from '@overlock-studio/composer';

import { packageRef, packageVersion } from './packageRef';
import { sampleDependencies } from './sample';

const providers: CrossplaneProviderDB[] = sampleDependencies
  .filter((d) => d.kind === 'provider')
  .map((d, idx) => ({
    _id: `${idx + 1}`,
    title: d.package.split('/').pop() ?? d.package,
    description: `Demo provider entry parsed from crossplane.yaml (${d.package})`,
    icon: '',
    family: d.package.split('/').slice(-2, -1)[0] ?? 'provider',
    familyName: d.package.split('/').slice(-2, -1)[0] ?? undefined,
    url: d.package,
    version: packageVersion(d.version),
  }));

const functions: CrossplaneFunctionDB[] = sampleDependencies
  .filter((d) => d.kind === 'function')
  .map((d, idx) => ({
    _id: `fn-${idx + 1}`,
    title: d.package.split('/').pop() ?? d.package,
    description: `Demo function entry parsed from crossplane.yaml (${d.package})`,
    url: d.package,
    version: packageVersion(d.version),
  }));

const configuration: ConfigurationDB = {
  _id: 'composer',
  name: 'demo-configuration',
  providers: providers.map((p) => p._id),
  functions: functions.map((f) => f._id),
  deployId: null,
};

const fetchFromServer = async (url: string): Promise<BlockType[]> => {
  const res = await fetch(
    `/api/blocktypes?url=${encodeURIComponent(url)}`,
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `/api/blocktypes ${res.status}: ${body || res.statusText}`,
    );
  }
  return (await res.json()) as BlockType[];
};

// A build has no dev server to pull packages through, so it carries the block
// types of the sample providers as files, listed by package in index.json.
const buildFile = (file: string): Promise<Response> =>
  fetch(`${import.meta.env.BASE_URL}${file}`);

let buildIndex: Promise<Record<string, string>> | undefined;

const fetchFromBuild = async (url: string): Promise<BlockType[]> => {
  buildIndex ??= buildFile('blocktypes/index.json').then(
    (res) => res.json() as Promise<Record<string, string>>,
  );
  const file = (await buildIndex)[url];
  if (!file) {
    throw new Error(`not among the providers built into the demo`);
  }
  return (await (await buildFile(file)).json()) as BlockType[];
};

const fetchBlockTypes = import.meta.env.DEV ? fetchFromServer : fetchFromBuild;

export const demoAdapter: EditorDataAdapter = {
  getBlocks: async () => [],
  updateBlocks: async () => true,
  getBlockTypes: async (url) => {
    if (isCrossplaneCoreUrl(url)) {
      return crossplaneCoreBlockTypes;
    }
    try {
      return await fetchBlockTypes(url);
    } catch (err) {
      console.warn(`[composer-demo] getBlockTypes(${url}) failed:`, err);
      return [];
    }
  },
  getConfiguration: async (id) =>
    id === configuration._id ? configuration : null,
  getTemplate: async () => null,
  listCrossplaneProviders: async () => ({
    crossplaneProviders: providers,
    totalCount: providers.length,
  }),
  listCrossplaneFunctions: async () => ({
    crossplaneFunctions: functions,
    totalCount: functions.length,
  }),
  getConfigurationData: async () => ({
    compositions: [],
    xrdBlockType: [],
    providerUrls: providers.map((p) => packageRef(p.url, p.version)),
    functionUrls: [],
  }),
  createConfiguration: async () => configuration._id,
  updateConfiguration: async () => undefined,
  createProvidersFromUrls: async (urls) => urls,
  createFunctionsFromUrls: async (urls) => urls,
};
