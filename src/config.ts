export const SITE = {
  nombre: 'Dive Clif',
  url: import.meta.env.SITE.replace(/\/$/, ''),
  descripcion:
    'Cursos de buceo PADI y SSI de todos los niveles y viajes de buceo con Pelayo, IDC Staff Instructor PADI. Cabo de Palos y Madrid.',
  instagram: 'https://www.instagram.com/dive_clif/',
  comunidadWhatsApp: 'https://chat.whatsapp.com/BEQJLLbdGcC67MPE7YKq0f',
  whatsappNumero: null as string | null,
  email: 'hola@diveclif.es',
  geo: { lat: 37.6346, lon: -0.6906 },
} as const;

// null = dato pendiente de Pelayo; la página lo muestra marcado como hueco
export const LEGAL = {
  titular: null as string | null,
  nif: null as string | null,
  domicilio: null as string | null,
  emailContacto: SITE.email,
  numeroPadi: null as string | null,
  numeroSsi: null as string | null,
  teMoana: {
    razonSocial: null as string | null,
    tituloLicencia: null as string | null,
  },
  actualizado: '2026-09-24',
} as const;
