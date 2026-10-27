import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { evaluar } from '../../.github/cambio-pequeno/regla.mjs';
import config from '../../.github/cambio-pequeno/config.json';
import { NO_ENLACES, NO_HTML } from '../src/viaje';
import { banco, fijarContador, llamar, viaje, type Banco } from './banco';
import { capturarConsola } from './consola';
import { ANDRES, ctx, PELAYO } from './util';

let b: Banco;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T10:00:00Z'));
  b = await banco();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const idDe = (texto: string) => /propuesta ([a-z2-7]{24})/.exec(texto)?.[1] ?? '';
const propuestas = () => b.db.sql('SELECT * FROM propuestas');
const cron = () =>
  capturarConsola(async () => {
    await b.worker.scheduled!({ cron: '*/2 * * * *', scheduledTime: Date.now(), noRetry: () => undefined } as ScheduledController, b.env, ctx);
  });

describe('proponer_viaje', () => {
  it('crea la rama desde main, el fichero y el PR, y lo apunta en D1', async () => {
    const r = await llamar(b, 'proponer_viaje', { campos: viaje() });
    expect(r.error, r.texto).toBe(false);
    const [p] = propuestas();
    expect(p).toMatchObject({ correo: ANDRES, slug: 'mar-rojo-sur-may-2027', rama: 'pelayo/viaje-mar-rojo-sur-may-2027', pr: 1, estado: 'compilando', nuevo: 1 });
    expect(r.texto).toContain(String(p?.['id']));
    const pr = b.falso.pulls.get(1);
    expect(pr?.head.sha).toBe(p?.['sha']);
    const contenido = b.falso.ficheros('pelayo/viaje-mar-rojo-sur-may-2027')?.get('src/content/viajes/mar-rojo-sur-may-2027.md') ?? '';
    // El fichero escrito pasa la regla con los datos del PR, como la pasará el workflow.
    expect(
      evaluar([{ nombre: 'src/content/viajes/mar-rojo-sur-may-2027.md', estado: 'added', modo: '100644', contenido }], {
        autor: pr?.user.login ?? '',
        rama: pr?.head.ref ?? '',
        repoCabeza: pr?.head.repo.full_name ?? '',
        fechaPr: pr?.created_at ?? '',
        config,
        dominios: [],
      }),
    ).toEqual({ pequeno: true, motivos: [] });
  });

  it('si el slug ya existe en main, añade un sufijo', async () => {
    const r = await llamar(b, 'proponer_viaje', { campos: viaje({ titulo: 'Maldivas', inicio: '2027-03-01', fin: '2027-03-10' }) });
    expect(r.error, r.texto).toBe(false);
    expect(propuestas()[0]?.['slug']).toBe('maldivas-mar-2027-2');
  });

  it('un viaje que empieza antes de hoy se rechaza con el motivo de la regla, sin llamar a GitHub', async () => {
    const r = await llamar(b, 'proponer_viaje', { campos: viaje({ inicio: '2026-10-10', fin: '2026-10-12' }) });
    expect(r).toEqual({ error: true, texto: expect.stringContaining('empieza antes de hoy') });
    expect(b.falso.llamadas).toEqual([]);
  });

  it('si GitHub falla, la reserva se anula y no se registran los argumentos', async () => {
    b.falso.fallarEscritura = 500;
    let r = { error: false, texto: '' };
    const salida = await capturarConsola(async () => {
      r = await llamar(b, 'proponer_viaje', { campos: viaje({ titulo: 'Viaje secreto de prueba' }) });
    });
    expect(r.error).toBe(true);
    expect(propuestas()).toEqual([]);
    expect(salida).toContain('"herramienta":"proponer_viaje","error":"github-500"');
    expect(salida).not.toContain('secreto');
    expect([...b.falso.ramas.keys()]).toEqual(['main']);
  });

  it('si GitHub falla al abrir el PR, la rama creada se borra', async () => {
    b.falso.fallarPr = 500;
    const r = await capturarConsola(() => llamar(b, 'proponer_viaje', { campos: viaje() }));
    expect(r).toContain('"error":"github-500"');
    expect(propuestas()).toEqual([]);
    expect([...b.falso.ramas.keys()]).toEqual(['main']);
  });
});

