// Respuestas del Worker. Todas con nosniff; las de la página llevan además su CSP.
export const CSP_PAGINA =
  "default-src 'none'; img-src 'self'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'";

export function texto(cuerpo: string, estado: number, cabeceras: Record<string, string> = {}): Response {
  return new Response(cuerpo, {
    status: estado,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', ...cabeceras },
  });
}

export function noEncontrado(): Response {
  return texto('No encontrado', 404);
}

export function prohibido(): Response {
  return texto('Prohibido', 403);
}
