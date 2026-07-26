import { defineConfig, configDefaults } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    exclude: [...configDefaults.exclude, 'tests/e2e/**'],
    coverage: {
      reporter: ['text', 'html'],
    },
  },
});
