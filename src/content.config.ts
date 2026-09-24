import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { NIVELES } from './lib/buceo';

const nivel = z.enum(NIVELES);

const viajes = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/viajes' }),
  schema: z
    .object({
      titulo: z.string(),
      destino: z.string(),
      tipo: z.enum(['internacional', 'nacional', 'day-trip']),
      inicio: z.coerce.date(),
      fin: z.coerce.date(),
      formato: z.enum(['vida-a-bordo', 'desde-tierra', 'barco']),
      nivel: nivel.exclude(['tecnico']),
      inmersionesMinimas: z.int().min(0),
      inmersiones: z.int().min(1),
      agua: z.object({ temperatura: z.string(), traje: z.string() }),
      precioDesde: z.int().positive(),
      organiza: z.string(),
      estado: z.enum(['abierto', 'ultimas-plazas', 'completo']).default('abierto'),
      destacado: z.boolean().default(false),
      cita: z.string().optional(),
      fauna: z.array(z.string()).default([]),
      incluye: z.array(z.string()).default([]),
      noIncluye: z.array(z.string()).default([]),
      resumen: z.string(),
    })
    .refine((v) => v.fin >= v.inicio, { message: 'fin no puede ser anterior a inicio', path: ['fin'] }),
});

const puntos = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/puntos' }),
  schema: z.object({
    nombre: z.string(),
    orden: z.int(),
    tipo: z.enum(['costa', 'arenal', 'isla', 'bajo', 'pecio']),
    lat: z.number().min(37.6).max(37.72),
    lon: z.number().min(-0.78).max(-0.6),
    profundidad: z.object({ min: z.number().min(0), max: z.number().positive(), aproximada: z.boolean().default(false) }),
    nivel,
    corriente: z.enum(['Nula', 'Baja', 'Media', 'Fuerte']),
    fauna: z.array(z.string()),
    resumen: z.string(),
  }),
});

const cursos = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/cursos' }),
  schema: z.object({
    nombre: z.string(),
    orden: z.int(),
    linea: z.enum(['recreativa', 'profesional']),
    profundidadMax: z.number().positive().optional(),
    agencias: z.array(z.string()).default([]),
    resumen: z.string(),
  }),
});

const cuaderno = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/cuaderno' }),
  schema: z.object({
    titulo: z.string(),
    fecha: z.coerce.date(),
    etiqueta: z.string(),
    especie: z.string().optional(),
    resumen: z.string(),
    arte: z.enum(['medusas', 'banco', 'arrecife', 'arena']),
  }),
});

const bitacora = defineCollection({
  loader: file('./src/content/bitacora.json'),
  schema: z.object({
    titulo: z.string(),
    cuando: z.string(),
    resumen: z.string(),
    tipo: z.enum(['internacional', 'nacional', 'day-trip', 'pecios']),
    orden: z.int(),
  }),
});

export const collections = { viajes, puntos, cursos, cuaderno, bitacora };
