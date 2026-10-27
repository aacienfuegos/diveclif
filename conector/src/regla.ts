// La regla de cambio pequeño sobre el fichero que va a escribir el Worker, antes de escribirlo.
// El workflow cambio-pequeno.yml no se fía del Worker y la vuelve a pasar sobre el PR.
import { evaluar, leerDominios, MOTIVOS } from '../../.github/cambio-pequeno/regla.mjs';
import config from '../../.github/cambio-pequeno/config.json';
import dominiosTxt from '../../.github/cambio-pequeno/dominios.txt';
import { rutaViaje } from './viaje';

const dominios = leerDominios(dominiosTxt);

/** null si pasa; si no, los motivos en llano. */
export function pasaLaRegla(slug: string, nuevo: boolean, contenido: string, rama: string, repo: string, fechaPr: string): string | null {
  const { pequeno, motivos } = evaluar(
    [{ nombre: rutaViaje(slug), estado: nuevo ? 'added' : 'modified', modo: '100644', contenido }],
    { autor: config.autor, rama, repoCabeza: repo, fechaPr, config, dominios },
  );
  if (pequeno) return null;
  const textos = [...new Set(motivos.map((m) => (MOTIVOS as Record<string, string>)[m.codigo] ?? m.codigo))];
  return `No puedo preparar este cambio: ${textos.join(' ')}`;
}
