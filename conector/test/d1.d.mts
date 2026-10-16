export interface D1DePrueba extends D1Database {
  sql(sql: string, ...params: (string | number | null)[]): Record<string, unknown>[];
}
export function crearD1(): D1DePrueba;
