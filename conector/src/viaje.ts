// Viajes: campos que acepta el conector, validación con motivos en llano, plantilla del fichero y slug.
// La definición copia la de src/content.config.ts:8-33 de main (con `estado`, sin `plazas`) hasta que
// el conector pase a importar src/lib/esquemas.ts.
import { z } from 'zod';
import { leerFicha, tieneEnlace, tieneHtml } from '../../.github/cambio-pequeno/regla.mjs';
import config from '../../.github/cambio-pequeno/config.json';

export const TIPOS = ['internacional', 'nacional', 'day-trip'] as const;
export const FORMATOS = ['vida-a-bordo', 'desde-tierra', 'barco'] as const;
export const NIVELES = ['ninguno', 'open-water', 'advanced', 'deep'] as const;
export const ESTADOS = ['abierto', 'ultimas-plazas', 'completo'] as const;

export const ORGANIZA_TE_MOANA = config.organizaObligatorio;
const TIPOS_CON_ORGANIZA: readonly string[] = config.tiposConOrganiza;
const ORDEN: readonly string[] = config.clavesViaje;

export const NO_ENLACES = 'De momento no puedo poner enlaces ni direcciones de correo en la ficha; si hace falta, pídeselo a Andrés.';
export const NO_HTML = 'La ficha no puede llevar código HTML (un "<" seguido de una letra, "!", "/" o "?").';

export interface Campo {
  nombre: string;
  obligatorio: boolean;
  descripcion: string;
  formato: string;
}

/** Lo que devuelve campos_viaje. */
export const CAMPOS: readonly Campo[] = [
  { nombre: 'titulo', obligatorio: true, descripcion: 'Nombre del viaje', formato: 'texto de una línea, hasta 100 caracteres' },
  { nombre: 'destino', obligatorio: true, descripcion: 'Zona y país', formato: 'texto de una línea, hasta 80 caracteres' },
  { nombre: 'tipo', obligatorio: true, descripcion: 'Tipo de viaje', formato: TIPOS.join(', ') },
  { nombre: 'inicio', obligatorio: true, descripcion: 'Primer día', formato: 'fecha AAAA-MM-DD, posterior a hoy' },
  { nombre: 'fin', obligatorio: true, descripcion: 'Último día', formato: 'fecha AAAA-MM-DD, no anterior al inicio' },
  { nombre: 'formato', obligatorio: true, descripcion: 'Cómo se bucea', formato: FORMATOS.join(', ') },
  { nombre: 'nivel', obligatorio: true, descripcion: 'Titulación mínima', formato: NIVELES.join(', ') },
  { nombre: 'inmersionesMinimas', obligatorio: true, descripcion: 'Inmersiones registradas que se piden', formato: 'número entero, 0 o más' },
  { nombre: 'inmersiones', obligatorio: true, descripcion: 'Inmersiones del viaje', formato: 'número entero, 1 o más' },
  { nombre: 'agua', obligatorio: true, descripcion: 'Temperatura del agua y traje recomendado', formato: 'objeto {temperatura, traje}, cada uno texto de una línea de hasta 80 caracteres' },
  { nombre: 'precioDesde', obligatorio: true, descripcion: 'Precio desde, en euros', formato: 'número entero mayor que 0' },
  { nombre: 'organiza', obligatorio: false, descripcion: 'Quién organiza. En internacional y nacional lo pone el conector: Te Moana Expeditions', formato: 'solo en day-trip, y ahí obligatorio: texto de una línea de hasta 80 caracteres' },
  { nombre: 'estado', obligatorio: false, descripcion: 'Plazas', formato: `${ESTADOS.join(', ')}; si no se dice, abierto` },
  { nombre: 'destacado', obligatorio: false, descripcion: 'Si sale destacado en la portada', formato: 'true o false; si no se dice, false' },
  { nombre: 'cita', obligatorio: false, descripcion: 'Frase corta de Pelayo sobre el viaje', formato: 'texto de una línea, hasta 200 caracteres' },
  { nombre: 'fauna', obligatorio: false, descripcion: 'Qué se ve', formato: 'lista de hasta 12 textos de una línea de hasta 80 caracteres' },
  { nombre: 'incluye', obligatorio: false, descripcion: 'Qué incluye el precio', formato: 'lista de hasta 12 textos de una línea de hasta 80 caracteres' },
  { nombre: 'noIncluye', obligatorio: false, descripcion: 'Qué no incluye el precio', formato: 'lista de hasta 12 textos de una línea de hasta 80 caracteres' },
  { nombre: 'resumen', obligatorio: true, descripcion: 'Resumen para la lista de viajes', formato: 'texto de una línea, hasta 300 caracteres' },
  { nombre: 'cuerpo', obligatorio: false, descripcion: 'Texto de la ficha', formato: 'hasta 3000 caracteres; párrafos, negrita, cursiva y listas, sin enlaces ni direcciones de correo' },
];

