// Página de la propuesta en PAGINA_HOST: qué cambia, capturas, vista previa y el botón "Publicar".
// Solo la ve la identidad dueña de la propuesta; para otra, 404 como un id inventado.
import { capturasDelRun, leerIndice, RE_CAPTURA, type Almacen, type Indice } from './capturas';
import { avisarUnaVez, avisarVistoBueno, cerrarSiTerminada } from './avisos';
import type { Env } from './entorno';
import { GitHub, type Pr } from './github';
import { documento, html, type Html } from './html';
import { frase, frases, type Motivo } from './motivos';
import { vistaPrevia } from './pages';
import { CERRADAS, deQuien, idValido, type Propuesta } from './propuestas';
import { codigoError, type Entrada } from './registro';
import { CSP_PAGINA, noEncontrado } from './respuestas';
import { runsQueCuentan, veredicto, type Run, type Veredicto, type Workflow } from './runs';
import { leerViaje, rutaViaje } from './viaje';
import config from '../../.github/cambio-pequeno/config.json';

const RE_ID = /^[a-z0-9]{1,40}$/;
/** El token del botón caduca a los 10 minutos. */
export const TOKEN_MS = 10 * 60 * 1000;

export type RutaPagina =
  | { tipo: 'pagina'; id: string }
  | { tipo: 'publicar'; id: string }
  | { tipo: 'captura'; id: string; nombre: string };

/** Las tres rutas de la página; cualquier otra cosa es null (404). */
export function rutaPagina(metodo: string, ruta: string): RutaPagina | null {
  const partes = ruta.split('/');
  if (partes[0] !== '' || partes[1] !== 'p' || !RE_ID.test(partes[2] ?? '')) return null;
  const id = partes[2] ?? '';
  if (partes.length === 3 && metodo === 'GET') return { tipo: 'pagina', id };
  if (partes.length === 4 && partes[3] === 'publicar' && metodo === 'POST') return { tipo: 'publicar', id };
  if (partes.length === 5 && partes[3] === 'captura' && metodo === 'GET') {
    const fichero = partes[4] ?? '';
    const nombre = fichero.endsWith('.png') ? fichero.slice(0, -'.png'.length) : '';
    if (RE_CAPTURA.test(nombre)) return { tipo: 'captura', id, nombre };
  }
  return null;
}

export async function atenderPagina(request: Request, env: Env, correo: string, entrada: Entrada, almacen: Almacen): Promise<Response> {
  const ruta = rutaPagina(request.method, new URL(request.url).pathname);
  if (ruta === null) return noEncontrado();
  entrada.propuesta = ruta.id;
  const p = idValido(ruta.id) ? await deQuien(env.DB, ruta.id, correo) : null;
  if (p === null || p.estado === 'preparando') return noEncontrado();
  const gh = new GitHub(env);
  if (ruta.tipo === 'captura') return captura(gh, almacen, p, ruta.nombre);
  if (ruta.tipo === 'publicar') return publicar(request, env, gh, p, correo, entrada);
  return pagina(env, gh, almacen, p, correo);
}

interface Situacion {
  pr: Pr;
  runs: Partial<Record<Workflow, Run>>;
  veredicto: Veredicto;
  /** null si se puede publicar; si no, por qué. */
  bloqueo: string[] | null;
}

/** Lo que tiene que cumplirse para el botón: PR abierto, su cabeza es el último SHA del Worker y los tres workflows en verde. */
async function situacion(gh: GitHub, p: Propuesta, indice: (runs: Partial<Record<Workflow, Run>>) => Promise<Indice | null>): Promise<Situacion> {
  const pr = await gh.pr(p.pr);
  const runs = await runsQueCuentan(gh, p.sha, p.pr);
  const v = veredicto(runs);
  let bloqueo: string[] | null = null;
  if (pr.merged) bloqueo = ['Ya está publicada.'];
  else if (pr.state !== 'open') bloqueo = ['Andrés la ha cerrado sin publicar.'];
  else if (pr.head.sha !== p.sha) bloqueo = [frase({ codigo: 'pr-cambiado' })];
  else if (v.tipo === 'pendiente') bloqueo = ['La revisión automática todavía no ha terminado. Vuelve a cargar la página en unos minutos.'];
  else if (v.tipo === 'rojo') bloqueo = await motivosRojo(v.fallidos, p, () => indice(runs));
  return { pr, runs, veredicto: v, bloqueo };
}

async function motivosRojo(fallidos: Workflow[], p: Propuesta, indice: () => Promise<Indice | null>): Promise<string[]> {
  const guardados = frases(p.motivos);
  if (guardados.length > 0) return guardados;
  const motivos: Motivo[] = [];
  if (fallidos.includes('cambio-pequeno')) motivos.push({ codigo: 'regla-generica' });
  if (fallidos.includes('build')) motivos.push({ codigo: 'build' });
  if (fallidos.includes('visual')) motivos.push(...((await indice())?.motivos ?? [{ codigo: 'visual-generico' }]));
  return [...new Set(motivos.map((m) => (m.codigo === 'regla-generica' ? 'El cambio no cumple las reglas para publicarse solo.' : frase(m))))];
}

