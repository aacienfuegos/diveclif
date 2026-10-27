// Motivos de que una propuesta no se pueda publicar sola: se guardan como códigos y se enseñan
// como frases fijas. Ningún texto que venga de fuera (artefactos, GitHub) llega a la página ni al correo.
import { MOTIVOS } from '../../.github/cambio-pequeno/regla.mjs';

export interface Motivo {
  codigo: string;
  pagina?: string;
  ancho?: number;
}

export const ANCHOS = [1500, 390, 360] as const;
export const TIPOS_VISUAL = ['desborde', 'csp', 'solape-hud', 'error-carga'] as const;

const FIJAS: Record<string, string> = {
  build: 'La web no compila con este cambio.',
  'visual-generico': 'La revisión automática ha fallado.',
  'pr-cambiado': 'La propuesta ha cambiado fuera del conector; la revisa Andrés.',
};

function dispositivo(ancho: number | undefined): string {
  return ancho === 1500 ? 'En el ordenador' : `En el móvil (${ancho === 390 ? 390 : 360} px)`;
}

function sitio(pagina: string | undefined): string {
  if (pagina === '/') return 'la portada';
  if (pagina?.startsWith('/viajes/') === true) return 'la ficha del viaje';
  return 'una página de la web';
}

export function frase(m: Motivo): string {
  const regla = (MOTIVOS as Record<string, string>)[m.codigo];
  if (regla !== undefined) return regla;
  const fija = FIJAS[m.codigo];
  if (fija !== undefined) return fija;
  switch (m.codigo) {
    case 'visual-desborde':
      return `${dispositivo(m.ancho)}, ${sitio(m.pagina)} se sale de la pantalla.`;
    case 'visual-csp':
      return `${dispositivo(m.ancho)}, ${sitio(m.pagina)} intenta cargar algo que la web bloquea.`;
    case 'visual-solape-hud':
      return `${dispositivo(m.ancho)}, el ordenador de buceo tapa un enlace o un botón de la portada.`;
    case 'visual-error-carga':
      return `${dispositivo(m.ancho)}, ${sitio(m.pagina)} no carga.`;
    default:
      return FIJAS['visual-generico'] ?? '';
  }
}

export function frases(motivosJson: string): string[] {
  let lista: unknown;
  try {
    lista = JSON.parse(motivosJson);
  } catch {
    lista = [];
  }
  if (!Array.isArray(lista)) return [];
  return [...new Set(lista.map((m: Motivo) => frase(m)))];
}
