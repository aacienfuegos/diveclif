import { describe, expect, it } from 'vitest';
import config from '../.github/cambio-pequeno/config.json';
import { resumen, revisarPr } from '../.github/cambio-pequeno/revisar-pr.mjs';

const SHA = 'a'.repeat(40);
const OTRO_SHA = 'b'.repeat(40);
const RUTA = 'src/content/viajes/mar-rojo-sur-may-2027.md';

const FICHA = `---
titulo: "Mar Rojo sur"
destino: "Marsa Alam, Egipto"
tipo: "internacional"
inicio: "2027-05-10"
fin: "2027-05-17"
formato: "vida-a-bordo"
nivel: "advanced"
inmersionesMinimas: 30
inmersiones: 16
agua: {"temperatura":"25 °C","traje":"5 mm"}
precioDesde: 1850
organiza: "Te Moana Expeditions"
resumen: "Vida a bordo por los arrecifes del sur."
---

Una semana de vida a bordo.
`;

const datos = {
  pr: 12,
  headSha: SHA,
  autor: config.autor,
  rama: 'pelayo/viaje-mar-rojo-sur-may-2027',
  repoCabeza: 'aacienfuegos/diveclif',
  fechaPr: '2026-10-16T09:00:00Z',
};

type Fichero = { filename: string; status: string; previous_filename?: string };

/** API falsa de GitHub: un PR con `ficheros`, el árbol de SHA y un blob por fichero. */
function api(ficheros: Fichero[], opciones: { modo?: string; truncado?: boolean; cabezas?: string[]; changed?: number; falla?: string } = {}) {
  const cabezas = [...(opciones.cabezas ?? [SHA, SHA])];
  const pedidas: string[] = [];
  const llamar = async (ruta: string): Promise<unknown> => {
    pedidas.push(ruta);
    if (opciones.falla !== undefined && ruta.startsWith(opciones.falla)) throw new Error('HTTP 500');
    if (ruta === 'pulls/12') return { head: { sha: cabezas.shift() }, changed_files: opciones.changed ?? ficheros.length };
    const pagina = /^pulls\/12\/files\?per_page=100&page=(\d+)$/.exec(ruta);
    if (pagina) return ficheros.slice((Number(pagina[1]) - 1) * 100, Number(pagina[1]) * 100);
    if (ruta === `git/trees/${SHA}?recursive=1`) {
      return {
        truncated: opciones.truncado ?? false,
        tree: ficheros.map((f, i) => ({ path: f.filename, type: 'blob', mode: opciones.modo ?? '100644', size: FICHA.length, sha: `blob${i}` })),
      };
    }
    if (ruta.startsWith('git/blobs/')) return { encoding: 'base64', content: Buffer.from(FICHA).toString('base64') };
    throw new Error(`ruta inesperada ${ruta}`);
  };
  return { llamar, pedidas };
}

const dominios: string[] = [];
const codigos = (r: { motivos: { codigo: string }[] }) => r.motivos.map((m) => m.codigo);

describe('revisar-pr: lee el PR por la API y le pasa la regla', () => {
  it('un viaje de la App en pelayo/ pasa, con el modo del árbol y el contenido del blob', async () => {
    const { llamar, pedidas } = api([{ filename: RUTA, status: 'added' }]);
    expect(await revisarPr(llamar, datos, config, dominios)).toEqual({ pequeno: true, motivos: [] });
    expect(pedidas).toContain(`git/trees/${SHA}?recursive=1`);
    expect(pedidas).toContain('git/blobs/blob0');
  });

  it('un PR de otro autor y otra rama sale en rojo por origen', async () => {
    const { llamar } = api([{ filename: RUTA, status: 'added' }]);
    const r = await revisarPr(llamar, { ...datos, autor: 'cienfuegos-agentes[bot]', rama: 'feat/conector-221' }, config, dominios);
    expect(codigos(r)).toEqual(['autor', 'rama']);
  });

  it('lee todas las páginas de ficheros', async () => {
    const muchos = Array.from({ length: 150 }, (_, i) => ({ filename: `src/content/viajes/v-${i}.md`, status: 'added' }));
    const { llamar, pedidas } = api(muchos);
    const r = await revisarPr(llamar, datos, config, dominios);
    expect(pedidas).toContain('pulls/12/files?per_page=100&page=2');
    expect(codigos(r)).toContain('demasiados-ficheros');
    expect(pedidas.some((p) => p.startsWith('git/blobs/'))).toBe(false);
  });

  it('si la lista no cuadra con changed_files, falla por lectura', async () => {
    const { llamar } = api([{ filename: RUTA, status: 'added' }], { changed: 2 });
    expect(codigos(await revisarPr(llamar, datos, config, dominios))).toEqual(['lectura']);
  });

  it('si la cabeza del PR no es la del evento, antes o después de leer, falla por lectura', async () => {
    for (const cabezas of [[OTRO_SHA, SHA], [SHA, OTRO_SHA]]) {
      const { llamar } = api([{ filename: RUTA, status: 'added' }], { cabezas });
      expect(codigos(await revisarPr(llamar, datos, config, dominios))).toEqual(['lectura']);
    }
  });

  it('un árbol truncado o un error de la API fallan por lectura', async () => {
    const truncado = api([{ filename: RUTA, status: 'added' }], { truncado: true });
    expect(codigos(await revisarPr(truncado.llamar, datos, config, dominios))).toEqual(['lectura']);
    for (const falla of ['pulls/12/files', 'git/trees/', 'git/blobs/']) {
      const { llamar } = api([{ filename: RUTA, status: 'added' }], { falla });
      expect(codigos(await revisarPr(llamar, datos, config, dominios))).toEqual(['lectura']);
    }
  });

  it('el modo sale del árbol: un enlace simbólico falla por modo', async () => {
    const { llamar } = api([{ filename: RUTA, status: 'added' }], { modo: '120000' });
    expect(codigos(await revisarPr(llamar, datos, config, dominios))).toEqual(['modo']);
  });

  it('un renombrado desde fuera de la lista falla por ruta', async () => {
    const { llamar } = api([{ filename: RUTA, status: 'renamed', previous_filename: 'functions/api/contacto.ts' }]);
    expect(codigos(await revisarPr(llamar, datos, config, dominios))).toContain('ruta');
  });
});

describe('revisar-pr: resumen del job', () => {
  it('escribe cada motivo en llano y sanea el nombre del fichero', () => {
    const texto = resumen({ pequeno: false, motivos: [{ codigo: 'ruta', fichero: 'a`](https://x)<b>.md' }, { codigo: 'autor', fichero: null }] });
    expect(texto).toContain('## cambio-pequeno: no');
    expect(texto).toContain('El cambio no lo ha preparado el conector de Dive Clif.');
    expect(texto).not.toMatch(/[`]\]|\(https|<b>/);
  });
});
