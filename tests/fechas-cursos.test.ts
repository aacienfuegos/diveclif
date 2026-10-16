import { describe, expect, it } from 'vitest';
import { curso } from '../src/lib/esquemas';
import { proximas } from '../src/lib/viajes';

const conv = (inicio: string, fin: string) => ({ inicio, fin, lugar: 'madrid', plazas: { total: 6, libres: 3 } });
const base = { nombre: 'Advanced Open Water', orden: 3, linea: 'recreativa', resumen: 'Cinco inmersiones de aventura.' };

describe('convocatorias de cursos', () => {
  it('sin convocatorias, lista vacía', () => {
    expect(curso.parse(base).convocatorias).toEqual([]);
  });

  it('rechaza fin anterior a inicio y lugares desconocidos', () => {
    expect(curso.safeParse({ ...base, convocatorias: [conv('2027-02-07', '2027-02-06')] }).success).toBe(false);
    expect(curso.safeParse({ ...base, convocatorias: [{ ...conv('2027-02-06', '2027-02-07'), lugar: 'murcia' }] }).success).toBe(false);
  });

  it('próximas: sin las terminadas, la de hoy dentro, por fecha de inicio', () => {
    const { convocatorias } = curso.parse({
      ...base,
      convocatorias: [conv('2027-03-01', '2027-03-02'), conv('2026-09-01', '2026-09-02'), conv('2026-10-14', '2026-10-15'), conv('2026-11-01', '2026-11-02')],
    });
    const hoy = new Date('2026-10-15');
    expect(proximas(convocatorias, hoy).map((c) => c.inicio.toISOString().slice(0, 10))).toEqual(['2026-10-14', '2026-11-01', '2027-03-01']);
  });
});
