// Qué runs de Actions cuentan para el botón, las capturas y los avisos.
import { ErrorConector } from './entorno';
import type { GitHub } from './github';

export const WORKFLOWS = {
  'cambio-pequeno': { path: '.github/workflows/cambio-pequeno.yml', event: 'pull_request_target' },
  build: { path: '.github/workflows/build.yml', event: 'pull_request' },
  visual: { path: '.github/workflows/visual.yml', event: 'pull_request' },
} as const;
export type Workflow = keyof typeof WORKFLOWS;
const NOMBRES = Object.keys(WORKFLOWS) as Workflow[];

export interface Run {
  id: number;
  path: string;
  event: string;
  status: string;
  conclusion: string | null;
  head_sha: string;
  head_repository: { full_name: string } | null;
  pull_requests: { number: number }[] | null;
  created_at: string;
}

export const RE_SHA = /^[0-9a-f]{40}$/;

/**
 * El run más reciente de cada workflow que cumple todo: `path` y `event` del workflow, repo de cabeza
 * igual a REPO, `head_sha` igual al SHA y el PR guardado entre sus `pull_requests`. Así un PR desde
 * un fork con la misma cabeza no cuenta ni puede tapar el bueno.
 */
export async function runsQueCuentan(gh: GitHub, sha: string, pr: number): Promise<Partial<Record<Workflow, Run>>> {
  if (!RE_SHA.test(sha)) throw new ErrorConector('sha');
  const { workflow_runs } = await gh.json<{ workflow_runs: Run[] }>('GET', `actions/runs?head_sha=${sha}&per_page=100`);
  const elegidos: Partial<Record<Workflow, Run>> = {};
  for (const run of workflow_runs) {
    const nombre = NOMBRES.find((n) => WORKFLOWS[n].path === run.path);
    if (nombre === undefined) continue;
    if (run.event !== WORKFLOWS[nombre].event) continue;
    if (run.head_repository?.full_name !== gh.repo || run.head_sha !== sha) continue;
    if (!(run.pull_requests ?? []).some((p) => p.number === pr)) continue;
    const actual = elegidos[nombre];
    if (actual === undefined || run.created_at > actual.created_at || (run.created_at === actual.created_at && run.id > actual.id)) {
      elegidos[nombre] = run;
    }
  }
  return elegidos;
}

export type Veredicto = { tipo: 'verde' } | { tipo: 'pendiente' } | { tipo: 'rojo'; fallidos: Workflow[] };

export function veredicto(runs: Partial<Record<Workflow, Run>>): Veredicto {
  const fallidos = NOMBRES.filter((n) => runs[n]?.status === 'completed' && runs[n]?.conclusion !== 'success');
  if (fallidos.length > 0) return { tipo: 'rojo', fallidos };
  const verdes = NOMBRES.filter((n) => runs[n]?.status === 'completed' && runs[n]?.conclusion === 'success');
  return verdes.length === NOMBRES.length ? { tipo: 'verde' } : { tipo: 'pendiente' };
}
