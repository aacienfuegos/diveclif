// Artefacto `capturas` del run de visual: se descomprime en memoria, en streaming, contando los bytes
// reales sin fiarse de los tamaños de la cabecera del zip. Del artefacto solo se usan PNG con nombre
// cerrado y los códigos de resultado.json; ningún texto libre llega a la página ni al correo.
import { Unzip, UnzipInflate } from 'fflate';
import type { Env } from './entorno';
import { ErrorConector } from './entorno';
import type { GitHub } from './github';
import { ANCHOS, TIPOS_VISUAL, type Motivo } from './motivos';
import type { Run } from './runs';

export const TOPES = { entradas: 40, porEntrada: 5 * 1024 * 1024, total: 40 * 1024 * 1024, resultado: 64 * 1024 };
export const RE_CAPTURA = /^[a-z0-9-]+-(1500|390|360)$/;
const RE_FICHERO_CAPTURA = /^[a-z0-9-]+-(1500|390|360)\.png$/;
const RE_PAGINA = /^\/[a-z0-9/-]{0,100}$/;
const CABECERA_PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface Artefacto {
  capturas: Map<string, Uint8Array>;
  motivos: Motivo[];
}

const GENERICO: Motivo = { codigo: 'visual-generico' };

function unir(trozos: Uint8Array[]): Uint8Array {
  const total = trozos.reduce((n, t) => n + t.length, 0);
  const salida = new Uint8Array(total);
  let i = 0;
  for (const t of trozos) {
    salida.set(t, i);
    i += t.length;
  }
  return salida;
}

/** Solo códigos de la lista cerrada; una entrada que no cumpla se descarta y da el motivo genérico. */
export function leerResultado(bytes: Uint8Array | undefined): Motivo[] {
  if (bytes === undefined) return [GENERICO];
  let datos: unknown;
  try {
    datos = JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes));
  } catch {
    return [GENERICO];
  }
  const fallos = (datos as { fallos?: unknown } | null)?.fallos;
  if (!Array.isArray(fallos)) return [GENERICO];
  const motivos: Motivo[] = [];
  let descartado = false;
  for (const f of fallos as Record<string, unknown>[]) {
    const { pagina, ancho, tipo } = f ?? {};
    const valido =
      typeof pagina === 'string' &&
      RE_PAGINA.test(pagina) &&
      (ANCHOS as readonly unknown[]).includes(ancho) &&
      (TIPOS_VISUAL as readonly unknown[]).includes(tipo);
    if (valido) motivos.push({ codigo: `visual-${String(tipo)}`, pagina, ancho: Number(ancho) });
    else descartado = true;
  }
  return descartado ? [...motivos, GENERICO] : motivos;
}

/** Descomprime el zip con los topes. null si se pasa alguno: el artefacto entero se rechaza. */
export async function leerArtefacto(flujo: ReadableStream<Uint8Array>): Promise<Artefacto | null> {
  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  const ficheros = new Map<string, Uint8Array[]>();
  let entradas = 0;
  let total = 0;
  let roto = false;

  unzip.onfile = (f) => {
    if (roto) return;
    entradas += 1;
    if (entradas > TOPES.entradas) {
      roto = true;
      return;
    }
    const esPng = RE_FICHERO_CAPTURA.test(f.name);
    if (!esPng && f.name !== 'resultado.json') return;
    if (ficheros.has(f.name)) {
      roto = true;
      return;
    }
    const tope = esPng ? TOPES.porEntrada : TOPES.resultado;
    const trozos: Uint8Array[] = [];
    let bytes = 0;
    ficheros.set(f.name, trozos);
    f.ondata = (error, dato) => {
      if (roto) return;
      if (error !== null) {
        roto = true;
        return;
      }
      bytes += dato.length;
      total += dato.length;
      if (bytes > tope || total > TOPES.total) {
        roto = true;
        f.terminate();
        return;
      }
      trozos.push(dato);
    };
    f.start();
  };

  const lector = flujo.getReader();
  let leidos = 0;
  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) {
        unzip.push(new Uint8Array(0), true);
        break;
      }
      leidos += value.length;
      // El zip comprimido tampoco puede pasar del tope total.
      if (leidos > TOPES.total) roto = true;
      if (!roto) unzip.push(value, false);
      if (roto) break;
    }
  } catch {
    roto = true;
  }
  if (roto) {
    await lector.cancel().catch(() => undefined);
    return null;
  }

  const capturas = new Map<string, Uint8Array>();
  for (const [nombre, trozos] of ficheros) {
    if (nombre === 'resultado.json') continue;
    const datos = unir(trozos);
    if (CABECERA_PNG.every((b, i) => datos[i] === b)) capturas.set(nombre.slice(0, -'.png'.length), datos);
  }
  const resultado = ficheros.get('resultado.json');
  return { capturas, motivos: leerResultado(resultado === undefined ? undefined : unir(resultado)) };
}

/** Caché de capturas por SHA. */
export interface Almacen {
  leer(clave: string): Promise<Uint8Array | null>;
  guardar(clave: string, datos: Uint8Array): Promise<void>;
}

/** La caché del Worker, con claves en su propio hostname. */
export function almacenCache(env: Env): Almacen {
  const url = (clave: string) => `https://${env.PAGINA_HOST}/__capturas/${clave}`;
  return {
    async leer(clave) {
      const r = await caches.default.match(url(clave));
      return r === undefined ? null : new Uint8Array(await r.arrayBuffer());
    },
    async guardar(clave, datos) {
      await caches.default.put(url(clave), new Response(datos, { headers: { 'Cache-Control': 'max-age=1209600' } }));
    },
  };
}

export interface Indice {
  nombres: string[];
  motivos: Motivo[];
}

export async function leerIndice(almacen: Almacen, sha: string): Promise<Indice | null> {
  const bytes = await almacen.leer(`${sha}/indice.json`);
  return bytes === null ? null : (JSON.parse(new TextDecoder().decode(bytes)) as Indice);
}

/** Descarga, valida y guarda las capturas del run de visual que cuenta. Devuelve el índice. */
export async function capturasDelRun(gh: GitHub, almacen: Almacen, run: Run, sha: string): Promise<Indice> {
  const guardado = await leerIndice(almacen, sha);
  if (guardado !== null) return guardado;
  const { artifacts } = await gh.json<{ artifacts: { id: number; name: string; expired: boolean }[] }>('GET', `actions/runs/${run.id}/artifacts`);
  const artefacto = artifacts.find((a) => a.name === 'capturas' && !a.expired);
  let indice: Indice = { nombres: [], motivos: [GENERICO] };
  if (artefacto !== undefined) {
    // La API redirige a un almacén externo: se sigue a mano para no mandarle el token.
    const r = await gh.pedir('GET', `actions/artifacts/${artefacto.id}/zip`);
    const destino = r.headers.get('Location');
    if (r.status !== 302 || destino === null || !destino.startsWith('https://')) throw new ErrorConector(`artefacto-${r.status}`);
    const zip = await fetch(destino, { redirect: 'error' });
    if (!zip.ok || zip.body === null) throw new ErrorConector(`artefacto-descarga-${zip.status}`);
    const leido = await leerArtefacto(zip.body);
    if (leido !== null) {
      for (const [nombre, datos] of leido.capturas) await almacen.guardar(`${sha}/${nombre}.png`, datos);
      indice = { nombres: [...leido.capturas.keys()].sort(), motivos: leido.motivos };
    }
  }
  await almacen.guardar(`${sha}/indice.json`, new TextEncoder().encode(JSON.stringify(indice)));
  return indice;
}
