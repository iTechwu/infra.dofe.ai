import { PrismaReadService } from "../prisma-read/prisma-read.service";
import { PrismaWriteService } from "../prisma-write/prisma-write.service";
export declare class PrismaService {
    private readonly prismaRead;
    private readonly prismaWrite;
    constructor(prismaRead: PrismaReadService, prismaWrite: PrismaWriteService);
    get read(): import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, import("@prisma/client").Prisma.LogLevel, import("../../../../../models.dofe.ai/apps/api/generated/prisma-client/runtime/client").DefaultArgs>;
    get write(): import("@prisma/client").PrismaClient<import("@prisma/client").Prisma.PrismaClientOptions, import("@prisma/client").Prisma.LogLevel, import("../../../../../models.dofe.ai/apps/api/generated/prisma-client/runtime/client").DefaultArgs>;
    /**
     * Check if both read and write clients are ready
     * 检查读写客户端是否都已就绪
     */
    get isReady(): boolean;
    /**
     * Wait for Prisma clients to be ready
     * 等待 Prisma 客户端就绪
     */
    waitForReady(timeoutMs?: number): Promise<void>;
}
