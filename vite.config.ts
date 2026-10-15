import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const API_PORT = 8787;

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: { '/api': `http://localhost:${API_PORT}` },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'server/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts'],
      exclude: ['src/lib/**/*.test.ts'],
    },
  },
});
