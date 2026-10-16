import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { banco, fijarContador, llamar, viaje, type Banco } from './banco';
import { capturarConsola } from './consola';
import { ctx, ANDRES, PELAYO } from './util';

let b: Banco;
let id: string;

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-16T10:00:00Z'));
  b = await banco();
  id = /propuesta ([a-z2-7]{24})/.exec((await llamar(b, 'proponer_viaje', { campos: viaje() }, PELAYO)).texto)?.[1] ?? '';
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const cron = () =>
  capturarConsola(async () => {
    await b.worker.scheduled!({ cron: '*/2 * * * *', scheduledTime: Date.now(), noRetry: () => undefined } as ScheduledController, b.env, ctx);
  });
const verde = (extra: Partial<Record<'cambio-pequeno' | 'build' | 'visual', string>> = {}) => {
  for (const w of ['cambio-pequeno', 'build', 'visual'] as const) b.falso.run(1, w, { conclusion: extra[w] ?? 'success' });
};
const asuntos = () => b.falso.correos.map((c) => String(c['subject']));

describe('avisos', () => {
  it('cada transición manda un solo correo por SHA y estado', async () => {
    await cron();
    expect(b.falso.correos).toEqual([]);

    verde();
    await cron();
    await cron();
    expect(asuntos()).toEqual(['[Dive Clif] Tu viaje está listo para ver: mar-rojo-sur-may-2027']);
    expect(b.falso.correos[0]).toMatchObject({ to: [PELAYO], text: expect.stringContaining(`/p/${id}`) });

    // Commit nuevo: otro SHA, otro aviso.
    vi.setSystemTime(new Date('2026-10-16T10:03:00Z'));
    await llamar(b, 'cambiar_viaje', { slug: 'mar-rojo-sur-may-2027', campos: { precioDesde: 1790 } }, PELAYO);
    verde({ build: 'failure' });
    await cron();
    await cron();
    expect(asuntos().slice(1)).toEqual(['[Dive Clif] No se puede publicar solo: viaje mar-rojo-sur-may-2027']);
    expect(String(b.falso.correos[1]?.['text'])).toContain('- La web no compila con este cambio.');
    expect(b.db.sql('SELECT estado FROM propuestas')).toEqual([{ estado: 'no-publicable' }]);

    // Lo mergea Andrés.
    const pr = b.falso.pulls.get(1);
    if (pr !== undefined) Object.assign(pr, { state: 'closed', merged: true });
    await cron();
    await cron();
    expect(asuntos().slice(2)).toEqual(['[Dive Clif] Publicado: viaje mar-rojo-sur-may-2027']);
    expect(b.db.sql('SELECT estado FROM propuestas')).toEqual([{ estado: 'publicada' }]);
  });

  it('con visto bueno sobre el SHA no vuelve a mandar "listo"', async () => {
    verde();
    b.db.sql("UPDATE propuestas SET visto_bueno = sha, estado = 'esperando-andres'");
    await cron();
    expect(b.falso.correos).toEqual([]);
  });

  it('si falla cambio-pequeno, los motivos son los de la regla en llano', async () => {
    const pr = b.falso.pulls.get(1);
    if (pr !== undefined) pr.user.login = 'otra-app[bot]';
    verde({ 'cambio-pequeno': 'failure' });
    await cron();
    expect(String(b.falso.correos[0]?.['text'])).toContain('- El cambio no lo ha preparado el conector de Dive Clif.');
  });

  it('si alguien empuja a la rama, avisa de que ha cambiado fuera del conector', async () => {
    b.falso.empujar('pelayo/viaje-mar-rojo-sur-may-2027', 'src/pages/index.astro', 'x');
    await cron();
    expect(String(b.falso.correos[0]?.['text'])).toContain('ha cambiado fuera del conector');
  });

  it('un PR cerrado sin mergear se cierra sin correo', async () => {
    const pr = b.falso.pulls.get(1);
    if (pr !== undefined) pr.state = 'closed';
    await cron();
    expect(b.falso.correos).toEqual([]);
    expect(b.db.sql('SELECT estado FROM propuestas')).toEqual([{ estado: 'cerrada' }]);
  });

  it('con el tope diario de correos no llama a Resend y el aviso queda para el día siguiente', async () => {
    fijarContador(b, 'global', 'correos', '2026-10-16', 40);
    verde();
    await cron();
    expect(b.falso.correos).toEqual([]);
    expect(b.db.sql('SELECT avisos FROM propuestas')).toEqual([{ avisos: '[]' }]);
    vi.setSystemTime(new Date('2026-10-17T00:00:30Z'));
    await cron();
    expect(asuntos()).toEqual(['[Dive Clif] Tu viaje está listo para ver: mar-rojo-sur-may-2027']);
  });

  it('con el tope del mes tampoco', async () => {
    fijarContador(b, 'global', 'correos', '2026-10', 1000);
    verde();
    await cron();
    expect(b.falso.correos).toEqual([]);
  });

  it('el aviso de publicado pendiente por el tope se manda al día siguiente', async () => {
    fijarContador(b, 'global', 'correos', '2026-10-16', 40);
    const pr = b.falso.pulls.get(1);
    if (pr !== undefined) Object.assign(pr, { state: 'closed', merged: true });
    await cron();
    expect(b.falso.correos).toEqual([]);
    vi.setSystemTime(new Date('2026-10-17T00:00:30Z'));
    await cron();
    expect(asuntos()).toEqual(['[Dive Clif] Publicado: viaje mar-rojo-sur-may-2027']);
  });

  it('un error en una propuesta solo registra su código y sigue con las demás', async () => {
    b.db.sql("UPDATE propuestas SET pr = 404");
    const salida = await cron();
    expect(salida).toBe(JSON.stringify({ host: 'cron', ruta: 'avisos', metodo: 'CRON', estado: 500, propuesta: id, error: 'github-404' }));
  });
});

