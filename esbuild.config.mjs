import * as esbuild from 'esbuild';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const watch = process.argv.includes('--watch');
const dev = process.argv.includes('--dev') || watch;

const srcRoot = path.resolve(__dirname, 'src');
const exts = ['.ts', '.tsx', '.js', '.jsx', '.css'];

function resolveAlias(rel) {
  const base = rel ? path.join(srcRoot, rel) : srcRoot;
  for (const ext of exts) {
    const candidate = base + ext;
    if (fs.existsSync(candidate)) return candidate;
  }
  if (fs.existsSync(base) && fs.statSync(base).isDirectory()) {
    for (const ext of exts) {
      const candidate = path.join(base, 'index' + ext);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

const aliasPlugin = {
  name: 'composer-alias',
  setup(build) {
    build.onResolve({ filter: /^@\// }, (args) => {
      const resolved = resolveAlias(args.path.slice(2));
      return resolved ? { path: resolved } : null;
    });
  },
};

const pkg = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'),
);
const external = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
  'node:*',
];

const common = {
  bundle: true,
  sourcemap: true,
  minify: !dev,
  logLevel: 'info',
  target: 'es2022',
  jsx: 'automatic',
  platform: 'neutral',
  external,
  plugins: [aliasPlugin],
  loader: { '.css': 'copy' },
  resolveExtensions: ['.tsx', '.ts', '.jsx', '.js', '.css'],
};

const entries = [
  { in: 'src/index.ts', out: 'dist/index' },
  { in: 'src/lib/parser.ts', out: 'dist/lib/parser' },
  { in: 'src/oci/client.ts', out: 'dist/oci/client' },
];

const buildOne = (entry, format) =>
  esbuild.build({
    ...common,
    entryPoints: [path.join(__dirname, entry.in)],
    outfile: path.join(
      __dirname,
      `${entry.out}${format === 'esm' ? '.js' : '.cjs'}`,
    ),
    format,
  });

const copyCss = () => {
  const srcCss = path.join(__dirname, 'src/styles/editor.css');
  const destDir = path.join(__dirname, 'dist/styles');
  if (!fs.existsSync(srcCss)) return;
  fs.mkdirSync(destDir, { recursive: true });
  fs.copyFileSync(srcCss, path.join(destDir, 'editor.css'));
};

if (watch) {
  const ctxs = [];
  for (const entry of entries) {
    for (const format of ['esm', 'cjs']) {
      const ctx = await esbuild.context({
        ...common,
        entryPoints: [path.join(__dirname, entry.in)],
        outfile: path.join(
          __dirname,
          `${entry.out}${format === 'esm' ? '.js' : '.cjs'}`,
        ),
        format,
      });
      ctxs.push(ctx);
    }
  }
  copyCss();
  await Promise.all(ctxs.map((c) => c.watch()));
  console.log('watching...');
} else {
  await Promise.all(
    entries.flatMap((entry) =>
      ['esm', 'cjs'].map((format) => buildOne(entry, format)),
    ),
  );
  copyCss();
}
