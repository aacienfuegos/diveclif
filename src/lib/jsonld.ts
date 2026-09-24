import { SITE } from '../config';
import { isoFecha } from './fechas';

type Nodo = Record<string, unknown>;

const ORG_ID = `${SITE.url}/#org`;
const PELAYO_ID = `${SITE.url}/sobre-pelayo#pelayo`;

export function serializar(nodos: readonly Nodo[]): string {
  // "<" escapado para que ningún texto de contenido pueda cerrar el <script>
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': nodos }).replace(/</g, '\\u003c');
}

export const organizacion = (): Nodo => ({
  '@type': ['SportsActivityLocation', 'LocalBusiness'],
  '@id': ORG_ID,
  name: SITE.nombre,
  url: `${SITE.url}/`,
  description: SITE.descripcion,
  founder: { '@id': PELAYO_ID },
  sameAs: [SITE.instagram],
  address: { '@type': 'PostalAddress', addressLocality: 'Cabo de Palos', addressRegion: 'Murcia', addressCountry: 'ES' },
  geo: { '@type': 'GeoCoordinates', latitude: SITE.geo.lat, longitude: SITE.geo.lon },
  areaServed: ['Cabo de Palos', 'La Manga', 'Cartagena', 'Madrid'],
});

export const webSite = (): Nodo => ({
  '@type': 'WebSite',
  '@id': `${SITE.url}/#web`,
  url: `${SITE.url}/`,
  name: SITE.nombre,
  inLanguage: 'es-ES',
  publisher: { '@id': ORG_ID },
});

export const pelayo = (): Nodo => ({
  '@type': 'Person',
  '@id': PELAYO_ID,
  name: 'Pelayo',
  jobTitle: 'IDC Staff Instructor PADI · Divemaster Instructor SSI',
  worksFor: { '@id': ORG_ID },
});

export const theSunset = (): Nodo => ({
  '@type': 'Event',
  name: 'The Sunset · inmersión al atardecer en Cabo de Palos',
  eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
  eventSchedule: { '@type': 'Schedule', repeatFrequency: 'P1W', byDay: 'https://schema.org/Friday', scheduleTimezone: 'Europe/Madrid' },
  location: { '@type': 'Place', name: 'Arenales del Cabo, Cabo de Palos' },
  organizer: { '@id': ORG_ID },
});

interface ViajeLd {
  readonly url: string;
  readonly titulo: string;
  readonly destino: string;
  readonly resumen: string;
  readonly inicio: Date;
  readonly fin: Date;
  readonly precioDesde: number;
  readonly organiza: string;
  readonly completo: boolean;
}

export const viaje = (v: ViajeLd): Nodo => ({
  '@type': 'TouristTrip',
  name: `Viaje de buceo: ${v.titulo}`,
  description: v.resumen,
  url: v.url,
  provider: { '@id': ORG_ID },
  offers: {
    '@type': 'Offer',
    price: String(v.precioDesde),
    priceCurrency: 'EUR',
    availability: v.completo ? 'https://schema.org/SoldOut' : 'https://schema.org/InStock',
    offeredBy: v.organiza === SITE.nombre ? { '@id': ORG_ID } : { '@type': 'TravelAgency', name: v.organiza },
  },
  subjectOf: {
    '@type': 'Event',
    name: v.titulo,
    startDate: isoFecha(v.inicio),
    endDate: isoFecha(v.fin),
    location: { '@type': 'Place', name: v.destino },
    organizer: { '@id': ORG_ID },
  },
});

export const punto = (p: { url: string; nombre: string; resumen: string; lat: number; lon: number }): Nodo => ({
  '@type': 'TouristAttraction',
  name: p.nombre,
  description: p.resumen,
  url: p.url,
  geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lon },
  containedInPlace: { '@type': 'Place', name: 'Reserva Marina de Cabo de Palos - Islas Hormigas' },
});

export const curso = (c: { nombre: string; resumen: string }): Nodo => ({
  '@type': 'Course',
  name: c.nombre,
  description: c.resumen,
  provider: { '@id': ORG_ID },
});

export const articulo = (a: { url: string; titulo: string; resumen: string; fecha: Date }): Nodo => ({
  '@type': 'BlogPosting',
  headline: a.titulo,
  description: a.resumen,
  url: a.url,
  datePublished: isoFecha(a.fecha),
  author: { '@id': PELAYO_ID },
  publisher: { '@id': ORG_ID },
});

export const migas = (items: readonly { nombre: string; url: string }[]): Nodo => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.nombre, item: it.url })),
});
