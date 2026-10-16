import { writeFileSync } from 'node:fs';
import { esquemasJson } from '../src/lib/esquemas.ts';

for (const [coleccion, esquema] of Object.entries(esquemasJson())) {
  writeFileSync(`esquemas/${coleccion}.schema.json`, `${JSON.stringify(esquema, null, 2)}\n`);
}
