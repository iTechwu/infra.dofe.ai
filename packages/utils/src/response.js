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
exports.Response = void 0;
const swagger_1 = require("@nestjs/swagger");
const bigint_util_1 = __importDefault(require("./bigint.util"));
class Response {
    constructor(code = 200, msg, data) {
        this.code = code;
        this.msg = msg || 'ok';
        this.data = data || undefined;
    }
    code;
    msg;
    data;
    static ok(data) {
        return new Response(200, 'ok', bigint_util_1.default.serialize(data));
    }
}
exports.Response = Response;
__decorate([
    (0, swagger_1.ApiProperty)({ type: 'number', default: 200 }),
    __metadata("design:type", Number)
], Response.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: 'string', default: 'ok' }),
    __metadata("design:type", String)
], Response.prototype, "msg", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Object)
], Response.prototype, "data", void 0);
//# sourceMappingURL=response.js.map