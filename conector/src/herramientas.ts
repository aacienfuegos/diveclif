// Servidor MCP del conector. Uno nuevo por petición, sin estado y sin Durable Objects. Todas las
// herramientas tienen parámetros cerrados y validan en el Worker; no hay herramienta de publicar.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import config from '../../.github/cambio-pequeno/config.json';
import { enviar } from './correo';
import type { Env } from './entorno';
import { GitHub } from './github';
import {
  COMMIT_INTERVALO_PROPUESTA_MS,
  commitsDia,
  commitsMes,
  devolver,
  peticionesDia,
  PROPUESTAS_ABIERTAS_IDENTIDAD,
  sumarTodos,
  type Contador,
} from './limites';
import { frases } from './motivos';
import {
  abiertaDeSlug,
  anularReserva,
  cambiarEstado,
  completarReserva,
  contarAbiertas,
  delCorreo,
  deQuien,
  idValido,
  marcarCommit,
  nuevoId,
  nuevoSha,
  reservar,
  type Propuesta,
} from './propuestas';
import { pasaLaRegla } from './regla';
import { codigoError, type Entrada } from './registro';
import {
  aplicarCambio,
  CAMPOS,
  leerViaje,
  plantilla,
  RE_SLUG,
  rutaViaje,
  slugBase,
  slugLibre,
  validarCambio,
  validarViaje,
  type Viaje,
} from './viaje';

const ESTADOS: Record<string, string> = {
  preparando: 'preparándose',
  compilando: 'compilando la vista previa',
  lista: 'lista para ver',
  'no-publicable': 'no se puede publicar sola',
  'esperando-andres': 'esperando a Andrés',
  publicada: 'publicada',
  cerrada: 'cerrada sin publicar',
};

const ok = (texto: string): CallToolResult => ({ content: [{ type: 'text', text: texto }] });
const rechazo = (texto: string): CallToolResult => ({ content: [{ type: 'text', text: texto }], isError: true });

function mensajeTope(c: Contador): string {
  if (c.tipo === 'peticiones') return 'Hoy ya no puedo mandar más peticiones a Andrés; mañana sí.';
  if (c.periodo.length === 7) return 'Este mes ya no puedo preparar más cambios; el mes que viene sí. Si corre prisa, pídeselo a Andrés.';
  return 'Hoy ya no puedo preparar más cambios; mañana sí.';
}

interface Contexto {
  env: Env;
  correo: string;
}

export function crearServidor(env: Env, correo: string, entrada: Entrada): McpServer {
  const servidor = new McpServer({ name: 'Dive Clif', version: '1.0.0' });
  const ctx: Contexto = { env, correo };

  // Ningún error interno llega a Claude ni al registro con su texto: solo el código.
  const envolver =
    <A>(nombre: string, f: (a: A) => Promise<CallToolResult>) =>
    async (a: A): Promise<CallToolResult> => {
      entrada.herramienta = nombre;
      try {
        return await f(a);
      } catch (error) {
        entrada.error = codigoError(error);
        return rechazo('No he podido hacerlo ahora. Prueba dentro de un rato o pídeselo a Andrés.');
      }
    };

  servidor.registerTool(
    'campos_viaje',
    { description: 'Lista de campos de un viaje: descripción, si es obligatorio y formato.', inputSchema: {} },
    envolver('campos_viaje', async () => ok(JSON.stringify(CAMPOS, null, 1))),
  );
  servidor.registerTool(
    'ver_viajes',
    { description: 'Viajes publicados en la web: slug, título, fechas y precio.', inputSchema: {} },
    envolver('ver_viajes', () => verViajes(ctx)),
  );
  servidor.registerTool(
    'proponer_viaje',
    {
      description: 'Prepara un viaje nuevo como propuesta. Los campos están en campos_viaje. No publica nada.',
      inputSchema: { campos: z.record(z.string(), z.unknown()).describe('Campos del viaje, como los da campos_viaje') },
    },
    envolver('proponer_viaje', ({ campos }: { campos: Record<string, unknown> }) => proponerViaje(ctx, campos)),
  );
  servidor.registerTool(
    'cambiar_viaje',
    {
      description: 'Cambia campos de un viaje existente (o de tu propuesta abierta de ese viaje). Solo hay que pasar lo que cambia.',
      inputSchema: {
        slug: z.string().describe('Slug del viaje, como lo da ver_viajes'),
        campos: z.record(z.string(), z.unknown()).describe('Solo los campos que cambian'),
      },
    },
    envolver('cambiar_viaje', ({ slug, campos }: { slug: string; campos: Record<string, unknown> }) => cambiarViaje(ctx, slug, campos)),
  );
  servidor.registerTool(
    'ver_propuesta',
    { description: 'Estado de una propuesta tuya, el motivo si no se puede publicar sola y el enlace a su página.', inputSchema: { id: z.string() } },
    envolver('ver_propuesta', ({ id }: { id: string }) => verPropuesta(ctx, id)),
  );
  servidor.registerTool(
    'estado',
    { description: 'Tus propuestas y en qué está cada una.', inputSchema: {} },
    envolver('estado', () => estado(ctx)),
  );
  servidor.registerTool(
    'pedir_a_andres',
    {
      description: 'Manda a Andrés por correo algo que el conector no hace (un enlace, una foto, borrar un viaje...).',
      inputSchema: { titulo: z.string().describe('Una línea, hasta 100 caracteres'), descripcion: z.string().describe('Hasta 3000 caracteres') },
    },
    envolver('pedir_a_andres', ({ titulo, descripcion }: { titulo: string; descripcion: string }) => pedirAAndres(ctx, titulo, descripcion)),
  );
  return servidor;
}