describe('validación por /mcp', () => {
  it.each(['../maldivas-mar-2027', 'viajes/maldivas', 'Maldivas-mar-2027', 'maldivas.md', '', 'x'.repeat(61)])(
    'cambiar_viaje con el slug "%s" se rechaza sin llamar a GitHub',
    async (slug) => {
      const r = await llamar(b, 'cambiar_viaje', { slug, campos: { precioDesde: 2790 } });
      expect(r).toEqual({ error: true, texto: expect.stringContaining('Ese nombre de viaje no vale') });
      expect(b.falso.llamadas).toEqual([]);
    },
  );

  it.each([
    ['cuerpo', 'Mira [a](https://lista.example/ruta)', NO_ENLACES],
    ['resumen', 'Escríbeme a alguien@otro.com', NO_ENLACES],
    ['cuerpo', '<script>alert(1)</script>', NO_HTML],
  ])('proponer_viaje con un enlace o HTML en %s se rechaza en llano', async (campo, valor, motivo) => {
    const r = await llamar(b, 'proponer_viaje', { campos: viaje({ [campo]: valor }) });
    expect(r).toEqual({ error: true, texto: motivo });
    expect(b.falso.llamadas).toEqual([]);
  });

  it('cambiar_viaje con un enlace se rechaza', async () => {
    const r = await llamar(b, 'cambiar_viaje', { slug: 'maldivas-mar-2027', campos: { cuerpo: 'www.otro.com' } });
    expect(r).toEqual({ error: true, texto: NO_ENLACES });
  });

  it.each(['2027-13-01', '2027-05-32', '2027-02-30'])('la fecha imposible %s se rechaza con su motivo', async (inicio) => {
    const r = await llamar(b, 'proponer_viaje', { campos: viaje({ inicio }) });
    expect(r).toEqual({ error: true, texto: expect.stringContaining('inicio tiene que ser fecha AAAA-MM-DD') });
  });

  it('un salto de línea en titulo se rechaza', async () => {
    const r = await llamar(b, 'proponer_viaje', { campos: viaje({ titulo: 'Mar Rojo\nsur' }) });
    expect(r).toEqual({ error: true, texto: expect.stringContaining('titulo tiene que ser texto de una línea') });
  });
});

