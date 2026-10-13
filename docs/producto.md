# Producto

Qué es la web de Dive Clif, para quién es y qué hace hoy. Las reglas de trabajo del repo (revisión en móvil, CSP, marca, indexación) están en el `CLAUDE.md` de la raíz; aquí no se repiten.

## Qué es

Es el escaparate de Pelayo, instructor de buceo (IDC Staff Instructor PADI y Divemaster Instructor SSI, `src/lib/jsonld.ts:40`), que trabaja entre Cabo de Palos y Madrid (`src/config.ts:4-5`, `src/components/Bases.astro:7-31`). La web enseña cuatro cosas y lleva a una quinta:

- **Cursos** PADI y SSI, de bautismo a profesional (`src/content/cursos/`, `src/components/Cursos.astro`).
- **Viajes** de buceo nacionales e internacionales y salidas de un día (`src/content/viajes/`, `src/components/Viajes.astro`). Los viajes combinados los organiza Te Moana Expeditions (`src/pages/legal/aviso-legal.astro:19`); cada viaje dice quién lo organiza en su ficha (`src/pages/viajes/[slug].astro:47`).
- **Puntos de inmersión** de la Reserva Marina de Cabo de Palos e Islas Hormigas (`src/content/puntos/`, `src/pages/puntos-de-inmersion/`).
- **Cuaderno de fauna**: artículos sobre especies del Mediterráneo (`src/content/cuaderno/`, `src/components/Fauna.astro`).
- **Contacto**: formulario que envía la consulta por correo a Pelayo, más enlaces a la comunidad de WhatsApp, Instagram y email (`src/components/Contacto.astro`).

La contratación y el pago de los viajes no pasan por la web: se formalizan con la agencia (`src/pages/legal/aviso-legal.astro:19`). La web no cobra ni guarda datos (`docs/datos.md`).

## Para quién

- Quien quiere empezar a bucear o sacarse la siguiente titulación, en Madrid (piscina) o en Cabo de Palos (mar) (`src/components/Bases.astro:8`, `src/components/Hero.astro:31`).
- Buceadores titulados que buscan viaje o salida y quieren saber si cumplen los requisitos ("¿Puedo ir?", abajo).
- Buceadores que preparan una inmersión en Cabo de Palos y consultan profundidad, nivel, corriente y fauna de cada punto (`src/pages/puntos-de-inmersion/[slug].astro:38-45`).

Pendiente: no hay en el repo un documento de público objetivo validado por Pelayo; lo anterior sale de los textos de la web.

## Funcionalidades que existen hoy

