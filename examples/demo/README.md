# composer-demo

Tiny Vite + React app for poking at `@overlock-studio/composer` without a host.
It's a Yarn workspace under the parent repo and imports the library directly
from `../../src`, so edits to the library hot-reload.

## Run

From the repo root:

```bash
yarn install   # installs the workspace, hoists everything to ./node_modules
yarn demo      # vite dev server, opens http://localhost:5173
yarn demo:build
```

Or from inside this folder:

```bash
yarn dev
yarn build
```

## What it does

- Loads a minimal Crossplane bundle (`crossplane.yaml` + XRD + one Composition with a `nop` managed resource).
- Mounts `<ComposerEditor />` with a stubbed `EditorDataAdapter`.
- Captures the `onSave` payload and renders it in a side panel for inspection.
- A header button calls the imperative `editorRef.current?.save()` to exercise the ref handle.

## Editing the library

Source resolution goes through Vite aliases in `vite.config.ts`:

| Import                                          | Resolves to                          |
| ----------------------------------------------- | ------------------------------------ |
| `@overlock-studio/composer`                     | `../../src/index.ts`                 |
| `@overlock-studio/composer/styles/editor.css`   | `../../src/styles/editor.css`        |

So any change in `composer/src/**` triggers HMR in the demo.

## Tailwind

The library ships utility classes. Tailwind is configured locally
(`tailwind.config.ts`) to scan both demo and library sources, and
`src/index.css` defines the shadcn-style HSL CSS variables the library expects.
