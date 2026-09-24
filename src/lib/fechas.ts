const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'] as const;

const dd = (d: Date) => String(d.getUTCDate()).padStart(2, '0');
const mes = (d: Date) => MESES[d.getUTCMonth()];

export function rangoFechas(inicio: Date, fin: Date): string {
  if (inicio.getTime() === fin.getTime()) return `${dd(inicio)} ${mes(inicio)} ${inicio.getUTCFullYear()}`;
  const mismoMes = inicio.getUTCMonth() === fin.getUTCMonth() && inicio.getUTCFullYear() === fin.getUTCFullYear();
  if (mismoMes) return `${dd(inicio)}–${dd(fin)} ${mes(fin)} ${fin.getUTCFullYear()}`;
  return `${dd(inicio)} ${mes(inicio)}–${dd(fin)} ${mes(fin)} ${fin.getUTCFullYear()}`;
}

export function duracionDias(inicio: Date, fin: Date): number {
  return Math.round((fin.getTime() - inicio.getTime()) / 86_400_000) + 1;
}

export function isoFecha(d: Date): string {
  return d.toISOString().slice(0, 10);
}
