import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// scripts/extraer_capturas.py, el que usa qa para las capturas de Actions. Cada caso monta su zip y
// lo comprueba en tests/extraer_capturas_casos.py.
const casos = fileURLToPath(new URL('./extraer_capturas_casos.py', import.meta.url));

function caso(nombre: string) {
  const r = spawnSync('python3', ['-I', casos, nombre], { encoding: 'utf8' });
  expect(r.stderr + r.stdout, `caso ${nombre}`).toBe('');
  expect(r.status).toBe(0);
}

describe('extraer_capturas.py', () => {
  it('rechaza el artefacto entero si trae un enlace simbólico', () => caso('enlace'));
  it('rechaza un directorio dentro del artefacto', () => caso('directorio'));
  it('rechaza 41 entradas y acepta 40', () => {
    caso('41_entradas');
    caso('40_entradas');
  });
  it('rechaza una entrada de más de 5 MB', () => caso('mas_de_5_mb'));
  it('rechaza una entrada de más de 5 MB aunque su file_size diga menos', () => caso('mas_de_5_mb_con_cabecera_falsa'));
  it('rechaza más de 40 MB en total', () => caso('mas_de_40_mb'));
  it('rechaza un .png sin cabecera PNG', () => caso('png_sin_cabecera'));
  it('rechaza dos entradas con el mismo nombre', () => caso('nombre_repetido'));
  it('con dos PNG los escribe, y nada más', () => caso('dos_png'));
  it('no escribe en un directorio de salida que ya existe', () => caso('salida_existente'));
});
