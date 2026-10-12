/// <reference types="vitest/config" />
import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/mixingbowl/',
  plugins: [preact()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // Tests never talk to iCloud, even when .env.local has CloudKit settings.
    env: { VITE_CLOUDKIT_CONTAINER: '', VITE_CLOUDKIT_API_TOKEN: '' },
  },
});
