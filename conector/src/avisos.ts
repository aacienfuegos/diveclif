// Avisos por correo: uno por SHA y estado de cada propuesta.
import { enviar, type Correo } from './correo';
import type { Env } from './entorno';

/** Apunta el aviso `clave` en la propuesta; false si ya estaba apuntado. */
async function reservarAviso(db: D1Database, id: string, clave: string): Promise<boolean> {
  const fila = await db
    .prepare(
      `UPDATE propuestas SET avisos = json_insert(avisos, '$[#]', ?2)
       WHERE id = ?1 AND NOT EXISTS (SELECT 1 FROM json_each(propuestas.avisos) WHERE value = ?2)
       RETURNING id`,
    )
    .bind(id, clave)
    .first();
  return fila !== null;
}

async function liberarAviso(db: D1Database, id: string, clave: string): Promise<void> {
  await db
    .prepare(
      `UPDATE propuestas SET avisos = (SELECT json_group_array(value) FROM json_each(propuestas.avisos) WHERE value != ?2)
       WHERE id = ?1`,
    )
    .bind(id, clave)
    .run();
}

export type ResultadoAviso = 'enviado' | 'ya-enviado' | 'pendiente';

/**
 * Manda el correo si no se ha mandado ya el aviso `<sha>:<estado>`. Con el tope de correos
 * alcanzado no llama a Resend y el aviso queda pendiente: la siguiente vuelta del cron lo reintenta.
 */
export async function avisarUnaVez(env: Env, id: string, sha: string, estado: string, correo: Correo): Promise<ResultadoAviso> {
  const clave = `${sha}:${estado}`;
  if (!(await reservarAviso(env.DB, id, clave))) return 'ya-enviado';
  try {
    if (await enviar(env, correo)) return 'enviado';
  } catch (error) {
    await liberarAviso(env.DB, id, clave);
    throw error;
  }
  await liberarAviso(env.DB, id, clave);
  return 'pendiente';
}
