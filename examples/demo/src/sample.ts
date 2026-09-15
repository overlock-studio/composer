import {
  parseCrossplaneDependencies,
  type CrossplaneFile,
  type LayoutByComposition,
  type PackageDependency,
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

export const sampleDependencies: PackageDependency[] =
  parseCrossplaneDependencies(crossplaneYaml);
