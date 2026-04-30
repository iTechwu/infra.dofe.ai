import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as cryptoUtil from '@/utils/crypto.util';
import urlencodeUtil from '@/utils/urlencode.util';

@Injectable()
export class CryptClient {
  private readonly key: string;
  private readonly iv: string;
  constructor(
    private readonly configService: ConfigService,
  ) {
    this.key = configService.getOrThrow<string>('CRYPTO_KEY');
    this.iv = configService.getOrThrow<string>('CRYPTO_IV');
  }

  encrypt(text: string, iv?: string, key?: string): string {
    key = key || this.key;
    iv = iv || this.iv;
    const cry = cryptoUtil.aesCbcEncrypt(text, key, iv);
    return urlencodeUtil.base64ToUrlSafe(cry);
  }

  decrypt(text: string, iv?: string, key?: string): string {
    text = urlencodeUtil.urlSafeToBase64(text);
    key = key || this.key;
    iv = iv || this.iv;
    return cryptoUtil.aesCbcDecrypt(text, key, iv);
  }

  getSignUrl(url: string): string {
    return cryptoUtil.signUrl(url, this.key);
  }
}
