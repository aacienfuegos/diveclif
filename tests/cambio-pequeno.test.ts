import { describe, expect, it } from 'vitest';
import config from '../.github/cambio-pequeno/config.json';
import { evaluar, leerDominios } from '../.github/cambio-pequeno/regla.mjs';

const DOMINIO = 'lista.example';
const RUTA = 'src/content/viajes/mar-rojo-sur-may-2027.md';

const ctx = {
  autor: config.autor,
  rama: 'pelayo/viaje-mar-rojo-sur-may-2027',
  repoCabeza: 'aacienfuegos/diveclif',
  fechaPr: '2026-10-16T09:00:00Z',
  config,
  dominios: leerDominios(`# comentario\n${DOMINIO}\n`),
};

const DATOS: Readonly<Record<string, unknown>> = {
  titulo: 'Mar Rojo sur',
  destino: 'Marsa Alam, Egipto',
  tipo: 'internacional',
  inicio: '2027-05-10',
  fin: '2027-05-17',
  formato: 'vida-a-bordo',
  nivel: 'advanced',
  inmersionesMinimas: 30,
  inmersiones: 16,
  agua: { temperatura: '25 °C', traje: '5 mm' },
  precioDesde: 1850,
  organiza: 'Te Moana Expeditions',
  fauna: ['Tiburón oceánico', 'Delfines'],
  resumen: 'Vida a bordo por los arrecifes del sur.',
};

function ficha(datos: Readonly<Record<string, unknown>> = DATOS, cuerpo = 'Una semana de vida a bordo.\n'): string {
  const lineas = Object.entries(datos)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`);
  return `---\n${lineas.join('\n')}\n---\n\n${cuerpo}`;
}

const fichero = (cambios: Partial<{ nombre: string; estado: string; anterior: string; modo: string | null; contenido: string | null }> = {}) => ({
  nombre: RUTA,
  estado: 'added',
  modo: '100644',
  contenido: ficha(),
  ...cambios,
});

const codigos = (r: ReturnType<typeof evaluar>) => r.motivos.map((m) => m.codigo);

describe('cambio pequeño: positivos', () => {
  it('un viaje nuevo bien formado pasa', () => {
    expect(evaluar([fichero()], ctx)).toEqual({ pequeno: true, motivos: [] });
  });

  it('una modificación pasa aunque el viaje ya haya empezado', () => {
    expect(evaluar([fichero({ estado: 'modified', contenido: ficha({ ...DATOS, inicio: '2026-01-01' }) })], ctx).pequeno).toBe(true);
  });

  it('un viaje real de main (formato JSON en el frontmatter) pasa', () => {
    const maldivas = `---
titulo: "Maldivas"
destino: "Atolones centrales, Maldivas"
tipo: "internacional"
inicio: "2027-03-08"
fin: "2027-03-18"
formato: "vida-a-bordo"
nivel: "advanced"
inmersionesMinimas: 50
inmersiones: 18
agua: {"temperatura": "28 °C", "traje": "3 mm"}
precioDesde: 2950
organiza: "Te Moana Expeditions"
fauna: ["Mantas", "Tiburones grises", "Tiburón ballena"]
resumen: "Vida a bordo por los atolones centrales: canales con corriente, mantas y tiburones."
---

Once días de vida a bordo entrando y saliendo de los canales de los atolones.
`;
    expect(evaluar([fichero({ contenido: maldivas })], ctx).pequeno).toBe(true);
  });

  it('en un day-trip organiza es texto libre', () => {
    expect(evaluar([fichero({ contenido: ficha({ ...DATOS, tipo: 'day-trip', organiza: 'Dive Clif' }) })], ctx).pequeno).toBe(true);
  });

  it.each([`[a](https://${DOMINIO}/ruta)`, `[a](https://${DOMINIO.toUpperCase()})`, '[a](/viajes/x/)', '[a](/)'])('el enlace permitido %s pasa', (enlace) => {
    expect(evaluar([fichero({ contenido: ficha(DATOS, `Más en ${enlace}.\n`) })], ctx)).toEqual({ pequeno: true, motivos: [] });
  });

  it('"<" que no abre HTML pasa', () => {
    expect(evaluar([fichero({ contenido: ficha(DATOS, 'Menos de < 10 m y <3\n') })], ctx).pequeno).toBe(true);
  });
});

