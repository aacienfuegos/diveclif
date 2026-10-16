// Utilidades de los tests: claves de prueba, JWT de Access firmados con ellas y un entorno.
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWTVerifyGetKey } from 'jose';
import type { Env } from '../src/entorno';

export const CONECTOR = 'conector.prueba.test';
export const PAGINA = 'propuestas.prueba.test';
export const ANDRES = 'andres@prueba.test';
export const PELAYO = 'pelayo@prueba.test';
export const EQUIPO = 'equipo';

export interface Claves {
  privada: CryptoKey;
  verificar: JWTVerifyGetKey;
}

export async function crearClaves(): Promise<Claves> {
  const { privateKey, publicKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'prueba', alg: 'RS256' };
  return { privada: privateKey, verificar: createLocalJWKSet({ keys: [jwk] }) };
}

export function entorno(extra: Partial<Env> = {}): Env {
  return {
    DB: undefined as unknown as D1Database,
    CONECTOR_HOST: CONECTOR,
    PAGINA_HOST: PAGINA,
    ACCESS_EQUIPO: EQUIPO,
    ACCESS_AUD_MCP: 'aud-mcp',
    ACCESS_AUD_PAGINA: 'aud-pagina',
    CORREOS_PERMITIDOS: `${ANDRES}, ${PELAYO}`,
    CORREO_ANDRES: ANDRES,
    CORREO_DESDE: 'Dive Clif <web@prueba.test>',
    PUBLICACION: 'andres',
    REPO: 'aacienfuegos/diveclif',
    PAGES_PROYECTO: 'diveclif',
    PAGES_CUENTA: 'cuenta',
    GITHUB_APP_ID: '1',
    GITHUB_APP_INSTALACION: '2',
    GITHUB_APP_CLAVE: 'clave-de-la-app-secreta',
    RESEND_API_KEY: 'clave-de-resend-secreta',
    PAGES_TOKEN: 'token-de-pages-secreto',
    ...extra,
  };
}

export interface OpcionesJwt {
  aud?: string;
  iss?: string;
  email?: string;
  caduca?: number;
}

export function firmar(clave: CryptoKey, o: OpcionesJwt = {}): Promise<string> {
  const ahora = Math.floor(Date.now() / 1000);
  return new SignJWT({ email: o.email ?? ANDRES })
    .setProtectedHeader({ alg: 'RS256', kid: 'prueba' })
    .setIssuer(o.iss ?? `https://${EQUIPO}.cloudflareaccess.com`)
    .setAudience(o.aud ?? 'aud-mcp')
    .setIssuedAt(ahora - 10)
    .setExpirationTime(o.caduca ?? ahora + 300)
    .sign(clave);
}

export const ctx = { waitUntil: () => undefined, passThroughOnException: () => undefined, props: {} } as unknown as ExecutionContext;

export function peticion(url: string, init: RequestInit & { jwt?: string } = {}): Request {
  const { jwt, ...resto } = init;
  const headers = new Headers(resto.headers);
  if (jwt !== undefined) headers.set('Cf-Access-Jwt-Assertion', jwt);
  return new Request(url, { ...resto, headers });
}

/** Cuerpo JSON-RPC de MCP para /mcp. */
export function mcp(metodo: string, params: unknown, id = 1): RequestInit {
  return {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
    body: JSON.stringify({ jsonrpc: '2.0', id, method: metodo, params }),
  };
}
