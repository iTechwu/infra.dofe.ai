import { ForbiddenException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  CURRENT_TENANT_HEADER,
  TENANT_SCOPE_KEY,
} from '@dofe/infra-contracts';
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

  it('rejects a tenant-scoped request with no resolved user identity instead of silently passing', async () => {
    // Regression: when TenantContextGuard runs before the auth guard (e.g.
    // `@Auth() + @UseGuards(TenantContextGuard)` evaluated bottom-up),
    // request.userId is unset. Previously the guard silently returned true,
    // leaving request.tenantId empty and surfacing as a misleading downstream
    // 400 ("No tenant context available"). It must now fail loudly.
    const request = {
      headers: { [CURRENT_TENANT_HEADER]: 'tenant-123' },
      // no userId, no skipTenantCheck
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;
    const reflector = {
      getAllAndOverride: jest.fn((key: string) => key === TENANT_SCOPE_KEY),
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
    expect(tenantContextService.resolveCurrentTenant).not.toHaveBeenCalled();
    expect(request).not.toHaveProperty('tenantId');
  });
});
