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
Object.defineProperty(exports, "__esModule", { value: true });
exports.PrismaService = void 0;
const common_1 = require("@nestjs/common");
const prisma_read_service_1 = require("../prisma-read/prisma-read.service");
const prisma_write_service_1 = require("../prisma-write/prisma-write.service");
let PrismaService = class PrismaService {
    prismaRead;
    prismaWrite;
    constructor(prismaRead, prismaWrite) {
        this.prismaRead = prismaRead;
        this.prismaWrite = prismaWrite;
    }
    get read() {
        return this.prismaRead.client;
    }
    get write() {
        return this.prismaWrite.client;
    }
    /**
     * Check if both read and write clients are ready
     * 检查读写客户端是否都已就绪
     */
    get isReady() {
        return this.prismaRead.isReady && this.prismaWrite.isReady;
    }
    /**
     * Wait for Prisma clients to be ready
     * 等待 Prisma 客户端就绪
     */
    async waitForReady(timeoutMs = 10000) {
        const startTime = Date.now();
        while (!this.isReady) {
            if (Date.now() - startTime > timeoutMs) {
                throw new Error(`Prisma clients not ready after ${timeoutMs}ms. ` +
                    `Read ready: ${this.prismaRead.isReady}, Write ready: ${this.prismaWrite.isReady}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
    }
};
exports.PrismaService = PrismaService;
exports.PrismaService = PrismaService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_read_service_1.PrismaReadService,
        prisma_write_service_1.PrismaWriteService])
], PrismaService);
//# sourceMappingURL=prisma.service.js.map