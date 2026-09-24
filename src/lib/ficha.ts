import { FICHA_INICIAL, type Ficha } from './buceo';

const CLAVE = 'diveclif-ficha';
const EVENTO = 'ficha:cambio';

function esFicha(v: unknown): v is Ficha {
  if (typeof v !== 'object' || v === null) return false;
  const { rango, inmersiones } = v as Record<string, unknown>;
  return Number.isInteger(rango) && (rango as number) >= 0 && (rango as number) <= 3
    && Number.isInteger(inmersiones) && (inmersiones as number) >= 0 && (inmersiones as number) <= 1000;
}

let actual: Ficha = (() => {
  try {
    const guardada: unknown = JSON.parse(localStorage.getItem(CLAVE) ?? 'null');
    return esFicha(guardada) ? guardada : FICHA_INICIAL;
  } catch {
    return FICHA_INICIAL;
  }
})();

export function leerFicha(): Ficha {
  return actual;
}

export function actualizarFicha(cambio: Partial<Ficha>): void {
  actual = { ...actual, ...cambio };
  try {
    localStorage.setItem(CLAVE, JSON.stringify(actual));
  } catch {
    // modo privado o almacenamiento bloqueado: la ficha vive solo en memoria
  }
  document.dispatchEvent(new CustomEvent<Ficha>(EVENTO, { detail: actual }));
}

export function alCambiarFicha(fn: (f: Ficha) => void): void {
  document.addEventListener(EVENTO, (e) => fn((e as CustomEvent<Ficha>).detail));
  fn(actual);
}
