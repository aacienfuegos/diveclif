// Sustitutos de los módulos cloudflare:* para correr los tests en Node. El conector no usa
// nada de esto (ni Durable Objects ni correo entrante); los importa `agents` al cargarse.
export class DurableObject {}
export class RpcTarget {}
export class WorkerEntrypoint {}
export class WorkflowEntrypoint {}
export class EmailMessage {}
export const env = {};
export const exports = {};
