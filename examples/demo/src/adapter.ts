import {
  crossplaneCoreBlockTypes,
  isCrossplaneCoreUrl,
  type BlockType,
  type ConfigurationDB,
  type CrossplaneProviderDB,
  type EditorDataAdapter,
} from '@overlock-studio/composer';

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
    version: d.version.replace(/^[>=<~^ ]+/, '') || undefined,
  }));

const configuration: ConfigurationDB = {
  _id: 'composer',
  name: 'demo-configuration',
  providers: providers.map((p) => p._id),
  functions: [],
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

export const demoAdapter: EditorDataAdapter = {
  getBlocks: async () => [],
  updateBlocks: async () => true,
  getBlockTypes: async (url) => {
    if (isCrossplaneCoreUrl(url)) {
      return crossplaneCoreBlockTypes;
    }
    try {
      return await fetchFromServer(url);
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
  getConfigurationData: async () => ({
    compositions: [],
    xrdBlockType: [],
    providerUrls: providers.map((p) =>
      p.version ? `${p.url}:${p.version}` : p.url,
    ),
    functionUrls: [],
  }),
  createConfiguration: async () => configuration._id,
  updateConfiguration: async () => undefined,
  createProvidersFromUrls: async (urls) => urls,
  createFunctionsFromUrls: async (urls) => urls,
};
