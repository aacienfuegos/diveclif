// Límites del conector, contra un bucle o una IA inyectada con las herramientas en "permitir siempre".
// Cambiarlos es un PR con revisión. Los periodos van en UTC.

/** Commits (proponer_viaje y cambiar_viaje) al día por identidad. */
export const COMMITS_DIA_IDENTIDAD = 20;
/** Milisegundos mínimos entre dos commits de la misma propuesta. */
export const COMMIT_INTERVALO_PROPUESTA_MS = 2 * 60 * 1000;
/** Commits al mes en total: cada uno es una compilación de Pages, que da 500 al mes en Free. */
export const COMMITS_MES_TOTAL = 150;
/** pedir_a_andres al día por identidad. */
export const PETICIONES_DIA_IDENTIDAD = 5;
/** Correos del Worker: Resend da 100 al día y 3.000 al mes, compartidos con el formulario de contacto. */
export const CORREOS_DIA_TOTAL = 40;
export const CORREOS_MES_TOTAL = 1000;
/** Propuestas abiertas a la vez por identidad. */
export const PROPUESTAS_ABIERTAS_IDENTIDAD = 10;

export const dia = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 10);
export const mes = (ms = Date.now()) => new Date(ms).toISOString().slice(0, 7);

export interface Contador {
  clave: string;
  tipo: string;
  periodo: string;
  tope: number;
}

/** Suma uno si no se ha llegado al tope, en una sola sentencia. Devuelve false si ya estaba en el tope. */
export async function sumar(db: D1Database, c: Contador): Promise<boolean> {
  const fila = await db
    .prepare(
      `INSERT INTO contadores (clave, tipo, periodo, cuenta) VALUES (?1, ?2, ?3, 1)
       ON CONFLICT (clave, tipo, periodo) DO UPDATE SET cuenta = cuenta + 1 WHERE cuenta < ?4
       RETURNING cuenta`,
    )
    .bind(c.clave, c.tipo, c.periodo, c.tope)
    .first<{ cuenta: number }>();
  return fila !== null && fila.cuenta <= c.tope;
}

/** Devuelve lo sumado por `sumar` cuando un límite posterior no deja seguir. */
export async function devolver(db: D1Database, c: Contador): Promise<void> {
  await db
    .prepare('UPDATE contadores SET cuenta = cuenta - 1 WHERE clave = ?1 AND tipo = ?2 AND periodo = ?3 AND cuenta > 0')
    .bind(c.clave, c.tipo, c.periodo)
    .run();
}

/** Suma todos o ninguno: si uno está en el tope, devuelve los anteriores y da el que ha fallado. */
export async function sumarTodos(db: D1Database, contadores: Contador[]): Promise<Contador | null> {
  const sumados: Contador[] = [];
  for (const c of contadores) {
    if (!(await sumar(db, c))) {
      for (const s of sumados) await devolver(db, s);
      return c;
    }
    sumados.push(c);
  }
  return null;
}

export const commitsDia = (correo: string): Contador => ({ clave: correo, tipo: 'commits', periodo: dia(), tope: COMMITS_DIA_IDENTIDAD });
export const commitsMes = (): Contador => ({ clave: 'global', tipo: 'commits', periodo: mes(), tope: COMMITS_MES_TOTAL });
export const peticionesDia = (correo: string): Contador => ({ clave: correo, tipo: 'peticiones', periodo: dia(), tope: PETICIONES_DIA_IDENTIDAD });
export const correosDia = (): Contador => ({ clave: 'global', tipo: 'correos', periodo: dia(), tope: CORREOS_DIA_TOTAL });
export const correosMes = (): Contador => ({ clave: 'global', tipo: 'correos', periodo: mes(), tope: CORREOS_MES_TOTAL });
