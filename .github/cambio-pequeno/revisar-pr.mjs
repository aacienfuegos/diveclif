// Script del workflow cambio-pequeno.yml: lee el PR por la API, como datos, y le pasa regla.mjs.
// Uso: node .github/cambio-pequeno/revisar-pr.mjs, con GH_TOKEN, REPO, PR, HEAD_SHA, AUTOR, RAMA,
// REPO_CABEZA y FECHA_PR en el entorno. Lo que no se pueda leer entero hace fallar el PR.
import { appendFileSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluar, leerDominios, MOTIVOS } from './regla.mjs';

const POR_PAGINA = 100;
// GitHub no lista más de 3000 ficheros de un PR.
const MAX_PAGINAS = 30;
// Más que esto no se descarga: la regla lo rechaza por tamaño o por no poder leerlo.
const MAX_BLOB = 1024 * 1024;

/**
 * @typedef {(ruta: string) => Promise<any>} Api GET a `https://api.github.com/repos/<repo>/<ruta>`, JSON.
 * @typedef {{ pr: number, headSha: string, autor: string, rama: string, repoCabeza: string, fechaPr: string }} DatosPr
 */

/** Todos los ficheros del PR, página a página. */
async function ficherosDelPr(api, pr) {
  const todos = [];
  for (let pagina = 1; pagina <= MAX_PAGINAS; pagina += 1) {
    const lote = await api(`pulls/${pr}/files?per_page=${POR_PAGINA}&page=${pagina}`);
    if (!Array.isArray(lote)) throw new Error('lista de ficheros ilegible');
    todos.push(...lote);
    if (lote.length < POR_PAGINA) return todos;
  }
  throw new Error('demasiados ficheros para listarlos');
}

/**
 * @param {Api} api
 * @param {DatosPr} datos
 * @param {import('./regla.mjs').Contexto['config']} config
 * @param {string[]} dominios
 */
export async function revisarPr(api, datos, config, dominios) {
  const ctx = { autor: datos.autor, rama: datos.rama, repoCabeza: datos.repoCabeza, fechaPr: datos.fechaPr, config, dominios };
  const lectura = () => ({ pequeno: false, motivos: [{ codigo: 'lectura', fichero: null }] });
  try {
    const antes = await api(`pulls/${datos.pr}`);
    if (antes?.head?.sha !== datos.headSha) return lectura();
    const lista = await ficherosDelPr(api, datos.pr);
    if (lista.length !== antes.changed_files) return lectura();

    const arbol = await api(`git/trees/${datos.headSha}?recursive=1`);
    if (arbol?.truncated !== false || !Array.isArray(arbol.tree)) return lectura();
    const entradas = new Map(arbol.tree.map((e) => [e.path, e]));

    const ficheros = [];
    for (const f of lista) {
      const entrada = f.status === 'removed' ? undefined : entradas.get(f.filename);
      let contenido = null;
      if (entrada?.type === 'blob' && entrada.size <= MAX_BLOB && lista.length <= config.maxFicheros) {
        const blob = await api(`git/blobs/${entrada.sha}`);
        if (blob?.encoding === 'base64') contenido = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.from(blob.content, 'base64'));
      }
      ficheros.push({
        nombre: f.filename,
        estado: f.status,
        ...(f.previous_filename === undefined ? {} : { anterior: f.previous_filename }),
        modo: entrada?.mode ?? null,
        contenido,
      });
    }

    // Si alguien empuja mientras se lee, lo leído puede ser de dos commits distintos.
    const despues = await api(`pulls/${datos.pr}`);
    if (despues?.head?.sha !== datos.headSha) return lectura();
    return evaluar(ficheros, ctx);
  } catch {
    return lectura();
  }
}

// El nombre del fichero lo elige quien abre el PR: en el resumen, solo caracteres de ruta.
const saneado = (nombre) => nombre.replace(/[^A-Za-z0-9._\/-]/g, '?').slice(0, 200);

/** Una línea por motivo, con el texto en llano y el fichero si lo hay. */
export function resumen({ pequeno, motivos }) {
  if (pequeno) return '## cambio-pequeno: sí\n\nEl cambio cumple la regla de cambio pequeño.\n';
  const lineas = motivos.map((m) => `- \`${m.codigo}\`${m.fichero === null ? '' : ` en \`${saneado(m.fichero)}\``}: ${MOTIVOS[m.codigo] ?? m.codigo}`);
  return `## cambio-pequeno: no\n\n${lineas.join('\n')}\n`;
}

function datosDelEntorno() {
  const e = process.env;
  const repo = e.REPO ?? '';
  if (!/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(repo)) throw new Error('REPO no válido');
  if (!/^[1-9][0-9]*$/.test(e.PR ?? '')) throw new Error('PR no válido');
  if (!/^[0-9a-f]{40}$/.test(e.HEAD_SHA ?? '')) throw new Error('HEAD_SHA no válido');
  if (!/^\d{4}-\d{2}-\d{2}T/.test(e.FECHA_PR ?? '')) throw new Error('FECHA_PR no válida');
  if (!e.GH_TOKEN) throw new Error('Falta GH_TOKEN');
  /** @type {Api} */
  const api = async (ruta) => {
    const res = await fetch(`https://api.github.com/repos/${repo}/${ruta}`, {
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${e.GH_TOKEN}`, 'X-GitHub-Api-Version': '2022-11-28' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  };
  /** @type {DatosPr} */
  const datos = {
    pr: Number(e.PR),
    headSha: e.HEAD_SHA ?? '',
    autor: e.AUTOR ?? '',
    rama: e.RAMA ?? '',
    repoCabeza: e.REPO_CABEZA ?? '',
    fechaPr: e.FECHA_PR ?? '',
  };
  return { api, datos };
}

async function main() {
  const dir = dirname(fileURLToPath(import.meta.url));
  const config = JSON.parse(readFileSync(join(dir, 'config.json'), 'utf8'));
  const dominios = leerDominios(readFileSync(join(dir, 'dominios.txt'), 'utf8'));
  let resultado;
  try {
    const { api, datos } = datosDelEntorno();
    resultado = await revisarPr(api, datos, config, dominios);
  } catch {
    resultado = { pequeno: false, motivos: [{ codigo: 'lectura', fichero: null }] };
  }
  const texto = resumen(resultado);
  process.stdout.write(texto);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, texto);
  process.exitCode = resultado.pequeno ? 0 : 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
