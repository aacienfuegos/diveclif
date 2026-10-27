// HTML de la página de la propuesta: sin JavaScript, sin estilos en línea y todo el texto escapado.
import { CSP_PAGINA } from './respuestas';

export function escapar(texto: string): string {
  return texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Plantilla con interpolación escapada: los valores nunca se insertan como HTML. */
export class Html {
  constructor(readonly fuente: string) {}
}

export function html(partes: TemplateStringsArray, ...valores: unknown[]): Html {
  let fuente = partes[0] ?? '';
  valores.forEach((v, i) => {
    fuente += aHtml(v) + (partes[i + 1] ?? '');
  });
  return new Html(fuente);
}

function aHtml(v: unknown): string {
  if (v instanceof Html) return v.fuente;
  if (Array.isArray(v)) return v.map(aHtml).join('');
  if (v === null || v === undefined || v === false) return '';
  return escapar(String(v));
}

export function documento(titulo: string, cuerpo: Html, estado = 200): Response {
  const fuente = html`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${titulo}</title>
</head>
<body>
${cuerpo}
</body>
</html>
`.fuente;
  return new Response(fuente, {
    status: estado,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Security-Policy': CSP_PAGINA,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
      'Cache-Control': 'no-store',
    },
  });
}
