import { vi } from 'vitest';

/** Captura todo lo que el Worker escribe en la consola mientras corre `f`. */
export async function capturarConsola(f: () => Promise<unknown>): Promise<string> {
  const lineas: string[] = [];
  const espias = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
    vi.spyOn(console, m).mockImplementation((...args: unknown[]) => {
      lineas.push(args.map((a) => (a instanceof Error ? `${a.message} ${a.stack ?? ''}` : typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    }),
  );
  try {
    await f();
  } finally {
    for (const e of espias) e.mockRestore();
  }
  return lineas.join('\n');
}
