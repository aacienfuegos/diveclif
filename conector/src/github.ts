// Escritura y lectura en GitHub con la GitHub App publicadora (instalada solo en el repo).
// Los tokens de instalación no se guardan ni se registran.
import { importPKCS8, SignJWT } from 'jose';
import { ErrorConector, type Env } from './entorno';

const API = 'https://api.github.com';

export class GitHub {
  private token: Promise<string> | null = null;

  constructor(private readonly env: Env) {}

  get repo(): string {
    return this.env.REPO;
  }

  private async tokenInstalacion(): Promise<string> {
    const clave = await importPKCS8(this.env.GITHUB_APP_CLAVE, 'RS256');
    const ahora = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(this.env.GITHUB_APP_ID)
      .setIssuedAt(ahora - 60)
      .setExpirationTime(ahora + 540)
      .sign(clave);
    const r = await fetch(`${API}/app/installations/${encodeURIComponent(this.env.GITHUB_APP_INSTALACION)}/access_tokens`, {
      method: 'POST',
      headers: { ...cabeceras(), Authorization: `Bearer ${jwt}` },
    });
    if (!r.ok) throw new ErrorConector(`github-token-${r.status}`);
    const { token } = await r.json<{ token: string }>();
    return token;
  }

  /** Petición a la API. `ruta` es relativa a /repos/<REPO>/ salvo que empiece por `/`. */
  async pedir(metodo: string, ruta: string, cuerpo?: unknown, extra: Record<string, string> = {}): Promise<Response> {
    this.token ??= this.tokenInstalacion();
    const url = ruta.startsWith('/') ? `${API}${ruta}` : `${API}/repos/${this.env.REPO}/${ruta}`;
    return fetch(url, {
      method: metodo,
      headers: { ...cabeceras(), Authorization: `Bearer ${await this.token}`, ...extra },
      ...(cuerpo === undefined ? {} : { body: JSON.stringify(cuerpo) }),
      redirect: 'manual',
    });
  }

  /** Como `pedir`, pero falla con un código propio si la respuesta no es 2xx. */
  async json<T>(metodo: string, ruta: string, cuerpo?: unknown): Promise<T> {
    const r = await this.pedir(metodo, ruta, cuerpo);
    if (!r.ok) throw new ErrorConector(`github-${r.status}`);
    return r.json<T>();
  }

  /** Contenido de un fichero en una ref, o null si no existe. */
  async leer(ruta: string, ref: string): Promise<{ contenido: string; sha: string } | null> {
    const r = await this.pedir('GET', `contents/${ruta}?ref=${encodeURIComponent(ref)}`);
    if (r.status === 404) return null;
    if (!r.ok) throw new ErrorConector(`github-${r.status}`);
    const f = await r.json<{ type: string; sha: string; content?: string; encoding?: string }>();
    if (f.type !== 'file' || f.encoding !== 'base64' || f.content === undefined) throw new ErrorConector('github-fichero');
    return { contenido: desdeBase64(f.content), sha: f.sha };
  }

  /** Nombres de los ficheros de un directorio en una ref. */
  async listar(ruta: string, ref: string): Promise<string[]> {
    const r = await this.pedir('GET', `contents/${ruta}?ref=${encodeURIComponent(ref)}`);
    if (r.status === 404) return [];
    if (!r.ok) throw new ErrorConector(`github-${r.status}`);
    const lista = await r.json<{ type: string; name: string }[]>();
    return lista.filter((f) => f.type === 'file').map((f) => f.name);
  }

  async shaDeRama(rama: string): Promise<string> {
    const ref = await this.json<{ object: { sha: string } }>('GET', `git/ref/heads/${rama}`);
    return ref.object.sha;
  }

  /** Crea la rama; false si ya existe. */
  async crearRama(rama: string, sha: string): Promise<boolean> {
    const r = await this.pedir('POST', 'git/refs', { ref: `refs/heads/${rama}`, sha });
    if (r.status === 422) return false;
    if (!r.ok) throw new ErrorConector(`github-${r.status}`);
    return true;
  }

  /** Escribe un fichero en una rama y devuelve el SHA del commit. */
  async escribir(ruta: string, rama: string, contenido: string, mensaje: string, shaAnterior?: string): Promise<string> {
    const r = await this.json<{ commit: { sha: string } }>('PUT', `contents/${ruta}`, {
      message: mensaje,
      content: aBase64(contenido),
      branch: rama,
      ...(shaAnterior === undefined ? {} : { sha: shaAnterior }),
    });
    return r.commit.sha;
  }

  async abrirPr(rama: string, titulo: string, cuerpo: string): Promise<number> {
    const r = await this.json<{ number: number }>('POST', 'pulls', { title: titulo, head: rama, base: 'main', body: cuerpo });
    return r.number;
  }

  async pr(numero: number): Promise<Pr> {
    return this.json<Pr>('GET', `pulls/${numero}`);
  }
}

export interface Pr {
  number: number;
  state: string;
  merged: boolean;
  head: { sha: string; ref: string };
}

function cabeceras(): Record<string, string> {
  return {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'diveclif-conector',
    'Content-Type': 'application/json',
  };
}

export function aBase64(texto: string): string {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binario += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binario);
}

export function desdeBase64(b64: string): string {
  const binario = atob(b64.replace(/\s/g, ''));
  return new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(Uint8Array.from(binario, (c) => c.charCodeAt(0)));
}
