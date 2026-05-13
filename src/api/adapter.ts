import {
  Block,
  BlockType,
  ConfigurationData,
  ConfigurationImportData,
} from './types';
import {
  ConfigurationDB,
  CrossplaneProviderDB,
  TemplateDB,
} from './typesDB';

export type EditorDataAdapter = {
  getBlocks: (params: {
    configurationId?: string;
    importData?: ConfigurationImportData;
  }) => Promise<Block[]>;

  updateBlocks: (
    configurationId: string,
    blocks: Block[],
  ) => Promise<boolean | null>;

  getBlockTypes: (url: string) => Promise<BlockType[]>;

  getConfiguration: (id: string) => Promise<ConfigurationDB | null>;

  getTemplate: (id: string) => Promise<TemplateDB | null>;

  listCrossplaneProviders: () => Promise<{
    crossplaneProviders: CrossplaneProviderDB[];
    totalCount: number;
  }>;

  getConfigurationData: (
    importData: ConfigurationImportData,
  ) => Promise<ConfigurationData>;

  createConfiguration: (name: string) => Promise<string>;

  updateConfiguration: (params: {
    id: string;
    name: string;
    providers?: string[];
    functions?: string[];
    deployId?: bigint;
  }) => Promise<void>;

  createProvidersFromUrls: (providerUrls: string[]) => Promise<string[]>;

  createFunctionsFromUrls: (functionUrls: string[]) => Promise<string[]>;
};

export type EditorEntityRef = {
  entity: 'configuration' | 'template' | null;
  entityId: string | null;
};
