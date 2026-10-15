export type EstadoPlazas = 'completo' | 'ultimas' | 'abierto';

// Con más de 3 libres no se dice cuántas quedan (decisión D2 de CIE-220)
const ULTIMAS = 3;

export function estadoPlazas(libres: number): EstadoPlazas {
  if (libres <= 0) return 'completo';
  return libres <= ULTIMAS ? 'ultimas' : 'abierto';
}

export function textoPlazas(libres: number): string | null {
  switch (estadoPlazas(libres)) {
    case 'completo':
      return 'Completo';
    case 'ultimas':
      return libres === 1 ? 'Queda 1 plaza' : `Quedan ${libres} plazas`;
    case 'abierto':
      return null;
  }
}