describe('cambio pequeño: origen', () => {
  it.each([
    ['otro autor', { autor: 'cienfuegos-agentes[bot]' }, 'autor'],
    ['rama de otro prefijo', { rama: 'feat/viaje' }, 'rama'],
    ['fork', { repoCabeza: 'otro/diveclif' }, 'repo'],
  ])('%s', (_caso, cambio, codigo) => {
    const r = evaluar([fichero()], { ...ctx, ...cambio });
    expect(r.pequeno).toBe(false);
    expect(r.motivos).toEqual([{ codigo, fichero: null }]);
  });
});

describe('cambio pequeño: rutas, operaciones, tipo y tamaño', () => {
  const unico = (f: ReturnType<typeof fichero>) => codigos(evaluar([f], ctx));

  it('fuera de src/content/viajes/', () => {
    expect(unico(fichero({ nombre: 'src/pages/index.astro' }))).toContain('ruta');
  });

  it.each(['src/content/viajes/Mayus.md', 'src/content/viajes/a/b.md', 'src/content/viajes/../x.md', 'src/content/viajes/x.json'])('slug no válido %s', (nombre) => {
    expect(unico(fichero({ nombre }))).toContain('ruta');
  });

  it('renombrado desde fuera de la lista', () => {
    const c = unico(fichero({ estado: 'renamed', anterior: '.github/workflows/build.yml' }));
    expect(c).toContain('ruta');
    expect(c).toContain('operacion');
  });

  it('renombrado dentro de la lista también falla por operación', () => {
    expect(unico(fichero({ estado: 'renamed', anterior: 'src/content/viajes/otro.md' }))).toEqual(['operacion']);
  });

  it('borrado', () => {
    expect(unico(fichero({ estado: 'removed', contenido: null }))).toEqual(['operacion']);
  });

  it('modo 120000 (enlace simbólico)', () => {
    expect(unico(fichero({ modo: '120000' }))).toEqual(['modo']);
  });

  it('modo ejecutable', () => {
    expect(unico(fichero({ modo: '100755' }))).toEqual(['modo']);
  });

  it('más de 20 KB', () => {
    expect(unico(fichero({ contenido: ficha(DATOS, 'a'.repeat(20 * 1024)) }))).toEqual(['tamano']);
  });

  it('más de 10 ficheros', () => {
    const muchos = Array.from({ length: 11 }, (_, i) => fichero({ nombre: `src/content/viajes/v-${i}.md` }));
    expect(codigos(evaluar(muchos, ctx))).toEqual(['demasiados-ficheros']);
  });

  it('sin ficheros no es pequeño', () => {
    expect(codigos(evaluar([], ctx))).toEqual(['lectura']);
  });

  it('contenido que no se pudo leer', () => {
    expect(unico(fichero({ contenido: null }))).toEqual(['lectura']);
  });
});

