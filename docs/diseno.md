# Diseño

Tokens, tipografía, componentes y puntos de corte tal como están en el código. La referencia de diseño es `docs/propuesta.html` (propuesta v5, añadida en el commit `0f4d6de`); el repo no recoge que Pelayo la haya aprobado. Cómo revisar un cambio visual en escritorio y móvil: `CLAUDE.md`.

## Idea

La web es una inmersión: la portada baja de la superficie al azul y vuelve a subir. Cada sección declara su tramo de profundidad con `data-depth` y `data-depth-end`, y el ordenador de buceo calcula la profundidad de lo que está en el centro de la pantalla (`src/components/OrdenadorBuceo.astro:35,42-50`). Los fondos de las secciones usan los colores de profundidad `--d*` en ese mismo orden.

| Sección | Tramo (m) | Fondo |
|---|---|---|
| Hero | 0 a 3 (`src/components/Hero.astro:12`) | cielo `--sky-1`/`--sky-2` sobre agua `--d0`/`--d5` (`src/styles/home.css:2`) |
| Bases | 3 a 8 (`src/components/Bases.astro:4`) | `--d5` a `--d10` (`src/styles/home.css:29`) |
| Carta de puntos | 8 a 12 (`src/pages/index.astro:32`) | `--d10` a `--d18` (`src/styles/carta.css:1`) |
| Cursos | 12 a 40 (`src/components/Cursos.astro:8`) | `--d18` a `--d40` (`src/styles/home.css:46`) |
| Viajes | 40 a 30 (`src/components/Viajes.astro:13`) | `--d40` a `--abyss` (`src/styles/viajes.css:1`) |
| Cuaderno de fauna | 30 a 15 (`src/components/Fauna.astro:9`) | `--abyss` a `--d30` (`src/styles/home.css:61`) |
| Contacto | 15 a 3 (`src/components/Contacto.astro:18`) | `--d30`, `--asc` y `--d0` (`src/styles/home.css:81`) |
| Pie | 3 a 0 (`src/components/Pie.astro:5`) | `--d0` (`src/styles/marco.css:14`) |

Las páginas interiores no tienen tramos: fondo `--d18` a `--abyss` (`src/styles/marco.css:38`).

## Tokens

Todos en `:root` de `src/styles/base.css`.

| Token | Valor | Uso | Línea |
|---|---|---|---|
| `--ink` | `#04131d` | texto oscuro sobre fondos claros; botón `.btn-ink` | `src/styles/base.css:3` |
| `--foam` | `#effafb` | texto principal | `src/styles/base.css:3` |
| `--foam-2` | `rgba(239, 250, 251, .72)` | texto secundario | `src/styles/base.css:3` |
| `--foam-3` | `rgba(239, 250, 251, .45)` | texto terciario, bordes | `src/styles/base.css:3` |
| `--tail` | `#8fd8ea` | acento frío: etiquetas, enlaces, selector activo | `src/styles/base.css:4` |
| `--coral` | `#ff6a3d` | acción principal (`.btn-coral`), foco | `src/styles/base.css:4` |
| `--sand` | `#f3dcb8` | tarjeta de The Sunset, avisos del formulario | `src/styles/base.css:4` |
| `--sky-1`, `--sky-2` | `#ffe2b8`, `#f9ae86` | cielo del hero | `src/styles/base.css:5` |
| `--d0`, `--d5`, `--d10`, `--d18`, `--d30`, `--d40` | `#1e9db0` a `#04213a` | azules por profundidad (el número son metros) | `src/styles/base.css:6` |
| `--abyss` | `#020c18` | fondo de la página y `theme-color` (`src/layouts/Base.astro:39`) | `src/styles/base.css:6` |
| `--asc` | `#08425f` | tramo de ascenso de contacto | `src/styles/base.css:6` |
| `--viaje` | `#e8399f` | categoría viaje | `src/styles/base.css:7` |
| `--fauna` | `#1fc28c` | categoría fauna | `src/styles/base.css:7` |
| `--daytrip` | `#f0364e` | categoría day trip; alarma del ordenador | `src/styles/base.css:7` |
| `--pecio` | `#3d6bff` | categoría pecios | `src/styles/base.css:7` |
| `--lv-0` a `--lv-4` | `#8fd8ea`, `#8fd8ea`, `#5aa9ff`, `#f7b955`, `#ff6a3d` | nivel de titulación de cada punto en la carta | `src/styles/base.css:8` |
| `--f-display`, `--f-body`, `--f-serif`, `--f-mono` | ver Tipografía | familias | `src/styles/base.css:9-12` |
| `--gut` | `clamp(16px, 4vw, 56px)` | margen lateral de `.wrap` | `src/styles/base.css:13` |

