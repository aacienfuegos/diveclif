// Página de la propuesta en PAGINA_HOST.
import type { Env } from './entorno';
import type { Entrada } from './registro';
import { noEncontrado } from './respuestas';

const RE_ID = /^[a-z0-9]{1,40}$/;
const RE_CAPTURA = /^[a-z0-9-]+-(1500|390|360)$/;

export type RutaPagina =
  | { tipo: 'pagina'; id: string }
  | { tipo: 'publicar'; id: string }
  | { tipo: 'captura'; id: string; nombre: string };

/** Las tres rutas de la página; cualquier otra cosa es null (404). */
export function rutaPagina(metodo: string, ruta: string): RutaPagina | null {
  const partes = ruta.split('/');
  if (partes[0] !== '' || partes[1] !== 'p' || !RE_ID.test(partes[2] ?? '')) return null;
  const id = partes[2] ?? '';
  if (partes.length === 3 && metodo === 'GET') return { tipo: 'pagina', id };
  if (partes.length === 4 && partes[3] === 'publicar' && metodo === 'POST') return { tipo: 'publicar', id };
  if (partes.length === 5 && partes[3] === 'captura' && metodo === 'GET') {
    const fichero = partes[4] ?? '';
    const nombre = fichero.endsWith('.png') ? fichero.slice(0, -'.png'.length) : '';
    if (RE_CAPTURA.test(nombre)) return { tipo: 'captura', id, nombre };
  }
  return null;
}

export async function atenderPagina(request: Request, _env: Env, _correo: string, entrada: Entrada): Promise<Response> {
  const ruta = rutaPagina(request.method, new URL(request.url).pathname);
  if (ruta === null) return noEncontrado();
  entrada.propuesta = ruta.id;
  return noEncontrado();
}
