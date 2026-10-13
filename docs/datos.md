# Datos

Qué datos tiene la web, dónde viven y qué pasa con lo que envía un visitante.

## Base de datos

No hay base de datos ni migraciones. Todo el contenido son ficheros del repo, validados en el build por las content collections de Astro (`src/content.config.ts`). Cambiar contenido es cambiar un fichero y volver a desplegar.

## Autenticación

No hay cuentas ni sesiones. La web no tiene zona privada ni panel de edición (`docs/producto.md`).

## Colecciones

Los esquemas completos están en `src/content.config.ts`; aquí van los campos que deciden algo en la interfaz.

| Colección | Ficheros | Campos clave | Esquema |
|---|---|---|---|
| `viajes` | `src/content/viajes/*.md` | `tipo` (internacional, nacional, day-trip), `inicio` y `fin` (`fin` no puede ser anterior a `inicio`), `nivel` y `inmersionesMinimas` (requisitos para "¿Puedo ir?"), `organiza`, `estado` (abierto, últimas plazas, completo), `destacado`, `precioDesde` | `src/content.config.ts:8-33` |
| `puntos` | `src/content/puntos/*.md` | `orden` (número en la carta y orden de la lista), `tipo` (los `pecio` se dibujan como rombo), `lat` y `lon` (limitados al recuadro de la carta), `profundidad`, `nivel`, `corriente`, `fauna` | `src/content.config.ts:35-49` |
| `cursos` | `src/content/cursos/*.md` | `orden`, `linea` (recreativa o profesional), `profundidadMax`, `agencias` | `src/content.config.ts:51-61` |
| `cuaderno` | `src/content/cuaderno/*.md` | `fecha` (orden en la portada), `etiqueta`, `especie`, `arte` (ilustración de fondo de la tarjeta) | `src/content.config.ts:63-73` |
| `bitacora` | `src/content/bitacora.json` (un solo fichero JSON) | `tipo` (internacional, nacional, day-trip, pecios; el filtro "Internacional" incluye también los nacionales, `src/components/Bitacora.astro:44`), `orden` | `src/content.config.ts:75-84` |

El cuerpo Markdown de viajes, puntos y cuaderno es el texto de su página de detalle (`render` en `src/pages/viajes/[slug].astro:24`, `src/pages/puntos-de-inmersion/[slug].astro:21`, `src/pages/cuaderno/[slug].astro:18`). El `id` de cada entrada de viajes, puntos y cuaderno (el nombre del fichero) es el `slug` de su URL. La bitácora no tiene páginas; su `id` es un campo del JSON.

Datos que no están en colecciones: los del sitio y los legales en `src/config.ts` (los legales pendientes, a `null`: `docs/producto.md`) y algunos textos escritos en los componentes (`docs/producto.md`).

## Relaciones

No hay claves entre colecciones; lo que las une es código compartido:

- **Niveles.** `viajes.nivel` y `puntos.nivel` usan la misma lista, `NIVELES` de `src/lib/buceo.ts:1` (`src/content.config.ts:4,6`); los viajes no admiten `tecnico` (`src/content.config.ts:18`). De ahí salen el rango (`src/lib/buceo.ts:4-10`), el nombre visible (`src/lib/buceo.ts:12-18`), el color `--lv-*` (`docs/diseno.md`) y la evaluación de "¿Puedo ir?" y del veredicto de cada punto (`src/lib/buceo.ts:42-68`).
- **Titulación del visitante.** El selector ofrece `TITULACIONES` (`src/lib/buceo.ts:22-27`). La titulación y las inmersiones se guardan en el navegador del visitante, en `localStorage` con la clave `diveclif-ficha` (`src/lib/ficha.ts:3,26-34`), y no se envían a ningún servidor (`src/pages/legal/privacidad.astro:44`). Al leerlas se validan (`src/lib/ficha.ts:6-11`); si no son válidas se usa la ficha inicial, Advanced con 25 inmersiones (`src/lib/buceo.ts:34`).
- **Opciones del formulario.** "Me interesa" se construye en el build con los viajes próximos, los cursos y tres opciones fijas (`src/components/Contacto.astro:8-16`); "Titulación actual", con `TITULACIONES` más "Rescue o superior" (`src/components/Contacto.astro:40`). El servidor no comprueba que el valor recibido sea una de esas opciones: solo su longitud (`src/lib/contacto.ts:6-7`).
- **Viajes próximos.** La portada y el formulario solo usan los viajes cuyo `fin` no ha pasado en la fecha del build (`src/lib/viajes.ts:13-15`).

