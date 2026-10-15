import { defineCollection } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { actividad, articulo, curso, entradaBitacora, foto, punto, textos as esquemaTextos, viaje } from './lib/esquemas';

const md = (carpeta: string) => glob({ pattern: '*.md', base: `./src/content/${carpeta}` });

const viajes = defineCollection({ loader: md('viajes'), schema: viaje });
const puntos = defineCollection({ loader: md('puntos'), schema: punto });
const cursos = defineCollection({ loader: md('cursos'), schema: curso });
const cuaderno = defineCollection({ loader: md('cuaderno'), schema: articulo });
const actividades = defineCollection({ loader: md('actividades'), schema: actividad });
const bitacora = defineCollection({ loader: file('./src/content/bitacora.json'), schema: entradaBitacora });
const fotos = defineCollection({ loader: file('./src/content/fotos.json'), schema: foto });
const textos = defineCollection({ loader: glob({ pattern: '*.json', base: './src/content/textos' }), schema: esquemaTextos });

export const collections = { viajes, puntos, cursos, cuaderno, actividades, bitacora, textos, fotos };
