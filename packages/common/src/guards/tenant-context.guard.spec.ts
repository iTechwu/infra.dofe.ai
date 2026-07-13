import { ForbiddenException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantContextGuard } from './tenant-context.guard';

describe('TenantContextGuard', () => {
  it('rejects an internal request that omits the current tenant header', async () => {
    const request = {
      headers: {},
      skipTenantCheck: true,
      internalServiceName: 'agents',
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(false),
    } as unknown as Reflector;
    const tenantContextService = {
      resolveCurrentTenant: jest.fn(),
      getTenantMember: jest.fn(),
    };
    const logger = {
      debug: jest.fn(),
      warn: jest.fn(),
    };
    const guard = new TenantContextGuard(
      reflector,
      tenantContextService,
      logger as never,
    );

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(request).not.toHaveProperty('tenantId');
  });
});
