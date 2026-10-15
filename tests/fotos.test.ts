import { existsSync, readFileSync, readdirSync } from 'node:fs';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { HUECOS, PESO_MAXIMO, erroresFoto, type ContextoFotos, type Hueco } from '../src/lib/fotos';

const RAIZ = 'src/assets/fotos';

const ids = (coleccion: string) =>
  existsSync(`src/content/${coleccion}`) ? readdirSync(`src/content/${coleccion}`).filter((f) => f.endsWith('.md')).map((f) => f.slice(0, -3)) : [];

const slugsDe = (h: Hueco): readonly string[] => {
  const origen = HUECOS[h].slugs;
  return 'fijos' in origen ? origen.fijos : ids(origen.coleccion);
};
const slugs: Record<Hueco, readonly string[]> = {
  viajes: slugsDe('viajes'),
  bases: slugsDe('bases'),
  puntos: slugsDe('puntos'),
  actividades: slugsDe('actividades'),
};

const altsRepo: readonly { id: string; alt: string }[] = JSON.parse(readFileSync('src/content/fotos.json', 'utf8'));

describe('fotos del repo', () => {
  const ficheros = existsSync(RAIZ) ? readdirSync(RAIZ, { recursive: true, encoding: 'utf8' }).filter((f) => /\.[^/]+$/.test(f)) : [];
  const ctx: ContextoFotos = { slugs, alts: new Set(altsRepo.map((a) => a.id)) };

  it('cada fichero de src/assets/fotos cumple su hueco', async () => {
    const errores = await Promise.all(ficheros.map((f) => erroresFoto(f.replaceAll('\\', '/'), readFileSync(`${RAIZ}/${f}`), ctx)));
    expect(errores.flat()).toEqual([]);
  });

  it('un solo fichero por hueco y slug', () => {
    const claves = ficheros.map((f) => f.replace(/\.[^.]+$/, ''));
    expect(claves.filter((c, i) => claves.indexOf(c) !== i)).toEqual([]);
  });

  it('cada entrada de fotos.json tiene su fichero', () => {
    const conFichero = new Set(ficheros.map((f) => f.replace(/\.[^.]+$/, '')));
    expect(altsRepo.map((a) => a.id).filter((id) => !conFichero.has(id))).toEqual([]);
  });
});

describe('erroresFoto con fotos generadas', () => {
  const ctx: ContextoFotos = { slugs: { ...slugs, viajes: ['maldivas-mar-2027'] }, alts: new Set(['viajes/maldivas-mar-2027', 'viajes/no-existe']) };
  const imagen = (ancho: number, alto: number) => sharp({ create: { width: ancho, height: alto, channels: 3, background: '#0e5f86' } });

  it('pasa una foto buena', async () => {
    expect(await erroresFoto('viajes/maldivas-mar-2027.jpg', await imagen(1600, 1000).jpeg().toBuffer(), ctx)).toEqual([]);
  });

  it('falla con una PNG renombrada a .jpg', async () => {
    const errores = await erroresFoto('viajes/maldivas-mar-2027.jpg', await imagen(1600, 1000).png().toBuffer(), ctx);
    expect(errores).toEqual(['viajes/maldivas-mar-2027.jpg: es png aunque la extensión diga .jpg']);
  });

  it('falla con una foto demasiado pequeña', async () => {
    const errores = await erroresFoto('viajes/maldivas-mar-2027.webp', await imagen(1200, 800).webp().toBuffer(), ctx);
    expect(errores).toEqual(['viajes/maldivas-mar-2027.webp: mide 1200 × 800 px y el mínimo es 1600 × 1000']);
  });

  it('falla sin texto alternativo', async () => {
    const errores = await erroresFoto('bases/madrid.jpg', await imagen(1200, 900).jpeg().toBuffer(), ctx);
    expect(errores).toEqual(['bases/madrid.jpg: falta su texto alternativo en src/content/fotos.json']);
  });

  it('falla con un slug que no existe', async () => {
    const errores = await erroresFoto('viajes/no-existe.jpg', await imagen(1600, 1000).jpeg().toBuffer(), ctx);
    expect(errores).toEqual(['viajes/no-existe.jpg: no hay ningún viajes "no-existe"']);
  });

  it('falla con más de 5 MB', async () => {
    const ruido = Buffer.from(Array.from({ length: 1700 * 1100 * 3 }, () => Math.floor(Math.random() * 256)));
    const png = await sharp(ruido, { raw: { width: 1700, height: 1100, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
    expect(png.length).toBeGreaterThan(PESO_MAXIMO);
    const errores = await erroresFoto('viajes/maldivas-mar-2027.png', png, ctx);
    expect(errores).toHaveLength(1);
    expect(errores[0]).toMatch(/pesa 5\.\d MB y el máximo es 5 MB/);
  });

  it('falla con huecos, rutas o ficheros que no son imagen', async () => {
    expect(await erroresFoto('galeria/maldivas-mar-2027.jpg', Buffer.from(''), ctx)).toEqual([
      'galeria/maldivas-mar-2027.jpg: "galeria" no es un hueco (viajes, bases, puntos, actividades)',
    ]);
    expect(await erroresFoto('viajes/Maldivas.JPG', Buffer.from(''), ctx)).toHaveLength(1);
    expect(await erroresFoto('viajes/maldivas-mar-2027.jpg', Buffer.from('<svg/>'), ctx)).toEqual([
      'viajes/maldivas-mar-2027.jpg: no es una imagen legible',
    ]);
  });
});