- **Niveles `--lv-*`.** El índice es el `RANGO` del nivel (`src/lib/buceo.ts:4-10`): 0 sin titulación, 1 Open Water, 2 Advanced, 3 Deep, 4 técnico. Se aplican en las marcas de la carta (`src/components/Carta.astro:29`) y en la lista con `bg-lv-*` (`src/components/Carta.astro:75`, `src/styles/carta.css:16-17`). `--lv-0` y `--lv-1` son el mismo color, y la leyenda los agrupa como "Sin titulación / Open Water" (`src/components/Carta.astro:46`).
- **Categorías.** Las clases `c-*` (`src/styles/base.css:35-36`) colorean texto y chips por categoría: tipos de la bitácora (`src/components/Bitacora.astro:5-16`), fechas del viaje (`src/pages/viajes/[slug].astro:37`) y etiquetas del cuaderno (`src/components/Fauna.astro:34`).

## Colores fuera de los tokens

Valores escritos directamente, sin variable:

| Dónde | Valores | Qué |
|---|---|---|
| `src/styles/base.css:32` | `#25d366`, `#062315` | botón de WhatsApp (`.btn-wa`) |
| `src/styles/base.css:38-39` | `#8ff0c8`, `#ffb59d` | píldoras "Puedes ir" y "no" |
| `src/styles/marco.css:5` | `#050607` | círculo de la marca |
| `src/styles/marco.css:23,27,34` | `#bff3ff`, `#e9fcff`, `#ffb4a0` | ordenador de buceo |
| `src/styles/marco.css:53` | `#ffc2ad` | hueco de dato legal pendiente |
| `src/styles/home.css:33-34` | degradados `#2fb3c0`, `#0d6f8c`, `#083a55`, `#1b8fb3`, `#0a4c78`, `#062a47` | tarjetas de las bases |
| `src/styles/home.css:42` | `#e2622f` | título de The Sunset |
| `src/styles/home.css:63,69-71` | `#082c44` y degradados de `arte-*` | tarjetas del cuaderno |
| `src/styles/home.css:102` | `#ffb59d` | error del formulario |
| `src/styles/carta.css:6,28-29,42` | `#0a3550`, `#9ff0cf`, `#ffc2ad`, `#072a40` | carta, veredicto y nota en móvil |
| `src/styles/viajes.css:2-3,30,45,47,50` | `#061a2e`, `#0e5f86`, `#062038`, `#07192b`, `#ffc9b6`, `#0f3b2e`, `#25d366` | viaje destacado, tarjetas, hueco de requisitos y banner de WhatsApp |
| `src/components/CartaFondo.astro:4-49` | tierra `#d8c29b`, mar `#0a3550`, reserva `#ff6a3d`, rótulos `#5e4a2c` y otros | dibujo de la carta náutica |
| `src/components/Carta.astro:34-37` | `#04131d`, `#0a3550` | borde y rótulo de las marcas de la carta |
| `src/components/Marca.astro:9`, `public/favicon.svg` | `#8fd8ea`, `#050607` | logotipo |
| `src/components/Hero.astro:17` | `#1e9db0` | ola del hero (mismo valor que `--d0`) |
| `src/components/Fauna.astro:19-20` | `#ffb8d9`, `#a24a8a`, `#051b2c` | ilustración de medusas |
| `src/pages/og/[...ruta].png.ts:19,32` | `#e8399f`, `#1fc28c` | acento de las imágenes OG de viajes y del cuaderno (mismos valores que `--viaje` y `--fauna`) |
| `src/lib/og.ts:41,44,64,71,88,91` | `#8fd8ea`, `#effafb`, `#0b6584`, `#04213a`, `#020c18` y otros | imágenes Open Graph: `satori` no lee el CSS, así que repite los valores de los tokens |

## Tipografía

Las cuatro familias salen de Fontsource y se importan en `src/layouts/Base.astro:2-10`, solo el subconjunto latino y los pesos indicados.

| Familia | Token | Pesos importados | Uso |
|---|---|---|---|
| Big Shoulders Display | `--f-display` | 800, 900 (`src/layouts/Base.astro:2-3`) | titulares de sección y de página, números de profundidad, nombre de la marca (`src/styles/base.css:42,44`, `src/styles/marco.css:6,40`) |
| Instrument Sans | `--f-body` | 400, 500, 600 (`src/layouts/Base.astro:4-6`) | texto corrido (`src/styles/base.css:17`) |
| Instrument Serif | `--f-serif` | 400 e itálica (`src/layouts/Base.astro:7-8`) | palabra en cursiva dentro de los titulares (`.serif`), citas (`.quote`) y nombres científicos (`.sci`) (`src/styles/base.css:45-46`, `src/styles/home.css:67`) |
| Martian Mono | `--f-mono` | 400, 500 (`src/layouts/Base.astro:9-10`) | etiquetas en mayúsculas (`.mono`), botones, chips, formulario y ordenador de buceo (`src/styles/base.css:24,26,34`, `src/styles/marco.css:23`) |

Las familias de respaldo de los tokens (p. ej. "Oswald" en `--f-display`, `src/styles/base.css:9`) no se cargan. Las imágenes OG cargan sus propias fuentes desde los ficheros de Fontsource (`src/lib/og.ts:26-34`).