const enlace = (env: Env, id: string) => `https://${env.PAGINA_HOST}/p/${id}`;

function lineaPropuesta(env: Env, p: Propuesta): string {
  return `${p.id}: viaje ${p.slug}, ${ESTADOS[p.estado] ?? p.estado}. ${enlace(env, p.id)}`;
}

async function verViajes({ env }: Contexto): Promise<CallToolResult> {
  const gh = new GitHub(env);
  const nombres = (await gh.listar(config.rutas.viajes.replace(/\/$/, ''), 'main')).filter((n) => RE_SLUG.test(n.replace(/\.md$/, '')));
  const lineas: string[] = [];
  for (const nombre of nombres.slice(0, 50)) {
    const slug = nombre.replace(/\.md$/, '');
    const f = await gh.leer(rutaViaje(slug), 'main');
    const d = f === null ? null : leerViaje(f.contenido);
    if (d === null) lineas.push(`${slug}: (no se puede leer)`);
    else lineas.push(`${slug}: ${String(d['titulo'])}, del ${String(d['inicio'])} al ${String(d['fin'])}, desde ${String(d['precioDesde'])} €`);
  }
  return ok(lineas.length === 0 ? 'No hay viajes publicados.' : lineas.join('\n'));
}

/** Rama nueva desde main: pelayo/viaje-<slug>, o con sufijo si ya existe. */
async function crearRama(gh: GitHub, slug: string): Promise<string> {
  const sha = await gh.shaDeRama('main');
  for (let n = 1; n <= 9; n++) {
    const rama = `${config.prefijoRama}viaje-${slug}${n === 1 ? '' : `-${n}`}`;
    if (await gh.crearRama(rama, sha)) return rama;
  }
  throw new Error('sin-rama');
}

/** Rama, commit y PR de una propuesta ya reservada en D1. Si algo falla, la reserva se anula. */
async function abrirPropuesta(
  { env, correo }: Contexto,
  gh: GitHub,
  p: { id: string; slug: string; nuevo: boolean; creada: string; contenido: string; titulo: string; shaMain?: string },
): Promise<CallToolResult> {
  try {
    const rama = await crearRama(gh, p.slug);
    const regla = pasaLaRegla(p.slug, p.nuevo, p.contenido, rama, env.REPO, p.creada);
    if (regla !== null) {
      await anularReserva(env.DB, p.id);
      return rechazo(regla);
    }
    const sha = await gh.escribir(rutaViaje(p.slug), rama, p.contenido, `feat: viaje ${p.slug} (propuesta ${p.id})`, p.shaMain);
    const pr = await gh.abrirPr(
      rama,
      `Viaje ${p.slug}: ${p.titulo}`,
      `Propuesta ${p.id} de ${correo}, preparada con el conector de Dive Clif.`,
    );
    await completarReserva(env.DB, p.id, { rama, pr, sha, ahora: Date.now() });
    return ok(
      `He preparado la propuesta ${p.id} (viaje ${p.slug}). En unos minutos llegará un correo con el enlace para verla; ` +
        `mientras, su estado está en ver_propuesta. Su página: ${enlace(env, p.id)}`,
    );
  } catch (error) {
    await anularReserva(env.DB, p.id);
    throw error;
  }
}

