export interface Pez {
  readonly x: number;
  readonly y: number;
  readonly ancho: number;
  readonly giro: number;
}

// PRNG determinista: el mismo build produce siempre el mismo dibujo
function mulberry32(semilla: number): () => number {
  let a = semilla;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function banco(n: number, cx: number, cy: number, rx: number, ry: number, ancho: number, semilla: number): Pez[] {
  const rnd = mulberry32(semilla);
  return Array.from({ length: n }, () => {
    const a = rnd() * Math.PI * 2;
    const r = Math.sqrt(rnd());
    return {
      x: Math.round(cx + Math.cos(a) * rx * r),
      y: Math.round(cy + Math.sin(a) * ry * r),
      ancho: Math.round(ancho * (0.7 + rnd() * 0.5)),
      giro: Math.round((rnd() - 0.5) * 8),
    };
  });
}
