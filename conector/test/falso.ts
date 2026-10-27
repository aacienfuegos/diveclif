// GitHub, Resend y la API de Pages falsos, en memoria, para los tests del Worker.
import { exportPKCS8, generateKeyPair } from 'jose';
import config from '../../.github/cambio-pequeno/config.json';

export const MALDIVAS = `---
titulo: "Maldivas"
destino: "Atolones centrales, Maldivas"
tipo: "internacional"
inicio: "2027-03-08"
fin: "2027-03-18"
formato: "vida-a-bordo"
nivel: "advanced"
inmersionesMinimas: 50
inmersiones: 18
agua: {"temperatura": "28 °C", "traje": "3 mm"}
precioDesde: 2950
organiza: "Te Moana Expeditions"
fauna: ["Mantas", "Tiburones grises", "Tiburón ballena"]
resumen: "Vida a bordo por los atolones centrales: canales con corriente, mantas y tiburones."
---

Once días de vida a bordo entrando y saliendo de los canales de los atolones.
`;

export const TOKEN_INSTALACION = 'ghs_token_de_instalacion_de_prueba';

export interface PrFalso {
  number: number;
  state: 'open' | 'closed';
  merged: boolean;
  head: { sha: string; ref: string; repo: { full_name: string } };
  user: { login: string };
  title: string;
  body: string;
  created_at: string;
}

export interface RunFalso {
  id: number;
  path: string;
  event: string;
  status: string;
  conclusion: string | null;
  head_sha: string;
  head_repository: { full_name: string };
  pull_requests: { number: number }[];
  created_at: string;
}

let contadorSha = 0;
const nuevoSha = () => (++contadorSha).toString(16).padStart(40, '0');

async function hashBlob(texto: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(texto));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function b64(texto: string): string {
  let s = '';
  for (const b of new TextEncoder().encode(texto)) s += String.fromCharCode(b);
  return btoa(s);
}

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

export class Falso {
  readonly repo = 'aacienfuegos/diveclif';
  ramas = new Map<string, string>();
  commits = new Map<string, Map<string, string>>();
  pulls = new Map<number, PrFalso>();
  runs: RunFalso[] = [];
  artefactos = new Map<number, { nombre: string; zip: Uint8Array }[]>();
  comentarios: { pr: number; body: string }[] = [];
  merges: { pr: number; sha: string }[] = [];
  correos: Record<string, unknown>[] = [];
  despliegues: { url: string; deployment_trigger: { metadata: { commit_hash: string } } }[] = [];
  /** Peticiones a api.github.com, como "MÉTODO /ruta". */
  llamadas: string[] = [];
  /** Si se pone, la siguiente escritura de contenidos falla con este estado. */
  fallarEscritura: number | null = null;
  /** Si se pone, los comentarios en PR fallan con este estado. */
  fallarComentario: number | null = null;
  /** Si se pone, Resend falla con este estado. */
  fallarCorreo: number | null = null;
  private siguientePr = 1;

  constructor(ficheros: Record<string, string> = { 'src/content/viajes/maldivas-mar-2027.md': MALDIVAS }) {
    const sha = nuevoSha();
    this.commits.set(sha, new Map(Object.entries(ficheros)));
    this.ramas.set('main', sha);
  }

  ficheros(ref: string): Map<string, string> | undefined {
    const sha = this.ramas.get(ref) ?? ref;
    return this.commits.get(sha);
  }

  /** Simula un push de otra persona a una rama. */
  empujar(rama: string, ruta: string, contenido: string): string {
    const base = this.ficheros(rama) ?? new Map();
    const sha = nuevoSha();
    this.commits.set(sha, new Map([...base, [ruta, contenido]]));
    this.ramas.set(rama, sha);
    for (const pr of this.pulls.values()) if (pr.head.ref === rama) pr.head.sha = sha;
    return sha;
  }

  fetch = async (entrada: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const req = new Request(entrada, init);
    const url = new URL(req.url);
    if (url.hostname === 'api.resend.com') {
      if (this.fallarCorreo !== null) return json({ message: 'falla' }, this.fallarCorreo);
      this.correos.push((await req.json()) as Record<string, unknown>);
      return json({ id: `correo-${this.correos.length}` });
    }
    if (url.hostname === 'api.cloudflare.com') return json({ success: true, result: this.despliegues });
    if (url.hostname === 'blob.prueba.test') {
      const id = Number(url.pathname.slice(1));
      const a = [...this.artefactos.values()].flat().find((_, i) => i + 1 === id);
      return a === undefined ? new Response('', { status: 404 }) : new Response(a.zip);
    }
    if (url.hostname !== 'api.github.com') throw new Error(`fetch inesperado a ${url.hostname}`);
    this.llamadas.push(`${req.method} ${url.pathname}`);
    return this.github(req, url);
  };

