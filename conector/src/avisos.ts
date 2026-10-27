// Avisos por correo: uno por SHA y estado de cada propuesta.
import { motivosDeLaRegla } from './cambio';
import { capturasDelRun, type Almacen } from './capturas';
import { enviar, type Correo } from './correo';
import type { Env } from './entorno';
import { GitHub, type Pr } from './github';
import { frases, type Motivo } from './motivos';
import { vistaPrevia } from './pages';
import { abiertas, cambiarEstado, type Propuesta } from './propuestas';
import { codigoError, registrar, type Entrada } from './registro';
import { runsQueCuentan, veredicto } from './runs';
import { rutaViaje } from './viaje';

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
 * Hace `accion` una sola vez por `clave`. Si lanza o devuelve false, la clave se libera y la
 * siguiente vuelta del cron lo reintenta.
 */
async function unaVez(db: D1Database, id: string, clave: string, accion: () => Promise<boolean>): Promise<ResultadoAviso> {
  if (!(await reservarAviso(db, id, clave))) return 'ya-enviado';
  try {
    if (await accion()) return 'enviado';
  } catch (error) {
    await liberarAviso(db, id, clave);
    throw error;
  }
  await liberarAviso(db, id, clave);
  return 'pendiente';
}

/**
 * Manda el correo si no se ha mandado ya el aviso `<sha>:<estado>`. Con el tope de correos
 * alcanzado no llama a Resend y el aviso queda pendiente: la siguiente vuelta del cron lo reintenta.
 */
export function avisarUnaVez(env: Env, id: string, sha: string, estado: string, correo: Correo): Promise<ResultadoAviso> {
  return unaVez(env.DB, id, `${sha}:${estado}`, () => enviar(env, correo));
}

/**
 * Comentario en el PR y correo a Andrés por el visto bueno al SHA de la propuesta, cada uno una
 * sola vez. Lo llaman el botón y cada vuelta del cron, así que lo que falle se reintenta solo.
 */
export async function avisarVistoBueno(env: Env, gh: GitHub, p: Propuesta): Promise<void> {
  const claves = [`${p.sha}:comentario-visto-bueno`, `${p.sha}:esperando-andres`];
  const hechos: unknown = JSON.parse(p.avisos);
  if (Array.isArray(hechos) && claves.every((c) => hechos.includes(c))) return;
  await unaVez(env.DB, p.id, `${p.sha}:comentario-visto-bueno`, async () => {
    await gh.json('POST', `issues/${p.pr}/comments`, { body: `Visto bueno de ${p.correo} al commit ${p.sha}.` });
    return true;
  });
  const vista = await vistaPrevia(env, p.sha);
  await avisarUnaVez(env, p.id, p.sha, 'esperando-andres', {
    para: env.CORREO_ANDRES,
    asunto: `Visto bueno de ${p.correo}: viaje ${p.slug}`,
    texto:
      `${p.correo} da el visto bueno al commit ${p.sha} del viaje ${p.slug}.\n\n` +
      `PR: https://github.com/${env.REPO}/pull/${p.pr}\nFichero: ${rutaViaje(p.slug)}\nVista previa: ${vista ?? 'aún no está lista'}\n\n` +
      'Para publicarlo, revisa y mergea el PR en GitHub.\n',
  });
}

/** Ronda del cron: mira cada propuesta abierta, actualiza su estado y manda los avisos que falten. */
export async function vuelta(env: Env, almacen: Almacen): Promise<void> {
  // Reservas que se quedaron a medias (el Worker se cortó entre D1 y GitHub).
  await env.DB.prepare("DELETE FROM propuestas WHERE estado = 'preparando' AND creada < ?1")
    .bind(new Date(Date.now() - 10 * 60 * 1000).toISOString())
    .run();
  const gh = new GitHub(env);
  for (const p of await abiertas(env.DB)) {
    const entrada: Entrada = { host: 'cron', ruta: 'avisos', metodo: 'CRON', estado: 200, propuesta: p.id };
    try {
      await revisar(env, gh, almacen, p);
    } catch (error) {
      entrada.estado = 500;
      entrada.error = codigoError(error);
    }
    registrar(entrada);
  }
}

const pagina = (env: Env, p: Propuesta) => `https://${env.PAGINA_HOST}/p/${p.id}`;

/**
 * Si el PR ya está mergeado o cerrado, manda el "Publicado", borra la rama y cierra la propuesta.
 * True si el PR ya no está abierto. Si el aviso queda pendiente o algo falla, la propuesta sigue
 * abierta y la siguiente vuelta lo reintenta.
 */
export async function cerrarSiTerminada(env: Env, gh: GitHub, p: Propuesta, pr: Pr): Promise<boolean> {
  if (pr.merged) {
    const r = await avisarUnaVez(env, p.id, p.sha, 'publicada', {
      para: p.correo,
      asunto: `Publicado: viaje ${p.slug}`,
      texto: `El viaje ${p.slug} ya está en la web.\n`,
    });
    if (r === 'pendiente') return true;
    await gh.borrarRama(p.rama);
    await cambiarEstado(env.DB, p.id, 'publicada');
    return true;
  }
  if (pr.state !== 'open') {
    await gh.borrarRama(p.rama);
    await cambiarEstado(env.DB, p.id, 'cerrada');
    return true;
  }
  return false;
}

async function revisar(env: Env, gh: GitHub, almacen: Almacen, p: Propuesta): Promise<void> {
  const pr = await gh.pr(p.pr);
  if (await cerrarSiTerminada(env, gh, p, pr)) return;

  let motivos: Motivo[] = [];
  if (pr.head.sha !== p.sha) motivos = [{ codigo: 'pr-cambiado' }];
  else {
    const runs = await runsQueCuentan(gh, p.sha, p.pr);
    const v = veredicto(runs);
    if (v.tipo === 'pendiente') {
      if (p.estado !== 'compilando') await cambiarEstado(env.DB, p.id, 'compilando');
      return;
    }
    if (v.tipo === 'verde') {
      if (p.visto_bueno === p.sha) {
        await avisarVistoBueno(env, gh, p);
        return;
      }
      if (p.estado !== 'lista') await cambiarEstado(env.DB, p.id, 'lista');
      await avisarUnaVez(env, p.id, p.sha, 'lista', {
        para: p.correo,
        asunto: `Tu viaje está listo para ver: ${p.slug}`,
        texto: `La propuesta ${p.id} del viaje ${p.slug} está lista. Mírala y, si está bien, pulsa Publicar:\n${pagina(env, p)}\n`,
      });
      return;
    }
    if (v.fallidos.includes('cambio-pequeno')) motivos.push(...(await motivosDeLaRegla(gh, pr)));
    if (v.fallidos.includes('build')) motivos.push({ codigo: 'build' });
    if (v.fallidos.includes('visual') && runs.visual !== undefined) motivos.push(...(await capturasDelRun(gh, almacen, runs.visual, p.sha)).motivos);
    if (motivos.length === 0) motivos.push({ codigo: 'visual-generico' });
  }
  await cambiarEstado(env.DB, p.id, 'no-publicable', motivos);
  await avisarUnaVez(env, p.id, p.sha, 'no-publicable', {
    para: p.correo,
    asunto: `No se puede publicar solo: viaje ${p.slug}`,
    texto:
      `La propuesta ${p.id} del viaje ${p.slug} no se puede publicar sola porque:\n` +
      frases(JSON.stringify(motivos))
        .map((f) => `- ${f}\n`)
        .join('') +
      `\nPuedes cambiarla desde Claude o pedírselo a Andrés. Su página: ${pagina(env, p)}\n`,
  });
}
