import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { esquemasJson, texto } from '../src/lib/esquemas';

describe('esquemas JSON', () => {
  const generados = esquemasJson();

  it('esquemas/ coincide con Zod (si falla: npm run esquemas)', () => {
    const ficheros = readdirSync('esquemas').filter((f) => f.endsWith('.schema.json'));
    expect(ficheros.map((f) => f.replace('.schema.json', '')).sort()).toEqual(Object.keys(generados).sort());
    for (const f of ficheros) {
      expect(JSON.parse(readFileSync(`esquemas/${f}`, 'utf8')), f).toEqual(generados[f.replace('.schema.json', '')]);
    }
  });
});

describe('texto', () => {
  const t = texto(20);

  it('rechaza lo que abre HTML', () => {
    for (const malo of ['<b>hola</b>', 'a <script>', '<!-- x', '</p>', '<?php']) expect(t.safeParse(malo).success, malo).toBe(false);
  });

  it('acepta "<" que no abre HTML', () => {
    for (const bueno of ['a < b', '<3', '< 10 m', '']) expect(t.safeParse(bueno).success, bueno).toBe(true);
  });

  it('respeta el máximo', () => {
    expect(t.safeParse('x'.repeat(21)).success).toBe(false);
  });
});
