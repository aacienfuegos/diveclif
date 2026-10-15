import { getEntry } from 'astro:content';
import type { Textos } from './esquemas';

type Seccion = Textos['seccion'];
type TextosDe<S extends Seccion> = Extract<Textos, { seccion: S }>;

const esDe = <S extends Seccion>(t: Textos, seccion: S): t is TextosDe<S> => t.seccion === seccion;

export async function texto<S extends Seccion>(seccion: S): Promise<TextosDe<S>> {
  const entrada = await getEntry('textos', seccion);
  if (!entrada) throw new Error(`Falta src/content/textos/${seccion}.json`);
  if (!esDe(entrada.data, seccion)) throw new Error(`src/content/textos/${seccion}.json dice "seccion": "${entrada.data.seccion}"`);
  return entrada.data;
}

// Sin espacio delante de la puntuación: "¿Sabías que…?", "Cabo de Palos, con Naranjito"
export const pegado = (siguiente: string): boolean => /^[.,;:!?…)»]/.test(siguiente);
