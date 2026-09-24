import type { APIRoute } from 'astro';
import { CF_PAGES_BRANCH } from 'astro:env/server';

export const GET: APIRoute = ({ site }) => {
  const cuerpo = CF_PAGES_BRANCH === 'main'
    ? `User-agent: *\nAllow: /\n\nSitemap: ${new URL('sitemap-index.xml', site)}\n`
    : 'User-agent: *\nDisallow: /\n';
  return new Response(cuerpo, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
