export const NIVELES = ['ninguno', 'open-water', 'advanced', 'deep', 'tecnico'] as const;
export type Nivel = (typeof NIVELES)[number];

export const RANGO: Readonly<Record<Nivel, number>> = {
  ninguno: 0,
  'open-water': 1,
  advanced: 2,
  deep: 3,
  tecnico: 4,
};

export const NOMBRE_NIVEL: Readonly<Record<Nivel, string>> = {
  ninguno: 'Sin titulación',
  'open-water': 'Open Water',
  advanced: 'Advanced',
  deep: 'Deep',
  tecnico: 'Técnico',
};

const CURSO_POR_RANGO = ['', 'Open Water', 'Advanced Open Water', 'Deep Diver'] as const;

export const TITULACIONES = [
  { rango: 0, etiqueta: 'Sin titulación' },
  { rango: 1, etiqueta: 'Open Water' },
  { rango: 2, etiqueta: 'Advanced' },
  { rango: 3, etiqueta: 'Deep · 40 m' },
] as const;

export interface Ficha {
  readonly rango: number;
  readonly inmersiones: number;
}

export const FICHA_INICIAL: Ficha = { rango: 2, inmersiones: 25 };

export interface EvaluacionViaje {
  readonly ok: boolean;
  readonly cursos: readonly string[];
  readonly faltanInmersiones: number;
}

export function evaluarViaje(ficha: Ficha, nivel: Nivel, inmersiones: number): EvaluacionViaje {
  const objetivo = RANGO[nivel];
  const cursos = ficha.rango < objetivo ? CURSO_POR_RANGO.slice(Math.max(ficha.rango + 1, 1), objetivo + 1) : [];
  const faltanInmersiones = Math.max(0, inmersiones - ficha.inmersiones);
  return { ok: cursos.length === 0 && faltanInmersiones === 0, cursos, faltanInmersiones };
}

export function etiquetaEvaluacion(e: EvaluacionViaje): string {
  if (e.ok) return 'Puedes ir';
  if (e.cursos.length > 0) return 'Te falta un curso';
  return `Faltan ${e.faltanInmersiones} inm.`;
}

export interface VeredictoPunto {
  readonly ok: boolean;
  readonly texto: string;
}

export function evaluarPunto(ficha: Ficha, nivel: Nivel): VeredictoPunto {
  const objetivo = RANGO[nivel];
  if (nivel === 'tecnico') return { ok: false, texto: 'Buceo técnico: fuera de la oferta recreativa de Dive Clif.' };
  if (ficha.rango >= objetivo) {
    const texto = ficha.rango === 0 ? 'Perfecto para tu bautismo con Pelayo.' : `Con tu ${NOMBRE_NIVEL[NIVELES[ficha.rango] ?? 'ninguno']} puedes bajar aquí.`;
    return { ok: true, texto };
  }
  return { ok: false, texto: `Necesitas ${CURSO_POR_RANGO[objetivo]}. Lo haces con Pelayo entre Madrid y Cabo de Palos.` };
}

export function alcanzable(ficha: Ficha, nivel: Nivel): boolean {
  return nivel !== 'tecnico' && ficha.rango >= RANGO[nivel];
}
