import { consultaSchema, textoCorreo } from '../../src/lib/contacto';

interface Env {
  readonly TURNSTILE_SECRET: string;
  readonly RESEND_API_KEY: string;
  readonly CONTACTO_PARA: string;
  readonly CONTACTO_DESDE: string;
}

const json = (cuerpo: Record<string, unknown>, status: number) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { 'Content-Type': 'application/json' } });

async function turnstileValido(token: string, secreto: string, ip: string | null): Promise<boolean> {
  const datos = new FormData();
  datos.append('secret', secreto);
  datos.append('response', token);
  if (ip) datos.append('remoteip', ip);
  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: datos });
  if (!res.ok) return false;
  const r: unknown = await res.json();
  return typeof r === 'object' && r !== null && (r as { success?: unknown }).success === true;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  let formulario: FormData;
  try {
    formulario = await request.formData();
  } catch {
    return json({ ok: false }, 400);
  }

  const consulta = consultaSchema.safeParse(Object.fromEntries([...formulario].map(([k, v]) => [k, typeof v === 'string' ? v : ''])));
  if (!consulta.success) return json({ ok: false }, 400);

  const ip = request.headers.get('CF-Connecting-IP');
  if (!(await turnstileValido(consulta.data['cf-turnstile-response'], env.TURNSTILE_SECRET, ip))) {
    return json({ ok: false }, 403);
  }

  const envio = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.CONTACTO_DESDE,
      to: [env.CONTACTO_PARA],
      reply_to: consulta.data.email,
      subject: `Consulta web: ${consulta.data.interes}`,
      text: textoCorreo(consulta.data),
    }),
  });

  if (!envio.ok) {
    console.error('Resend respondió', envio.status);
    return json({ ok: false }, 502);
  }
  return json({ ok: true }, 200);
};
