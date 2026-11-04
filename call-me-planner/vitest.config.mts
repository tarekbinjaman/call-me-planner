import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// Unit tests cover pure TypeScript only (src/domain, and data code that takes its database as a parameter).
// Anything that needs a real phone is tested with Maestro (.maestro/).
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    // One worker per CPU core runs this 8 GB laptop out of memory while Metro is running;
    // the tests are small, so two workers are just as fast.
    maxWorkers: 2,
  },
});
