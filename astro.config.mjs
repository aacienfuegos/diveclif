import { defineConfig, envField } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://diveclif.es',
  integrations: [sitemap()],
  build: {
    // CSP sin 'unsafe-inline': todo el CSS y JS sale como fichero
    inlineStylesheets: 'never',
  },
  vite: {
    build: { assetsInlineLimit: 0 },
  },
  env: {
    schema: {
      CF_PAGES_BRANCH: envField.string({ context: 'server', access: 'public', optional: true }),
      PUBLIC_TURNSTILE_SITE_KEY: envField.string({
        context: 'client',
        access: 'public',
        // clave de pruebas de Cloudflare: siempre valida
        default: '1x00000000000000000000AA',
      }),
    },
  },
});
