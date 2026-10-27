// Enlace a la vista previa de Cloudflare Pages de un commit, con un token de solo lectura.
import type { Env } from './entorno';

interface Despliegue {
  url?: string;
  deployment_trigger?: { metadata?: { commit_hash?: string } };
}

export async function vistaPrevia(env: Env, sha: string): Promise<string | null> {
  try {
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.PAGES_CUENTA)}/pages/projects/${encodeURIComponent(env.PAGES_PROYECTO)}/deployments`,
      { headers: { Authorization: `Bearer ${env.PAGES_TOKEN}` } },
    );
    if (!r.ok) return null;
    const { result } = await r.json<{ result?: Despliegue[] }>();
    const d = (result ?? []).find((x) => x.deployment_trigger?.metadata?.commit_hash === sha);
    if (d?.url === undefined) return null;
    const url = new URL(d.url);
    return url.protocol === 'https:' && url.hostname.endsWith('.pages.dev') ? url.href : null;
  } catch {
    return null;
  }
}
