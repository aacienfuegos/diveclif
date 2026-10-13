# Técnico

Stack, estructura y límites de la web. Lo que hay que hacer en cada cambio (revisión en escritorio y móvil, comprobaciones antes del commit, reglas de CSP, marca e indexación) está en el `CLAUDE.md` de la raíz; este documento remite a él y no lo copia.

## Stack

Versiones mínimas declaradas en `package.json`; las exactas están en `package-lock.json`.

| Pieza | Versión | Para qué |
|---|---|---|
| Node.js | `>=22.12.0` (`package.json:5-7`) | build y desarrollo |
| Astro | `^7.3.5` (`package.json:22`) | generador del sitio estático y content collections |
| `@astrojs/sitemap` | `^3.7.4` (`package.json:16`) | sitemap |
| Fontsource: Big Shoulders Display, Instrument Sans, Instrument Serif, Martian Mono | `^5.3.0` (`package.json:17-20`) | fuentes servidas desde el propio dominio |
| `satori` y `@resvg/resvg-js` | `^0.33.5` y `^2.6.2` (`package.json:21,23`) | imágenes Open Graph en el build |
| `sharp` | sin declarar en `package.json`; llega como dependencia de Astro (`package-lock.json`) | recorte de las fotos de Open Graph (`src/lib/og.ts:6,55`) |
| `zod` | `^4.6.5` (`package.json:24`) | validación del formulario en la Pages Function (`src/lib/contacto.ts`) |
| TypeScript | `^6.0.3` (`package.json:29`) | tipos; configuración `astro/tsconfigs/strictest` (`tsconfig.json:2`) |
| Vitest | `^5.0.1` (`package.json:30`) | tests (`tests/buceo.test.ts`) |
| `@astrojs/check` | `^0.9.10` (`package.json:27`) | `npm run check` |
| Wrangler y `@cloudflare/workers-types` | `^4.139.0` y `^5.20260924.1` (`package.json:28,31`) | probar la Pages Function en local y sus tipos |

Alojamiento: Cloudflare Pages, con el formulario como Pages Function (`CLAUDE.md`).

## Estructura

```
astro.config.mjs        sitio, integraciones, CSP en el build y esquema de entorno
public/_headers         cabeceras HTTP de Cloudflare Pages (CSP, HSTS, caché, noindex en previews)
public/favicon.svg      logotipo en SVG
functions/api/          Pages Function del formulario (POST /api/contacto)
functions/tsconfig.json tipos de Workers para la función; incluye src/lib/contacto.ts
src/config.ts           datos del sitio (SITE) y datos legales (LEGAL)
src/content.config.ts   esquemas de las cinco colecciones
src/content/            contenido: viajes, puntos, cursos, cuaderno (Markdown) y bitacora.json
src/pages/              rutas (ver docs/pantallas.md)
src/layouts/            Base.astro (head, fuentes, CSS común) y Legal.astro
src/components/         secciones y piezas de la interfaz (ver docs/diseno.md)
src/lib/                lógica sin interfaz: buceo, carta, fechas, ficha, jsonld, og, viajes, contacto, arte
src/styles/             CSS: base, marco, home, carta, viajes
src/assets/og/          fotos opcionales para las imágenes Open Graph
tests/                  tests de Vitest
scripts/movil.html      página de revisión móvil con dos iframes; solo para local (CLAUDE.md)
docs/                   esta documentación y la propuesta de diseño
```

El alias `@/` apunta a `src/` (`tsconfig.json:7`).

## Límites

