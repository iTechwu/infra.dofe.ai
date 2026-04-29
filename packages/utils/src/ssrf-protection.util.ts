/**
 * SSRF Protection Utilities
 *
 * SSRF (Server-Side Request Forgery) protection for preventing access to internal/sensitive networks.
 */
import * as net from 'net';
import { lookup } from 'dns/promises';

/**
 * Default blocked IP ranges (private/internal networks)
 */
const BLOCKED_IP_RANGES: IPRange[] = [
  // IPv4 private addresses
  { start: '0.0.0.0', end: '0.255.255.255' }, // Current network
  { start: '10.0.0.0', end: '10.255.255.255' }, // Private network
  { start: '127.0.0.0', end: '127.255.255.255' }, // Loopback
  { start: '169.254.0.0', end: '169.254.255.255' }, // Link-local
  { start: '172.16.0.0', end: '172.31.255.255' }, // Private network
  { start: '192.0.0.0', end: '192.0.0.255' }, // IANA IPv4 Special Purpose
  { start: '192.0.2.0', end: '192.0.2.255' }, // Documentation (TEST-NET-1)
  { start: '192.88.99.0', end: '192.88.99.255' }, // IPv6 to IPv4 relay
  { start: '192.168.0.0', end: '192.168.255.255' }, // Private network
  { start: '198.18.0.0', end: '198.19.255.255' }, // Network benchmark tests
  { start: '198.51.100.0', end: '198.51.100.255' }, // Documentation (TEST-NET-2)
  { start: '203.0.113.0', end: '203.0.113.255' }, // Documentation (TEST-NET-3)
  { start: '224.0.0.0', end: '239.255.255.255' }, // Multicast
  { start: '240.0.0.0', end: '255.255.255.255' }, // Reserved
];

interface IPRange {
  start: string;
  end: string;
}

/**
 * SSRF validation result
 */
export interface SSRFValidationResult {
  allowed: boolean;
  reason?: string;
  resolvedIp?: string;
}

/**
 * Simple logger interface
 */
interface SSRFLogger {
  warn(message: string, meta?: Record<string, unknown>): void;
}

const defaultLogger: SSRFLogger = {
  warn: (message, meta) => console.warn(message, meta),
};

/**
 * SSRF Protection Service
 * Validates URLs to prevent SSRF attacks
 */
export class SSRFProtectionService {
  private readonly allowedRanges: IPRange[] = [];
  private readonly logger: SSRFLogger;

  constructor(logger?: SSRFLogger) {
    this.logger = logger ?? defaultLogger;
  }

  /**
   * Add an allowed IP range (whitelist)
   */
  addAllowedRange(start: string, end: string): void {
    this.allowedRanges.push({ start, end });
  }

  /**
   * Validate if a URL is allowed to be accessed
   * @param url URL to validate
   * @param customAllowedRanges Custom allowed IP ranges (optional)
   */
  async validateUrl(
    url: string,
    customAllowedRanges?: string[],
  ): Promise<SSRFValidationResult> {
    try {
      const parsedUrl = new URL(url);
      const hostname = parsedUrl.hostname;

      // Check if it's an IP address
      const isIp = net.isIP(hostname) !== 0;

      let resolvedIp: string;
      if (isIp) {
        resolvedIp = hostname;
      } else {
        // DNS resolution
        const addresses = await lookup(hostname);
        resolvedIp = addresses.address;
      }

      // Check whitelist (highest priority)
      if (customAllowedRanges && customAllowedRanges.length > 0) {
        const inCustomRange = await this.isIpInRanges(
          resolvedIp,
          this.parseIpRanges(customAllowedRanges),
        );
        if (inCustomRange) {
          return { allowed: true, resolvedIp };
        }
      }

      // Check local whitelist
      if (this.allowedRanges.length > 0) {
        const inAllowedRange = await this.isIpInRanges(
          resolvedIp,
          this.allowedRanges,
        );
        if (inAllowedRange) {
          return { allowed: true, resolvedIp };
        }
      }

      // Check blocked list
      const inBlockedRange = await this.isIpInRanges(
        resolvedIp,
        BLOCKED_IP_RANGES,
      );
      if (inBlockedRange) {
        return {
          allowed: false,
          reason: `IP ${resolvedIp} is in blocked range (private/internal network)`,
          resolvedIp,
        };
      }

      return { allowed: true, resolvedIp };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.warn('SSRF validation failed', { url, error: errorMessage });
      return {
        allowed: false,
        reason: `Failed to validate URL: ${errorMessage}`,
      };
    }
  }

  /**
   * Check if IP is in specified ranges
   */
  private async isIpInRanges(ip: string, ranges: IPRange[]): Promise<boolean> {
    const ipNum = this.ipToNumber(ip);
    if (ipNum === null) return false;

    for (const range of ranges) {
      const startNum = this.ipToNumber(range.start);
      const endNum = this.ipToNumber(range.end);

      if (startNum !== null && endNum !== null) {
        if (ipNum >= startNum && ipNum <= endNum) {
          return true;
        }
      }
    }

    return false;
  }

  /**
   * Convert IP address to number
   */
  private ipToNumber(ip: string): number | null {
    const parts = ip.split('.');
    if (parts.length !== 4) return null;

    let num = 0;
    for (const part of parts) {
      const n = parseInt(part, 10);
      if (isNaN(n) || n < 0 || n > 255) return null;
      num = num * 256 + n;
    }

    return num;
  }

  /**
   * Parse IP range string array
   */
  private parseIpRanges(ranges: string[]): IPRange[] {
    const result: IPRange[] = [];

    for (const range of ranges) {
      // Support formats: "192.168.1.0-192.168.1.255" or "192.168.1.0/24"
      if (range.includes('-')) {
        const [start, end] = range.split('-');
        result.push({ start: start.trim(), end: end.trim() });
      } else if (range.includes('/')) {
        const cidrRange = this.parseCIDR(range);
        if (cidrRange) {
          result.push(cidrRange);
        }
      } else {
        // Single IP
        result.push({ start: range, end: range });
      }
    }

    return result;
  }

  /**
   * Parse CIDR format
   */
  private parseCIDR(cidr: string): IPRange | null {
    const [ip, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr, 10);

    if (isNaN(prefix) || prefix < 0 || prefix > 32) return null;

    const ipNum = this.ipToNumber(ip);
    if (ipNum === null) return null;

    const mask = (0xffffffff << (32 - prefix)) >>> 0;
    const startNum = (ipNum & mask) >>> 0;
    const endNum = (startNum | (~mask >>> 0)) >>> 0;

    return {
      start: this.numberToIp(startNum),
      end: this.numberToIp(endNum),
    };
  }

  /**
   * Convert number to IP address
   */
  private numberToIp(num: number): string {
    return [
      (num >>> 24) & 0xff,
      (num >>> 16) & 0xff,
      (num >>> 8) & 0xff,
      num & 0xff,
    ].join('.');
  }
}

/**
 * Default singleton instance (for non-NestJS contexts)
 */
let defaultInstance: SSRFProtectionService | null = null;

export function getSSRFProtectionService(): SSRFProtectionService {
  if (!defaultInstance) {
    defaultInstance = new SSRFProtectionService();
  }
  return defaultInstance;
}

/**
 * Convenience function to validate a URL
 */
export async function validateUrlForSSRF(
  url: string,
  customAllowedRanges?: string[],
): Promise<SSRFValidationResult> {
  return getSSRFProtectionService().validateUrl(url, customAllowedRanges);
}