## Formulario de contacto

Es el único dato que sale del navegador del visitante hacia la web.

1. **Navegador.** Al cargar, se pide el script de Turnstile (`src/components/Contacto.astro:59`) y se pinta el widget con la clave pública `PUBLIC_TURNSTILE_SITE_KEY` (`src/components/Contacto.astro:44,69-78`). Al enviar, el script intercepta el formulario y manda sus campos a `POST /api/contacto` (`src/components/Contacto.astro:90-95`). Campos: `nombre`, `email`, `interes`, `titulacion`, `mensaje`, el campo trampa `web` (oculto, `src/components/Contacto.astro:43`) y la respuesta de Turnstile.
2. **Lectura.** Si el cuerpo no es un formulario, 400 (`functions/api/contacto.ts:25-30`).
3. **Validación.** `consultaSchema` (`src/lib/contacto.ts:3-11`) con longitudes máximas, email válido y `web` vacío: si un bot rellena la trampa, no pasa. Si falla, 400 (`functions/api/contacto.ts:32-33`).
4. **Turnstile.** La función verifica la respuesta con Cloudflare usando `TURNSTILE_SECRET` y la IP de `CF-Connecting-IP` (`functions/api/contacto.ts:13-22,35-38`). Si no es válida, 403.
5. **Envío.** Correo por la API de Resend con `RESEND_API_KEY`: remitente `CONTACTO_DESDE`, destinatario `CONTACTO_PARA`, `reply_to` el email del visitante para que Pelayo responda directamente, asunto con el interés y cuerpo en texto plano (`functions/api/contacto.ts:40-50`, `src/lib/contacto.ts:15-24`). Si Resend no responde OK, la función registra solo el código de estado y devuelve 502 (`functions/api/contacto.ts:52-55`).
6. **Respuesta.** 200 con `{ ok: true }` (`functions/api/contacto.ts:56`). El navegador vacía el formulario y avisa; con 400 pide revisar los campos; con otro código de error propone WhatsApp o Instagram; sin conexión, pide volver a intentarlo. En todos los casos reinicia Turnstile (`src/components/Contacto.astro:96-109`).

La función no guarda nada: ni base de datos ni almacenamiento. La consulta solo existe en el correo enviado. Cuánto la conservan Resend y el buzón de destino no depende del repo; la política de privacidad recoge plazos y encargados (`src/pages/legal/privacidad.astro:25-35`).

## Variables de entorno

Solo nombres; los valores están en Cloudflare, fuera del repo.

| Variable | Dónde se usa | Para qué |
|---|---|---|
| `SITE_URL` | build (`astro.config.mjs:5`) | dominio de canonical, sitemap y Open Graph; tiene valor por defecto |
| `CF_PAGES_BRANCH` | build (`astro.config.mjs:16`) | rama desplegada; con `INDEXAR`, decide si se indexa (`CLAUDE.md`) |
| `INDEXAR` | build (`astro.config.mjs:18`) | permite indexar; por defecto `false` |
| `PUBLIC_TURNSTILE_SITE_KEY` | build, y llega al navegador (`astro.config.mjs:19-24`) | clave pública de Turnstile; por defecto, la clave de pruebas de Cloudflare |
| `TURNSTILE_SECRET` | Pages Function (`functions/api/contacto.ts:4`) | clave secreta de Turnstile |
| `RESEND_API_KEY` | Pages Function (`functions/api/contacto.ts:5`) | autenticación con Resend |
| `CONTACTO_PARA` | Pages Function (`functions/api/contacto.ts:6`) | destinatario del correo |
| `CONTACTO_DESDE` | Pages Function (`functions/api/contacto.ts:7`) | remitente del correo |

Para probar la función en local, las cuatro últimas van en `.dev.vars`, copiado de `.dev.vars.example` (ignorado por git, `.gitignore:7`).