| Funcionalidad | Qué hace | Dónde |
|---|---|---|
| Carta de puntos de inmersión | Carta náutica en SVG con los puntos situados por coordenadas; al elegir uno se muestra su ficha. Los puntos que no corresponden a la titulación elegida se atenúan. | `src/components/Carta.astro`, `src/components/CartaFondo.astro`, `src/lib/carta.ts` |
| Selector de titulación | Botones "Tu titulación" compartidos por la carta y por "¿Puedo ir?"; la elección se guarda en el navegador (`localStorage`) y se recuerda en la siguiente visita. | `src/components/SelectorTitulacion.astro`, `src/lib/ficha.ts:3,26-34` |
| "¿Puedo ir a este viaje?" | Con la titulación y las inmersiones registradas (deslizador de 0 a 150), cada viaje próximo dice "Puedes ir", "Te falta un curso" o cuántas inmersiones faltan, con enlace al curso o a las salidas. | `src/components/PuedoIr.astro`, `src/lib/buceo.ts:42-53` |
| Veredicto por punto | En la ficha de cada punto de la carta, si con tu titulación puedes bajar y, si no, qué curso necesitas. El buceo técnico queda fuera de la oferta recreativa. | `src/lib/buceo.ts:60-68` |
| Ordenador de buceo (HUD) | Panel fijo que simula un ordenador de buceo: la profundidad sale de la sección visible, con máxima, temperatura, NDL de la tabla PADI RDP y alarma "SUBE DESPACIO" si se sube rápido. Decorativo (`aria-hidden`). | `src/components/OrdenadorBuceo.astro` |
| Viaje destacado | El primer viaje próximo con `destacado: true`, o el primero por fecha si no hay ninguno. | `src/components/Viajes.astro:11`, `src/components/ViajeDestacado.astro` |
| Bitácora de viajes | Viajes ya hechos, con filtro por tipo (todos, internacional, day trip, pecios). | `src/components/Bitacora.astro`, `src/content/bitacora.json` |
| Formulario de contacto | Consulta con interés, titulación y mensaje; antispam con Cloudflare Turnstile y campo trampa; se envía por correo con Resend. | `src/components/Contacto.astro`, `functions/api/contacto.ts`, `docs/datos.md` |
| Imágenes Open Graph | Una PNG de 1200x630 por página, generada en el build; usa foto si existe en `src/assets/og/` y, si no, la ilustración de marca. | `src/pages/og/[...ruta].png.ts`, `src/lib/og.ts`, `src/assets/og/LEEME.md` |
| Datos estructurados (JSON-LD) | Organización, persona, sitio web, evento semanal "The Sunset", viajes, puntos, artículos y migas de pan. | `src/lib/jsonld.ts`, `src/layouts/Base.astro:54` |
| Sitemap y robots | Sitemap generado por `@astrojs/sitemap`; `robots.txt` que solo permite indexar con las condiciones del `CLAUDE.md`. | `astro.config.mjs:6`, `src/pages/robots.txt.ts` |
| Páginas legales | Aviso legal y política de privacidad, con los datos que faltan marcados como hueco visible. | `src/pages/legal/`, `src/components/Dato.astro` |

## Lo que es de ejemplo o está pendiente

- **Datos de viajes y puntos de inmersión**: de ejemplo hasta que Pelayo los valide (regla del `CLAUDE.md`). La carta lo avisa: "Posiciones y profundidades orientativas" (`src/components/Carta.astro:43`).
- **Artículos del cuaderno**: de ejemplo; el texto definitivo sale de los posts de Instagram (p. ej. `src/content/cuaderno/pez-ballesta.md:12`).
- **Datos legales**: titular, NIF, domicilio, números de instructor PADI y SSI, razón social y título-licencia de Te Moana Expeditions están a `null` en `src/config.ts:13-25`; las páginas legales los muestran como hueco (`src/components/Dato.astro:8`).
- **WhatsApp directo**: `whatsappNumero` es `null` (`src/config.ts:8`); mientras lo sea, el canal "WhatsApp" no aparece en contacto (`src/components/Contacto.astro:24-26`). La comunidad de WhatsApp sí está enlazada.
- **Fotos para Open Graph**: no hay ninguna en `src/assets/og/` (solo `LEEME.md`); todas las tarjetas salen con la ilustración.
- **Panel de edición para Pelayo**: el `CLAUDE.md` dice que Pelayo editará desde un panel; hoy no existe. El contenido se edita en los ficheros de `src/content/`. Hay textos que no están en colecciones sino en los componentes (The Sunset en `src/components/Bases.astro:33-37`, taller de biología marina en `src/components/Fauna.astro:40-45`, opciones fijas del formulario en `src/components/Contacto.astro:13-15`): un panel que solo edite colecciones no los alcanzaría.
- **Página "Sobre Pelayo"**: no existe; el JSON-LD usa `/sobre-pelayo#pelayo` como identificador de la persona (`src/lib/jsonld.ts:7`).
- **Diseño**: paleta, tipografía, logotipo y metáfora de profundidad, pendientes de validar por Pelayo (`docs/diseno.md`).

## Fuera de alcance

- Reservas, pagos y cuentas de usuario: no hay (`docs/datos.md`).
- App móvil: no hay; diveclif es solo web.

## Documentos relacionados

- `docs/tecnico.md`: stack, estructura, límites y comandos.
- `docs/pantallas.md`: rutas y navegación.
- `docs/diseno.md`: tokens, tipografía y componentes.
- `docs/datos.md`: colecciones de contenido y flujo del formulario.
- `docs/propuesta.html`: propuesta de diseño usada como referencia.
