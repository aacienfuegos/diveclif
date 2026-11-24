// Identidad de quien llama: el JWT que Cloudflare Access pone en Cf-Access-Jwt-Assertion.
// Se valida en cada petición; no se da por hecho que la petición haya pasado por Access.
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import type { Env } from './entorno';

const RE_EQUIPO = /^[a-z0-9-]{1,63}$/;
const conjuntos = new Map<string, JWTVerifyGetKey>();

/** Claves públicas del equipo de Access, cacheadas por jose dentro del isolate. */
export function clavesAccess(equipo: string): JWTVerifyGetKey {
  if (!RE_EQUIPO.test(equipo)) throw new Error('ACCESS_EQUIPO no válido');
  let claves = conjuntos.get(equipo);
  if (claves === undefined) {
    claves = createRemoteJWKSet(new URL(`https://${equipo}.cloudflareaccess.com/cdn-cgi/access/certs`));
    conjuntos.set(equipo, claves);
  }
  return claves;
}

export function correosPermitidos(env: Env): string[] {
  return env.CORREOS_PERMITIDOS.split(',')
    .map((c) => c.trim().toLowerCase())
    .filter((c) => c !== '');
}

/** Correo de quien llama, o null si el JWT no vale para la aplicación `aud` o el correo no está en la lista. */
export async function identidad(request: Request, env: Env, aud: string, claves: JWTVerifyGetKey): Promise<string | null> {
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (jwt === null || jwt === '') return null;
  try {
    const { payload } = await jwtVerify(jwt, claves, {
      issuer: `https://${env.ACCESS_EQUIPO}.cloudflareaccess.com`,
      audience: aud,
      algorithms: ['RS256'],
      requiredClaims: ['exp', 'email'],
    });
    const correo = typeof payload['email'] === 'string' ? payload['email'].toLowerCase() : '';
    return correosPermitidos(env).includes(correo) ? correo : null;
  } catch {
    return null;
  }
}
