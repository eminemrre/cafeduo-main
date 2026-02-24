import '@testing-library/jest-dom';
import { TextEncoder, TextDecoder } from 'util';

Object.defineProperty(global, 'TextEncoder', {
  value: TextEncoder,
});

Object.defineProperty(global, 'TextDecoder', {
  value: TextDecoder,
});

if (typeof global.setImmediate === 'undefined') {
  (global as typeof globalThis & { setImmediate: (fn: (...args: any[]) => void, ...args: any[]) => any }).setImmediate =
    ((fn: (...args: any[]) => void, ...args: any[]) => {
      const invoke = () => fn(...args);
      if (typeof queueMicrotask === 'function') {
        queueMicrotask(invoke);
      } else {
        Promise.resolve().then(invoke);
      }
      return 0;
    }) as any;
}

// Mock matchMedia
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: jest.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: jest.fn(),
      removeListener: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    })),
  });
}

// Mock IntersectionObserver
class MockIntersectionObserver {
  observe = jest.fn();
  disconnect = jest.fn();
  unobserve = jest.fn();
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'IntersectionObserver', {
    writable: true,
    value: MockIntersectionObserver,
  });
}

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
  });
}

// Mock browser dialogs used by UI actions
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'alert', {
    writable: true,
    value: jest.fn(),
  });
}

if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'confirm', {
    writable: true,
    value: jest.fn(() => true),
  });
}

// Mock import.meta.env for Vite compatibility
Object.defineProperty(global, 'import', {
  value: {
    meta: {
      env: {
        VITE_API_URL: 'http://localhost:3001',
        DEV: true,
        PROD: false,
      }
    }
  },
  writable: true
});

// Suppress console errors during tests
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
};
