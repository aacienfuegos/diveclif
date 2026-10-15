import { describe, expect, it } from 'vitest';
import { actividad } from '../src/lib/esquemas';

const base = {
  titulo: 'Biología marina', tipo: 'taller', inicio: '2026-11-20', fin: '2026-11-22', lugar: 'La Herradura, Granada',
  precio: 290, plazas: { total: 10, libres: 3 }, resumen: 'Fin de semana con buceo y charlas.',
};

describe('actividades', () => {
  it('acepta una actividad válida', () => {
    expect(actividad.safeParse(base).success).toBe(true);
  });

  it('el título cabe en "interes" del formulario', () => {
    expect(actividad.safeParse({ ...base, titulo: 'x'.repeat(100) }).success).toBe(true);
    expect(actividad.safeParse({ ...base, titulo: 'x'.repeat(101) }).success).toBe(false);
    expect(`Actividad: ${'x'.repeat(100)}`.length).toBeLessThanOrEqual(120);
  });

  it('rechaza fin anterior a inicio, tipos desconocidos y precio negativo', () => {
    expect(actividad.safeParse({ ...base, fin: '2026-11-19' }).success).toBe(false);
    expect(actividad.safeParse({ ...base, tipo: 'curso' }).success).toBe(false);
    expect(actividad.safeParse({ ...base, precio: -1 }).success).toBe(false);
  });
});
