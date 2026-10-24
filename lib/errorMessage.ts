/**
 * Turns a caught value into a message a user can read.
 *
 * lib/api.ts throws Error with the server's message, so the first branch covers the
 * api calls. The `response.data.error` branch is what useCafeAdmin's own copy of this
 * helper also accepted; it is kept so moving to one helper changes no screen.
 */
export const toErrorMessage = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === 'object' && error !== null) {
    const responseError = (error as { response?: { data?: { error?: unknown } } }).response?.data
      ?.error;
    if (typeof responseError === 'string' && responseError.trim()) {
      return responseError;
    }
  }

  return fallback;
};
