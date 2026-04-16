const DYNAMIC_IMPORT_ERROR_PATTERNS = [
  /dynamically imported module/i,
  /failed to fetch dynamically imported module/i,
  /error loading dynamically imported module/i,
  /chunkloaderror/i,
  /loading chunk/i,
  /importing a module script failed/i,
];

/**
 * Detect lazy chunk load errors caused by a stale client build or temporary asset fetch issues.
 */
export const isDynamicImportError = (error: unknown): boolean => {
  const message =
    typeof error === 'string'
      ? error
      : error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error ?? '');

  return DYNAMIC_IMPORT_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

