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
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
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
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EncryptionService = void 0;
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
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const crypto = __importStar(require("crypto-js"));
let EncryptionService = class EncryptionService {
    configService;
    encryptionKey;
    constructor(configService) {
        this.configService = configService;
        this.encryptionKey = this.configService.get('ENCRYPTION_KEY', '12345678901234567890123456789012');
        if (!this.encryptionKey || this.encryptionKey.length < 32) {
            throw new Error('ENCRYPTION_KEY must be at least 32 characters');
        }
    }
    encrypt(plainText) {
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
    decrypt(encryptedBuffer) {
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
    hash(input) {
        return crypto.SHA256(input).toString();
    }
};
exports.EncryptionService = EncryptionService;
exports.EncryptionService = EncryptionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], EncryptionService);
//# sourceMappingURL=encryption.service.js.map