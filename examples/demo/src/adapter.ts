import type { EditorDataAdapter } from '@overlock-studio/composer';

export const demoAdapter: EditorDataAdapter = {
  getBlocks: async () => [],
  updateBlocks: async () => true,
  getBlockTypes: async () => [],
  getConfiguration: async () => null,
  getTemplate: async () => null,
  listCrossplaneProviders: async () => ({
    crossplaneProviders: [],
    totalCount: 0,
  }),
  getConfigurationData: async () => ({
    compositions: [],
    xrdBlockType: [],
    providerUrls: [],
    functionUrls: [],
  }),
  createConfiguration: async () => 'demo-configuration-id',
  updateConfiguration: async () => undefined,
  createProvidersFromUrls: async (urls) => urls,
  createFunctionsFromUrls: async (urls) => urls,
};
