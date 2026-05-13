# @overlock-studio/composer

Visual editor library for Crossplane configurations. Node-based canvas with parsers and serializers for YAML round-trip.

## Install

```bash
yarn add @overlock-studio/composer
```

Peer dependencies: `react`, `react-dom`.

## Use

```ts
import {
  EditorArea,
  EditorAreaProvider,
  parseCrossplaneConfigurationFromFiles,
  serializeCrossplaneFiles,
} from '@overlock-studio/composer';
import '@overlock-studio/composer/styles/editor.css';
```

The library uses Tailwind utility classes in its components. If your consuming app uses Tailwind, add the package source to the Tailwind `content` array:

```ts
// tailwind.config.ts
export default {
  content: [
    './src/**/*.{ts,tsx}',
    './node_modules/@overlock-studio/composer/dist/**/*.{js,cjs}',
  ],
  // ...
};
```

## Develop

```bash
yarn install
yarn build      # one-off build (esbuild + tsc)
yarn watch      # rebuild on change
yarn typecheck  # type-only check
```

Outputs land in `dist/`: ESM (`.js`), CJS (`.cjs`), declarations (`.d.ts`), and the editor stylesheet.

## License

MIT