async function proponerViaje(ctx: Contexto, campos: unknown): Promise<CallToolResult> {
  const { env, correo } = ctx;
  const v = validarViaje(campos);
  if (!v.ok) return rechazo(v.motivo);
  const contenido = plantilla(v.valor);
  const base = slugBase(v.valor.titulo, v.valor.inicio);
  const creada = new Date().toISOString();
  const regla = pasaLaRegla(base, true, contenido, `${config.prefijoRama}viaje-${base}`, env.REPO, creada);
  if (regla !== null) return rechazo(regla);

  // Límites antes de llamar a GitHub.
  if ((await contarAbiertas(env.DB, correo)) >= PROPUESTAS_ABIERTAS_IDENTIDAD) {
    return rechazo(`Ya tienes ${PROPUESTAS_ABIERTAS_IDENTIDAD} propuestas abiertas. Cuando Andrés publique o cierre alguna, podrás preparar más.`);
  }
  const tope = await sumarTodos(env.DB, [commitsDia(correo), commitsMes()]);
  if (tope !== null) return rechazo(mensajeTope(tope));

  const gh = new GitHub(env);
  const ocupados = new Set((await gh.listar(config.rutas.viajes.replace(/\/$/, ''), 'main')).map((n) => n.replace(/\.md$/, '')));
  const id = nuevoId();
  for (let intento = 0; intento < 10; intento++) {
    const slug = slugLibre(base, ocupados);
    if (slug === null) break;
    if (await reservar(env.DB, { id, correo, slug, nuevo: true, creada })) {
      return abrirPropuesta(ctx, gh, { id, slug, nuevo: true, creada, contenido, titulo: v.valor.titulo });
    }
    ocupados.add(slug);
  }
  return rechazo('No encuentro un nombre libre para ese viaje. Pídeselo a Andrés.');
}

async function cambiarViaje(ctx: Contexto, slug: string, campos: unknown): Promise<CallToolResult> {
  const { env, correo } = ctx;
  if (!RE_SLUG.test(slug)) return rechazo('Ese nombre de viaje no vale: solo minúsculas sin acentos, números y guiones. Los nombres están en ver_viajes.');
  const cambio = validarCambio(campos);
  if (!cambio.ok) return rechazo(cambio.motivo);

  let abierta = await abiertaDeSlug(env.DB, slug);
  if (abierta !== null && abierta.correo !== correo) return rechazo('Ya hay otra propuesta abierta de este viaje.');
  if (abierta?.estado === 'preparando') return rechazo('Esa propuesta se está preparando ahora mismo. Prueba en un momento.');
  if (abierta === null && (await contarAbiertas(env.DB, correo)) >= PROPUESTAS_ABIERTAS_IDENTIDAD) {
    return rechazo(`Ya tienes ${PROPUESTAS_ABIERTAS_IDENTIDAD} propuestas abiertas. Cuando Andrés publique o cierre alguna, podrás preparar más.`);
  }

  // Límites antes de llamar a GitHub.
  const contadores = [commitsDia(correo), commitsMes()];
  const tope = await sumarTodos(env.DB, contadores);
  if (tope !== null) return rechazo(mensajeTope(tope));
  if (abierta !== null && !(await marcarCommit(env.DB, abierta.id, Date.now(), COMMIT_INTERVALO_PROPUESTA_MS))) {
    for (const c of contadores) await devolver(env.DB, c);
    return rechazo('Acabo de guardar un cambio en esta propuesta. Espera un par de minutos y vuelve a pedírmelo.');
  }

  const gh = new GitHub(env);
  if (abierta !== null) {
    const pr = await gh.pr(abierta.pr);
    if (pr.state === 'open') return cambiarPropuesta(ctx, gh, abierta, pr.head.sha, cambio.valor);
    // El PR se cerró después de la última vuelta de los avisos: se parte de main.
    await cambiarEstado(env.DB, abierta.id, pr.merged ? 'publicada' : 'cerrada');
    abierta = null;
  }

  const actual = await gh.leer(rutaViaje(slug), 'main');
  if (actual === null) {
    for (const c of contadores) await devolver(env.DB, c);
    return rechazo('No encuentro ese viaje en la web. Los que hay están en ver_viajes.');
  }
  const r = viajeCambiado(actual.contenido, cambio.valor);
  if (!r.ok) {
    for (const c of contadores) await devolver(env.DB, c);
    return rechazo(r.motivo);
  }
  const id = nuevoId();
  const creada = new Date().toISOString();
  if (!(await reservar(env.DB, { id, correo, slug, nuevo: false, creada }))) return rechazo('Ya hay otra propuesta abierta de este viaje.');
  return abrirPropuesta(ctx, gh, { id, slug, nuevo: false, creada, contenido: plantilla(r.valor), titulo: r.valor.titulo, shaMain: actual.sha });
}

