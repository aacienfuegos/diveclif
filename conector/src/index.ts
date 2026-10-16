// Worker del conector de Dive Clif: /mcp en CONECTOR_HOST y la página de la propuesta en PAGINA_HOST.
import { createMcpHandler } from 'agents/mcp';
import type { JWTVerifyGetKey } from 'jose';
import { ErrorConector, type Env } from './entorno';
import { crearServidor } from './herramientas';
import { clavesAccess, identidad } from './identidad';
import { almacenCache, type Almacen } from './capturas';
import { atenderPagina } from './pagina';
import { codigoError, registrar, type Entrada } from './registro';
import { noEncontrado, prohibido, texto } from './respuestas';

export interface Dependencias {
  /** Claves con las que se validan los JWT de Access. Por defecto, las del equipo. */
  claves?: (env: Env) => JWTVerifyGetKey;
  /** Dónde se guardan las capturas. Por defecto, la caché del Worker. */
  almacen?: (env: Env) => Almacen;
}

export function crearWorker(deps: Dependencias = {}): ExportedHandler<Env> {
  const claves = deps.claves ?? ((env: Env) => clavesAccess(env.ACCESS_EQUIPO));
  const almacen = deps.almacen ?? almacenCache;
  return {
    async fetch(request, env, ctx) {
      const url = new URL(request.url);
      const entrada: Entrada = { host: url.hostname, ruta: url.pathname, metodo: request.method, estado: 500 };
      let respuesta: Response;
      try {
        respuesta = await atender(request, url, env, ctx, claves, almacen, entrada);
      } catch (error) {
        entrada.error = codigoError(error);
        respuesta = texto('Error interno', 500);
      }
      entrada.estado = respuesta.status;
      registrar(entrada);
      return respuesta;
    },
  };
}

async function atender(
  request: Request,
  url: URL,
  env: Env,
  ctx: ExecutionContext,
  claves: (env: Env) => JWTVerifyGetKey,
  almacen: (env: Env) => Almacen,
  entrada: Entrada,
): Promise<Response> {
  if (env.CONECTOR_HOST === env.PAGINA_HOST) throw new ErrorConector('configuracion');
  const esConector = url.hostname === env.CONECTOR_HOST;
  if (!esConector && url.hostname !== env.PAGINA_HOST) return noEncontrado();

  const correo = await identidad(request, env, esConector ? env.ACCESS_AUD_MCP : env.ACCESS_AUD_PAGINA, claves(env));
  if (correo === null) return prohibido();

  if (!esConector) return atenderPagina(request, env, correo, entrada, almacen(env));
  if (url.pathname !== '/mcp') return noEncontrado();
  const servidor = crearServidor(env, correo, entrada);
  return createMcpHandler(servidor, { route: '/mcp', enableJsonResponse: true })(request, env, ctx);
}

export default crearWorker();
