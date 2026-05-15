import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

const composerSrc = path.resolve(__dirname, '../../src');

// Server-side OCI fetch endpoint. The library's fetchBlockTypes uses Node
// modules (zlib, tar-stream), so it can't run in the browser. We expose it
// here as /api/blocktypes?url=... so the demo's adapter can hit it.
function blocksApi(): Plugin {
  return {
    name: 'composer-demo-blocks-api',
    configureServer(server) {
      server.middlewares.use('/api/blocktypes', async (req, res) => {
        const url = new URL(req.url ?? '', 'http://localhost');
        const image = url.searchParams.get('url');
        if (!image) {
          res.statusCode = 400;
          res.end(JSON.stringify({ error: 'missing url query param' }));
          return;
        }
        try {
          const { fetchBlockTypes } = await server.ssrLoadModule(
            path.join(composerSrc, 'oci/client.ts'),
          );
          const blockTypes = await fetchBlockTypes(image);
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify(blockTypes));
        } catch (err) {
          console.error('[composer-demo] /api/blocktypes failed', err);
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [blocksApi(), react()],
  resolve: {
    alias: {
      '@overlock-studio/composer/styles/editor.css': path.join(
        composerSrc,
        'styles/editor.css',
      ),
      '@overlock-studio/composer/lib/parser': path.join(
        composerSrc,
        'lib/parser.ts',
      ),
      '@overlock-studio/composer': path.join(composerSrc, 'index.ts'),
      '@': composerSrc,
    },
    dedupe: ['react', 'react-dom', '@xyflow/react'],
  },
  server: {
    port: 5173,
    open: true,
  },
});
