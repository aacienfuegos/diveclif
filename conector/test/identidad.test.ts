import { beforeAll, describe, expect, it, vi } from 'vitest';
import { crearWorker } from '../src/index';
import { capturarConsola } from './consola';
import { ANDRES, CONECTOR, crearClaves, ctx, entorno, firmar, mcp, PAGINA, peticion, type Claves } from './util';

let claves: Claves;
let otras: Claves;
beforeAll(async () => {
  claves = await crearClaves();
  otras = await crearClaves();
});

const worker = () => crearWorker({ claves: () => claves.verificar });
const pedir = (r: Request) => worker().fetch!(r as Request<unknown, IncomingRequestCfProperties>, entorno(), ctx);
const iniciar = mcp('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'prueba', version: '1' } });

describe('identidad', () => {
  it('un JWT válido abre /mcp', async () => {
    const r = await pedir(peticion(`https://${CONECTOR}/mcp`, { ...iniciar, jwt: await firmar(claves.privada) }));
    expect(r.status).toBe(200);
  });

  it.each([
    ['sin cabecera', async () => undefined],
    ['firmado con otra clave', async () => firmar(otras.privada)],
    ['con otro aud', async () => firmar(claves.privada, { aud: 'otro' })],
    ['con otro iss', async () => firmar(claves.privada, { iss: 'https://otro.cloudflareaccess.com' })],
    ['caducado', async () => firmar(claves.privada, { caduca: Math.floor(Date.now() / 1000) - 60 })],
    ['con un correo fuera de la lista', async () => firmar(claves.privada, { email: 'otra@prueba.test' })],
    ['con el aud de la página', async () => firmar(claves.privada, { aud: 'aud-pagina' })],
  ])('/mcp da 403 %s', async (_caso, jwt) => {
    const r = await pedir(peticion(`https://${CONECTOR}/mcp`, { ...iniciar, jwt: (await jwt()) as string }));
    expect(r.status).toBe(403);
  });

  it('la página da 403 con el aud del conector', async () => {
    const r = await pedir(peticion(`https://${PAGINA}/p/abc`, { jwt: await firmar(claves.privada, { aud: 'aud-mcp' }) }));
    expect(r.status).toBe(403);
  });

  it('el correo no distingue mayúsculas', async () => {
    const jwt = await firmar(claves.privada, { email: ANDRES.toUpperCase() });
    const r = await pedir(peticion(`https://${CONECTOR}/mcp`, { ...iniciar, jwt }));
    expect(r.status).toBe(200);
  });
});

describe('hostnames', () => {
  it('una ruta de la página pedida en el conector da 404', async () => {
    for (const ruta of ['/p/abc', '/p/abc/captura/portada-390.png']) {
      const r = await pedir(peticion(`https://${CONECTOR}${ruta}`, { jwt: await firmar(claves.privada) }));
      expect(r.status).toBe(404);
    }
    const r = await pedir(peticion(`https://${CONECTOR}/p/abc/publicar`, { method: 'POST', jwt: await firmar(claves.privada) }));
    expect(r.status).toBe(404);
  });

  it('/mcp pedido en la página da 404', async () => {
    const r = await pedir(peticion(`https://${PAGINA}/mcp`, { ...iniciar, jwt: await firmar(claves.privada, { aud: 'aud-pagina' }) }));
    expect(r.status).toBe(404);
  });

  it('otro hostname da 404', async () => {
    const r = await pedir(peticion('https://otro.prueba.test/mcp', { ...iniciar, jwt: await firmar(claves.privada) }));
    expect(r.status).toBe(404);
  });

  it('una ruta desconocida da 404 en los dos', async () => {
    const r1 = await pedir(peticion(`https://${CONECTOR}/`, { jwt: await firmar(claves.privada) }));
    const r2 = await pedir(peticion(`https://${PAGINA}/p/../x`, { jwt: await firmar(claves.privada, { aud: 'aud-pagina' }) }));
    expect([r1.status, r2.status]).toEqual([404, 404]);
  });
});

describe('registro', () => {
  it('registra hostname, ruta, método y estado, y nada de la cabecera', async () => {
    const espia = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const jwt = await firmar(claves.privada);
    await pedir(peticion(`https://${CONECTOR}/mcp`, { ...iniciar, jwt }));
    const lineas = espia.mock.calls.map((c) => c.join(' '));
    espia.mockRestore();
    expect(lineas.at(-1)).toBe(JSON.stringify({ host: CONECTOR, ruta: '/mcp', metodo: 'POST', estado: 200 }));
    expect(lineas.join('\n')).not.toContain(jwt);
  });
});

describe('registro con un error forzado', () => {
  const secreto = 'argumento-secreto-de-prueba';
  it.each([
    ['/mcp', CONECTOR, 'POST'],
    ['/p/abc', PAGINA, 'GET'],
    ['/p/abc/publicar', PAGINA, 'POST'],
    ['/p/abc/captura/portada-390.png', PAGINA, 'GET'],
  ])('en %s solo registra el código del error', async (ruta, host, metodo) => {
    // El error lleva en el mensaje la cabecera, el token y los argumentos: nada de eso puede salir.
    const jwt = await firmar(claves.privada);
    const fallo = crearWorker({
      claves: () => {
        throw new Error(`${jwt} token-del-boton ${secreto}`);
      },
    });
    let estado = 0;
    const salida = await capturarConsola(async () => {
      const r = await fallo.fetch!(
        peticion(`https://${host}${ruta}`, {
          method: metodo,
          jwt,
          headers: { Cookie: 'CF_Authorization=cookie-secreta', Authorization: 'Bearer cabecera-secreta' },
          ...(metodo === 'POST' ? { body: `token=token-del-boton&a=${secreto}` } : {}),
        }) as Request<unknown, IncomingRequestCfProperties>,
        entorno(),
        ctx,
      );
      estado = r.status;
    });
    expect(estado).toBe(500);
    expect(salida).toBe(JSON.stringify({ host, ruta, metodo, estado: 500, error: 'interno' }));
    for (const s of [jwt, 'token-del-boton', secreto, 'cookie-secreta', 'cabecera-secreta']) expect(salida).not.toContain(s);
  });
});
