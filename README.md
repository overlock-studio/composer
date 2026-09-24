# @overlock-studio/composer

Visual editor library for Crossplane configurations. Node-based canvas with parsers and serializers for YAML round-trip.

## Install

```bash
yarn add @overlock-studio/composer
```

Peer dependencies: `react`, `react-dom`.

## Use

The simplest way to embed the editor is the `ComposerEditor` component. It owns the canvas, sidebar and save action — feed it blocks plus an adapter, and a save hands back blocks in the same format, which restore the same editor when passed back in.

```tsx
import { useRef } from 'react';
import {
  ComposerEditor,
  type Block,
  type ComposerEditorHandle,
  type ComposerSavePayload,
  type EditorDataAdapter,
} from '@overlock-studio/composer';
import '@overlock-studio/composer/styles/editor.css';

function Editor({
  blocks,
  adapter,
}: {
  blocks: Block[];
  adapter: EditorDataAdapter;
}) {
  const ref = useRef<ComposerEditorHandle>(null);

  const handleSave = (payload: ComposerSavePayload) => {
    // payload.blocks: the whole configuration as one flat list of generic
    //   blocks (id, parentId, type, position in the parent's space, size,
    //   connectors, edges, data). Types: composition, connectors (its Spec and
    //   Status panels), function (a pipeline step, chained to the next by an
    //   edge) and resource (child of the function composing it, patches as
    //   edges). Store them as they are and pass them back as `blocks` to
    //   restore the same editor.
  };

  return (
    <ComposerEditor
      ref={ref}
      blocks={blocks}
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

## Demo app

A tiny Vite playground lives in [`examples/demo`](./examples/demo). It mounts
`<ComposerEditor />` against a stub adapter with a minimal XRD + Composition so
you can drive the UI end-to-end without a host application. It's wired up as a
Yarn workspace, so `yarn install` at the repo root sets it up alongside the
library.

```bash
yarn install        # installs the library + demo workspace
yarn demo           # starts the Vite dev server
yarn demo:build     # production build of the demo
```

The demo imports the library straight from `../../src`, so editing files under
`src/` hot-reloads inside the demo.

## License

MIT
