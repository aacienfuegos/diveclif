// Regla de "cambio pequeño": la usan el workflow cambio-pequeno.yml y el Worker de conector/.
// Sin dependencias y sin E/S: todo lo que necesita llega por argumentos.

/**
 * @typedef {{ nombre: string, estado: string, anterior?: string, modo: string | null, contenido: string | null }} Fichero
 * @typedef {{ autor: string, prefijoRama: string, repo: string, maxFicheros: number, maxBytes: number, rutas: { viajes: string }, organizaObligatorio: string, tiposConOrganiza: string[], clavesViaje: string[] }} Config
 * @typedef {{ autor: string, rama: string, repoCabeza: string, fechaPr: string, config: Config, dominios: string[] }} Contexto
 * @typedef {{ codigo: string, fichero: string | null }} Motivo
 */

export const MOTIVOS = Object.freeze({
  autor: 'El cambio no lo ha preparado el conector de Dive Clif.',
  rama: 'El cambio no viene de una rama del conector.',
  repo: 'El cambio viene de otro repositorio.',
  'demasiados-ficheros': 'El cambio toca demasiados ficheros a la vez.',
  ruta: 'El cambio toca algo que no es la ficha de un viaje.',
  operacion: 'El cambio borra o mueve ficheros; eso lo hace Andrés.',
  modo: 'El cambio incluye un fichero de un tipo que no es texto normal.',
  tamano: 'La ficha es demasiado larga.',
  formato: 'La ficha no tiene el formato que espera la web.',
  'clave-desconocida': 'La ficha tiene un dato que la web no conoce.',
  html: 'La ficha tiene código HTML.',
  enlace: 'La ficha tiene un enlace o una dirección de correo que no se puede publicar solo.',
  organiza: 'Los viajes internacionales y nacionales los organiza Te Moana Expeditions.',
  'fecha-pasada': 'El viaje nuevo empieza antes de hoy.',
  lectura: 'No se ha podido leer el cambio entero.',
});

