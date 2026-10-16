// Servidor MCP del conector. Uno nuevo por petición: sin estado y sin Durable Objects.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Env } from './entorno';
import type { Entrada } from './registro';

export function crearServidor(_env: Env, _correo: string, _entrada: Entrada): McpServer {
  return new McpServer({ name: 'Dive Clif', version: '1.0.0' });
}
