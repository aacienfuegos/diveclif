import { describe, expect, it } from 'vitest';
import { estadoPlazas, textoPlazas } from '../src/lib/plazas';
import { plazas, viaje } from '../src/lib/esquemas';

describe('plazas', () => {
  it('completo con 0, últimas de 1 a 3, abierto con más', () => {
    expect([0, 1, 3, 4, 20].map(estadoPlazas)).toEqual(['completo', 'ultimas', 'ultimas', 'abierto', 'abierto']);
  });

  it('solo dice el número con 3 o menos', () => {
    expect([0, 1, 2, 3, 4].map(textoPlazas)).toEqual(['Completo', 'Queda 1 plaza', 'Quedan 2 plazas', 'Quedan 3 plazas', null]);
  });

  it('libres entre 0 y total', () => {
    expect(plazas.safeParse({ total: 10, libres: 10 }).success).toBe(true);
    expect(plazas.safeParse({ total: 10, libres: 11 }).success).toBe(false);
    expect(plazas.safeParse({ total: 10, libres: -1 }).success).toBe(false);
    expect(plazas.safeParse({ total: 0, libres: 0 }).success).toBe(false);
  });
});

describe('organiza', () => {
  const base = {
    titulo: 'Prueba', destino: 'Cabo de Palos', inicio: '2027-01-10', fin: '2027-01-10', formato: 'barco', nivel: 'open-water',
    inmersionesMinimas: 0, inmersiones: 2, agua: { temperatura: '14 °C', traje: '7 mm' }, precioDesde: 90,
    plazas: { total: 10, libres: 4 }, resumen: 'Salida de prueba.',
  };

  it('internacionales y nacionales, solo Te Moana Expeditions', () => {
    expect(viaje.safeParse({ ...base, tipo: 'nacional', organiza: 'Te Moana Expeditions' }).success).toBe(true);
    expect(viaje.safeParse({ ...base, tipo: 'internacional', organiza: 'Naranjito Buceo' }).success).toBe(false);
  });

  it('day-trip, cualquier centro de 2 a 60 caracteres', () => {
    expect(viaje.safeParse({ ...base, tipo: 'day-trip', organiza: 'Naranjito Buceo' }).success).toBe(true);
    expect(viaje.safeParse({ ...base, tipo: 'day-trip', organiza: 'N' }).success).toBe(false);
    expect(viaje.safeParse({ ...base, tipo: 'day-trip', organiza: '<b>Naranjito</b>' }).success).toBe(false);
  });
});
