export type ConfigurationDB = {
  _id: string;
  name: string;
  providers: string[];
  functions: string[];
  deployId: bigint | null;
};

export type EnvironmentDB = {
  _id: string;
  name: string;
  deployId: bigint | null;
  provider: bigint;
};

export type TemplateDB = {
  _id: string;
  title: string;
  description: string;
  imagePath: string;
  uri: string;
  blocks?: unknown[];
  providers?: string[];
};

export type CrossplaneProviderDB = {
  _id: string;
  title: string;
  description: string;
  icon: string;
  family: string;
  url: string;
  version?: string;
  familyName?: string;
};

export type ProviderFamilyDB = {
  _id: string;
  name: string;
};

export type CrossplaneFunctionDB = {
  _id: string;
  title: string;
  description: string;
  url: string;
  version?: string;
};
