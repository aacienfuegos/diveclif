// Banco de pruebas: Worker con D1 de prueba, GitHub falso y JWT de Access firmados en los tests.
import { vi } from 'vitest';
import type { Env } from '../src/entorno';
import { crearWorker } from '../src/index';
import { crearD1, type D1DePrueba } from './d1.mjs';
import { claveDeApp, Falso } from './falso';
import { ANDRES, CONECTOR, crearClaves, ctx, entorno, firmar, mcp, peticion, type Claves } from './util';

export interface Banco {
  db: D1DePrueba;
  falso: Falso;
  env: Env;
  claves: Claves;
  worker: ExportedHandler<Env>;
}

let claveApp: string | null = null;

export async function banco(extra: Partial<Env> = {}): Promise<Banco> {
  claveApp ??= await claveDeApp();
  const db = crearD1();
  const falso = new Falso();
  const claves = await crearClaves();
  const env = entorno({ DB: db, GITHUB_APP_CLAVE: claveApp, ...extra });
  vi.stubGlobal('fetch', falso.fetch);
  return { db, falso, env, claves, worker: crearWorker({ claves: () => claves.verificar }) };
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
