import { z } from 'astro/zod';
import { NIVELES } from './buceo.ts';

// Contrato del conector de Pelayo (CIE-221): lo que el build rechaza es lo que el conector no debe escribir.
// Los máximos son la longitud del texto más largo de hoy por 1,5, redondeada hacia arriba a la decena.

// "<" seguido de letra, "!", "/" o "?" abre HTML; "a < b" o "<3" no
export const SIN_HTML = /^(?![\s\S]*<[A-Za-z!/?])/;

export const texto = (max: number) => z.string().max(max).regex(SIN_HTML, 'sin HTML: quita el "<"');
const fecha = z.iso.date().transform((s) => new Date(s));
const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
const nivel = z.enum(NIVELES);
const finTrasInicio = { message: 'fin no puede ser anterior a inicio', path: ['fin'] };

export const viaje = z
  .object({
    titulo: texto(100),
    destino: texto(50),
    tipo: z.enum(['internacional', 'nacional', 'day-trip']),
    inicio: fecha,
    fin: fecha,
    formato: z.enum(['vida-a-bordo', 'desde-tierra', 'barco']),
    nivel: nivel.exclude(['tecnico']),
    inmersionesMinimas: z.int().min(0),
    inmersiones: z.int().min(1),
    agua: z.object({ temperatura: texto(20), traje: texto(10) }),
    precioDesde: z.int().positive(),
    organiza: texto(30),
    estado: z.enum(['abierto', 'ultimas-plazas', 'completo']).default('abierto'),
    destacado: z.boolean().default(false),
    cita: texto(60).optional(),
    fauna: z.array(texto(30)).default([]),
    incluye: z.array(texto(50)).default([]),
    noIncluye: z.array(texto(60)).default([]),
    resumen: texto(160),
  })
  .refine((v) => v.fin >= v.inicio, finTrasInicio);

export const punto = z.object({
  nombre: texto(30),
  orden: z.int(),
  tipo: z.enum(['costa', 'arenal', 'isla', 'bajo', 'pecio']),
  lat: z.number().min(37.6).max(37.72),
  lon: z.number().min(-0.78).max(-0.6),
  profundidad: z.object({ min: z.number().min(0), max: z.number().positive(), aproximada: z.boolean().default(false) }),
  nivel,
  corriente: z.enum(['Nula', 'Baja', 'Media', 'Fuerte']),
  fauna: z.array(texto(50)),
  resumen: texto(220),
});

export const curso = z.object({
  nombre: texto(30),
  orden: z.int(),
  linea: z.enum(['recreativa', 'profesional']),
  profundidadMax: z.number().positive().optional(),
  agencias: z.array(texto(20)).default([]),
  resumen: texto(200),
});

export const articulo = z.object({
  titulo: texto(70),
  fecha,
  etiqueta: texto(40),
  especie: texto(70).optional(),
  resumen: texto(170),
  arte: z.enum(['medusas', 'banco', 'arrecife', 'arena']),
});

export const entradaBitacora = z.object({
  titulo: texto(30),
  cuando: texto(20),
  resumen: texto(110),
  tipo: z.enum(['internacional', 'nacional', 'day-trip', 'pecios']),
  orden: z.int(),
});

// Textos de la web, un JSON por sección. Sin HTML: la palabra en cursiva de un título y la negrita
// de un párrafo van en su propio campo. En los tipos que se repiten, el máximo sale del texto más largo.
const tituloSerif = z.object({ antes: texto(20), serif: texto(20), despues: texto(30) });
const parrafo = z.object({ destacado: texto(120), texto: texto(150) });
const base = z.object({
  coordenadas: texto(30),
  detalle: texto(50),
  nombre: z.array(texto(20)).min(1).max(2),
  lista: z.array(texto(80)).min(1).max(4),
});
const cabecera = (etiqueta: number, entradilla: number) =>
  ({ etiqueta: texto(etiqueta), titulo: tituloSerif, entradilla: texto(entradilla) });

export const textos = z.discriminatedUnion('seccion', [
  z.object({
    seccion: z.literal('hero'),
    etiquetas: z.array(texto(60)).min(1).max(3),
    intro: parrafo,
    botonViajes: texto(30),
    botonCursos: texto(30),
  }),
  z.object({ seccion: z.literal('bases'), ...cabecera(50, 210), caboDePalos: base, madrid: base }),
  z.object({ seccion: z.literal('sunset'), titulo: texto(20), parrafo, boton: texto(20) }),
  z.object({ seccion: z.literal('puntos'), ...cabecera(80, 210) }),
  z.object({ seccion: z.literal('cursos'), ...cabecera(50, 210) }),
  z.object({ seccion: z.literal('viajes'), etiqueta: texto(60), titulo: tituloSerif }),
  z.object({ seccion: z.literal('puedo-ir'), titulo: tituloSerif, etiqueta: texto(30) }),
  z.object({ seccion: z.literal('comunidad'), parrafo }),
  z.object({ seccion: z.literal('fauna'), ...cabecera(50, 190) }),
  z.object({ seccion: z.literal('taller'), etiqueta: texto(50), titulo: texto(30), texto: texto(130), boton: texto(20) }),
  z.object({
    seccion: z.literal('contacto'),
    etiqueta: texto(50),
    titulo: tituloSerif,
    instagram: z.object({ etiqueta: texto(40), texto: texto(80) }),
  }),
  z.object({ seccion: z.literal('pagina-puntos'), titulo: texto(40), entradilla: texto(260) }),
]);

export type Textos = z.infer<typeof textos>;
export type TituloSerif = z.infer<typeof tituloSerif>;
export type Parrafo = z.infer<typeof parrafo>;

// Un JSON Schema por colección, de lo que el conector escribe: el frontmatter de cada .md,
// o el fichero entero en las colecciones de un solo JSON.
export function esquemasJson(): Record<string, unknown> {
  const esquemas = {
    viajes: viaje,
    puntos: punto,
    cursos: curso,
    cuaderno: articulo,
    bitacora: z.array(entradaBitacora.extend({ id: slug })),
    textos,
  };
  return Object.fromEntries(Object.entries(esquemas).map(([k, s]) => [k, z.toJSONSchema(s, { io: 'input' })]));
}