describe('cambiar_viaje', () => {
  it('sobre un viaje de main abre una propuesta que modifica el fichero', async () => {
    const r = await llamar(b, 'cambiar_viaje', { slug: 'maldivas-mar-2027', campos: { precioDesde: 2790 } });
    expect(r.error, r.texto).toBe(false);
    expect(propuestas()[0]).toMatchObject({ slug: 'maldivas-mar-2027', nuevo: 0, rama: 'pelayo/viaje-maldivas-mar-2027' });
    const nuevo = b.falso.ficheros('pelayo/viaje-maldivas-mar-2027')?.get('src/content/viajes/maldivas-mar-2027.md');
    expect(nuevo).toContain('precioDesde: 2790\n');
    expect(nuevo).toContain('organiza: "Te Moana Expeditions"');
  });

  it('un viaje que no existe da "no lo encuentro" y devuelve el contador', async () => {
    const r = await llamar(b, 'cambiar_viaje', { slug: 'no-existe-ene-2027', campos: { precioDesde: 1 } });
    expect(r).toEqual({ error: true, texto: expect.stringContaining('No encuentro ese viaje') });
    expect(b.db.sql("SELECT cuenta FROM contadores WHERE tipo = 'commits'")).toEqual([{ cuenta: 0 }, { cuenta: 0 }]);
  });

  it('sobre la propuesta propia añade un commit al mismo PR y anula el visto bueno', async () => {
    const id = idDe((await llamar(b, 'proponer_viaje', { campos: viaje() })).texto);
    b.db.sql("UPDATE propuestas SET visto_bueno = sha, estado = 'esperando-andres'");
    vi.setSystemTime(new Date('2026-10-16T10:02:00Z'));
    const r = await llamar(b, 'cambiar_viaje', { slug: 'mar-rojo-sur-may-2027', campos: { precioDesde: 1790 } });
    expect(r.error, r.texto).toBe(false);
    const [p] = propuestas();
    expect(p).toMatchObject({ id, pr: 1, estado: 'compilando', visto_bueno: null });
    expect(b.falso.pulls.get(1)?.head.sha).toBe(p?.['sha']);
    expect(b.falso.pulls.size).toBe(1);
    expect(b.falso.ficheros('pelayo/viaje-mar-rojo-sur-may-2027')?.get('src/content/viajes/mar-rojo-sur-may-2027.md')).toContain(
      'precioDesde: 1790\n',
    );
  });

  it('diez propuestas seguidas del mismo viaje, publicadas o cerradas, tienen rama', async () => {
    for (let i = 0; i < 10; i++) {
      const r = await llamar(b, 'cambiar_viaje', { slug: 'maldivas-mar-2027', campos: { precioDesde: 2000 + i } });
      expect(r.error, `propuesta ${i + 1}: ${r.texto}`).toBe(false);
      const pr = b.falso.pulls.get(i + 1);
      if (pr !== undefined) Object.assign(pr, i % 2 === 0 ? { state: 'closed', merged: true } : { state: 'closed' });
      await cron();
    }
    expect(b.db.sql("SELECT count(*) AS n FROM propuestas WHERE estado IN ('publicada', 'cerrada')")).toEqual([{ n: 10 }]);
    expect([...b.falso.ramas.keys()]).toEqual(['main']);
  });

  it('sobre un PR mergeado que el cron aún no ha visto, manda el "Publicado" y abre otra propuesta', async () => {
    await llamar(b, 'cambiar_viaje', { slug: 'maldivas-mar-2027', campos: { precioDesde: 2790 } });
    const pr = b.falso.pulls.get(1);
    if (pr !== undefined) Object.assign(pr, { state: 'closed', merged: true });
    vi.setSystemTime(new Date('2026-10-16T10:02:00Z'));
    const r = await llamar(b, 'cambiar_viaje', { slug: 'maldivas-mar-2027', campos: { precioDesde: 2690 } });
    expect(r.error, r.texto).toBe(false);
    expect(b.falso.correos.map((c) => c['subject'])).toEqual(['[Dive Clif] Publicado: viaje maldivas-mar-2027']);
    expect(b.db.sql('SELECT pr, estado, rama FROM propuestas ORDER BY pr')).toEqual([
      { pr: 1, estado: 'publicada', rama: 'pelayo/viaje-maldivas-mar-2027' },
      { pr: 2, estado: 'compilando', rama: 'pelayo/viaje-maldivas-mar-2027' },
    ]);
  });

  it('si alguien empujó a la rama fuera del conector, no escribe', async () => {
    await llamar(b, 'proponer_viaje', { campos: viaje() });
    b.falso.empujar('pelayo/viaje-mar-rojo-sur-may-2027', 'src/pages/index.astro', 'x');
    vi.setSystemTime(new Date('2026-10-16T10:05:00Z'));
    const r = await llamar(b, 'cambiar_viaje', { slug: 'mar-rojo-sur-may-2027', campos: { precioDesde: 1790 } });
    expect(r).toEqual({ error: true, texto: expect.stringContaining('ha cambiado fuera del conector') });
  });
});