function valorLegible(v: unknown): string {
  if (v === undefined) return '';
  if (Array.isArray(v)) return v.map(valorLegible).join(', ');
  if (v !== null && typeof v === 'object') return Object.entries(v).map(([k, x]) => `${k}: ${valorLegible(x)}`).join(', ');
  return String(v);
}

/** Campo a campo: lo que hay en main y lo que deja la propuesta. */
async function cambios(gh: GitHub, p: Propuesta): Promise<{ campo: string; antes: string; ahora: string }[]> {
  const [enMain, enPropuesta] = await Promise.all([gh.leer(rutaViaje(p.slug), 'main'), gh.leer(rutaViaje(p.slug), p.sha)]);
  const antes = enMain === null ? {} : (leerViaje(enMain.contenido) ?? {});
  const ahora = enPropuesta === null ? {} : (leerViaje(enPropuesta.contenido) ?? {});
  return [...config.clavesViaje, 'cuerpo']
    .map((campo) => ({ campo, antes: valorLegible(antes[campo]), ahora: valorLegible(ahora[campo]) }))
    .filter((c) => c.antes !== c.ahora);
}

async function crearToken(db: D1Database, p: Propuesta, correo: string): Promise<string> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const ahora = Date.now();
  await db.prepare('DELETE FROM tokens_publicar WHERE caduca < ?1').bind(ahora).run();
  await db
    .prepare('INSERT INTO tokens_publicar (hash, pr, sha, correo, caduca) VALUES (?1, ?2, ?3, ?4, ?5)')
    .bind(await hash(token), p.pr, p.sha, correo, ahora + TOKEN_MS)
    .run();
  return token;
}

