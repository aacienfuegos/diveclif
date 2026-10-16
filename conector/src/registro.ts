// Registro del Worker: solo estos campos. Nunca cabeceras, cookies, tokens, argumentos de
// herramientas ni cuerpos de respuestas de GitHub o Resend.
export interface Entrada {
  host: string;
  ruta: string;
  metodo: string;
  estado: number;
  propuesta?: string;
  herramienta?: string;
  error?: string;
}

export function registrar(entrada: Entrada): void {
  console.log(JSON.stringify(entrada));
}

/** Código que se registra para un error: el propio si lo tiene, si no `interno`. */
export function codigoError(error: unknown): string {
  return typeof error === 'object' && error !== null && 'codigo' in error && typeof error.codigo === 'string'
    ? error.codigo
    : 'interno';
}