describe('pedir_a_andres', () => {
  it('manda a Andrés un correo en texto plano con la petición citada', async () => {
    const r = await llamar(b, 'pedir_a_andres', { titulo: 'Enlace a Te Moana', descripcion: 'Pon el enlace\nhttps://temoana.example' }, PELAYO);
    expect(r).toEqual({ error: false, texto: 'Se lo he mandado a Andrés por correo.' });
    expect(b.falso.correos).toEqual([
      {
        from: 'Dive Clif <web@prueba.test>',
        to: [ANDRES],
        subject: `[Dive Clif] Petición de ${PELAYO}: Enlace a Te Moana`,
        text: expect.stringContaining('> Pon el enlace\n> https://temoana.example'),
      },
    ]);
  });

  it('el sexto del día de una identidad se rechaza', async () => {
    for (let i = 0; i < 5; i++) expect((await llamar(b, 'pedir_a_andres', { titulo: `P${i}`, descripcion: 'x' }, PELAYO)).error).toBe(false);
    const r = await llamar(b, 'pedir_a_andres', { titulo: 'P6', descripcion: 'x' }, PELAYO);
    expect(r).toEqual({ error: true, texto: 'Hoy ya no puedo mandar más peticiones a Andrés; mañana sí.' });
    expect(b.falso.correos).toHaveLength(5);
    expect((await llamar(b, 'pedir_a_andres', { titulo: 'Otra', descripcion: 'x' }, ANDRES)).error).toBe(false);
  });

  it('un título de varias líneas se rechaza', async () => {
    const r = await llamar(b, 'pedir_a_andres', { titulo: 'Uno\nBcc: otro@prueba.test', descripcion: 'x' }, PELAYO);
    expect(r.error).toBe(true);
    expect(b.falso.correos).toEqual([]);
  });

  it('con el tope de correos no llama a Resend y no gasta la petición', async () => {
    fijarContador(b, 'global', 'correos', '2026-10-16', 40);
    const r = await llamar(b, 'pedir_a_andres', { titulo: 'P', descripcion: 'x' }, PELAYO);
    expect(r).toEqual({ error: true, texto: 'Hoy ya no puedo mandar más correos; mañana sí.' });
    expect(b.falso.correos).toEqual([]);
    expect(b.db.sql("SELECT cuenta FROM contadores WHERE tipo = 'peticiones'")).toEqual([{ cuenta: 0 }]);
  });
});

describe('todos los correos', () => {
  it('llevan text y no html, y el asunto empieza por [Dive Clif]', async () => {
    verde();
    await cron();
    await llamar(b, 'pedir_a_andres', { titulo: 'P', descripcion: 'x' }, PELAYO);
    expect(b.falso.correos.length).toBeGreaterThanOrEqual(2);
    for (const c of b.falso.correos) {
      expect(c).not.toHaveProperty('html');
      expect(typeof c['text']).toBe('string');
      expect(String(c['subject'])).toMatch(/^\[Dive Clif\] /);
    }
  });
});
