# Pantallas

Rutas de la web, de dónde se llega a cada una y a dónde llevan sus acciones. Todas las páginas comparten la cabecera (`src/components/Nav.astro`) y el pie (`src/components/Pie.astro`); la marca de la cabecera y del pie lleva a `/` (`src/components/Marca.astro:5,7`).

## Navegación común

- Cabecera (`src/components/Nav.astro:12-18`): Viajes (`/#viajes`), Puntos de inmersión (`/puntos-de-inmersion`), Cursos (`/#cursos`), Bases (`/#bases`), Cuaderno (`/#fauna`) y el botón "Reserva tu plaza" (`/#contacto`). Por debajo de 980 px solo quedan la marca y el botón (`src/styles/marco.css:60-62`).
- Pie (`src/components/Pie.astro:9-13`): Puntos de inmersión, Instagram y Comunidad WhatsApp (externos, en pestaña nueva), Aviso legal y Privacidad.
- Las páginas interiores llevan migas de pan con enlace a Inicio (p. ej. `src/pages/viajes/[slug].astro:36`).

## Rutas

| Ruta | Fichero | De dónde se llega | Acciones principales y a dónde llevan |
|---|---|---|---|
| `/` | `src/pages/index.astro` | Marca de cabecera y pie; migas "Inicio" de todas las páginas interiores; "Volver a superficie" de la 404 (`src/pages/404.astro:15`) | Secciones de la portada (abajo). |
| `/puntos-de-inmersion` | `src/pages/puntos-de-inmersion/index.astro` | Cabecera (`src/components/Nav.astro:13`); pie (`src/components/Pie.astro:9`); migas y "Ver la carta" de cada punto (`src/pages/puntos-de-inmersion/[slug].astro:34,48`); enlace "day trips a Cabo de Palos" de "¿Puedo ir?" cuando faltan inmersiones (`src/components/PuedoIr.astro:71`) | Carta con selector de titulación; el nombre de cada punto en su ficha lleva a `/puntos-de-inmersion/[slug]` (`src/components/Carta.astro:59`); "Reservar una salida" lleva a `/#contacto` (`src/pages/puntos-de-inmersion/index.astro:27`). |
| `/puntos-de-inmersion/[slug]` | `src/pages/puntos-de-inmersion/[slug].astro` | Ficha del punto en la carta, en la portada y en `/puntos-de-inmersion` (`src/components/Carta.astro:59`). Una página por fichero de `src/content/puntos/`. | "Bucear aquí con Pelayo" lleva a `/#contacto`; "Ver la carta" a `/puntos-de-inmersion` (`src/pages/puntos-de-inmersion/[slug].astro:47-48`). |
| `/viajes/[slug]` | `src/pages/viajes/[slug].astro` | Título de cada tarjeta de "¿Puedo ir?" (`src/components/PuedoIr.astro:40`); "Ver itinerario" del viaje destacado (`src/components/ViajeDestacado.astro:34`). Una página por fichero de `src/content/viajes/`, también de los viajes ya terminados, que dejan de enlazarse desde la portada (`src/lib/viajes.ts:13-15`). | "Pedir plaza" lleva a `/#contacto`; "¿Cumplo los requisitos?" a `/#puedo-ir` (`src/pages/viajes/[slug].astro:59-60`); banner de la comunidad de WhatsApp, externo (`src/components/ComunidadWhatsApp.astro:9`). |
| `/cuaderno/[slug]` | `src/pages/cuaderno/[slug].astro` | Tarjetas del cuaderno en la portada (`src/components/Fauna.astro:16`). La portada solo muestra los cuatro artículos más recientes (`src/components/Fauna.astro:5`): un quinto artículo tendría página pero ningún enlace. | "Más del cuaderno" y migas "Cuaderno" llevan a `/#fauna` (`src/pages/cuaderno/[slug].astro:30,36`). |
| `/legal/aviso-legal` | `src/pages/legal/aviso-legal.astro` | Pie (`src/components/Pie.astro:12`) | Enlace `mailto:` al email de contacto (`src/pages/legal/aviso-legal.astro:13`). |
| `/legal/privacidad` | `src/pages/legal/privacidad.astro` | Pie (`src/components/Pie.astro:13`); texto bajo el formulario (`src/components/Contacto.astro:46`) | Enlaces `mailto:` y a la web de la AEPD (`src/pages/legal/privacidad.astro:38`). |
| 404 | `src/pages/404.astro` | Cualquier URL que no existe. Astro genera `404.html`; quien la sirve es Cloudflare Pages (comportamiento de la plataforma, sin configuración en el repo). | "Volver a superficie" lleva a `/` (`src/pages/404.astro:15`). |

