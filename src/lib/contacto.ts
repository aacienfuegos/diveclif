import { z } from 'zod';

export const consultaSchema = z.object({
  nombre: z.string().trim().min(1).max(80),
  email: z.email().max(254),
  interes: z.string().trim().min(1).max(120),
  titulacion: z.string().trim().max(60),
  mensaje: z.string().trim().min(1).max(2000),
  web: z.string().max(0),
  'cf-turnstile-response': z.string().min(1).max(2048),
});

export type Consulta = z.infer<typeof consultaSchema>;

export function textoCorreo(c: Consulta): string {
  return [
    `Nombre: ${c.nombre}`,
    `Email: ${c.email}`,
    `Le interesa: ${c.interes}`,
    `Titulación: ${c.titulacion || '—'}`,
    '',
    c.mensaje,
  ].join('\n');
}
