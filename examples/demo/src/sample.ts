import {
  parseCrossplaneDependencies,
  type PackageDependency,
} from '@overlock-studio/composer';

import crossplaneYaml from './samples/crossplane.yaml?raw';

// Providers the sidebar lists. The configuration itself comes from the dev
// server's blocks store, seeded with samples/blocks.json.
export const sampleDependencies: PackageDependency[] =
  parseCrossplaneDependencies(crossplaneYaml);
