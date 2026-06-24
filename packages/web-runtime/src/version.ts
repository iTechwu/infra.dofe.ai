/**
 * API Version & Client Generation helpers for browser runtime.
 *
 * Used by frontend apps to:
 * - Declare the API contract version they were built against
 * - Declare the minimum build number the server requires
 * - Detect version mismatch responses
 * - Detect deprecation warnings from response headers
 */

export const VERSION_HEADERS = {
  API_VERSION: 'x-api-version',
  API_CONTRACT: 'x-api-contract',
  APP_BUILD: 'x-app-build',
  SERVER_BUILD: 'x-server-build',
  MIN_APP_BUILD: 'x-min-app-build',
  DEPRECATION: 'x-deprecation',
  DEPRECATION_MESSAGE: 'x-deprecation-message',
  SUNSET: 'x-sunset',
} as const;

/**
 * Check if a response indicates the API contract version is no longer supported.
 */
export function isVersionMismatchStatus(status: number): boolean {
  return status === 426;
}

/**
 * Parse the deprecation warning from response headers.
 * Returns the deprecation message if present, or null.
 */
export function parseDeprecationWarning(response: Response): string | null {
  const deprecation = response.headers.get(VERSION_HEADERS.DEPRECATION);
  if (deprecation === 'true') {
    return (
      response.headers.get(VERSION_HEADERS.DEPRECATION_MESSAGE) ||
      'This API version is deprecated'
    );
  }
  return null;
}

/**
 * Parse the sunset date from the Sunset header.
 */
export function parseSunsetDate(response: Response): Date | null {
  const sunset = response.headers.get(VERSION_HEADERS.SUNSET);
  if (sunset) {
    const date = new Date(sunset);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}
