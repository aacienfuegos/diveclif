// Revisión visual automática del workflow visual.yml.
// Uso: node scripts/visual.mjs <dir de salida> [fichero con la lista de ficheros cambiados]
// Sirve dist/ con las cabeceras de public/_headers, recorre cada página a 1500, 390 y 360 px y
// escribe en la salida las capturas y resultado.json, que solo lleva códigos.
import { createServer } from 'node:http';
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, relative, sep } from 'node:path';
import { chromium } from 'playwright';

const DIST = 'dist';
const ANCHOS = [1500, 390, 360];
const ALTO = { 1500: 900, 390: 844, 360: 780 };
const RE_SLUG = /^[a-z0-9-]{1,60}$/;
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const [salida, ficheroCambiados] = process.argv.slice(2);
if (salida === undefined) throw new Error('Falta el directorio de salida');

/** Cabeceras del bloque `/*` de public/_headers, las mismas que pone Cloudflare Pages. */
function cabecerasGlobales() {
  const lineas = readFileSync('public/_headers', 'utf8').split('\n');
  const inicio = lineas.findIndex((l) => l.trimEnd() === '/*');
  if (inicio === -1) throw new Error('public/_headers sin bloque /*');
  const cabeceras = {};
  for (const l of lineas.slice(inicio + 1)) {
    if (!/^\s+\S/.test(l)) break;
    const i = l.indexOf(':');
    cabeceras[l.slice(0, i).trim()] = l.slice(i + 1).trim();
  }
  if (!('Content-Security-Policy' in cabeceras)) throw new Error('public/_headers sin CSP en /*');
  return cabeceras;
}

function servir(cabeceras) {
  const raiz = normalize(DIST);
  const leer = (ruta) => {
    try {
      const s = statSync(ruta);
      return s.isDirectory() ? leer(join(ruta, 'index.html')) : { ruta, datos: readFileSync(ruta) };
    } catch {
      return null;
    }
  };
  const servidor = createServer((req, res) => {
    const camino = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
    const ruta = normalize(join(raiz, camino));
    const dentro = ruta === raiz || ruta.startsWith(raiz + sep);
    const encontrado = dentro ? leer(ruta) : null;
    const fichero = encontrado ?? leer(join(raiz, '404.html'));
    res.writeHead(encontrado === null ? 404 : 200, {
      ...cabeceras,
      'Content-Type': TIPOS[extname(fichero?.ruta ?? '.txt')] ?? 'application/octet-stream',
    });
    res.end(fichero?.datos ?? '');
  });
  return new Promise((ok) => servidor.listen(0, '127.0.0.1', () => ok(servidor)));
}

function paginas(dir = DIST) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return paginas(ruta);
    if (!e.name.endsWith('.html')) return [];
    const rel = `/${relative(DIST, ruta).split(sep).join('/')}`;
    return [rel.endsWith('/index.html') ? rel.slice(0, -'index.html'.length) : rel];
  });
}

/** Fichas cuyo fichero de contenido cambia el PR: src/content/viajes/<slug>.md da /viajes/<slug>/. */
function fichasCambiadas() {
  if (ficheroCambiados === undefined) return [];
  return readFileSync(ficheroCambiados, 'utf8')
    .split('\n')
    .map((l) => /^src\/content\/viajes\/([^/]+)\.md$/.exec(l.trim())?.[1])
    .filter((slug) => slug !== undefined && RE_SLUG.test(slug));
}

const codigoPagina = (url) => url.replace(/\.html$/, '');

