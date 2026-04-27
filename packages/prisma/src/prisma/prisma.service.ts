import { Injectable } from '@nestjs/common';
import { PrismaReadService } from '@/prisma-read/prisma-read.service';
import { PrismaWriteService } from '@/prisma-write/prisma-write.service';

@Injectable()
export class PrismaService {
  constructor(
    private readonly prismaRead: PrismaReadService,
    private readonly prismaWrite: PrismaWriteService,
  ) {}
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
  get isReady(): boolean {
    return this.prismaRead.isReady && this.prismaWrite.isReady;
  }

  /**
   * Wait for Prisma clients to be ready
   * 等待 Prisma 客户端就绪
   */
  async waitForReady(timeoutMs: number = 10000): Promise<void> {
    const startTime = Date.now();

    while (!this.isReady) {
      if (Date.now() - startTime > timeoutMs) {
        throw new Error(
          `Prisma clients not ready after ${timeoutMs}ms. ` +
            `Read ready: ${this.prismaRead.isReady}, Write ready: ${this.prismaWrite.isReady}`,
        );
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}
