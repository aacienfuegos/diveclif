import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import sharp from 'sharp';

export interface Tarjeta {
  readonly clave: string;
  readonly antetitulo: string;
  readonly titulo: string;
  readonly subtitulo?: string;
  readonly dato?: { readonly valor: string; readonly etiqueta: string };
  readonly acento?: string;
}

const ANCHO = 1200;
const ALTO = 630;
const PANEL = 420;

const requerir = createRequire(import.meta.url);
const fuente = (paquete: string, fichero: string) =>
  readFileSync(join(dirname(requerir.resolve(`${paquete}/package.json`)), 'files', fichero));

let fuentes: Parameters<typeof satori>[1]['fonts'] | undefined;
function cargarFuentes() {
  fuentes ??= [
    { name: 'Big Shoulders Display', data: fuente('@fontsource/big-shoulders-display', 'big-shoulders-display-latin-900-normal.woff'), weight: 900, style: 'normal' },
    { name: 'Big Shoulders Display', data: fuente('@fontsource/big-shoulders-display', 'big-shoulders-display-latin-800-normal.woff'), weight: 800, style: 'normal' },
    { name: 'Instrument Serif', data: fuente('@fontsource/instrument-serif', 'instrument-serif-latin-400-italic.woff'), weight: 400, style: 'italic' },
    { name: 'Martian Mono', data: fuente('@fontsource/martian-mono', 'martian-mono-latin-400-normal.woff'), weight: 400, style: 'normal' },
  ];
  return fuentes;
}

const COLA = 'M100 118 C97 92 96 74 98 58 C82 40 46 30 4 34 C30 14 70 6 100 30 C130 6 170 14 196 34 C154 30 118 40 102 58 C104 74 103 92 100 118Z';
const MANTA = 'M0 62 C40 30 80 18 104 40 C112 34 128 34 136 40 C160 18 200 30 240 62 C198 60 162 72 138 92 L126 104 L122 150 L118 104 L102 92 C78 72 42 60 0 62Z';

const svgUri = (svg: string) => `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;

const MARCA = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><circle cx="32" cy="32" r="32" fill="#050607"/><path transform="translate(8 18) scale(.24)" fill="#8fd8ea" d="${COLA}"/></svg>`);

const ILUSTRACION = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PANEL} ${ALTO}">
  <defs><linearGradient id="a" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1e9db0"/><stop offset=".55" stop-color="#0a5474"/><stop offset="1" stop-color="#04213a"/></linearGradient></defs>
  <rect width="${PANEL}" height="${ALTO}" fill="url(#a)"/>
  <g fill="rgba(255,255,255,.07)">${Array.from({ length: 6 }, (_, i) => `<rect x="${i * 80 - 40}" y="0" width="34" height="${ALTO}" transform="skewX(-10)"/>`).join('')}</g>
  <path d="${MANTA}" transform="translate(60 210) scale(1.25)" fill="rgba(2,12,24,.55)"/>
  <path d="${MANTA}" transform="translate(250 90) scale(.45)" fill="rgba(2,12,24,.35)"/>
  <path d="${MANTA}" transform="translate(30 470) scale(.35)" fill="rgba(2,12,24,.3)"/>
</svg>`);

async function panelDerecho(clave: string): Promise<string> {
  const ruta = join(process.cwd(), 'src/assets/og', `${clave.replaceAll('/', '--')}.jpg`);
  if (!existsSync(ruta)) return ILUSTRACION;
  const jpg = await sharp(ruta).resize(PANEL, ALTO, { fit: 'cover' }).jpeg({ quality: 82 }).toBuffer();
  return `data:image/jpeg;base64,${jpg.toString('base64')}`;
}

type Nodo = { type: string; props: Record<string, unknown> };
const h = (type: string, style: Record<string, unknown>, children?: unknown, extra: Record<string, unknown> = {}): Nodo =>
  ({ type, props: { style, children, ...extra } });

export async function renderizarTarjeta(t: Tarjeta): Promise<Buffer> {
  const acento = t.acento ?? '#8fd8ea';
  const tamTitulo = t.titulo.length <= 14 ? 118 : t.titulo.length <= 24 ? 92 : 74;
  const panel = await panelDerecho(t.clave);

  const izquierda = h('div', { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: ANCHO - PANEL, height: ALTO, padding: '56px 60px' }, [
    h('div', { display: 'flex', alignItems: 'center', gap: 16 }, [
      h('img', { width: 52, height: 52 }, undefined, { src: MARCA, width: 52, height: 52 }),
      h('div', { fontFamily: 'Big Shoulders Display', fontWeight: 800, fontSize: 30, letterSpacing: 5, color: '#effafb' }, 'DIVE CLIF'),
    ]),
    h('div', { display: 'flex', flexDirection: 'column', gap: 14 }, [
      h('div', { fontFamily: 'Martian Mono', fontSize: 20, letterSpacing: 2, textTransform: 'uppercase', color: acento }, t.antetitulo),
      h('div', { fontFamily: 'Big Shoulders Display', fontWeight: 900, fontSize: tamTitulo, lineHeight: 0.9, textTransform: 'uppercase', color: '#effafb' }, t.titulo),
      ...(t.subtitulo ? [h('div', { fontFamily: 'Instrument Serif', fontStyle: 'italic', fontSize: 34, color: '#8fd8ea' }, t.subtitulo)] : []),
    ]),
    t.dato
      ? h('div', { display: 'flex', alignItems: 'flex-end', gap: 16 }, [
          h('div', { fontFamily: 'Big Shoulders Display', fontWeight: 900, fontSize: 64, lineHeight: 1, color: acento, whiteSpace: 'nowrap', flexShrink: 0 }, t.dato.valor),
          h('div', { fontFamily: 'Martian Mono', fontSize: 18, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(239,250,251,.7)', paddingBottom: 8 }, t.dato.etiqueta),
        ])
      : h('div', { fontFamily: 'Martian Mono', fontSize: 18, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(239,250,251,.7)' }, 'Cabo de Palos · Madrid · viajes'),
  ]);

  const derecha = h('div', { display: 'flex', position: 'relative', width: PANEL, height: ALTO }, [
    h('img', { width: PANEL, height: ALTO, objectFit: 'cover' }, undefined, { src: panel, width: PANEL, height: ALTO }),
    h('div', { position: 'absolute', left: 0, top: 0, width: 120, height: ALTO, backgroundImage: 'linear-gradient(to right, #04213a, rgba(4,33,58,0))' }),
  ]);

  const raiz = h('div', { display: 'flex', width: ANCHO, height: ALTO, backgroundImage: 'linear-gradient(160deg, #0b6584 0%, #04213a 55%, #020c18 100%)' }, [izquierda, derecha]);

  const svg = await satori(raiz as unknown as Parameters<typeof satori>[0], { width: ANCHO, height: ALTO, fonts: cargarFuentes() });
  return new Resvg(svg, { fitTo: { mode: 'width', value: ANCHO } }).render().asPng();
}
