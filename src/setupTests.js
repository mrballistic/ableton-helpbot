import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import matchers from '@testing-library/jest-dom/matchers';

// Add custom matchers
expect.extend(matchers);

// Clean up after each test
afterEach(() => {
  cleanup();
});
