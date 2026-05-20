import type { BlockType } from '../api/types';
import crossplaneIcon from '../assets/crossplane-icon.svg';

export const CROSSPLANE_CORE_URL = 'xpkg.crossplane/crossplane/crossplane';

export const isCrossplaneCoreUrl = (url: string): boolean =>
  url === CROSSPLANE_CORE_URL ||
  url.startsWith(`${CROSSPLANE_CORE_URL}:`) ||
  url.startsWith(`${CROSSPLANE_CORE_URL}@`);

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
];
