// Propuestas en D1. Cada una es de la identidad que la creó; para otra, no existe.
import { PROPUESTAS_ABIERTAS_IDENTIDAD } from './limites';

export interface Propuesta {
  id: string;
  correo: string;
  slug: string;
  rama: string;
  pr: number;
  sha: string;
  nuevo: number;
  creada: string;
  ultimo_commit: number;
  estado: string;
  motivos: string;
  visto_bueno: string | null;
  avisos: string;
}

export const CERRADAS = ['publicada', 'cerrada'];
const ABIERTA = "estado NOT IN ('publicada', 'cerrada')";
const RE_ID = /^[a-z2-7]{24}$/;
const ALFABETO = 'abcdefghijklmnopqrstuvwxyz234567';

/** 24 caracteres en base32: 120 bits aleatorios. */
export function nuevoId(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => ALFABETO[b & 31]).join('');
}

export const idValido = (id: string) => RE_ID.test(id);

export function deQuien(db: D1Database, id: string, correo: string): Promise<Propuesta | null> {
  return db.prepare('SELECT * FROM propuestas WHERE id = ?1 AND correo = ?2').bind(id, correo).first<Propuesta>();
}

export async function delCorreo(db: D1Database, correo: string): Promise<Propuesta[]> {
  const r = await db.prepare('SELECT * FROM propuestas WHERE correo = ?1 ORDER BY creada DESC').bind(correo).all<Propuesta>();
  return r.results;
}

export async function abiertas(db: D1Database): Promise<Propuesta[]> {
  const r = await db.prepare(`SELECT * FROM propuestas WHERE ${ABIERTA} AND estado != 'preparando'`).all<Propuesta>();
  return r.results;
}

export function abiertaDeSlug(db: D1Database, slug: string): Promise<Propuesta | null> {
  return db.prepare(`SELECT * FROM propuestas WHERE slug = ?1 AND ${ABIERTA}`).bind(slug).first<Propuesta>();
}

export async function contarAbiertas(db: D1Database, correo: string): Promise<number> {
  const r = await db.prepare(`SELECT count(*) AS n FROM propuestas WHERE correo = ?1 AND ${ABIERTA}`).bind(correo).first<{ n: number }>();
  return r?.n ?? 0;
}

/**
 * Reserva el slug antes de escribir en GitHub, si la identidad no está en el tope de abiertas: las
 * dos cosas en una sentencia, para que dos llamadas a la vez no pasen las dos del tope. `ocupado` si
 * ya hay otra propuesta abierta de ese viaje.
 */
export async function reservar(
  db: D1Database,
  p: { id: string; correo: string; slug: string; nuevo: boolean; creada: string },
): Promise<'ok' | 'ocupado' | 'tope'> {
  try {
    const fila = await db
      .prepare(
        `INSERT INTO propuestas (id, correo, slug, nuevo, creada, estado)
         SELECT ?1, ?2, ?3, ?4, ?5, 'preparando'
         WHERE (SELECT count(*) FROM propuestas WHERE correo = ?2 AND ${ABIERTA}) < ?6
         RETURNING id`,
      )
      .bind(p.id, p.correo, p.slug, p.nuevo ? 1 : 0, p.creada, PROPUESTAS_ABIERTAS_IDENTIDAD)
      .first();
    return fila === null ? 'tope' : 'ok';
  } catch (error) {
    if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) return 'ocupado';
    throw error;
  }
}

export async function completarReserva(db: D1Database, id: string, d: { rama: string; pr: number; sha: string; ahora: number }): Promise<void> {
  await db
    .prepare("UPDATE propuestas SET rama = ?2, pr = ?3, sha = ?4, ultimo_commit = ?5, estado = 'compilando' WHERE id = ?1")
    .bind(id, d.rama, d.pr, d.sha, d.ahora)
    .run();
}

export async function anularReserva(db: D1Database, id: string): Promise<void> {
  await db.prepare("DELETE FROM propuestas WHERE id = ?1 AND estado = 'preparando'").bind(id).run();
}

/** Apunta el commit si han pasado dos minutos desde el anterior, en una sola sentencia. */
export async function marcarCommit(db: D1Database, id: string, ahora: number, intervalo: number): Promise<boolean> {
  const fila = await db
    .prepare('UPDATE propuestas SET ultimo_commit = ?2 WHERE id = ?1 AND ultimo_commit <= ?3 RETURNING id')
    .bind(id, ahora, ahora - intervalo)
    .first();
  return fila !== null;
}

/** Deshace `marcarCommit` cuando el cambio se ha rechazado sin escribir nada. */
export async function desmarcarCommit(db: D1Database, id: string, marcado: number, anterior: number): Promise<void> {
  await db.prepare('UPDATE propuestas SET ultimo_commit = ?3 WHERE id = ?1 AND ultimo_commit = ?2').bind(id, marcado, anterior).run();
}

/** Commit nuevo del Worker: el visto bueno anterior deja de valer. */
export async function nuevoSha(db: D1Database, id: string, sha: string): Promise<void> {
  await db
    .prepare("UPDATE propuestas SET sha = ?2, estado = 'compilando', motivos = '[]', visto_bueno = NULL WHERE id = ?1")
    .bind(id, sha)
    .run();
}

export async function cambiarEstado(db: D1Database, id: string, estado: string, motivos: unknown[] = []): Promise<void> {
  await db.prepare('UPDATE propuestas SET estado = ?2, motivos = ?3 WHERE id = ?1').bind(id, estado, JSON.stringify(motivos)).run();
}
