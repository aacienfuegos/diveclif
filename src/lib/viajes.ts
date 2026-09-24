export const FORMATO: Readonly<Record<'vida-a-bordo' | 'desde-tierra' | 'barco', string>> = {
  'vida-a-bordo': 'Vida a bordo',
  'desde-tierra': 'Desde tierra',
  barco: 'Barco',
};

const euros = new Intl.NumberFormat('es-ES', { useGrouping: 'always', maximumFractionDigits: 0 });

export function precio(eur: number): string {
  return `${euros.format(eur)} €`;
}

export function proximos<T extends { data: { fin: Date; inicio: Date } }>(viajes: readonly T[], hoy: Date): T[] {
  return viajes.filter((v) => v.data.fin >= hoy).sort((a, b) => a.data.inicio.getTime() - b.data.inicio.getTime());
}