describe('propiedad', () => {
  it('con dos identidades, cada una solo ve y cambia lo suyo', async () => {
    const id = idDe((await llamar(b, 'proponer_viaje', { campos: viaje() }, ANDRES)).texto);
    expect(id).not.toBe('');

    expect((await llamar(b, 'estado', {}, ANDRES)).texto).toContain(id);
    expect(await llamar(b, 'estado', {}, PELAYO)).toEqual({ error: false, texto: 'No tienes propuestas.' });

    expect((await llamar(b, 'ver_propuesta', { id }, ANDRES)).texto).toContain('compilando');
    // Mismo mensaje que un id inventado.
    expect(await llamar(b, 'ver_propuesta', { id }, PELAYO)).toEqual({ error: true, texto: 'No encuentro esa propuesta.' });
    expect(await llamar(b, 'ver_propuesta', { id: 'a'.repeat(24) }, ANDRES)).toEqual({ error: true, texto: 'No encuentro esa propuesta.' });

    const llamadas = b.falso.llamadas.length;
    expect(await llamar(b, 'cambiar_viaje', { slug: 'mar-rojo-sur-may-2027', campos: { precioDesde: 1 } }, PELAYO)).toEqual({
      error: true,
      texto: 'Ya hay otra propuesta abierta de este viaje.',
    });
    expect(b.falso.llamadas.length).toBe(llamadas);
  });
});

