# @overlock-studio/composer

Visual editor library for Crossplane configurations. Node-based canvas with parsers and serializers for YAML round-trip.

## Install

```bash
yarn add @overlock-studio/composer
```

Peer dependencies: `react`, `react-dom`.

## Use

The simplest way to embed the editor is the `ComposerEditor` component. It owns the canvas, sidebar, save action, and YAML round-trip — feed it Crossplane files plus an adapter and it returns a save payload.

```tsx
import { useRef } from 'react';
import {
  ComposerEditor,
  type ComposerEditorHandle,
  type ComposerSavePayload,
  type EditorDataAdapter,
  type CrossplaneFile,
  type LayoutByComposition,
} from '@overlock-studio/composer';
import '@overlock-studio/composer/styles/editor.css';

function Editor({
  files,
  layout,
  hashes,
  adapter,
}: {
  files: CrossplaneFile[];
  layout: LayoutByComposition;
  hashes: Record<string, string>;
  adapter: EditorDataAdapter;
}) {
  const ref = useRef<ComposerEditorHandle>(null);

  const handleSave = (payload: ComposerSavePayload) => {
    // payload.files: only files whose content changed
    // payload.hashes: pass-through for optimistic-locking checks
    // payload.layout: positions to persist alongside the YAML
  };

  return (
    <ComposerEditor
      ref={ref}
      files={files}
      crossplaneFile="crossplane.yaml"
      hashes={hashes}
      layout={layout}
      adapter={adapter}
      onSave={handleSave}
    />
  );
}
```

The component exposes an imperative `save()` via its ref for hosts that want to trigger saves from outside the editor chrome (e.g. a parent toolbar or keyboard shortcut).

### Lower-level building blocks

If you need finer control, the underlying pieces are still exported and can be composed directly:

```ts
import {
  EditorArea,
  EditorAreaProvider,
  EditorAreaSidebar,
  parseCrossplaneConfigurationFromFiles,
  serializeCrossplaneFiles,
} from '@overlock-studio/composer';
```

The library uses Tailwind utility classes in its components. If your consuming app uses Tailwind, add the package source to the Tailwind `content` array:

```ts
// tailwind.config.ts
export default {
  content: [
    './src/**/*.{ts,tsx}',
    './node_modules/@overlock-studio/composer/src/**/*.{ts,tsx}',
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
