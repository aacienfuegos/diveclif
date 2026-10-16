import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const sustituto = fileURLToPath(new URL('./test/cloudflare.ts', import.meta.url));

export default defineConfig({
  plugins: [
    // wrangler carga los .txt como texto; aquí se hace lo mismo para los tests.
    {
      name: 'texto',
      transform(codigo, id) {
        return id.endsWith('.txt') ? { code: `export default ${JSON.stringify(codigo)};`, map: null } : null;
      },
    },
  ],
  resolve: { alias: { 'cloudflare:workers': sustituto, 'cloudflare:email': sustituto } },
  test: {
    include: ['test/**/*.test.ts'],
    server: { deps: { inline: ['agents'] } },
  },
});