  private async github(req: Request, url: URL): Promise<Response> {
    const ruta = url.pathname;
    const auth = req.headers.get('Authorization') ?? '';
    if (/^\/app\/installations\/[^/]+\/access_tokens$/.test(ruta) && req.method === 'POST') {
      if (!auth.startsWith('Bearer ey')) return json({ message: 'Bad credentials' }, 401);
      return json({ token: TOKEN_INSTALACION, expires_at: new Date(Date.now() + 3600_000).toISOString() }, 201);
    }
    if (auth !== `Bearer ${TOKEN_INSTALACION}`) return json({ message: 'Bad credentials' }, 401);
    const prefijo = `/repos/${this.repo}/`;
    if (!ruta.startsWith(prefijo)) return json({ message: 'Not Found' }, 404);
    const resto = decodeURIComponent(ruta.slice(prefijo.length));
    let m: RegExpExecArray | null;

    if ((m = /^contents\/(.+)$/.exec(resto)) !== null) {
      const camino = m[1] ?? '';
      if (req.method === 'GET') {
        const ficheros = this.ficheros(url.searchParams.get('ref') ?? 'main');
        if (ficheros === undefined) return json({ message: 'No commit found' }, 404);
        const contenido = ficheros.get(camino);
        if (contenido !== undefined) {
          return json({ type: 'file', name: camino.split('/').at(-1), sha: await hashBlob(contenido), encoding: 'base64', content: b64(contenido) });
        }
        const dentro = [...ficheros.keys()].filter((k) => k.startsWith(`${camino}/`) && !k.slice(camino.length + 1).includes('/'));
        if (dentro.length === 0) return json({ message: 'Not Found' }, 404);
        return json(dentro.map((k) => ({ type: 'file', name: k.slice(camino.length + 1) })));
      }
      if (req.method === 'PUT') {
        if (this.fallarEscritura !== null) {
          const s = this.fallarEscritura;
          this.fallarEscritura = null;
          return json({ message: 'falla' }, s);
        }
        const c = (await req.json()) as { content: string; branch: string; sha?: string };
        const ficheros = this.ficheros(c.branch);
        if (ficheros === undefined) return json({ message: 'Branch not found' }, 404);
        const anterior = ficheros.get(camino);
        if (anterior !== undefined && c.sha !== (await hashBlob(anterior))) return json({ message: 'sha does not match' }, 409);
        if (anterior === undefined && c.sha !== undefined) return json({ message: 'sha sin fichero' }, 422);
        const bin = atob(c.content);
        const texto = new TextDecoder().decode(Uint8Array.from(bin, (x) => x.charCodeAt(0)));
        const sha = this.empujar(c.branch, camino, texto);
        return json({ commit: { sha }, content: { sha: await hashBlob(texto) } }, anterior === undefined ? 201 : 200);
      }
    }
    if ((m = /^git\/ref\/heads\/(.+)$/.exec(resto)) !== null && req.method === 'GET') {
      const sha = this.ramas.get(m[1] ?? '');
      return sha === undefined ? json({ message: 'Not Found' }, 404) : json({ object: { sha } });
    }
    if (resto === 'git/refs' && req.method === 'POST') {
      const c = (await req.json()) as { ref: string; sha: string };
      const rama = c.ref.replace(/^refs\/heads\//, '');
      if (this.ramas.has(rama)) return json({ message: 'Reference already exists' }, 422);
      this.ramas.set(rama, c.sha);
      return json({ ref: c.ref, object: { sha: c.sha } }, 201);
    }
    if (resto === 'pulls' && req.method === 'POST') {
      const c = (await req.json()) as { title: string; head: string; body: string };
      const pr: PrFalso = {
        number: this.siguientePr++,
        state: 'open',
        merged: false,
        head: { sha: this.ramas.get(c.head) ?? '', ref: c.head, repo: { full_name: this.repo } },
        user: { login: config.autor },
        title: c.title,
        body: c.body,
        created_at: new Date().toISOString(),
      };
      this.pulls.set(pr.number, pr);
      return json(pr, 201);
    }
    if ((m = /^pulls\/(\d+)$/.exec(resto)) !== null && req.method === 'GET') {
      const pr = this.pulls.get(Number(m[1]));
      return pr === undefined ? json({ message: 'Not Found' }, 404) : json(pr);
    }
    if ((m = /^pulls\/(\d+)\/merge$/.exec(resto)) !== null && req.method === 'PUT') {
      const pr = this.pulls.get(Number(m[1]));
      const c = (await req.json()) as { sha: string };
      if (pr === undefined) return json({ message: 'Not Found' }, 404);
      if (c.sha !== pr.head.sha) return json({ message: 'Head branch was modified' }, 409);
      this.merges.push({ pr: pr.number, sha: c.sha });
      pr.state = 'closed';
      pr.merged = true;
      return json({ merged: true, sha: nuevoSha() });
    }
    if ((m = /^issues\/(\d+)\/comments$/.exec(resto)) !== null && req.method === 'POST') {
      if (this.fallarComentario !== null) return json({ message: 'falla' }, this.fallarComentario);
      const c = (await req.json()) as { body: string };
      this.comentarios.push({ pr: Number(m[1]), body: c.body });
      return json({ id: this.comentarios.length }, 201);
    }
    if ((m = /^pulls\/(\d+)\/files$/.exec(resto)) !== null && req.method === 'GET') {
      const pr = this.pulls.get(Number(m[1]));
      if (pr === undefined) return json({ message: 'Not Found' }, 404);
      const base = this.ficheros('main') ?? new Map<string, string>();
      const cabeza = this.ficheros(pr.head.sha) ?? new Map<string, string>();
      const lista = [
        ...[...cabeza].filter(([k, v]) => base.get(k) !== v).map(([k]) => ({ filename: k, status: base.has(k) ? 'modified' : 'added' })),
        ...[...base.keys()].filter((k) => !cabeza.has(k)).map((k) => ({ filename: k, status: 'removed' })),
      ];
      const pagina = Number(url.searchParams.get('page') ?? '1');
      return json(lista.slice((pagina - 1) * 100, pagina * 100));
    }
    if ((m = /^git\/trees\/([0-9a-f]{40})$/.exec(resto)) !== null && req.method === 'GET') {
      const ficheros = this.commits.get(m[1] ?? '');
      if (ficheros === undefined) return json({ message: 'Not Found' }, 404);
      return json({ truncated: false, tree: [...ficheros.keys()].map((path) => ({ path, mode: '100644', type: 'blob' })) });
    }
    if (resto === 'actions/runs' && req.method === 'GET') {
      const sha = url.searchParams.get('head_sha');
      const lista = this.runs.filter((r) => r.head_sha === sha);
      return json({ total_count: lista.length, workflow_runs: lista });
    }
    if ((m = /^actions\/runs\/(\d+)\/artifacts$/.exec(resto)) !== null && req.method === 'GET') {
      const todos = [...this.artefactos.entries()].flatMap(([run, as]) => as.map((a) => ({ run, ...a })));
      const lista = todos.map((a, i) => ({ id: i + 1, name: a.nombre, expired: false, run: a.run })).filter((a) => a.run === Number(m?.[1]));
      return json({ total_count: lista.length, artifacts: lista.map(({ id, name, expired }) => ({ id, name, expired })) });
    }
    if ((m = /^actions\/artifacts\/(\d+)\/zip$/.exec(resto)) !== null && req.method === 'GET') {
      return new Response(null, { status: 302, headers: { Location: `https://blob.prueba.test/${m[1]}` } });
    }
    return json({ message: `Ruta no simulada: ${req.method} ${resto}` }, 501);
  }

  /** Un run de uno de los tres workflows sobre la cabeza de un PR, en `success` por defecto. */
  run(pr: number, workflow: 'cambio-pequeno' | 'build' | 'visual', extra: Partial<RunFalso> = {}): RunFalso {
    const p = this.pulls.get(pr);
    const r: RunFalso = {
      id: this.runs.length + 1,
      path: `.github/workflows/${workflow}.yml`,
      event: workflow === 'cambio-pequeno' ? 'pull_request_target' : 'pull_request',
      status: 'completed',
      conclusion: 'success',
      head_sha: p?.head.sha ?? '',
      head_repository: { full_name: this.repo },
      pull_requests: [{ number: pr }],
      created_at: new Date(Date.now() + this.runs.length).toISOString(),
      ...extra,
    };
    this.runs.push(r);
    return r;
  }
}

/** Clave privada de una App de prueba en PKCS#8. */
export async function claveDeApp(): Promise<string> {
  const { privateKey } = await generateKeyPair('RS256', { extractable: true });
  return exportPKCS8(privateKey);
}
