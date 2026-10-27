// Lo que genera la plantilla pasa la regla y el esquema de viajes de main (src/content.config.ts:8-33),
// leído con el mismo parser de frontmatter que usa Astro. astro y @astrojs/internal-helpers salen del
// node_modules de la raíz del repo (npm ci en la raíz antes de estos tests).
import { parseFrontmatter } from '@astrojs/internal-helpers/frontmatter';
import { z } from 'astro/zod';
import { describe, expect, it } from 'vitest';
import { evaluar } from '../../.github/cambio-pequeno/regla.mjs';
import config from '../../.github/cambio-pequeno/config.json';
import { aplicarCambio, leerViaje, NO_ENLACES, NO_HTML, plantilla, slugBase, slugLibre, validarViaje, type Viaje } from '../src/viaje';
import { viaje } from './banco';
import { MALDIVAS } from './falso';

// Copia de origin/main:src/content.config.ts:8-33 (NIVELES de src/lib/buceo.ts).
const NIVELES = ['ninguno', 'open-water', 'advanced', 'deep', 'tecnico'] as const;
const nivel = z.enum(NIVELES);
const esquemaDeMain = z
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
  .refine((v) => v.fin >= v.inicio, { message: 'fin no puede ser anterior a inicio', path: ['fin'] });

function generado(campos: Record<string, unknown>): { v: Viaje; contenido: string } {
  const r = validarViaje(campos);
  if (!r.ok) throw new Error(r.motivo);
  return { v: r.valor, contenido: plantilla(r.valor) };
}

function pasaRegla(slug: string, contenido: string, estado = 'added') {
  return evaluar([{ nombre: `src/content/viajes/${slug}.md`, estado, modo: '100644', contenido }], {
    autor: config.autor,
    rama: `pelayo/viaje-${slug}`,
    repoCabeza: 'aacienfuegos/diveclif',
    fechaPr: '2026-10-16T10:00:00Z',
    config,
    dominios: [],
  });
}

const completo = viaje({
  titulo: 'Mar Rojo "sur" \\ Brothers',
  estado: 'ultimas-plazas',
  destacado: true,
  cita: 'Donde el azul no se acaba',
  incluye: ['Pensión completa', 'Botellas y plomos'],
  noIncluye: ['Vuelos'],
});

describe('plantilla', () => {
  it.each([
    ['con todos los campos', completo],
    ['con los obligatorios', { ...viaje(), fauna: undefined, cuerpo: undefined }],
    ['un day trip', viaje({ tipo: 'day-trip', formato: 'barco', titulo: 'Day trip Cabo de Palos', organiza: 'Dive Clif', inicio: '2026-11-07', fin: '2026-11-07' })],
  ])('%s: pasa la regla y el esquema de main', (_caso, campos) => {
    const { v, contenido } = generado(Object.fromEntries(Object.entries(campos).filter(([, x]) => x !== undefined)));
    expect(pasaRegla(slugBase(v.titulo, v.inicio), contenido)).toEqual({ pequeno: true, motivos: [] });
    const { frontmatter, content } = parseFrontmatter(contenido);
    const r = esquemaDeMain.safeParse(frontmatter);
    expect(r.success, JSON.stringify(r.error?.issues)).toBe(true);
    expect(frontmatter['titulo']).toBe(v.titulo);
    expect(content.trim()).toBe(v.cuerpo ?? '');
  });

  it('un viaje de main leído y vuelto a escribir sale igual', () => {
    const datos = leerViaje(MALDIVAS);
    expect(datos).not.toBeNull();
    expect(generado(datos ?? {}).contenido).toBe(MALDIVAS);
  });

  it('en internacional y nacional, organiza siempre es Te Moana', () => {
    expect(generado(viaje({ organiza: 'Otra agencia' })).v.organiza).toBe('Te Moana Expeditions');
    expect(generado(viaje({ tipo: 'nacional' })).v.organiza).toBe('Te Moana Expeditions');
  });

  it('un day trip sin organiza se rechaza', () => {
    const r = validarViaje(viaje({ tipo: 'day-trip' }));
    expect(r).toEqual({ ok: false, motivo: expect.stringContaining('quién lo organiza') });
  });

  it('fin antes de inicio se rechaza', () => {
    expect(validarViaje(viaje({ fin: '2027-05-01' })).ok).toBe(false);
  });

  it('una fecha que no existe se rechaza', () => {
    expect(validarViaje(viaje({ inicio: '2027-02-30' })).ok).toBe(false);
  });

  it('un campo desconocido se rechaza', () => {
    expect(validarViaje(viaje({ plazas: 3 }))).toEqual({ ok: false, motivo: expect.stringContaining('"plazas" no es un campo') });
  });

  it('cambiar el tipo a day trip pide quién lo organiza', () => {
    const datos = leerViaje(MALDIVAS) ?? {};
    expect(aplicarCambio(datos, { tipo: 'day-trip' }).ok).toBe(false);
    expect(aplicarCambio(datos, { tipo: 'day-trip', organiza: 'Dive Clif' }).ok).toBe(true);
  });
});