// Falla si algún `a` o `button` visible queda tapado por el HUD en todas las posiciones de scroll en
// las que está entero en pantalla: en ninguna, elementFromPoint en su centro da el elemento o un hijo.
// Lo que el scroll puede destapar no cuenta, porque el HUD es fijo y siempre pasa algo por debajo.
async function solapesHud(page) {
  return page.evaluate(async () => {
    const hud = document.querySelector('[data-hud]');
    if (hud === null) return false;
    // Un ciclo del temporizador del HUD (400 ms) más su transición (0,2 s).
    const espera = () => new Promise((ok) => setTimeout(ok, 600));
    const pulsables = new Set();
    const tapados = new Set();
    const fin = document.documentElement.scrollHeight - innerHeight;
    for (let y = 0; ; y = Math.min(fin, y + innerHeight / 3)) {
      scrollTo({ top: y, behavior: 'instant' });
      await espera();
      for (const el of document.querySelectorAll('a, button')) {
        if (hud.contains(el) || pulsables.has(el)) continue;
        const e = el.getBoundingClientRect();
        const visible = e.width > 0 && e.height > 0 && getComputedStyle(el).visibility !== 'hidden';
        const entero = e.top >= 0 && e.left >= 0 && e.bottom <= innerHeight && e.right <= innerWidth;
        if (!visible || !entero) continue;
        // Un enlace en línea partido en dos renglones tiene el centro de su caja fuera del texto: se mira
        // el centro de cada renglón.
        const encima = [...el.getClientRects()].map((c) => document.elementFromPoint(c.left + c.width / 2, c.top + c.height / 2));
        if (encima.some((x) => x !== null && el.contains(x))) pulsables.add(el);
        else if (encima.some((x) => x !== null && hud.contains(x))) tapados.add(el);
      }
      if (y >= fin) break;
    }
    return [...tapados].some((el) => !pulsables.has(el));
  });
}

async function main() {
  mkdirSync(salida, { recursive: true });
  const servidor = await servir(cabecerasGlobales());
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const capturas = new Map([['/', 'portada'], ...fichasCambiadas().map((slug) => [`/viajes/${slug}/`, `viaje-${slug}`])]);
  const todas = [...new Set([...paginas(), ...capturas.keys()])].sort();
  const fallos = [];
  const fallo = (pagina, ancho, tipo) => {
    if (!fallos.some((f) => f.pagina === pagina && f.ancho === ancho && f.tipo === tipo)) fallos.push({ pagina, ancho, tipo });
  };

  const navegador = await chromium.launch();
  try {
    for (const ancho of ANCHOS) {
      const contexto = await navegador.newContext({ viewport: { width: ancho, height: ALTO[ancho] }, deviceScaleFactor: 1 });
      await contexto.addInitScript(() => {
        window.__violaciones = 0;
        document.addEventListener('securitypolicyviolation', () => (window.__violaciones += 1), true);
      });
      for (const url of todas) {
        const pagina = codigoPagina(url);
        const page = await contexto.newPage();
        let errorJs = false;
        page.on('pageerror', () => (errorJs = true));
        try {
          const resp = await page.goto(base + url, { waitUntil: 'load' });
          await page.evaluate(() => document.fonts.ready);
          if (resp === null || resp.status() >= 400 || errorJs) fallo(pagina, ancho, 'error-carga');
          if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) fallo(pagina, ancho, 'desborde');
          if (url === '/' && (await solapesHud(page))) fallo(pagina, ancho, 'solape-hud');
          if (await page.evaluate(() => window.__violaciones > 0)) fallo(pagina, ancho, 'csp');
          const nombre = capturas.get(url);
          if (nombre !== undefined) {
            await page.evaluate(() => scrollTo({ top: 0, behavior: 'instant' }));
            await page.screenshot({ path: join(salida, `${nombre}-${ancho}.png`), fullPage: true });
          }
        } catch {
          fallo(pagina, ancho, 'error-carga');
        } finally {
          await page.close();
        }
      }
      await contexto.close();
    }
  } finally {
    await navegador.close();
    servidor.close();
  }

  writeFileSync(join(salida, 'resultado.json'), `${JSON.stringify({ fallos }, null, 2)}\n`);
  for (const f of fallos) process.stderr.write(`${f.tipo} ${f.pagina} ${f.ancho}\n`);
  process.exitCode = fallos.length > 0 ? 1 : 0;
}

await main();