- **Sitio estático.** Todas las páginas se generan en el build (`getStaticPaths` en cada ruta dinámica, p. ej. `src/pages/viajes/[slug].astro:14-17`). No hay servidor de aplicación ni renderizado bajo demanda.
- **El contenido se congela en el build.** Qué viajes son "próximos" se decide con la fecha del build (`src/pages/index.astro:19`, `src/lib/viajes.ts:13-15`): un viaje que ya terminó sigue en la portada hasta el siguiente despliegue.
- **Sin base de datos ni cuentas.** El modelo de datos son las colecciones de `src/content.config.ts` (`docs/datos.md`).
- **Una sola función de servidor**: `functions/api/contacto.ts`, que valida, verifica Turnstile y envía un correo. No guarda nada.
- **CSP estricta sin `unsafe-inline`** (`public/_headers:2`). Por eso Astro no incrusta CSS (`inlineStylesheets: 'never'`, `astro.config.mjs:7-10`) ni convierte recursos pequeños en `data:` (`assetsInlineLimit: 0`, `astro.config.mjs:11-13`). Los scripts de los componentes se empaquetan como ficheros. Las dos excepciones en el HTML son el script de Turnstile, externo y permitido por la CSP (`src/components/Contacto.astro:59`), y el bloque JSON-LD (`src/layouts/Base.astro:54`), que es de tipo `application/ld+json`: el navegador no lo ejecuta, así que `script-src` no lo bloquea. Ese bloque usa `set:html` con datos de contenido, escapando `<` para que ningún texto cierre el `<script>` (`src/lib/jsonld.ts:9-11`). Restricciones para estilos: `docs/diseno.md`.
- **Caché**: `/_astro/*` lleva caché inmutable de un año (`public/_headers:9-10`); los nombres de esos ficheros cambian con el contenido.

## Dependencias externas en tiempo de ejecución

| Servicio | Desde dónde | Para qué |
|---|---|---|
| Cloudflare Turnstile | navegador (`src/components/Contacto.astro:59,69-78`) y función (`functions/api/contacto.ts:13-22`) | antispam del formulario; la CSP permite su script y su iframe (`public/_headers:2`) |
| Resend | función (`functions/api/contacto.ts:40-50`) | envío del correo con la consulta |
| Cloudflare Web Analytics | navegador | estadísticas de visitas. La CSP permite su script y su envío (`public/_headers:2`) y la política de privacidad lo menciona (`src/pages/legal/privacidad.astro:14`), pero el repo no lo inserta. Pendiente: confirmar dónde se activa (en Cloudflare, fuera del repo). |

Enlaces salientes (Instagram, comunidad de WhatsApp) están en `src/config.ts`; no cargan nada en la página.

## Build

`npm run build` (`package.json:10`) genera en `dist/`:

- Las páginas HTML de `src/pages/` y `404.html`.
- Las PNG de Open Graph (`src/pages/og/[...ruta].png.ts`): `satori` compone la tarjeta con las fuentes de Fontsource leídas del disco (`src/lib/og.ts:22-34`) y `resvg` la rasteriza (`src/lib/og.ts:93-94`).
- `robots.txt` (`src/pages/robots.txt.ts`) y el sitemap (`@astrojs/sitemap`, `astro.config.mjs:6`).

Variables que lee el build: `SITE_URL`, `CF_PAGES_BRANCH`, `INDEXAR` y `PUBLIC_TURNSTILE_SITE_KEY` (`astro.config.mjs:5,14-26`). Las de la función: `docs/datos.md`. Cómo combinan `INDEXAR` y la rama para indexar: `CLAUDE.md`.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | servidor de desarrollo de Astro (`package.json:9`) |
| `npm run build` | build de producción en `dist/` (`package.json:10`) |
| `npm run preview` | sirve `dist/` (`package.json:11`) |
| `npm run check` | `astro check`: tipos de `.astro` y TypeScript (`package.json:12`) |
| `npm test` | Vitest (`package.json:13`) |
| `npx tsc -p functions/tsconfig.json` | tipos de la Pages Function (`functions/tsconfig.json`) |
| `npx wrangler pages dev dist` | la función en local, con las variables en `.dev.vars` copiado de `.dev.vars.example` (`.dev.vars.example:1`) |

Qué ejecutar antes de cada commit y cómo revisar en móvil: `CLAUDE.md`.

## Tests

`tests/buceo.test.ts` cubre la evaluación de viajes y puntos (`src/lib/buceo.ts`), la proyección y el formato de coordenadas de la carta (`src/lib/carta.ts`), el formato de fechas (`src/lib/fechas.ts`) y el esquema del formulario, incluido el campo trampa (`src/lib/contacto.ts`). No hay tests de la Pages Function ni de interfaz.