## Componentes

En `src/components/`:

| Componente | Qué es |
|---|---|
| `Nav.astro` | cabecera; variante `oscura` en páginas interiores |
| `Marca.astro` | logotipo y nombre "DIVE CLIF" |
| `Pie.astro` | pie con enlaces |
| `Hero.astro` | cabecera de la portada con el rótulo partido por la línea de agua |
| `Bases.astro` | Cabo de Palos, Madrid y The Sunset |
| `Carta.astro`, `CartaFondo.astro` | carta de puntos (interactiva) y su dibujo de fondo |
| `SelectorTitulacion.astro` | botones de titulación compartidos |
| `Cursos.astro` | escala de cursos por profundidad y línea profesional |
| `Viajes.astro`, `ViajeDestacado.astro`, `PuedoIr.astro`, `Bitacora.astro` | sección de viajes |
| `ComunidadWhatsApp.astro` | banner de la comunidad, también en la ficha de viaje |
| `Fauna.astro` | cuaderno de fauna y taller |
| `Contacto.astro` | canales y formulario |
| `OrdenadorBuceo.astro` | HUD de profundidad |
| `Banco.astro` | banco de peces en SVG, determinista por semilla (`src/lib/arte.ts:8-17`) |
| `Dato.astro` | valor legal o hueco marcado si falta |

Clases reutilizables de `src/styles/base.css`: `.wrap` (23), `.mono` (24), `.btn` y variantes `-ink`, `-coral`, `-ghost`, `-wa` (26-32), `.chip` (34), `.c-*` (35-36), `.pill` (37-39), `.depth-tag` (41-42), `.sec` (43-44), `.serif` (45), `.quote` (46), `.lede` (47), `.cert` (49-52), `.sr-only` (22). De `src/styles/marco.css`, para páginas interiores: `.page`, `.page-head`, `.crumbs`, `.prose`, `.facts`, `.two`, `.cta-row` (38-58).

Qué CSS carga cada página: `base.css` y `marco.css` siempre (`src/layouts/Base.astro:11-12`); `home.css` en la portada (`src/pages/index.astro:16`); `carta.css` donde hay carta (`src/components/Carta.astro:7`); `viajes.css` en la sección de viajes y en la ficha de viaje (`src/components/Viajes.astro:8`, `src/pages/viajes/[slug].astro:12`).

## Puntos de corte

| Ancho | Qué cambia | Dónde |
|---|---|---|
| 980 px | desaparecen los enlaces de la cabecera; rejillas de dos columnas pasan a una (hero, bases, contacto, carta, viaje destacado); tarjetas de viaje a dos columnas | `src/styles/marco.css:60`, `src/styles/home.css:112`, `src/styles/carta.css:37`, `src/styles/viajes.css:66` |
| 620 px | botones y selector de titulación compactos; ordenador de buceo a lo ancho abajo; formulario y tarjetas a una columna | `src/styles/base.css:54`, `src/styles/marco.css:63`, `src/styles/home.css:121`, `src/styles/carta.css:40`, `src/styles/viajes.css:76` |
| 560 px (ancho de la carta) | la carta se recorta a la zona de la reserva | `src/components/Carta.astro:130` (JavaScript) |
| 300 px (ancho del hueco) | Turnstile en tamaño compacto | `src/components/Contacto.astro:72` (JavaScript) |

Con `prefers-reduced-motion` se quitan animaciones y transiciones (`src/styles/base.css:61-64`), las burbujas del hero (`src/components/Hero.astro:57`) y la alarma de ascenso (`src/components/OrdenadorBuceo.astro:64`).

## Restricciones de la CSP sobre los estilos

La CSP de `public/_headers:2` tiene `style-src 'self'` sin `unsafe-inline` (regla en `CLAUDE.md`). En la práctica:

- Todo el CSS va en `src/styles/` o en ficheros importados; nada de `<style>` ni `style=` en el HTML.
- Los colores que dependen de datos se resuelven con clases (`c-*`, `bg-lv-*`), no con estilos en línea.
- Los atributos de presentación de SVG (`fill`, `stroke`) no son estilos en línea y se usan en los dibujos.
- Desde JavaScript se pueden cambiar propiedades por CSSOM (`el.style.setProperty`), como hacen la línea de agua y las burbujas del hero (`src/components/Hero.astro:50,61-66`); la CSP no lo bloquea.
- `scripts/movil.html` lleva `style=` en línea, pero solo se usa en local y no llega a producción (`CLAUDE.md`).

## Pendiente de validar por Pelayo

No consta en el repo que Pelayo haya validado nada de lo siguiente:

- Paleta (tokens y colores de categoría y nivel).
- Tipografía: las cuatro familias y sus pesos.
- Logotipo: `src/components/Marca.astro` y `public/favicon.svg`.
- Metáfora de profundidad y ordenador de buceo.
- Textos de la portada (hero, bases, cursos, cuaderno y contacto), escritos en los componentes.
