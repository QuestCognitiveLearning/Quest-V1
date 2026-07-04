import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    // Source maps make production stack traces actually readable. Slight
    // bandwidth cost; massively faster debugging.
    sourcemap: true,
  },
  test: {
    // Vitest owns src/ only; supabase/functions tests are Deno tests
    // (https: imports) and run via `deno test` in the function directory.
    include: ['src/**/*.test.{js,jsx}'],
  },
});
