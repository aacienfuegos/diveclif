// Lee un PR como lo lee el workflow cambio-pequeno.yml (lista de ficheros, árbol y contenido por
// head.sha) y le pasa la regla, para dar los motivos en llano cuando cambio-pequeno falla.
import { evaluar, leerDominios } from '../../.github/cambio-pequeno/regla.mjs';
import config from '../../.github/cambio-pequeno/config.json';
import dominiosTxt from '../../.github/cambio-pequeno/dominios.txt';
import type { GitHub, Pr } from './github';
import type { Motivo } from './motivos';

interface FicheroPr {
  filename: string;
  status: string;
  previous_filename?: string;
}

export async function motivosDeLaRegla(gh: GitHub, pr: Pr): Promise<Motivo[]> {
  const ficheros: FicheroPr[] = [];
  for (let pagina = 1; pagina <= 30; pagina++) {
    const lote = await gh.json<FicheroPr[]>('GET', `pulls/${pr.number}/files?per_page=100&page=${pagina}`);
    ficheros.push(...lote);
    if (lote.length < 100) break;
  }
  const { tree, truncated } = await gh.json<{ tree: { path: string; mode: string }[]; truncated: boolean }>(
    'GET',
    `git/trees/${pr.head.sha}?recursive=1`,
  );
  if (truncated) return [{ codigo: 'lectura' }];
  const modos = new Map(tree.map((t) => [t.path, t.mode]));
  // Con más ficheros de la cuenta ya no es pequeño: no hace falta leerlos todos.
  const aLeer = ficheros.slice(0, config.maxFicheros + 1);
  const entrada = await Promise.all(
    aLeer.map(async (f) => ({
      nombre: f.filename,
      estado: f.status,
      ...(f.previous_filename === undefined ? {} : { anterior: f.previous_filename }),
      modo: modos.get(f.filename) ?? null,
      contenido: f.status === 'removed' ? null : ((await gh.leer(f.filename, pr.head.sha))?.contenido ?? null),
    })),
  );
  const { motivos } = evaluar(entrada.concat(ficheros.slice(aLeer.length).map((f) => ({ nombre: f.filename, estado: f.status, modo: null, contenido: null }))), {
    autor: pr.user?.login ?? '',
    rama: pr.head.ref,
    repoCabeza: pr.head.repo?.full_name ?? '',
    fechaPr: pr.created_at,
    config,
    dominios: leerDominios(dominiosTxt),
  });
  return motivos.map((m) => ({ codigo: m.codigo }));
}
