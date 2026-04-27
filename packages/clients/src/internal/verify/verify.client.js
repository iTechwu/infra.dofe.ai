"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.VerifyClient = void 0;
const common_1 = require("@nestjs/common");
const string_util_1 = __importDefault(require("../../../../utils/dist/string.util"));
const redis_1 = require("../../../../redis/src");
let VerifyClient = class VerifyClient {
    redis;
    constructor(redis) {
        this.redis = redis;
    }
    async getMobileCode(mobile) {
        return await this.redis.getData('mobileCode', mobile);
    }
    async validateMobileCode(mobile, code) {
        const mobileCode = await this.getMobileCode(mobile);
        if (mobileCode !== code)
            return false;
        await this.redis.deleteData('mobileCode', mobile);
        return true;
    }
    async generateMobileCode(mobile, expireIn) {
        const code = Math.random().toString().slice(-6);
        await this.redis.saveData('mobileCode', mobile, code, expireIn);
        return code;
    }
    async getEmailCode(email) {
        return await this.redis.getData('emailCode', email);
    }
    async validateEmailCode(email, code) {
        const emailCode = await this.getEmailCode(email);
        if (emailCode.toUpperCase() !== code.toUpperCase())
            return false;
        await this.redis.deleteData('emailCode', email);
        return true;
    }
    async generateEmailCode(email, expireIn) {
        const code = string_util_1.default.stringGen(6).toUpperCase();
        await this.redis.saveData('emailCode', email, code, expireIn);
        return code;
    }
};
exports.VerifyClient = VerifyClient;
exports.VerifyClient = VerifyClient = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [redis_1.RedisService])
], VerifyClient);
//# sourceMappingURL=verify.client.js.map