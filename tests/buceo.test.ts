import { describe, expect, it } from 'vitest';
import { alcanzable, etiquetaEvaluacion, evaluarPunto, evaluarViaje } from '../src/lib/buceo';
import { formatearCoordenadas, proyectar } from '../src/lib/carta';
import { duracionDias, rangoFechas } from '../src/lib/fechas';
import { consultaSchema } from '../src/lib/contacto';

describe('evaluarViaje', () => {
  it('apto cuando cumple titulación e inmersiones', () => {
    const e = evaluarViaje({ rango: 2, inmersiones: 30 }, 'advanced', 30);
    expect(e).toEqual({ ok: true, cursos: [], faltanInmersiones: 0 });
    expect(etiquetaEvaluacion(e)).toBe('Puedes ir');
  });

  it('lista todos los cursos que faltan desde cero', () => {
    const e = evaluarViaje({ rango: 0, inmersiones: 0 }, 'advanced', 0);
    expect(e.cursos).toEqual(['Open Water', 'Advanced Open Water']);
    expect(etiquetaEvaluacion(e)).toBe('Te falta un curso');
  });

  it('cuenta las inmersiones que faltan', () => {
    const e = evaluarViaje({ rango: 3, inmersiones: 10 }, 'open-water', 25);
    expect(e.faltanInmersiones).toBe(15);
    expect(etiquetaEvaluacion(e)).toBe('Faltan 15 inm.');
  });
});

describe('evaluarPunto', () => {
  it('los puntos técnicos nunca son alcanzables', () => {
    expect(evaluarPunto({ rango: 3, inmersiones: 500 }, 'tecnico').ok).toBe(false);
    expect(alcanzable({ rango: 3, inmersiones: 500 }, 'tecnico')).toBe(false);
  });

  it('pide el curso siguiente cuando no llega', () => {
    const v = evaluarPunto({ rango: 1, inmersiones: 10 }, 'deep');
    expect(v.ok).toBe(false);
    expect(v.texto).toContain('Deep Diver');
  });

  it('sin titulación solo vale para bautismo', () => {
    expect(evaluarPunto({ rango: 0, inmersiones: 0 }, 'ninguno').texto).toContain('bautismo');
    expect(alcanzable({ rango: 0, inmersiones: 0 }, 'open-water')).toBe(false);
  });
});

describe('carta', () => {
  it('proyecta el faro de Cabo de Palos dentro de la carta', () => {
    const { x, y } = proyectar(37.6346, -0.6906);
    expect(x).toBeGreaterThan(380);
    expect(x).toBeLessThan(420);
    expect(y).toBeGreaterThan(460);
    expect(y).toBeLessThan(500);
  });

  it('formatea en grados y minutos', () => {
    expect(formatearCoordenadas(37.6682, -0.6297)).toBe('37°40.1′N · 0°37.8′W');
  });
});

describe('fechas', () => {
  it('agrupa el mes cuando coincide', () => {
    expect(rangoFechas(new Date('2026-12-05'), new Date('2026-12-14'))).toBe('05–14 dic 2026');
    expect(duracionDias(new Date('2026-12-05'), new Date('2026-12-14'))).toBe(10);
  });

  it('muestra ambos meses cuando cambian', () => {
    expect(rangoFechas(new Date('2027-04-30'), new Date('2027-05-03'))).toBe('30 abr–03 may 2027');
  });
});

describe('consultaSchema', () => {
  const base = {
    nombre: 'Lucía',
    email: 'lucia@ejemplo.com',
    interes: 'Baja California Sur',
    titulacion: 'Open Water',
    mensaje: '¿Quedan plazas?',
    web: '',
    'cf-turnstile-response': 'token',
  };

  it('acepta una consulta válida', () => {
    expect(consultaSchema.safeParse(base).success).toBe(true);
  });

  it('rechaza el honeypot relleno', () => {
    expect(consultaSchema.safeParse({ ...base, web: 'http://spam' }).success).toBe(false);
  });

  it('rechaza emails inválidos y mensajes enormes', () => {
    expect(consultaSchema.safeParse({ ...base, email: 'no-es-email' }).success).toBe(false);
    expect(consultaSchema.safeParse({ ...base, mensaje: 'x'.repeat(2001) }).success).toBe(false);
  });
});
