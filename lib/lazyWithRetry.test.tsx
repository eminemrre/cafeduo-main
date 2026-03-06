import React, { Suspense } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { lazyWithRetry } from './lazyWithRetry';

const mockSafeReplace = jest.fn();
const mockIsDynamicImportError = jest.fn();

jest.mock('./navigation', () => ({
  safeReplace: (...args: unknown[]) => mockSafeReplace(...args),
}));

jest.mock('./chunkLoad', () => ({
  isDynamicImportError: (...args: unknown[]) => mockIsDynamicImportError(...args),
}));

describe('lazyWithRetry', () => {
  const originalSessionStorage = window.sessionStorage;
  let getItemMock: jest.Mock;
  let setItemMock: jest.Mock;
  let removeItemMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    getItemMock = jest.fn().mockReturnValue(null);
    setItemMock = jest.fn();
    removeItemMock = jest.fn();
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: {
        getItem: getItemMock,
        setItem: setItemMock,
        removeItem: removeItemMock,
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: originalSessionStorage,
    });
  });

  it('renders successfully loaded modules and clears retry marker', async () => {
    const LazyComponent = lazyWithRetry(
      async () => ({ default: () => <div>loaded</div> }),
      'dashboard'
    );

    render(
      <Suspense fallback={<div>loading</div>}>
        <LazyComponent />
      </Suspense>
    );

    expect(await screen.findByText('loaded')).toBeInTheDocument();
    expect(removeItemMock).toHaveBeenCalledWith('cafeduo:lazy-retry:dashboard');
  });

  it('forces one hard refresh for stale chunk errors', async () => {
    mockIsDynamicImportError.mockReturnValue(true);

    const LazyComponent = lazyWithRetry(
      async () => {
        throw new TypeError('Loading chunk 1 failed');
      },
      'games'
    );

    render(
      <Suspense fallback={<div>loading</div>}>
        <LazyComponent />
      </Suspense>
    );

    await waitFor(() => {
      expect(setItemMock).toHaveBeenCalledWith('cafeduo:lazy-retry:games', '1');
    });
    expect(mockSafeReplace).toHaveBeenCalledTimes(1);
    expect(String(mockSafeReplace.mock.calls[0][0])).toContain('__rf=');
  });
});
