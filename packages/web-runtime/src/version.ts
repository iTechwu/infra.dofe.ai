/**
 * API Version & Client Generation helpers for browser runtime.
 *
 * Used by frontend apps to:
 * - Declare the API contract version they were built against
 * - Declare the minimum build number the server requires
 * - Detect version mismatch responses
 * - Detect deprecation warnings from response headers
 */

import {
  API_CONTRACT_HEADER,
  API_VERSION_HEADER,
  APP_BUILD_HEADER,
  DEPRECATION_HEADER,
  DEPRECATION_MESSAGE_HEADER,
  MIN_APP_BUILD_HEADER,
  SERVER_BUILD_HEADER,
  SUNSET_HEADER,
} from '@dofe/infra-contracts';

/** 与 @dofe/infra-contracts 头常量保持单一事实源 */
export const VERSION_HEADERS = {
  API_VERSION: API_VERSION_HEADER,
  API_CONTRACT: API_CONTRACT_HEADER,
  APP_BUILD: APP_BUILD_HEADER,
  SERVER_BUILD: SERVER_BUILD_HEADER,
  MIN_APP_BUILD: MIN_APP_BUILD_HEADER,
  DEPRECATION: DEPRECATION_HEADER,
  DEPRECATION_MESSAGE: DEPRECATION_MESSAGE_HEADER,
  SUNSET: SUNSET_HEADER,
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
