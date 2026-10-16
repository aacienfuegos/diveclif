// Correos del Worker por Resend: siempre en texto plano y con el asunto empezando por [Dive Clif].
import { ErrorConector, type Env } from './entorno';
import { correosDia, correosMes, sumarTodos } from './limites';

export interface Correo {
  para: string;
  /** Sin el prefijo: lo pone `enviar`. */
  asunto: string;
  texto: string;
}

/** Envía el correo si no se ha llegado al tope diario o mensual. False si se ha llegado. */
export async function enviar(env: Env, c: Correo): Promise<boolean> {
  if ((await sumarTodos(env.DB, [correosDia(), correosMes()])) !== null) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.CORREO_DESDE,
      to: [c.para],
      subject: `[Dive Clif] ${c.asunto}`.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, ' '),
      text: c.texto,
    }),
  });
  if (!r.ok) throw new ErrorConector(`resend-${r.status}`);
  return true;
}
