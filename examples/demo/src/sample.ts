import type {
  CrossplaneFile,
  LayoutByComposition,
} from '@overlock-studio/composer';

import crossplaneYaml from './samples/crossplane.yaml?raw';
import xrdYaml from './samples/xrd.yaml?raw';
import compositionYaml from './samples/composition.yaml?raw';
import layoutJson from './samples/layout.json';

export const sampleFiles: CrossplaneFile[] = [
  { name: 'crossplane.yaml', content: crossplaneYaml },
  { name: 'xrd.yaml', content: xrdYaml },
  { name: 'composition.yaml', content: compositionYaml },
];

export const sampleLayout: LayoutByComposition =
  layoutJson as LayoutByComposition;

export const sampleHashes: Record<string, string> = {
  'crossplane.yaml': 'h-crossplane-1',
  'xrd.yaml': 'h-xrd-1',
  'composition.yaml': 'h-composition-1',
};
