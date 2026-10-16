// Avisos por correo: uno por SHA y estado de cada propuesta.
import { motivosDeLaRegla } from './cambio';
import { capturasDelRun, type Almacen } from './capturas';
import { enviar, type Correo } from './correo';
import type { Env } from './entorno';
import { GitHub } from './github';
import { frases, type Motivo } from './motivos';
import { abiertas, cambiarEstado, type Propuesta } from './propuestas';
import { codigoError, registrar, type Entrada } from './registro';
import { runsQueCuentan, veredicto } from './runs';

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

async function revisar(env: Env, gh: GitHub, almacen: Almacen, p: Propuesta): Promise<void> {
  const pr = await gh.pr(p.pr);
  if (pr.merged) {
    const r = await avisarUnaVez(env, p.id, p.sha, 'publicada', {
      para: p.correo,
      asunto: `Publicado: viaje ${p.slug}`,
      texto: `El viaje ${p.slug} ya está en la web.\n`,
    });
    // Si el aviso queda pendiente, la propuesta sigue abierta para que la próxima vuelta lo mande.
    if (r !== 'pendiente') await cambiarEstado(env.DB, p.id, 'publicada');
    return;
  }
  if (pr.state !== 'open') {
    await cambiarEstado(env.DB, p.id, 'cerrada');
    return;
  }

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
      if (p.visto_bueno === p.sha) return;
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
