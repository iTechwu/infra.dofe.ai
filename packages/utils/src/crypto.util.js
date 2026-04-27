"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.signUrl = exports.sha1 = exports.signEncrypt = void 0;
exports.rsaDecrypt = rsaDecrypt;
exports.rsaEncrypt = rsaEncrypt;
exports.aesCbcDecrypt = aesCbcDecrypt;
exports.aesCbcEncrypt = aesCbcEncrypt;
exports.decrypt = decrypt;
exports.encrypt = encrypt;
exports.WXBizDataCrypt = WXBizDataCrypt;
const crypto = __importStar(require("crypto"));
const CryptoJS = __importStar(require("crypto-js"));
function rsaDecrypt(val) {
    if (!val || typeof val !== 'string') {
        console.error('[rsaDecrypt] Invalid input:', {
            val: val?.substring(0, 50),
        });
        return '';
    }
    try {
        // 将 base64 编码的加密数据转换为 Buffer
        const bytes = CryptoJS.AES.decrypt(val, 'qmez2n1llvatr8gczip6uyokpi1wi8ys');
        const originalText = bytes.toString(CryptoJS.enc.Utf8);
        if (!originalText || originalText.trim() === '') {
            console.error('[rsaDecrypt] Decryption result is empty', {
                inputLength: val.length,
                inputPreview: val.substring(0, 50),
            });
        }
        return originalText;
    }
    catch (error) {
        console.error('[rsaDecrypt] Decryption failed:', {
            error: error.message || error,
            inputLength: val.length,
            inputPreview: val.substring(0, 50),
        });
        return '';
    }
}
/**
 * AES 加密（实际是 AES，但函数名保持与 Vue 代码一致）
 */
function rsaEncrypt(val) {
    const key = 'qmez2n1llvatr8gczip6uyokpi1wi8ys';
    const cipher = CryptoJS.AES.encrypt(val, key);
    return cipher.toString();
}
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
function aesCbcDecrypt(val, secretKey, iv) {
    try {
        const ivBuffer = CryptoJS.enc.Utf8.parse(iv);
        const decryptedBytes = CryptoJS.AES.decrypt(val, CryptoJS.enc.Utf8.parse(secretKey), {
            mode: CryptoJS.mode.CBC,
            padding: CryptoJS.pad.Pkcs7,
            iv: ivBuffer,
        });
        const originalText = decryptedBytes.toString(CryptoJS.enc.Utf8);
        return originalText;
    }
    catch (error) {
        console.error('Decryption failed:', error);
        throw new Error('Failed to decrypt data due to an error.');
    }
}
/**
 * AES CBC encryption function
 * @param {string} plainText - Data to encrypt (string)
 * @param {string} secretKey - Secret key (string)
 * @param {string} iv - Initialization vector (string or Buffer)
 * @returns {string} - Encrypted data (Base64 encoded string)
 */
function aesCbcEncrypt(plainText, secretKey, iv) {
    const ivBuffer = CryptoJS.enc.Utf8.parse(iv);
    const ciphered = CryptoJS.AES.encrypt(plainText, CryptoJS.enc.Utf8.parse(secretKey), {
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
        iv: ivBuffer,
    });
    return ciphered.toString();
}
/**
 * 解密
 * @param dataStr {string}
 * @param key {string}
 * @param iv {string}
 * @return {string}
 */
function decrypt(dataStr, key, iv) {
    try {
        const decipher = crypto.createDecipheriv('aes-128-cbc', key, iv);
        decipher.setAutoPadding(true);
        let decrypted = decipher.update(dataStr, 'base64', 'utf8');
        try {
            decrypted += decipher.final('utf8');
        }
        catch (err) {
            console.error('Decryption failed:', err);
            throw err; // 或者您可以选择返回一个错误消息或空字符串
        }
        return decrypted;
    }
    catch (err) {
        console.error('Error in decryption setup:', err);
        throw err; // 抛出错误或返回错误消息
    }
}
/**
 * 加密
 * @param dataStr {string}
 * @param key {string}
 * @param iv {string} 16位
 * @return {string}
 */
function encrypt(dataStr, key, iv) {
    try {
        const cipher = crypto.createCipheriv('aes-128-cbc', key, iv);
        cipher.setAutoPadding(true);
        let encrypted = cipher.update(dataStr, 'utf8', 'base64');
        encrypted += cipher.final('base64');
        return encrypted;
    }
    catch (err) {
        console.error('Error in encryption:', err);
        throw new Error('Error encrypting data');
    }
}
function WXBizDataCrypt(appId, sessionKey, encryptedData, iv) {
    // base64 decode
    sessionKey = Buffer.from(sessionKey, 'base64');
    encryptedData = Buffer.from(encryptedData, 'base64');
    iv = Buffer.from(iv, 'base64');
    let decoded;
    try {
        // 解密
        const decipher = crypto.createDecipheriv('aes-128-cbc', sessionKey, iv);
        // 设置自动 padding 为 true，删除填充补位
        decipher.setAutoPadding(true);
        decoded = decipher.update(encryptedData, 'binary', 'utf8');
        decoded += decipher.final('utf8');
        decoded = JSON.parse(decoded);
    }
    catch (err) {
        throw new Error('解密失败');
    }
    if (decoded.watermark.appid !== appId) {
        throw new Error('appid 错误');
    }
    return decoded;
}
/**
 * @param {string} algorithm
 * @param {any} content
 *  @return {string}
 */
const signEncrypt = (algorithm, content) => {
    const hash = crypto.createHash(algorithm);
    hash.update(content);
    return hash.digest('hex');
};
exports.signEncrypt = signEncrypt;
/**
 * @param {any} content
 *  @return {string}
 */
const sha1 = (content) => (0, exports.signEncrypt)('sha1', content);
exports.sha1 = sha1;
const signUrl = (uri, key) => {
    // 使用CryptoJS计算HMAC_SHA1
    const hash = CryptoJS.HmacSHA1(uri, key);
    const wordArray = hash.words;
    const sigBytes = hash.sigBytes;
    const buffer = Buffer.from(wordArray.map((word) => (word >>> 0) & 0xff));
    // 使用Base64 URL安全的编码
    const hash_encoded = buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    // 将签名信息添加到URL末尾
    const signedUrl = `${uri}sig=${hash_encoded}`;
    return signedUrl;
};
exports.signUrl = signUrl;
//# sourceMappingURL=crypto.util.js.map