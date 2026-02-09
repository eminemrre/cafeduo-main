import React from 'react';
import { isDynamicImportError } from './chunkLoad';
import { safeReplace } from './navigation';

const RETRY_KEY_PREFIX = 'cafeduo:lazy-retry:';

const readRetryMarker = (key: string): string | null => {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeRetryMarker = (key: string, value: string) => {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // noop: sessionStorage may be unavailable in restrictive browser modes
  }
};

const removeRetryMarker = (key: string) => {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // noop
  }
};

/**
 * Wrap React.lazy with one-time hard refresh recovery for stale chunk URLs after deployment.
 */
export const lazyWithRetry = <T extends React.ComponentType<any>>(
  importFactory: () => Promise<{ default: T }>,
  componentId: string
) =>
  React.lazy(async () => {
    const retryKey = `${RETRY_KEY_PREFIX}${componentId}`;

    try {
      const module = await importFactory();
      removeRetryMarker(retryKey);
      return module;
    } catch (error) {
      if (typeof window !== 'undefined' && isDynamicImportError(error)) {
        const alreadyRetried = readRetryMarker(retryKey) === '1';
        if (!alreadyRetried) {
          writeRetryMarker(retryKey, '1');
          const reloadUrl = new URL(window.location.href);
          reloadUrl.searchParams.set('__rf', String(Date.now()));
          safeReplace(reloadUrl.toString());
          return new Promise<never>(() => {});
        }
        removeRetryMarker(retryKey);
      }

      throw error;
    }
  });