const RE_CONTROL = /[\u0000-\u001f\u007f\u2028\u2029]/;
const RE_CONTROL_CUERPO = /[\u0000-\u0009\u000b-\u001f\u007f\u2028\u2029]/;
const RE_FECHA = /^\d{4}-\d{2}-\d{2}$/;

// Los saltos de línea y caracteres de control se rechazan antes de recortar espacios.
const linea = (max: number) =>
  z
    .string()
    .refine((s) => !RE_CONTROL.test(s))
    .transform((s) => s.trim())
    .pipe(z.string().min(1).max(max));
const lista = z.array(linea(80)).max(12);
const fecha = z.string().refine((s) => RE_FECHA.test(s) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s);

const forma = {
  titulo: linea(100),
  destino: linea(80),
  tipo: z.enum(TIPOS),
  inicio: fecha,
  fin: fecha,
  formato: z.enum(FORMATOS),
  nivel: z.enum(NIVELES),
  inmersionesMinimas: z.int().min(0),
  inmersiones: z.int().min(1),
  agua: z.strictObject({ temperatura: linea(80), traje: linea(80) }),
  precioDesde: z.int().positive(),
  organiza: linea(80).optional(),
  estado: z.enum(ESTADOS).optional(),
  destacado: z.boolean().optional(),
  cita: linea(200).optional(),
  fauna: lista.optional(),
  incluye: lista.optional(),
  noIncluye: lista.optional(),
  resumen: linea(300),
  cuerpo: z
    .string()
    .transform((s) => s.replace(/\r\n?/g, '\n').trim())
    .refine((s) => s.length <= 3000 && !RE_CONTROL_CUERPO.test(s))
    .optional(),
};

const esquema = z.strictObject(forma);
const esquemaParcial = z.strictObject(forma).partial();

export type Viaje = z.infer<typeof esquema>;
export type CambioViaje = z.infer<typeof esquemaParcial>;
export type Resultado<T> = { ok: true; valor: T } | { ok: false; motivo: string };

function motivoDeZod(error: z.ZodError): string {
  const campos = [
    ...new Set(error.issues.flatMap((i) => (i.code === 'unrecognized_keys' && i.path.length === 0 ? i.keys : [String(i.path[0] ?? '')]))),
  ];
  const partes = campos.map((nombre) => {
    if (nombre === '') return 'faltan los campos del viaje';
    const campo = CAMPOS.find((c) => c.nombre === nombre);
    if (campo === undefined) return `"${nombre.slice(0, 40)}" no es un campo de los viajes`;
    return `${campo.nombre} tiene que ser ${campo.formato}`;
  });
  return `Hay datos que no cuadran: ${partes.join('; ')}. La lista de campos está en campos_viaje.`;
}

/** Todos los textos de un valor (claves de objetos incluidas). */
function textos(valor: unknown): string[] {
  if (typeof valor === 'string') return [valor];
  if (Array.isArray(valor)) return valor.flatMap(textos);
  if (valor !== null && typeof valor === 'object') return Object.entries(valor).flatMap(([k, v]) => [k, ...textos(v)]);
  return [];
}

/** Rechaza enlaces, correos y HTML en cualquier texto. El conector no escapa: rechaza. */
function revisarTextos(valores: unknown): string | null {
  const todos = textos(valores);
  if (todos.some(tieneEnlace)) return NO_ENLACES;
  if (todos.some(tieneHtml)) return NO_HTML;
  return null;
}