describe('límites', () => {
  it('el commit 21 del día de una identidad se rechaza sin llamar a GitHub', async () => {
    fijarContador(b, ANDRES, 'commits', '2026-10-16', 20);
    const r = await llamar(b, 'proponer_viaje', { campos: viaje() });
    expect(r).toEqual({ error: true, texto: 'Hoy ya no puedo preparar más cambios; mañana sí.' });
    expect(b.falso.llamadas).toEqual([]);
    // Otra identidad sí puede.
    expect((await llamar(b, 'proponer_viaje', { campos: viaje() }, PELAYO)).error).toBe(false);
  });

  it('el commit 151 del mes se rechaza sin llamar a GitHub', async () => {
    fijarContador(b, 'global', 'commits', '2026-10', 150);
    const r = await llamar(b, 'proponer_viaje', { campos: viaje() }, PELAYO);
    expect(r).toEqual({ error: true, texto: expect.stringContaining('Este mes ya no puedo') });
    expect(b.falso.llamadas).toEqual([]);
    // Y el contador del día no se queda sumado.
    expect(b.db.sql("SELECT * FROM contadores WHERE clave = ?", PELAYO)).toEqual([{ clave: PELAYO, tipo: 'commits', periodo: '2026-10-16', cuenta: 0 }]);
  });

  it('un segundo commit a la misma propuesta antes de 2 minutos se rechaza sin llamar a GitHub', async () => {
    await llamar(b, 'proponer_viaje', { campos: viaje() });
    vi.setSystemTime(new Date('2026-10-16T10:01:59Z'));
    const llamadas = b.falso.llamadas.length;
    const r = await llamar(b, 'cambiar_viaje', { slug: 'mar-rojo-sur-may-2027', campos: { precioDesde: 1790 } });
    expect(r).toEqual({ error: true, texto: expect.stringContaining('Espera un par de minutos') });
    expect(b.falso.llamadas.length).toBe(llamadas);
    expect(b.db.sql("SELECT cuenta FROM contadores WHERE clave = ? AND tipo = 'commits'", ANDRES)).toEqual([{ cuenta: 1 }]);
  });

  it('el día siguiente se vuelve a poder', async () => {
    fijarContador(b, ANDRES, 'commits', '2026-10-16', 20);
    vi.setSystemTime(new Date('2026-10-17T00:00:01Z'));
    expect((await llamar(b, 'proponer_viaje', { campos: viaje() })).error).toBe(false);
  });

  it('dos llamadas a la vez con el contador en el tope menos uno dejan pasar solo una', async () => {
    fijarContador(b, ANDRES, 'commits', '2026-10-16', 19);
    const [r1, r2] = await Promise.all([
      llamar(b, 'proponer_viaje', { campos: viaje({ titulo: 'Uno' }) }),
      llamar(b, 'proponer_viaje', { campos: viaje({ titulo: 'Dos' }) }),
    ]);
    expect([r1?.error, r2?.error].sort()).toEqual([false, true]);
    expect(propuestas().length).toBe(1);
    expect(b.db.sql("SELECT cuenta FROM contadores WHERE clave = ? AND tipo = 'commits'", ANDRES)).toEqual([{ cuenta: 20 }]);
  });

  it('con 9 abiertas, tres propuestas a la vez dejan 10', async () => {
    for (let i = 0; i < 9; i++) {
      b.db.sql("INSERT INTO propuestas (id, correo, slug, nuevo, creada, estado) VALUES (?, ?, ?, 1, '2026-10-16', 'compilando')", `p${i}`, ANDRES, `s${i}`);
    }
    const rs = await Promise.all(['Uno', 'Dos', 'Tres'].map((titulo) => llamar(b, 'proponer_viaje', { campos: viaje({ titulo }) })));
    expect(rs.filter((r) => r.error).map((r) => r.texto)).toEqual([expect.stringContaining('Ya tienes 10'), expect.stringContaining('Ya tienes 10')]);
    expect(b.db.sql("SELECT count(*) AS n FROM propuestas WHERE estado NOT IN ('publicada', 'cerrada')")).toEqual([{ n: 10 }]);
    // Los dos rechazados no gastan commits.
    expect(b.db.sql("SELECT cuenta FROM contadores WHERE clave = ? AND tipo = 'commits'", ANDRES)).toEqual([{ cuenta: 1 }]);
  });

  it('un cambio rechazado en la propuesta propia no gasta commits ni bloquea dos minutos', async () => {
    await llamar(b, 'proponer_viaje', { campos: viaje() });
    vi.setSystemTime(new Date('2026-10-16T10:02:00Z'));
    // inicio después de fin: se rechaza al aplicarlo sobre la ficha de la propuesta.
    const r1 = await llamar(b, 'cambiar_viaje', { slug: 'mar-rojo-sur-may-2027', campos: { inicio: '2027-05-20' } });
    expect(r1.error).toBe(true);
    expect(r1.texto).not.toContain('Espera');
    vi.setSystemTime(new Date('2026-10-16T10:02:30Z'));
    const r2 = await llamar(b, 'cambiar_viaje', { slug: 'mar-rojo-sur-may-2027', campos: { precioDesde: 1790 } });
    expect(r2.error, r2.texto).toBe(false);
    expect(b.db.sql("SELECT cuenta FROM contadores WHERE clave = ? AND tipo = 'commits'", ANDRES)).toEqual([{ cuenta: 2 }]);
  });

  it('con 10 propuestas abiertas no deja abrir otra', async () => {
    for (let i = 0; i < 10; i++) {
      b.db.sql("INSERT INTO propuestas (id, correo, slug, nuevo, creada, estado) VALUES (?, ?, ?, 1, '2026-10-16', 'compilando')", `p${i}`, ANDRES, `s${i}`);
    }
    const r = await llamar(b, 'proponer_viaje', { campos: viaje() });
    expect(r).toEqual({ error: true, texto: expect.stringContaining('Ya tienes 10 propuestas abiertas') });
    expect(b.falso.llamadas).toEqual([]);
  });
});

describe('herramientas de consulta', () => {
  it('campos_viaje lista los campos con su formato', async () => {
    const r = await llamar(b, 'campos_viaje');
    const campos = JSON.parse(r.texto) as { nombre: string }[];
    expect(campos.map((c) => c.nombre)).toEqual([...config.clavesViaje, 'cuerpo']);
  });

  it('ver_viajes lista los de main', async () => {
    const r = await llamar(b, 'ver_viajes');
    expect(r).toEqual({ error: false, texto: 'maldivas-mar-2027: Maldivas, del 2027-03-08 al 2027-03-18, desde 2950 €' });
  });
});
