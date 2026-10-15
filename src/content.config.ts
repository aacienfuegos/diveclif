import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { articulo, curso, entradaBitacora, punto, viaje } from './lib/esquemas';

const md = (carpeta: string) => glob({ pattern: '*.md', base: `./src/content/${carpeta}` });

const viajes = defineCollection({ loader: md('viajes'), schema: viaje });
const puntos = defineCollection({ loader: md('puntos'), schema: punto });
const cursos = defineCollection({ loader: md('cursos'), schema: curso });
const cuaderno = defineCollection({ loader: md('cuaderno'), schema: articulo });
const bitacora = defineCollection({ loader: file('./src/content/bitacora.json'), schema: entradaBitacora });

export const collections = { viajes, puntos, cursos, cuaderno, bitacora };