/** Completa lo que pone el conector y comprueba lo que depende de varios campos. */
function completar(v: Viaje): Resultado<Viaje> {
  if (v.fin < v.inicio) return { ok: false, motivo: 'La fecha de fin no puede ser anterior a la de inicio.' };
  if (TIPOS_CON_ORGANIZA.includes(v.tipo)) return { ok: true, valor: { ...v, organiza: ORGANIZA_TE_MOANA } };
  if (v.organiza === undefined) return { ok: false, motivo: 'En un day trip hace falta decir quién lo organiza (campo organiza).' };
  return { ok: true, valor: v };
}

export function validarViaje(entrada: unknown): Resultado<Viaje> {
  const r = esquema.safeParse(entrada);
  if (!r.success) return { ok: false, motivo: motivoDeZod(r.error) };
  const enlaces = revisarTextos(r.data);
  if (enlaces !== null) return { ok: false, motivo: enlaces };
  return completar(r.data);
}

export function validarCambio(entrada: unknown): Resultado<CambioViaje> {
  const r = esquemaParcial.safeParse(entrada);
  if (!r.success) return { ok: false, motivo: motivoDeZod(r.error) };
  if (Object.keys(r.data).length === 0) return { ok: false, motivo: 'No me has dicho qué cambiar.' };
  const enlaces = revisarTextos(r.data);
  if (enlaces !== null) return { ok: false, motivo: enlaces };
  return { ok: true, valor: r.data };
}

/** Aplica un cambio sobre un viaje existente y valida el resultado entero. */
export function aplicarCambio(actual: Record<string, unknown>, cambio: CambioViaje): Resultado<Viaje> {
  const base = { ...actual };
  // Te Moana lo vuelve a poner el conector; si el viaje pasa a day trip, hay que decir quién lo organiza.
  if (TIPOS_CON_ORGANIZA.includes(String(base['tipo']))) delete base['organiza'];
  return validarViaje({ ...base, ...cambio });
}

/** Valor JSON con los espacios de los ficheros de main (`{"a": 1, "b": [2, 3]}`). */
function json(valor: unknown): string {
  if (Array.isArray(valor)) return `[${valor.map(json).join(', ')}]`;
  if (valor !== null && typeof valor === 'object') {
    return `{${Object.entries(valor)
      .map(([k, v]) => `${JSON.stringify(k)}: ${json(v)}`)
      .join(', ')}}`;
  }
  return JSON.stringify(valor);
}

/** Fichero src/content/viajes/<slug>.md: líneas `clave: <valor JSON>` y el cuerpo. */
export function plantilla(v: Viaje): string {
  const { cuerpo, ...datos } = v;
  const lineas = ORDEN.filter((k) => datos[k as keyof typeof datos] !== undefined).map(
    (k) => `${k}: ${json(datos[k as keyof typeof datos])}`,
  );
  return `---\n${lineas.join('\n')}\n---\n${cuerpo === undefined || cuerpo === '' ? '' : `\n${cuerpo}\n`}`;
}

/** Lee un fichero de viaje de main en el formato de la plantilla. */
export function leerViaje(contenido: string): Record<string, unknown> | null {
  const ficha = leerFicha(contenido);
  if (ficha === null) return null;
  const cuerpo = ficha.cuerpo.trim();
  return cuerpo === '' ? ficha.datos : { ...ficha.datos, cuerpo };
}

export const RE_SLUG = /^[a-z0-9-]{1,60}$/;
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** `<título>-<mes>-<año>`, como los ficheros de main (maldivas-mar-2027). */
export function slugBase(titulo: string, inicio: string): string {
  const sufijo = `-${MESES[Number(inicio.slice(5, 7)) - 1] ?? 'mes'}-${inicio.slice(0, 4)}`;
  const texto = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const corto = texto.slice(0, 60 - sufijo.length).replace(/-+$/, '');
  return `${corto === '' ? 'viaje' : corto}${sufijo}`;
}

/** El primer slug libre: el base o con sufijo -2, -3... */
export function slugLibre(base: string, ocupados: ReadonlySet<string>): string | null {
  if (!ocupados.has(base)) return base;
  for (let n = 2; n < 100; n++) {
    const sufijo = `-${n}`;
    const candidato = `${base.slice(0, 60 - sufijo.length).replace(/-+$/, '')}${sufijo}`;
    if (!ocupados.has(candidato)) return candidato;
  }
  return null;
}

export const rutaViaje = (slug: string) => `${config.rutas.viajes}${slug}.md`;
