import * as yaml from 'js-yaml';
import type { BlockType } from '../api/types';
import type { JSONSchemaProps } from './jsonSchema';
import crossplaneIcon from '../assets/crossplane-icon.svg';

export const CROSSPLANE_CORE_URL = 'xpkg.crossplane/crossplane/crossplane';

export const isCrossplaneCoreUrl = (url: string): boolean =>
  url === CROSSPLANE_CORE_URL ||
  url.startsWith(`${CROSSPLANE_CORE_URL}:`) ||
  url.startsWith(`${CROSSPLANE_CORE_URL}@`);

export const CROSSPLANE_XRD_KIND = 'CompositeResourceDefinition';

export type ParsedXrd = {
  name?: string;
  schema: JSONSchemaProps;
};

export const parseXrdYaml = (source: string): ParsedXrd => {
  const doc = yaml.load(source) as
    | {
        kind?: string;
        apiVersion?: string;
        metadata?: { name?: string };
        spec?: {
          versions?: Array<{
            name?: string;
            referenceable?: boolean;
            schema?: { openAPIV3Schema?: JSONSchemaProps };
          }>;
          names?: { kind?: string };
        };
      }
    | undefined;

  if (!doc || typeof doc !== 'object') {
    throw new Error('Invalid YAML document');
  }
  if (doc.kind !== CROSSPLANE_XRD_KIND) {
    throw new Error(`Expected kind ${CROSSPLANE_XRD_KIND}, got ${doc.kind}`);
  }

  const versions = doc.spec?.versions ?? [];
  const preferred =
    versions.find((v) => v.referenceable) ?? versions[0];
  const schema = preferred?.schema?.openAPIV3Schema;
  if (!schema) {
    throw new Error('XRD is missing spec.versions[].schema.openAPIV3Schema');
  }

  return {
    name: doc.spec?.names?.kind ?? doc.metadata?.name,
    schema,
  };
};

export const crossplaneCoreBlockTypes: BlockType[] = [
  {
    id: 'crossplane-core:Composition',
    name: 'apiextensions.crossplane.io/v1.Composition',
    apiVersion: 'apiextensions.crossplane.io/v1',
    kind: 'Composition',
    leaf: false,
    title: 'Composition',
    description:
      'A Crossplane Composition defines how composite resources are built from managed resources.',
    icon: crossplaneIcon,
    schema: {
      properties: {
        spec: { type: 'object' },
        status: { type: 'object' },
        metadata: { type: 'object' },
      },
    },
  },
  {
    id: 'crossplane-core:CompositeResourceDefinition',
    name: `apiextensions.crossplane.io/v1.${CROSSPLANE_XRD_KIND}`,
    apiVersion: 'apiextensions.crossplane.io/v1',
    kind: CROSSPLANE_XRD_KIND,
    leaf: false,
    title: 'CompositeResourceDefinition',
    description:
      'A Crossplane CompositeResourceDefinition (XRD) declares the schema of a composite resource. Other blocks connect to its right-side handles.',
    icon: crossplaneIcon,
    schema: {
      properties: {
        spec: { type: 'object' },
        status: { type: 'object' },
        metadata: { type: 'object' },
      },
    },
  },
];
