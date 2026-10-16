// Banco de pruebas: Worker con D1 de prueba, GitHub falso y JWT de Access firmados en los tests.
import { vi } from 'vitest';
import type { Almacen } from '../src/capturas';
import type { Env } from '../src/entorno';
import { crearWorker } from '../src/index';
import { crearD1, type D1DePrueba } from './d1.mjs';
import { claveDeApp, Falso } from './falso';
import { ANDRES, CONECTOR, crearClaves, ctx, entorno, firmar, mcp, PAGINA, peticion, type Claves } from './util';

export interface Banco {
  db: D1DePrueba;
  falso: Falso;
  env: Env;
  claves: Claves;
  worker: ExportedHandler<Env>;
  /** Caché de capturas en memoria. */
  cache: Map<string, Uint8Array>;
}

let claveApp: string | null = null;

export async function banco(extra: Partial<Env> = {}): Promise<Banco> {
  claveApp ??= await claveDeApp();
  const db = crearD1();
  const falso = new Falso();
  const claves = await crearClaves();
  const env = entorno({ DB: db, GITHUB_APP_CLAVE: claveApp, ...extra });
  vi.stubGlobal('fetch', falso.fetch);
  const cache = new Map<string, Uint8Array>();
  const almacen: Almacen = {
    leer: async (clave) => cache.get(clave) ?? null,
    guardar: async (clave, datos) => void cache.set(clave, datos),
  };
  return { db, falso, env, claves, cache, worker: crearWorker({ claves: () => claves.verificar, almacen: () => almacen }) };
}

export interface ResultadoHerramienta {
  error: boolean;
  texto: string;
}

let id = 1;

/** Llama a una herramienta por /mcp como lo haría Claude, con la identidad `correo`. */
export async function llamar(b: Banco, herramienta: string, args: Record<string, unknown> = {}, correo = ANDRES): Promise<ResultadoHerramienta> {
  const jwt = await firmar(b.claves.privada, { email: correo });
  const r = await b.worker.fetch!(
    peticion(`https://${CONECTOR}/mcp`, { ...mcp('tools/call', { name: herramienta, arguments: args }, id++), jwt }) as Request<
      unknown,
      IncomingRequestCfProperties
    >,
    b.env,
    ctx,
  );
  const cuerpo = (await r.json()) as { result?: { isError?: boolean; content: { text: string }[] }; error?: { message: string } };
  if (cuerpo.result === undefined) throw new Error(`MCP respondió sin resultado: ${JSON.stringify(cuerpo.error)}`);
  return { error: cuerpo.result.isError === true, texto: cuerpo.result.content.map((c) => c.text).join('\n') };
}

/** Viaje válido de ejemplo; `extra` sustituye campos. */
export function viaje(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    titulo: 'Mar Rojo sur',
    destino: 'Mar Rojo sur, Egipto',
    tipo: 'internacional',
    inicio: '2027-05-10',
    fin: '2027-05-17',
    formato: 'vida-a-bordo',
    nivel: 'advanced',
    inmersionesMinimas: 30,
    inmersiones: 18,
    agua: { temperatura: '26 °C', traje: '5 mm' },
    precioDesde: 1850,
    fauna: ['Tiburón oceánico', 'Delfines'],
    resumen: 'Vida a bordo por los arrecifes del sur: St. Johns, Fury Shoals y Daedalus.',
    cuerpo: 'Una semana de **vida a bordo** por los arrecifes del sur.\n\n- Tres inmersiones al día\n- Nocturna en St. Johns',
    ...extra,
  };
}

/** Pone un contador directamente en D1 (para probar los topes). */
export function fijarContador(b: Banco, clave: string, tipo: string, periodo: string, cuenta: number): void {
  b.db.sql('INSERT OR REPLACE INTO contadores (clave, tipo, periodo, cuenta) VALUES (?, ?, ?, ?)', clave, tipo, periodo, cuenta);
}

/** Petición a la página con la identidad `correo`. */
export async function aLaPagina(b: Banco, ruta: string, init: RequestInit = {}, correo = ANDRES): Promise<Response> {
  const jwt = await firmar(b.claves.privada, { email: correo, aud: 'aud-pagina' });
  return b.worker.fetch!(peticion(`https://${PAGINA}${ruta}`, { ...init, jwt }) as Request<unknown, IncomingRequestCfProperties>, b.env, ctx);
}

/** Pulsa "Publicar" con un token. */
export function pulsar(b: Banco, id: string, token: string, o: { origin?: string | null; correo?: string } = {}): Promise<Response> {
  const origin = o.origin === undefined ? `https://${PAGINA}` : o.origin;
  return aLaPagina(
    b,
    `/p/${id}/publicar`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', ...(origin === null ? {} : { Origin: origin }) },
      body: new URLSearchParams({ token }).toString(),
    },
    o.correo,
  );
}

export const tokenDe = (htmlPagina: string) => /name="token" value="([A-Za-z0-9_-]+)"/.exec(htmlPagina)?.[1] ?? null;
