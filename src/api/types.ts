import { JSONSchemaProps } from '../lib/jsonSchema';
export interface Spec {
  type?: string;
  owner?: string;
  compositeTypeRef?: {
    apiVersion: string;
    kind: string;
  };
  mode?: string;
  pipeline?: Pipeline[];
  resources?: Resource[];
}

export type Block = {
  id: string;
  parentId: string;
  name?: string;
  position?: { x: number; y: number };
  size?: { width: number; height: number };
  edges: Edge[];
  blockType: BlockType | undefined;
  connectors: Connector[];
  functions?: Pipeline[];
};

export type Edge = {
  source: string;
  sourceHandle: string | undefined;
  target: string;
  targetHandle: string | undefined;
  transformers?: Transformer[];
  data?: unknown;
};

export type SchemaData = {
  apiVersion: string;
  kind: string;
};

export type Pipeline = {
  step: string;
  functionRef: object;
  input: SchemaData & { resources: Resource[] };
};

export type Transformer =
  | { type: 'map'; map: Record<string, string> }
  | { type: 'string'; string: StringTransform }
  | { type: 'math'; math: MathTransform }
  | { type: 'match'; match: MatchTransform }
  | { type: 'convert'; convert: ConvertTransform };

export type StringTransform =
  | { type: 'Convert'; convert: 'ToUpper' | 'ToLower' }
  | { type: 'Format'; fmt: string }
  | { type: 'Join'; join: { separator: string } }
  | { type: 'Regexp'; regexp: { match: string; group: number } }
  | { type: 'TrimPrefix'; trim: string }
  | { type: 'TrimSuffix'; trim: string };

export type MathTransform =
  | { type: 'clampMin'; clampMin: number }
  | { type: 'clampMax'; clampMax: number }
  | { type: 'multiply'; multiply: number };

export type MatchTransform = {
  patterns: Array<
    | { type: 'literal'; literal: string; result: string }
    | { type: 'regexp'; regexp: string; result: string }
  >;
  fallbackTo?: 'Value' | 'Input';
  fallbackValue?: string;
};

export type ConvertTransform = {
  toType: 'bool' | 'float64' | 'int' | 'int64' | 'string' | 'object' | 'array';
  format?: 'json' | 'quantity';
};

type CombineStrategy =
  | { strategy: 'string'; string: { fmt: string } }
  | { strategy: 'array'; array: { separator: string } };

export type Patch = {
  type:
    | 'FromCompositeFieldPath'
    | 'ToCompositeFieldPath'
    | 'CombineFromComposite'
    | 'CombineToComposite'
    | 'FromEnvironmentFieldPath'
    | 'ToEnvironmentFieldPath'
    | 'CombineFromEnvironment'
    | 'CombineToEnvironment';
  fromFieldPath?: string;
  toFieldPath?: string;
  combine?: {
    variables: { fromFieldPath: string }[];
  } & CombineStrategy;
  transforms?: Transformer[];
  policy?: {
    fromFieldPath?: 'Required';
    toFieldPath?: 'MergeObjectsAppendArrays';
  };
};

export type Resource = {
  name: string;
  base: {
    apiVersion: string;
    kind: string;
    spec?: {
      forProvider: Record<string, object>;
    };
  };
  patches?: Patch[];
};

export type Configuration = {
  id: bigint;
  metadata: {
    name: string;
    annotations?: Record<string, string>;
  };
  spec?: {
    crossplane?: {
      version: string;
    };
    compositions: bigint[];
    xrds: bigint[];
    functions: bigint[];
    providers: bigint[];
    configurations: bigint[];
  };
};

export interface Composition {
  metadata: {
    name: string;
    annotations?: Record<string, string>;
    namespace?: string;
    description?: string;
    uid?: string;
    etag?: string;
  };
  spec?: Spec;
}

export interface XRD {
  metadata: {
    name: string;
  };
  spec: {
    group: string;
    names?: {
      kind: string;
      plural: string;
    };
    versions: {
      name: string;
      schema?: {
        openAPIV3Schema?: Record<string, unknown>;
      };
    }[];
  };
}

export type BlockType = {
  name: string;
  id: string;
  schema: {
    properties: {
      spec: JSONSchemaProps;
      status: JSONSchemaProps;
      metadata: JSONSchemaProps;
    };
  };
  leaf: boolean;
  kind: string;
  apiVersion: string;
  title?: string;
  description?: string;
  icon?: string;
};

export type ManifestResponse = {
  layers?: Layer[];
  manifests?: Manifest[];
};

export type Manifest = {
  platform: {
    architecture?: string;
  };
  digest: string;
};

export type Layer = {
  digest: string;
};

export type ConfigurationData = {
  compositions: Composition[];
  xrdBlockType: BlockType[];
  providerUrls: string[];
  functionUrls: string[];
  configurationName?: string;
};

export type ConfigurationImportData = {
  packageUrl: string;
  username?: string;
  password?: string;
};

export type AgentRequestData = {
  query: string;
  providerUrls?: string[];
};

export type Connector = {
  connection: 'input' | 'output';
  path: string;
  type: string;
  required: boolean;
  description: string;
};

export type Schema = {
  properties: {
    spec: JSONSchemaProps;
    status: JSONSchemaProps;
    metadata: JSONSchemaProps;
  };
};
