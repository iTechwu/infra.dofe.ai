/**
 * Encryption Service
 *
 * AES-256-CBC encryption for provider API keys.
 * SHA-256 hashing for user API key storage.
 *
 * Supports two stored formats for backward compatibility:
 * - Legacy: "ivHex:cipherTextHex" (raw hex strings joined by colon)
 * - Current: OpenSSL Base64 (crypto-js native serialization)
 */
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto-js';

@Injectable()
export class EncryptionService {
  private readonly encryptionKey: string;

  constructor(private readonly configService: ConfigService) {
    this.encryptionKey = this.configService.get<string>(
      'ENCRYPTION_KEY',
      '12345678901234567890123456789012',
    );
    if (!this.encryptionKey || this.encryptionKey.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters');
    }
  }

  encrypt(plainText: string): Uint8Array {
    const iv = crypto.lib.WordArray.random(16);
    const encrypted = crypto.AES.encrypt(plainText, this.encryptionKey, {
      iv: iv,
      mode: crypto.mode.CBC,
      padding: crypto.pad.Pkcs7,
    });

    // Store as OpenSSL format (Base64) which is the native crypto-js serialization
    const combined = encrypted.toString();
    const bytes = Buffer.from(combined, 'utf-8');
    return new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }

  decrypt(encryptedBuffer: Uint8Array): string {
    const combined = Buffer.from(encryptedBuffer).toString('utf-8');

    // Legacy format: "ivHex:cipherTextHex" (contains a colon)
    // crypto-js.decrypt treats strings as Base64/OpenSSL, so hex ciphertext
    // must be wrapped in a CipherParams object for correct parsing.
    if (combined.includes(':')) {
      const [ivHex, cipherTextHex] = combined.split(':');
      const cipherParams = crypto.lib.CipherParams.create({
        ciphertext: crypto.enc.Hex.parse(cipherTextHex),
      });
      const decrypted = crypto.AES.decrypt(cipherParams, this.encryptionKey, {
        iv: crypto.enc.Hex.parse(ivHex),
        mode: crypto.mode.CBC,
        padding: crypto.pad.Pkcs7,
      });
      return decrypted.toString(crypto.enc.Utf8);
    }

    // Current format: OpenSSL Base64
    const decrypted = crypto.AES.decrypt(combined, this.encryptionKey);
    return decrypted.toString(crypto.enc.Utf8);
  }

  hash(input: string): string {
    return crypto.SHA256(input).toString();
  }
}