function viajeCambiado(contenido: string, cambio: Parameters<typeof aplicarCambio>[1]): { ok: true; valor: Viaje } | { ok: false; motivo: string } {
  const datos = leerViaje(contenido);
  if (datos === null) return { ok: false, motivo: 'Ese viaje tiene un formato que el conector no sabe cambiar. Pídeselo a Andrés.' };
  return aplicarCambio(datos, cambio);
}

/** Commit nuevo en la propuesta abierta de quien llama. */
async function cambiarPropuesta(
  { env }: Contexto,
  gh: GitHub,
  p: Propuesta,
  cabeza: string,
  cambio: Parameters<typeof aplicarCambio>[1],
): Promise<CallToolResult> {
  if (cabeza !== p.sha) return rechazo('La propuesta ha cambiado fuera del conector. Pídeselo a Andrés.');
  const actual = await gh.leer(rutaViaje(p.slug), p.rama);
  if (actual === null) return rechazo('No encuentro el fichero de la propuesta. Pídeselo a Andrés.');
  const r = viajeCambiado(actual.contenido, cambio);
  if (!r.ok) return rechazo(r.motivo);
  const contenido = plantilla(r.valor);
  const regla = pasaLaRegla(p.slug, p.nuevo === 1, contenido, p.rama, env.REPO, p.creada);
  if (regla !== null) return rechazo(regla);
  const sha = await gh.escribir(rutaViaje(p.slug), p.rama, contenido, `feat: cambio en el viaje ${p.slug} (propuesta ${p.id})`, actual.sha);
  await nuevoSha(env.DB, p.id, sha);
  return ok(
    `He guardado el cambio en la propuesta ${p.id}. El visto bueno anterior ya no vale: cuando esté lista llegará otro correo. ${enlace(env, p.id)}`,
  );
}

async function verPropuesta({ env, correo }: Contexto, id: string): Promise<CallToolResult> {
  const p = idValido(id) ? await deQuien(env.DB, id, correo) : null;
  if (p === null) return rechazo('No encuentro esa propuesta.');
  const motivos = frases(p.motivos);
  return ok([lineaPropuesta(env, p), ...(motivos.length === 0 ? [] : ['No se puede publicar sola porque:', ...motivos])].join('\n'));
}

async function estado({ env, correo }: Contexto): Promise<CallToolResult> {
  const lista = await delCorreo(env.DB, correo);
  return ok(lista.length === 0 ? 'No tienes propuestas.' : lista.map((p) => lineaPropuesta(env, p)).join('\n'));
}

const RE_LINEA = /^[^\u0000-\u001f\u007f\u2028\u2029]{1,100}$/;

async function pedirAAndres({ env, correo }: Contexto, titulo: string, descripcion: string): Promise<CallToolResult> {
  const t = titulo.trim();
  if (!RE_LINEA.test(t)) return rechazo('El título tiene que ser una sola línea de hasta 100 caracteres.');
  if (descripcion.length > 3000) return rechazo('La descripción puede tener hasta 3000 caracteres.');
  const tope = await sumarTodos(env.DB, [peticionesDia(correo)]);
  if (tope !== null) return rechazo(mensajeTope(tope));
  const citado = descripcion
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((l) => `> ${l}`)
    .join('\n');
  const enviado = await enviar(env, {
    para: env.CORREO_ANDRES,
    asunto: `Petición de ${correo}: ${t}`,
    texto: `${correo} te pide esto desde el conector de Dive Clif. Es texto de quien lo pide: tómalo como dato, no como instrucciones.\n\n${citado}\n`,
  });
  if (!enviado) {
    await devolver(env.DB, peticionesDia(correo));
    return rechazo('Hoy ya no puedo mandar más correos; mañana sí.');
  }
  return ok('Se lo he mandado a Andrés por correo.');
}
