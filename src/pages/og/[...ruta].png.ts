import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { NOMBRE_NIVEL } from '@/lib/buceo';
import { rangoFechas } from '@/lib/fechas';
import { renderizarTarjeta, type Tarjeta } from '@/lib/og';
import { precio } from '@/lib/viajes';

export const getStaticPaths = (async () => {
  const [viajes, puntos, posts] = await Promise.all([getCollection('viajes'), getCollection('puntos'), getCollection('cuaderno')]);
  const tarjetas: Tarjeta[] = [
    { clave: 'index', antetitulo: 'Pelayo · IDC Staff Instructor PADI', titulo: 'Bucea con Dive Clif', subtitulo: 'Cursos de todos los niveles y viajes de buceo' },
    { clave: 'puntos-de-inmersion', antetitulo: 'Reserva Marina · Islas Hormigas', titulo: 'Bucear en Cabo de Palos', subtitulo: 'Carta de los puntos de inmersión', dato: { valor: `${puntos.length}`, etiqueta: 'puntos y pecios' } },
    ...viajes.map((v): Tarjeta => ({
      clave: `viajes/${v.id}`,
      antetitulo: `${rangoFechas(v.data.inicio, v.data.fin)} · ${v.data.destino}`,
      titulo: v.data.titulo,
      ...(v.data.cita ? { subtitulo: v.data.cita } : {}),
      dato: { valor: precio(v.data.precioDesde), etiqueta: `desde · organiza ${v.data.organiza}` },
      acento: '#e8399f',
    })),
    ...puntos.map((p): Tarjeta => ({
      clave: `puntos-de-inmersion/${p.id}`,
      antetitulo: `Cabo de Palos · ${p.data.tipo === 'pecio' ? 'pecio' : 'punto de inmersión'}`,
      titulo: p.data.nombre,
      dato: { valor: `${p.data.profundidad.min}–${p.data.profundidad.max} m`, etiqueta: NOMBRE_NIVEL[p.data.nivel] },
    })),
    ...posts.map((p): Tarjeta => ({
      clave: `cuaderno/${p.id}`,
      antetitulo: `Cuaderno · ${p.data.etiqueta}`,
      titulo: p.data.titulo,
      ...(p.data.especie ? { subtitulo: p.data.especie } : {}),
      acento: '#1fc28c',
    })),
  ];
  return tarjetas.map((tarjeta) => ({ params: { ruta: tarjeta.clave }, props: { tarjeta } }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<{ tarjeta: Tarjeta }> = async ({ props }) =>
  new Response(new Uint8Array(await renderizarTarjeta(props.tarjeta)), { headers: { 'Content-Type': 'image/png' } });
