import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

const AES_PREFIX = 'AES256:';
const KEY_LENGTH = 32; // 256-bit key
const IV_LENGTH = 16;  // 128-bit IV for GCM

/**
 * 加密服务
 * 提供 AES-256-GCM 对称加密/解密功能，用于敏感数据保护。
 *
 * 加密格式: AES256:{iv_hex}:{authTag_hex}:{ciphertext_hex}
 *
 * 向后兼容: 不带 AES256: 前缀的数据被视为旧版明文，解密时原样返回。
 * 如果未配置 ENCRYPTION_KEY 环境变量，则回退到透传模式（与旧版行为一致）。
 */
@Injectable()
export class EncryptionService {
  /**
   * 获取加密密钥
   */
  private getKey(): Buffer | null {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length < KEY_LENGTH) {
      return null;
    }
    return Buffer.from(key.slice(0, KEY_LENGTH), 'utf8');
  }

  /**
   * 加密数据 (AES-256-GCM)
   * 未配置密钥时回退到透传模式
   */
  encrypt(data: string): string {
    if (data == null) return data;
    const key = this.getKey();
    if (!key) return data;

    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(String(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();
    return `${AES_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
  }

  /**
   * 解密数据 (AES-256-GCM)
   * 不带 AES256: 前缀的数据视为旧版明文
   */
  decrypt(encrypted: string): string {
    if (encrypted == null) return encrypted;
    if (typeof encrypted !== 'string' || !encrypted.startsWith(AES_PREFIX)) {
      return encrypted;
    }

    const key = this.getKey();
    if (!key) return encrypted;

    try {
      const payload = encrypted.slice(AES_PREFIX.length);
      const sep1 = payload.indexOf(':');
      const sep2 = payload.indexOf(':', sep1 + 1);
      if (sep1 === -1 || sep2 === -1) return encrypted;

      const iv = Buffer.from(payload.slice(0, sep1), 'hex');
      const authTag = Buffer.from(payload.slice(sep1 + 1, sep2), 'hex');
      const ciphertext = payload.slice(sep2 + 1);

      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(authTag);
      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      return encrypted;
    }
  }
}
