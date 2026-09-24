# Dive Clif

Web estática de Dive Clif (Pelayo, instructor de buceo) con Astro 7 + content collections, desplegada en Cloudflare Pages. El formulario de contacto es una Pages Function (`functions/api/contacto.ts`).

## Obligatorio en cada cambio visual

**Revisar en navegador en escritorio (~1500 px) y en móvil (390 y 360 px) antes de darlo por hecho.** Evita lo que ya pasó: texto partido en dos líneas, tablas y diagramas con scroll horizontal, el ordenador de buceo tapando botones.

1. `npm run build && cp scripts/movil.html dist/__movil.html && npx astro preview`
2. Abrir `http://localhost:4321/` (escritorio) y `http://localhost:4321/__movil.html` (dos iframes, 390 y 360 px). La ventana de Chrome no se puede estrechar; por eso los iframes.
3. Comprobar por script en cada iframe que `document.documentElement.scrollWidth <= innerWidth` y recorrer la página de arriba abajo.

`dist/__movil.html` no llega a producción: Cloudflare compila desde cero.

## Antes de commit

`npm run check && npx tsc -p functions/tsconfig.json && npm test && npm run build`

## Reglas del proyecto

- **CSP sin `unsafe-inline`** (`public/_headers`): nada de `<script>` ni `<style>` en línea ni atributos `style=` en el HTML. Colores por clase (`c-*`, `bg-lv-*`). Si no, el navegador bloquea el recurso en producción sin error visible.
- **Sin `set:html` con datos de contenido.** Pelayo editará desde un panel; `set:html` sería inyección de HTML.
- Marca: "Dive Clif" o "Pelayo", nunca "Clif" a secas.
- Los viajes los organiza Te Moana Expeditions; cada ficha debe decirlo (normativa de viajes combinados).
- Datos de viajes y puntos de inmersión son de ejemplo hasta que Pelayo los valide.
- Indexación: solo con `INDEXAR=true` y rama `main` (meta robots y `robots.txt`), más `X-Robots-Tag` en `*.pages.dev`. La demo en ciencre.xyz va sin `INDEXAR`, para que Google no la indexe y luego no compita con el dominio definitivo. `SITE_URL` fija el dominio de canonical y sitemap.