const RE_SLUG = /^[a-z0-9-]{1,60}$/;
const RE_LINEA = /^([A-Za-z]+): (.+)$/;
const RE_HTML = /<[A-Za-z!/?]/;
const RE_CORREO = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const RE_ENTIDAD = /&[A-Za-z]+;/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;
const PROHIBIDAS = ['://', '](', ']:', '![', '&#'];
const RE_ENLACE_EXTERNO = /(?<![!\\])\[([^[\]\n]+)\]\(https:\/\/([A-Za-z0-9.-]+)(\/[A-Za-z0-9._~/?=#%-]*)?\)/g;
const RE_ENLACE_INTERNO = /(?<![!\\])\[([^[\]\n]+)\]\(\/([a-z0-9/-]*)\)/g;

/** @param {string} texto */
export function tieneHtml(texto) {
  return RE_HTML.test(texto);
}

/**
 * Formas que GFM convierte en enlace, imagen o entidad. Sin quitar nada antes.
 * @param {string} texto
 */
export function tieneEnlace(texto) {
  return (
    PROHIBIDAS.some((p) => texto.includes(p)) ||
    texto.toLowerCase().includes('www.') ||
    RE_CORREO.test(texto) ||
    RE_ENTIDAD.test(texto)
  );
}

/**
 * Quita del cuerpo los enlaces permitidos y mira si queda alguna forma prohibida.
 * @param {string} cuerpo
 * @param {string[]} dominios
 */
export function cuerpoConEnlaceNoPermitido(cuerpo, dominios) {
  const permitidos = new Set(dominios.map((d) => d.toLowerCase()));
  const textoValido = (/** @type {string} */ t) => !tieneEnlace(t) && !tieneHtml(t);
  const resto = cuerpo
    .replace(RE_ENLACE_EXTERNO, (todo, texto, dominio) =>
      permitidos.has(String(dominio).toLowerCase()) && textoValido(texto) ? '' : todo,
    )
    .replace(RE_ENLACE_INTERNO, (todo, texto, ruta) => (!String(ruta).startsWith('/') && textoValido(texto) ? '' : todo));
  return tieneEnlace(resto);
}

/** @param {string} texto */
export function leerDominios(texto) {
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));
}

/**
 * @param {unknown} valor
 * @returns {string[]}
 */
function textos(valor) {
  if (typeof valor === 'string') return [valor];
  if (Array.isArray(valor)) return valor.flatMap(textos);
  if (valor !== null && typeof valor === 'object') return Object.entries(valor).flatMap(([k, v]) => [k, ...textos(v)]);
  return [];
}

/**
 * Separa el frontmatter (líneas `clave: <JSON>`) del cuerpo. Devuelve null si no tiene esa forma.
 * @param {string} contenido
 * @returns {{ datos: Record<string, unknown>, cuerpo: string } | null}
 */
export function leerFicha(contenido) {
  if (contenido.includes('\r') || !contenido.startsWith('---\n')) return null;
  const fin = contenido.indexOf('\n---\n', 3);
  if (fin === -1) return null;
  /** @type {Record<string, unknown>} */
  const datos = {};
  for (const linea of contenido.slice(4, fin).split('\n')) {
    const m = RE_LINEA.exec(linea);
    if (m === null) return null;
    const [, clave = '', valor = ''] = m;
    if (Object.hasOwn(datos, clave)) return null;
    try {
      datos[clave] = JSON.parse(valor);
    } catch {
      return null;
    }
  }
  return { datos, cuerpo: contenido.slice(fin + 5) };
}

/**
 * @param {Fichero} f
 * @param {Contexto} ctx
 * @returns {string[]}
 */
function revisarContenido(f, ctx) {
  const { config } = ctx;
  if (f.contenido === null) return ['lectura'];
  if (new TextEncoder().encode(f.contenido).length > config.maxBytes) return ['tamano'];
  const ficha = leerFicha(f.contenido);
  if (ficha === null) return ['formato'];
  const { datos, cuerpo } = ficha;
  /** @type {string[]} */
  const codigos = [];
  if (Object.keys(datos).some((k) => !config.clavesViaje.includes(k))) codigos.push('clave-desconocida');
  const valores = textos(datos);
  if (tieneHtml(cuerpo) || valores.some(tieneHtml)) codigos.push('html');
  if (cuerpoConEnlaceNoPermitido(cuerpo, ctx.dominios) || valores.some(tieneEnlace)) codigos.push('enlace');
  if (config.tiposConOrganiza.includes(String(datos['tipo'])) && datos['organiza'] !== config.organizaObligatorio) {
    codigos.push('organiza');
  }
  if (f.estado === 'added') {
    const inicio = datos['inicio'];
    if (typeof inicio !== 'string' || !RE_FECHA.test(inicio)) codigos.push('formato');
    else if (inicio <= ctx.fechaPr.slice(0, 10)) codigos.push('fecha-pasada');
  }
  return codigos;
}

/** @param {string} ruta @param {Config} config */
function rutaPermitida(ruta, config) {
  if (!ruta.startsWith(config.rutas.viajes) || !ruta.endsWith('.md')) return false;
  return RE_SLUG.test(ruta.slice(config.rutas.viajes.length, -'.md'.length));
}

/**
 * @param {Fichero[]} ficheros
 * @param {Contexto} ctx
 * @returns {{ pequeno: boolean, motivos: Motivo[] }}
 */
export function evaluar(ficheros, ctx) {
  const { config } = ctx;
  /** @type {Motivo[]} */
  const motivos = [];
  const global = (/** @type {string} */ codigo) => motivos.push({ codigo, fichero: null });
  if (ctx.autor !== config.autor) global('autor');
  if (!ctx.rama.startsWith(config.prefijoRama)) global('rama');
  if (ctx.repoCabeza !== config.repo) global('repo');
  if (ficheros.length === 0) global('lectura');
  if (ficheros.length > config.maxFicheros) global('demasiados-ficheros');

  for (const f of ficheros) {
    const propio = (/** @type {string} */ codigo) => motivos.push({ codigo, fichero: f.nombre });
    const rutas = f.anterior === undefined ? [f.nombre] : [f.anterior, f.nombre];
    if (!rutas.every((r) => rutaPermitida(r, config))) propio('ruta');
    if (f.estado !== 'added' && f.estado !== 'modified') {
      propio('operacion');
      continue;
    }
    if (f.modo !== '100644') propio('modo');
    for (const codigo of new Set(revisarContenido(f, ctx))) propio(codigo);
  }
  return { pequeno: motivos.length === 0, motivos };
}
