export declare function rsaDecrypt(val: string): string;
/**
 * AES 加密（实际是 AES，但函数名保持与 Vue 代码一致）
 */
export declare function rsaEncrypt(val: string): string;
/**
 * 使用 AES 算法解密数据
 * @param val 加密后的字符串（通常是 Base64 编码）
 * @param secretKey 密钥（必须是字符串）
 * @returns 解密后的字符串
 */
/**
 * AES CBC decryption function
 * @param {string} val - Encrypted data (Base64 encoded string)
 * @param {string} secretKey - Secret key (string)
 * @param {string} iv - Initialization vector (string)
 * @returns {string} - Decrypted data (original text)
 */
export declare function aesCbcDecrypt(val: any, secretKey: any, iv: any): string;
/**
 * AES CBC encryption function
 * @param {string} plainText - Data to encrypt (string)
 * @param {string} secretKey - Secret key (string)
 * @param {string} iv - Initialization vector (string or Buffer)
 * @returns {string} - Encrypted data (Base64 encoded string)
 */
export declare function aesCbcEncrypt(plainText: any, secretKey: any, iv: any): string;
/**
 * 解密
 * @param dataStr {string}
 * @param key {string}
 * @param iv {string}
 * @return {string}
 */
export declare function decrypt(dataStr: string, key: string, iv: string): string;
/**
 * 加密
 * @param dataStr {string}
 * @param key {string}
 * @param iv {string} 16位
 * @return {string}
 */
export declare function encrypt(dataStr: string, key: string, iv: string): string;
export declare function WXBizDataCrypt(appId: any, sessionKey: any, encryptedData: any, iv: any): any;
/**
 * @param {string} algorithm
 * @param {any} content
 *  @return {string}
 */
export declare const signEncrypt: (algorithm: any, content: any) => string;
/**
 * @param {any} content
 *  @return {string}
 */
export declare const sha1: (content: any) => string;
export declare const signUrl: (uri: string, key: string) => string;
