import type { ImageMetadata } from 'astro';
import sharp from 'sharp';

// Fotos de Pelayo: src/assets/fotos/<hueco>/<slug>.{jpg,jpeg,png,webp}, con su alt en src/content/fotos.json
// (ruta de la regla de cambio pequeño de CIE-215 §3.1). Sin foto, cada hueco enseña lo de siempre.

export const HUECOS = {
  viajes: { slugs: { coleccion: 'viajes' }, minimo: { ancho: 1600, alto: 1000 } },
  bases: { slugs: { fijos: ['cabo-de-palos', 'madrid'] }, minimo: { ancho: 1200, alto: 900 } },
  puntos: { slugs: { coleccion: 'puntos' }, minimo: { ancho: 1600, alto: 1000 } },
  actividades: { slugs: { coleccion: 'actividades' }, minimo: { ancho: 1000, alto: 700 } },
} as const satisfies Record<string, { slugs: { coleccion: string } | { fijos: readonly string[] }; minimo: { ancho: number; alto: number } }>;

export type Hueco = keyof typeof HUECOS;

// Dónde se pinta cada hueco. "sizes" sale del CSS: .wrap mide 1208 px como mucho (1320 menos el margen)
// y el margen lateral es un 4 % por lado. "ancho" es el del <img> de respaldo, sin pasar del mínimo.
export const USOS = {
  'viaje-ficha': { hueco: 'viajes', anchos: [640, 960, 1280, 1600, 2400], sizes: '(min-width: 1320px) 1208px, 92vw', ancho: 1600 },
  'viaje-destacado': { hueco: 'viajes', anchos: [480, 800, 1200, 1600], sizes: '(min-width: 1320px) 683px, (min-width: 981px) 52vw, 92vw', ancho: 1200 },
  base: { hueco: 'bases', anchos: [480, 800, 1200, 1600], sizes: '(min-width: 1320px) 660px, (min-width: 981px) 50vw, 92vw', ancho: 1200 },
  'punto-ficha': { hueco: 'puntos', anchos: [640, 960, 1280, 1600, 2400], sizes: '(min-width: 1320px) 1208px, 92vw', ancho: 1600 },
  actividad: { hueco: 'actividades', anchos: [400, 800, 1000, 1400], sizes: '(min-width: 1320px) 391px, (min-width: 981px) 30vw, (min-width: 621px) 46vw, 92vw', ancho: 1000 },
} as const satisfies Record<string, { hueco: Hueco; anchos: readonly number[]; sizes: string; ancho: number }>;

export type Uso = keyof typeof USOS;

const ficheros = import.meta.glob<{ default: ImageMetadata }>('/src/assets/fotos/**/*.{jpg,jpeg,png,webp}', { eager: true });

export function buscarFoto(hueco: Hueco, slug: string): { ruta: string; imagen: ImageMetadata } | undefined {
  const ruta = Object.keys(ficheros).find((r) => r.replace(/\.[a-z]+$/, '') === `/src/assets/fotos/${hueco}/${slug}`);
  const imagen = ruta && ficheros[ruta]?.default;
  return ruta && imagen ? { ruta, imagen } : undefined;
}

export const PESO_MAXIMO = 5 * 1024 * 1024;
const FORMATO: Readonly<Record<string, string>> = { jpg: 'jpeg', jpeg: 'jpeg', png: 'png', webp: 'webp' };
const esHueco = (h: string): h is Hueco => Object.hasOwn(HUECOS, h);

export interface ContextoFotos {
  readonly slugs: Readonly<Record<Hueco, readonly string[]>>;
  readonly alts: ReadonlySet<string>;
}

// ruta relativa a src/assets/fotos. Formato y tamaño, por el contenido del fichero, no por la extensión.
export async function erroresFoto(ruta: string, bytes: Buffer, ctx: ContextoFotos): Promise<string[]> {
  const partes = /^([^/]+)\/([a-z0-9]+(?:-[a-z0-9]+)*)\.(jpg|jpeg|png|webp)$/.exec(ruta);
  if (!partes) return [`${ruta}: la ruta tiene que ser <hueco>/<slug>.jpg, .jpeg, .png o .webp`];
  const [, hueco = '', slug = '', extension = ''] = partes;
  if (!esHueco(hueco)) return [`${ruta}: "${hueco}" no es un hueco (${Object.keys(HUECOS).join(', ')})`];

  const errores: string[] = [];
  if (!ctx.slugs[hueco].includes(slug)) errores.push(`${ruta}: no hay ningún ${hueco} "${slug}"`);
  if (!ctx.alts.has(`${hueco}/${slug}`)) errores.push(`${ruta}: falta su texto alternativo en src/content/fotos.json`);
  if (bytes.length > PESO_MAXIMO) errores.push(`${ruta}: pesa ${(bytes.length / 1024 / 1024).toFixed(1)} MB y el máximo es 5 MB`);

  const meta = await sharp(bytes).metadata().catch(() => undefined);
  if (!meta) return [...errores, `${ruta}: no es una imagen legible`];
  if (meta.format !== FORMATO[extension]) errores.push(`${ruta}: es ${meta.format} aunque la extensión diga .${extension}`);
  const { ancho, alto } = HUECOS[hueco].minimo;
  if (meta.width < ancho || meta.height < alto) {
    errores.push(`${ruta}: mide ${meta.width} × ${meta.height} px y el mínimo es ${ancho} × ${alto}`);
  }
  return errores;
}
