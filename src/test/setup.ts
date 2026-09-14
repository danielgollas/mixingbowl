import { cleanup } from '@testing-library/preact';
import { afterEach, beforeEach, vi } from 'vitest';

// @testing-library/preact only auto-cleans when a global afterEach exists; Vitest globals are off.
beforeEach(() => {
  localStorage.clear();
  history.replaceState(null, '', '/');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
