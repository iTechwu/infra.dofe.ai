import type { ExecutionContext } from '@nestjs/common';
import { HttpException } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import {
  APP_BUILD_HEADER,
  CURRENT_CONTRACT,
  MIN_CLIENT_GENERATION,
  MIN_APP_BUILD_HEADER,
  PLATFORM_HEADER,
  PLATFORMS,
} from '@dofe/infra-contracts';
import { describe, expect, it, vi } from 'vitest';

import { SKIP_VERSION_CHECK, VersionGuard } from './version.guard';

const MIN_BUILD = `0000.00.00-000000-g${MIN_CLIENT_GENERATION}`;

function createContext(
  headers: Record<string, string | undefined>,
  skipVersionCheck?: boolean,
) {
  const request: {
    headers: Record<string, string | undefined>;
    versionContext?: unknown;
  } = { headers };
  const response = { header: vi.fn() };
  const context = {
    switchToHttp: () =>
      ({ getRequest: () => request, getResponse: () => response }) as never,
    getHandler: () => () => undefined,
    getClass: () => class Temp {},
  } as unknown as ExecutionContext;
  const reflector = {
    getAllAndOverride: vi
      .fn()
      .mockImplementation((key: string) =>
        key === SKIP_VERSION_CHECK ? skipVersionCheck : undefined,
      ),
  } as unknown as Reflector;
  return {
    guard: new VersionGuard(reflector),
    context,
    request,
    response,
  };
}

describe('VersionGuard Web 轨(代际号校验)', () => {
  it('缺失构建号: 放行并写入版本上下文', () => {
    const { guard, context, request } = createContext({
      [PLATFORM_HEADER]: PLATFORMS.WEB,
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(request.versionContext).toMatchObject({
      platform: PLATFORMS.WEB,
      appBuild: undefined,
    });
  });

  it.each(['dev', 'server'])('白名单值 %s: 放行', (build) => {
    const { guard, context } = createContext({
      [PLATFORM_HEADER]: PLATFORMS.WEB,
      [APP_BUILD_HEADER]: build,
    });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('合法构建号: 放行且代际号上下文正确', () => {
    const { guard, context, request } = createContext({
      [PLATFORM_HEADER]: PLATFORMS.WEB,
      [APP_BUILD_HEADER]: '2025.03.18-abcdef-g1',
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(request.versionContext).toMatchObject({
      platform: PLATFORMS.WEB,
      appBuild: '2025.03.18-abcdef-g1',
    });
  });

  it('品牌串 hozonauto: 抛 426 并携带结构化 payload 与最低版本头', () => {
    const { guard, context, response } = createContext({
      [PLATFORM_HEADER]: PLATFORMS.WEB,
      [APP_BUILD_HEADER]: 'hozonauto',
    });

    let thrown: unknown;
    try {
      guard.canActivate(context);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(HttpException);
    const exception = thrown as HttpException;
    expect(exception.getStatus()).toBe(426);
    expect(exception.getResponse()).toEqual({
      code: 426,
      msg: '客户端版本过旧，请刷新页面',
      data: {
        clientBuild: 'hozonauto',
        clientGeneration: 0,
        minGeneration: MIN_CLIENT_GENERATION,
        minBuild: MIN_BUILD,
      },
    });
    expect(response.header).toHaveBeenCalledWith(MIN_APP_BUILD_HEADER, MIN_BUILD);
  });

  it('低于最低代际号: 抛 426', () => {
    const { guard, context } = createContext({
      [PLATFORM_HEADER]: PLATFORMS.WEB,
      [APP_BUILD_HEADER]: '2025.03.18-abcdef-g0',
    });

    expect(() => guard.canActivate(context)).toThrow(HttpException);
  });
});

describe('VersionGuard APP 轨(Contract 校验)', () => {
  it('未携带 contract: 以当前版本放行', () => {
    const { guard, context, request } = createContext({
      [PLATFORM_HEADER]: PLATFORMS.IOS,
    });

    expect(guard.canActivate(context)).toBe(true);
    expect(request.versionContext).toMatchObject({ contract: CURRENT_CONTRACT });
  });

  it('未知 contract: 抛 400', () => {
    const { guard, context } = createContext({
      [PLATFORM_HEADER]: PLATFORMS.IOS,
      'x-api-contract': '1999-01' as never,
    });

    try {
      guard.canActivate(context);
      throw new Error('should not reach');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(400);
    }
  });

  it('build 低于 contract 最低构建号: 抛 426', () => {
    const { guard, context } = createContext({
      [PLATFORM_HEADER]: PLATFORMS.IOS,
      'x-api-contract': CURRENT_CONTRACT,
      [APP_BUILD_HEADER]: '999',
    });

    try {
      guard.canActivate(context);
      throw new Error('should not reach');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getStatus()).toBe(426);
    }
  });
});

describe('VersionGuard 跳过装饰器', () => {
  it('@SkipVersionCheck: 直接放行', () => {
    const { guard, context } = createContext(
      { [PLATFORM_HEADER]: PLATFORMS.WEB, [APP_BUILD_HEADER]: 'hozonauto' },
      true,
    );

    expect(guard.canActivate(context)).toBe(true);
  });
});
