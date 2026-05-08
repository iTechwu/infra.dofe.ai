/**
 * JWK (JSON Web Key) interface for JWKS response parsing
 */
interface Jwk {
  kty: string;
  kid?: string;
  n?: string;
  e?: string;
  alg?: string;
  use?: string;
}

interface JwksResponse {
  keys: Jwk[];
}

/**
 * Simple JWKS client — fetches and caches public keys from an OIDC JWKS endpoint.
 * Converts JWK RSA keys to PEM format for use with JWT verification.
 *
 * Features:
 * - In-memory cache with configurable TTL
 * - Graceful stale cache on fetch failure
 * - Zero external dependencies (no `jose`, `node-jose`, etc.)
 */
export class JwksClient {
  private cache: { keys: Map<string, string>; expiresAt: number } | null = null;

  constructor(
    private readonly jwksUri: string,
    private readonly cacheTtlMs = 5 * 60 * 1000,
  ) {}

  /**
   * Get a PEM public key by key ID (kid).
   * Fetches and caches JWKS on first call or cache expiry.
   * Returns null if no matching key is found.
   */
  async getPublicKey(kid: string): Promise<string | null> {
    await this.ensureCache();
    return this.cache?.keys.get(kid) ?? null;
  }

  private async ensureCache(): Promise<void> {
    if (this.cache && Date.now() < this.cache.expiresAt) return;

    try {
      const response = await fetch(this.jwksUri);
      if (!response.ok) {
        throw new Error(`JWKS fetch failed: ${response.status}`);
      }
      const jwks = (await response.json()) as JwksResponse;
      const keys = new Map<string, string>();

      for (const jwk of jwks.keys) {
        if (jwk.kid) {
          keys.set(jwk.kid, this.jwkToPem(jwk));
        }
      }

      this.cache = { keys, expiresAt: Date.now() + this.cacheTtlMs };
    } catch (error) {
      // On fetch failure, keep stale cache if available
      if (!this.cache) {
        throw error;
      }
    }
  }

  /**
   * Convert a JWK RSA public key to PEM format (PKCS#1).
   * Uses minimal ASN.1 DER encoding — no external dependencies.
   */
  private jwkToPem(jwk: Jwk): string {
    if (jwk.kty !== 'RSA' || !jwk.n || !jwk.e) {
      throw new Error(`Unsupported JWK key type: ${jwk.kty}`);
    }

    const base64UrlDecode = (str: string): Buffer => {
      let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4 !== 0) base64 += '=';
      return Buffer.from(base64, 'base64');
    };

    const modulus = base64UrlDecode(jwk.n);
    const exponent = base64UrlDecode(jwk.e);

    const modulusBytes = this.encodeAsn1Integer(modulus);
    const exponentBytes = this.encodeAsn1Integer(exponent);
    const sequence = this.encodeAsn1Sequence(
      Buffer.concat([modulusBytes, exponentBytes]),
    );

    const base64Der = sequence.toString('base64');
    const lines = base64Der.match(/.{1,64}/g) ?? [base64Der];
    return `-----BEGIN RSA PUBLIC KEY-----\n${lines.join('\n')}\n-----END RSA PUBLIC KEY-----`;
  }

  private encodeAsn1Length(length: number): Buffer {
    if (length < 128) {
      return Buffer.from([length]);
    }
    const bytes: number[] = [];
    let len = length;
    while (len > 0) {
      bytes.unshift(len & 0xff);
      len >>= 8;
    }
    return Buffer.from([0x80 | bytes.length, ...bytes]);
  }

  private encodeAsn1Integer(value: Buffer): Buffer {
    const data =
      value[0] & 0x80 ? Buffer.concat([Buffer.from([0x00]), value]) : value;
    return Buffer.concat([
      Buffer.from([0x02]),
      this.encodeAsn1Length(data.length),
      data,
    ]);
  }

  private encodeAsn1Sequence(contents: Buffer): Buffer {
    return Buffer.concat([
      Buffer.from([0x30]),
      this.encodeAsn1Length(contents.length),
      contents,
    ]);
  }
}