describe('rechazo de enlaces y HTML', () => {
  const formas = [
    'https://otro.com',
    'http://otro.com',
    'www.otro.com',
    'WWW.otro.com',
    'alguien@otro.com',
    'mailto:alguien@otro.com',
    '[a](https://otro.com/x)',
    '[a](https&#58;//lista.example)',
    '[a](//otro.com)',
    '[a]: https://otro.com',
    '![a](https://lista.example/x.png)',
    '[a](https://lista.example@otro.com/)',
    '[a](https://lista.example/x "título")',
    '&amp;',
    '&#64;',
    '[www.otro.com](https://lista.example/)',
    // Las dos que la regla acepta: el conector no genera enlaces.
    '[a](https://lista.example/ruta)',
    '[a](/viajes/x/)',
  ];
  it.each(formas)('"%s" se rechaza en el cuerpo y en un campo de texto', (forma) => {
    expect(validarViaje(viaje({ cuerpo: `Texto ${forma} más texto` }))).toEqual({ ok: false, motivo: NO_ENLACES });
    expect(validarViaje(viaje({ resumen: `Texto ${forma}` }))).toEqual({ ok: false, motivo: NO_ENLACES });
    expect(validarViaje(viaje({ fauna: [`Mantas ${forma}`] }))).toEqual({ ok: false, motivo: NO_ENLACES });
  });

  it.each(['<script>alert(1)</script>', '<!-- x -->', '<img src=x>', '</p>', '<?php'])('"%s" se rechaza', (forma) => {
    expect(validarViaje(viaje({ cuerpo: forma }))).toEqual({ ok: false, motivo: NO_HTML });
    expect(validarViaje(viaje({ destino: forma }))).toEqual({ ok: false, motivo: NO_HTML });
  });

  it('un "<" suelto delante de un número no es HTML', () => {
    expect(validarViaje(viaje({ cuerpo: 'Profundidad < 30 m' })).ok).toBe(true);
  });

  it.each([
    ['titulo', 'Mar Rojo\nsur'],
    ['titulo', 'Mar Rojo sur\n'],
    ['titulo', 'Mar Rojo\r'],
    ['destino', 'Egipto\u2028Sudán'],
    ['resumen', 'Una\ttabulación'],
  ])('un salto de línea o carácter de control en %s se rechaza', (campo, valor) => {
    expect(validarViaje(viaje({ [campo]: valor })).ok).toBe(false);
  });

  it('los límites de longitud', () => {
    expect(validarViaje(viaje({ titulo: 'x'.repeat(100) })).ok).toBe(true);
    expect(validarViaje(viaje({ titulo: 'x'.repeat(101) })).ok).toBe(false);
    expect(validarViaje(viaje({ resumen: 'x'.repeat(301) })).ok).toBe(false);
    expect(validarViaje(viaje({ cita: 'x'.repeat(201) })).ok).toBe(false);
    expect(validarViaje(viaje({ fauna: Array.from({ length: 13 }, () => 'x') })).ok).toBe(false);
    expect(validarViaje(viaje({ cuerpo: 'x'.repeat(3001) })).ok).toBe(false);
  });
});

describe('slug', () => {
  it('título y mes, como los de main', () => {
    expect(slugBase('Maldivas', '2027-03-08')).toBe('maldivas-mar-2027');
    expect(slugBase('Mar Rojo Norte: Tirán', '2027-04-01')).toBe('mar-rojo-norte-tiran-abr-2027');
    expect(slugBase('Año nuevo en Cabo de Palos', '2026-12-31')).toBe('ano-nuevo-en-cabo-de-palos-dic-2026');
    expect(slugBase('¿¡!?', '2027-01-02')).toBe('viaje-ene-2027');
  });

  it('nunca pasa de 60 caracteres y cumple la expresión de la regla', () => {
    const s = slugBase('x'.repeat(100), '2027-01-02');
    expect(s.length).toBeLessThanOrEqual(60);
    expect(s).toMatch(/^[a-z0-9-]{1,60}$/);
    const libre = slugLibre(s, new Set([s]));
    expect(libre?.length).toBeLessThanOrEqual(60);
    expect(libre).toMatch(/-2$/);
  });

  it('si ya existe, añade un sufijo', () => {
    expect(slugLibre('maldivas-mar-2027', new Set(['maldivas-mar-2027', 'maldivas-mar-2027-2']))).toBe('maldivas-mar-2027-3');
  });
});
