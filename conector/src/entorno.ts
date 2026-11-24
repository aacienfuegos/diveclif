// Variables (wrangler.jsonc) y secretos (wrangler secret put) del Worker.
export interface Env {
  DB: D1Database;
  CONECTOR_HOST: string;
  PAGINA_HOST: string;
  ACCESS_EQUIPO: string;
  ACCESS_AUD_MCP: string;
  ACCESS_AUD_PAGINA: string;
  /** Correos separados por comas. */
  CORREOS_PERMITIDOS: string;
  CORREO_ANDRES: string;
  /** Remitente verificado en Resend. */
  CORREO_DESDE: string;
  /** `andres` (todo va como PR a Andrés) o `directa`. */
  PUBLICACION: string;
  REPO: string;
  PAGES_PROYECTO: string;
  /** Id de la cuenta de Cloudflare del proyecto de Pages (no es secreto; lo pide la API de Pages). */
  PAGES_CUENTA: string;
  GITHUB_APP_ID: string;
  GITHUB_APP_INSTALACION: string;
  /** Clave privada de la App en PKCS#8. */
  GITHUB_APP_CLAVE: string;
  RESEND_API_KEY: string;
  PAGES_TOKEN: string;
}

/** Error con un código propio: es lo único que llega al registro. */
export class ErrorConector extends Error {
  constructor(readonly codigo: string) {
    super(codigo);
  }
}