## Secciones de la portada

En el orden de `src/pages/index.astro:30-46`. El ancla es el `id` de la sección.

| Sección | Ancla | Fichero | Acciones |
|---|---|---|---|
| Hero | `#superficie` (`src/components/Hero.astro:12`) | `src/components/Hero.astro` | "Próximos viajes" a `#viajes`, "Hazte buceador" a `#cursos` (`src/components/Hero.astro:33-34`). |
| Bases | `#bases` (`src/components/Bases.astro:4`) | `src/components/Bases.astro` | "Apúntate" a The Sunset lleva a `#contacto` (`src/components/Bases.astro:36`). |
| Carta de puntos | `#puntos` (`src/pages/index.astro:32`) | `src/components/Carta.astro` | Selector de titulación; elegir punto en la carta o en la lista; enlace a la ficha del punto. Ningún menú enlaza `#puntos`: la cabecera lleva a `/puntos-de-inmersion`. |
| Cursos | `#cursos` (`src/components/Cursos.astro:8`); cada curso, `#curso-<id>` (`src/components/Cursos.astro:17,27`) | `src/components/Cursos.astro` | Sin enlaces. |
| Viajes | `#viajes` (`src/components/Viajes.astro:13`); "¿Puedo ir?", `#puedo-ir` (`src/components/PuedoIr.astro:13`) | `src/components/Viajes.astro`, `ViajeDestacado.astro`, `PuedoIr.astro`, `ComunidadWhatsApp.astro`, `Bitacora.astro` | Viaje destacado: "Reservar plaza" a `#contacto`, "Ver itinerario" a `/viajes/[slug]` (`src/components/ViajeDestacado.astro:33-34`). "¿Puedo ir?": selector de titulación, deslizador de inmersiones y enlace a cada viaje. Banner de la comunidad de WhatsApp. Bitácora: filtros por tipo (`src/components/Bitacora.astro:22`). |
| Cuaderno de fauna | `#fauna` (`src/components/Fauna.astro:9`) | `src/components/Fauna.astro` | Cada tarjeta lleva a `/cuaderno/[slug]`; "Avísame" del taller lleva a `#contacto` (`src/components/Fauna.astro:44`). |
| Contacto | `#contacto` (`src/components/Contacto.astro:18`) | `src/components/Contacto.astro` | Canales: comunidad de WhatsApp, Instagram, email y, cuando haya número, WhatsApp directo (`src/components/Contacto.astro:24-29`). Formulario que envía a `POST /api/contacto` (`src/components/Contacto.astro:31`). Enlace grande a Instagram (`src/components/Contacto.astro:51`). |
| Pie | sin ancla | `src/components/Pie.astro` | Ver "Navegación común". |
| Ordenador de buceo | sin ancla | `src/components/OrdenadorBuceo.astro` | Ninguna: solo informa. Se oculta al llegar al pie (`src/components/OrdenadorBuceo.astro:59-60`) y, en móvil, mientras se ve el hero (`src/components/OrdenadorBuceo.astro:58`, `src/styles/marco.css:73`). |

Todas las anclas que se enlazan (`#viajes`, `#cursos`, `#bases`, `#fauna`, `#contacto`, `#puedo-ir`) existen en la portada.

## Rutas que no son pantallas

| Ruta | Fichero | Qué es |
|---|---|---|
| `/og/<ruta>.png` | `src/pages/og/[...ruta].png.ts` | Imagen Open Graph de cada página, generada en el build; `src/layouts/Base.astro:25` la enlaza en `og:image`. |
| `/robots.txt` | `src/pages/robots.txt.ts` | Permite o prohíbe indexar según `INDEXAR` y la rama (reglas en `CLAUDE.md`). |
| `/sitemap-index.xml` | `@astrojs/sitemap` (`astro.config.mjs:6`) | Sitemap; enlazado desde `src/layouts/Base.astro:41` y desde `robots.txt` cuando se indexa (`src/pages/robots.txt.ts:6`). |
| `POST /api/contacto` | `functions/api/contacto.ts` | Pages Function del formulario (flujo en `docs/datos.md`). |

## Android

No aplica: diveclif es solo web.