describe('cambio pequeño: formato y contenido', () => {
  const unico = (contenido: string, estado = 'added') => codigos(evaluar([fichero({ contenido, estado })], ctx));

  it('<!-- en un valor', () => {
    expect(unico(ficha({ ...DATOS, resumen: 'hola <!-- x -->' }))).toEqual(['html']);
  });

  it.each(['<script>alert(1)</script>', '</p>', '<?php', '<img src=x>'])('HTML en el cuerpo: %s', (cuerpo) => {
    expect(unico(ficha(DATOS, cuerpo))).toContain('html');
  });

  it('HTML en un elemento de lista y en una clave de objeto', () => {
    expect(unico(ficha({ ...DATOS, fauna: ['<b>x</b>'] }))).toEqual(['html']);
    expect(unico(ficha({ ...DATOS, agua: { '<i>': 'x', traje: '5 mm' } }))).toEqual(['html']);
  });

  it('clave desconocida', () => {
    expect(unico(ficha({ ...DATOS, plazas: 4 }))).toEqual(['clave-desconocida']);
  });

  it('frontmatter YAML no JSON', () => {
    expect(unico(ficha(DATOS).replace('titulo: "Mar Rojo sur"', 'titulo: Mar Rojo sur'))).toEqual(['formato']);
  });

  it.each([
    ['clave repetida', ficha(DATOS).replace('---\n\n', 'titulo: "Otro"\n---\n\n')],
    ['línea vacía en el frontmatter', ficha(DATOS).replace('tipo:', '\ntipo:')],
    ['sin frontmatter', 'Solo texto\n'],
    ['sin cierre', ficha(DATOS).replace('\n---\n', '\n')],
    ['CRLF', ficha(DATOS).replaceAll('\n', '\r\n')],
    ['bloque YAML', ficha(DATOS).replace('fauna: ["Tiburón oceánico","Delfines"]', 'fauna:\n  - Tiburón')],
  ])('%s', (_caso, contenido) => {
    expect(unico(contenido)).toContain('formato');
  });

  it('organiza distinto de Te Moana en internacional y nacional', () => {
    expect(unico(ficha({ ...DATOS, organiza: 'Dive Clif' }))).toEqual(['organiza']);
    expect(unico(ficha({ ...DATOS, tipo: 'nacional', organiza: 'te moana expeditions' }))).toEqual(['organiza']);
    expect(unico(ficha({ ...DATOS, organiza: undefined }))).toEqual(['organiza']);
  });

  it('viaje nuevo que empieza el día del PR o antes', () => {
    expect(unico(ficha({ ...DATOS, inicio: '2026-10-16' }))).toEqual(['fecha-pasada']);
    expect(unico(ficha({ ...DATOS, inicio: '2025-01-01' }))).toEqual(['fecha-pasada']);
  });

  it('viaje nuevo con inicio que no es AAAA-MM-DD', () => {
    expect(unico(ficha({ ...DATOS, inicio: '10/05/2027' }))).toEqual(['formato']);
  });
});

describe('cambio pequeño: enlaces', () => {
  const enCuerpo = (cuerpo: string) => codigos(evaluar([fichero({ contenido: ficha(DATOS, `Texto ${cuerpo} más texto.\n`) })], ctx));

  it.each([
    'https://otro.example/x',
    'http://otro.example',
    'www.otro.example',
    'WWW.otro.example',
    'pelayo@ejemplo.example',
    'mailto:pelayo@ejemplo.example',
    '[a](https://otro.example/x)',
    `[a](https&#58;//${DOMINIO})`,
    '[a](//otro.example)',
    '[a]: https://otro.example',
    `![a](https://${DOMINIO}/x.png)`,
    `[a](https://${DOMINIO}@otro.example/)`,
    `[a](https://${DOMINIO}/x "título")`,
    '&amp;',
    '&#64;',
    `[www.otro.example](https://${DOMINIO}/)`,
    `[a](http://${DOMINIO}/)`,
    `[a](https://sub.${DOMINIO}/)`,
    '[a](//viajes/x)',
    '[a](/Viajes/x)',
    '[a](/x?y=1)',
    `[a] (https://${DOMINIO})`,
    `[a](<https://${DOMINIO}>)`,
    `[](https://${DOMINIO})`,
    `[[a](https://${DOMINIO})](https://otro.example)`,
  ])('%s', (cuerpo) => {
    expect(enCuerpo(cuerpo)).toContain('enlace');
  });

  it('un enlace permitido dentro de un valor del frontmatter', () => {
    expect(codigos(evaluar([fichero({ contenido: ficha({ ...DATOS, resumen: `Ver [a](https://${DOMINIO}/x)` }) })], ctx))).toEqual(['enlace']);
  });

  it.each(['https://otro.example', 'pelayo@ejemplo.example', '&amp;', 'www.x.example'])('%s en un valor del frontmatter', (valor) => {
    expect(codigos(evaluar([fichero({ contenido: ficha({ ...DATOS, cita: valor }) })], ctx))).toEqual(['enlace']);
  });

  it('dominios.txt vacío: ningún enlace externo pasa', () => {
    const r = evaluar([fichero({ contenido: ficha(DATOS, `[a](https://${DOMINIO}/x)\n`) })], { ...ctx, dominios: [] });
    expect(codigos(r)).toEqual(['enlace']);
  });
});
