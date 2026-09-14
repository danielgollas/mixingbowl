/// <reference types="vitest/config" />
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/mixingbowl/',
  plugins: [preact()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
});