async function hash(token: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function pagina(env: Env, gh: GitHub, almacen: Almacen, p: Propuesta, correo: string): Promise<Response> {
  let indice: Promise<Indice | null> | null = null;
  const leer = (runs: Partial<Record<Workflow, Run>>) =>
    (indice ??= runs.visual?.status === 'completed' ? capturasDelRun(gh, almacen, runs.visual, p.sha) : Promise.resolve(null));
  const s = await situacion(gh, p, leer);
  const [lista, vista, art] = await Promise.all([cambios(gh, p), vistaPrevia(env, p.sha), leer(s.runs)]);
  const capturas = art?.nombres ?? [];
  const vistoBueno = p.visto_bueno === p.sha;
  const token = s.bloqueo === null && !vistoBueno && !CERRADAS.includes(p.estado) ? await crearToken(env.DB, p, correo) : null;

  const accion: Html =
    token !== null
      ? html`<form method="post" action="/p/${p.id}/publicar">
<input type="hidden" name="token" value="${token}">
<p>${env.PUBLICACION === 'directa' ? 'Al pulsar, se publica en la web.' : 'Al pulsar, Andrés recibe tu visto bueno y lo publica él.'}</p>
<button type="submit">Publicar</button>
</form>`
      : vistoBueno && s.bloqueo === null
        ? html`<p>Ya has dado el visto bueno a esta versión. Ahora la revisa Andrés.</p>`
        : html`<p>No se puede publicar todavía:</p>
<ul>${(s.bloqueo ?? []).map((m) => html`<li>${m}</li>`)}</ul>`;

  return documento(
    `Propuesta: viaje ${p.slug}`,
    html`<h1>Propuesta: viaje ${p.slug}</h1>
<p>Commit ${p.sha.slice(0, 12)}${p.nuevo === 1 ? ', viaje nuevo' : ''}.</p>
<h2>Qué cambia</h2>
${
  lista.length === 0
    ? html`<p>No cambia ningún campo.</p>`
    : html`<table>
<thead><tr><th>Campo</th><th>Antes</th><th>Ahora</th></tr></thead>
<tbody>${lista.map((c) => html`<tr><td>${c.campo}</td><td>${c.antes}</td><td>${c.ahora}</td></tr>`)}</tbody>
</table>`
}
<h2>Vista previa</h2>
${vista === null ? html`<p>La vista previa de este commit aún no está lista.</p>` : html`<p><a href="${vista}">Abrir la vista previa de este commit</a></p>`}
<h2>Capturas</h2>
${
  capturas.length === 0
    ? html`<p>Aún no hay capturas de esta versión.</p>`
    : capturas.map(
        (n) =>
          html`<figure><img src="/p/${p.id}/captura/${n}.png" alt="Captura ${n}" width="${n.endsWith('-1500') ? 750 : 360}"><figcaption>${n}</figcaption></figure>`,
      )
}
<h2>Publicar</h2>
${accion}`,
  );
}

async function captura(gh: GitHub, almacen: Almacen, p: Propuesta, nombre: string): Promise<Response> {
  let indice = await leerIndice(almacen, p.sha);
  if (indice === null) {
    const run = (await runsQueCuentan(gh, p.sha, p.pr)).visual;
    if (run !== undefined && run.status === 'completed') indice = await capturasDelRun(gh, almacen, run, p.sha);
  }
  // Solo capturas del SHA de esta propuesta.
  if (indice === null || !indice.nombres.includes(nombre)) return noEncontrado();
  const datos = await almacen.leer(`${p.sha}/${nombre}.png`);
  if (datos === null) return noEncontrado();
  return new Response(datos, {
    headers: {
      'Content-Type': 'image/png',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': CSP_PAGINA,
      'Cache-Control': 'private, no-store',
    },
  });
}

function rechazoPublicar(texto: string, estado: number): Response {
  return documento('No se ha publicado', html`<h1>No se ha publicado</h1><p>${texto}</p><p>Vuelve a la página de la propuesta y recárgala.</p>`, estado);
}

async function publicar(request: Request, env: Env, gh: GitHub, p: Propuesta, correo: string, entrada: Entrada): Promise<Response> {
  if (request.headers.get('Origin') !== `https://${env.PAGINA_HOST}`) return rechazoPublicar('La petición no viene de la página de la propuesta.', 403);
  let token: unknown = null;
  try {
    token = (await request.formData()).get('token');
  } catch {
    token = null;
  }
  if (typeof token !== 'string' || token.length === 0 || token.length > 100) return rechazoPublicar('El botón no es válido.', 403);

  // Un solo uso de verdad: se borra al leerlo.
  const fila = await env.DB.prepare('DELETE FROM tokens_publicar WHERE hash = ?1 RETURNING pr, sha, correo, caduca')
    .bind(await hash(token))
    .first<{ pr: number; sha: string; correo: string; caduca: number }>();
  if (fila === null || fila.pr !== p.pr || fila.sha !== p.sha || fila.correo !== correo || fila.caduca < Date.now()) {
    return rechazoPublicar('El botón ha caducado o ya se ha usado.', 403);
  }
  if (p.visto_bueno === p.sha || CERRADAS.includes(p.estado)) return rechazoPublicar('Esta versión ya tiene tu visto bueno.', 409);

  const s = await situacion(gh, p, async () => null);
  if (s.bloqueo !== null) return rechazoPublicar(s.bloqueo.join(' '), 409);

  if (env.PUBLICACION === 'directa') {
    // La API de merge falla si la cabeza ya no es este SHA.
    const r = await gh.pedir('PUT', `pulls/${p.pr}/merge`, { sha: p.sha });
    if (!r.ok) return rechazoPublicar('GitHub no ha dejado publicarla. Pídeselo a Andrés.', 409);
    // Ya está publicada: lo que falle a partir de aquí se registra, pero no se le enseña como error.
    try {
      await avisarUnaVez(env, p.id, p.sha, 'publicada-directa', {
        para: env.CORREO_ANDRES,
        asunto: `${correo} ha publicado el viaje ${p.slug}`,
        texto: `${correo} ha publicado el commit ${p.sha} del viaje ${p.slug}.\n\nPR: https://github.com/${env.REPO}/pull/${p.pr}\nFichero: ${rutaViaje(p.slug)}\n`,
      });
    } catch (error) {
      entrada.error = codigoError(error);
    }
    // Si no se puede cerrar ahora, el cron ve el PR mergeado y lo reintenta.
    try {
      await cerrarSiTerminada(env, gh, p, { ...s.pr, state: 'closed', merged: true });
    } catch (error) {
      entrada.error = codigoError(error);
    }
    return documento('Publicado', html`<h1>Publicado</h1><p>El viaje ${p.slug} ya está en la web.</p>`);
  }

  // Solo uno de dos POST a la vez guarda el visto bueno; el otro no comenta ni avisa.
  const guardado = await env.DB.prepare(
    `UPDATE propuestas SET visto_bueno = ?2, estado = 'esperando-andres'
     WHERE id = ?1 AND sha = ?2 AND visto_bueno IS NOT ?2 AND estado NOT IN ('publicada', 'cerrada')
     RETURNING *`,
  )
    .bind(p.id, p.sha)
    .first<Propuesta>();
  if (guardado === null) return rechazoPublicar('Esta versión ya tiene tu visto bueno.', 409);
  // El visto bueno ya está guardado: si el comentario o el correo fallan, los reintenta el cron.
  try {
    await avisarVistoBueno(env, gh, guardado);
  } catch (error) {
    entrada.error = codigoError(error);
  }
  return documento('Visto bueno enviado', html`<h1>Visto bueno enviado</h1><p>Andrés lo revisa y lo publica. Te llegará un correo cuando esté en la web.</p>`);
}
