import { defineConfig } from 'vitest/config';

// Solo los tests de la web: conector/ tiene los suyos con su propio Vitest.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
