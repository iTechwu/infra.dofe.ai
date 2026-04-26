import { Injectable } from '@nestjs/common';
import { PrismaReadService } from '@dofe/infra-prisma';
import { PrismaWriteService } from '@dofe/infra-prisma';

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
}
