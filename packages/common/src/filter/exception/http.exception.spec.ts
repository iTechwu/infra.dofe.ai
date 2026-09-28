import type { ArgumentsHost } from '@nestjs/common';
import {
  BadRequestException,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';

import { ApiException } from './api.exception';
import { HttpExceptionFilter } from './http.exception';

function createHost() {
  const request = {
    url: '/auth/login',
    traceId: 'trace-1',
    i18nContext: { t: () => null, lang: 'zh' },
  };
  const reply = { status: vi.fn().mockReturnThis(), send: vi.fn() };
  const host = {
    getType: () => 'http',
    switchToHttp: () =>
      ({ getResponse: () => reply, getRequest: () => request }) as never,
    switchToRpc: () => {
      throw new Error('http only');
    },
    switchToWs: () => {
      throw new Error('http only');
    },
  } as unknown as ArgumentsHost;
  return { request, reply, host };
}

function createFilter() {
  const logger = { error: vi.fn() };
  const filter = new HttpExceptionFilter(logger as never);
  return { filter, logger };
}

describe('HttpExceptionFilter 普通 HttpException 富 payload 透传', () => {
  it('VersionGuard 426: 透传 msg 与 data，且不带 timestamp/path', () => {
    const { reply, host } = createHost();
    const { filter } = createFilter();
    const payload = {
      code: 426,
      msg: '客户端版本过旧，请刷新页面',
      data: {
        clientBuild: 'hozonauto',
        clientGeneration: 0,
        minGeneration: 1,
        minBuild: '0000.00.00-000000-g1',
      },
    };

    filter.catch(new HttpException(payload, 426), host);

    expect(reply.status).toHaveBeenCalledWith(426);
    const body = reply.send.mock.calls[0][0] as Record<string, unknown>;
    expect(body.code).toBe(426);
    expect(body.msg).toBe('客户端版本过旧，请刷新页面');
    expect(body.data).toEqual(payload.data);
    expect(body.traceId).toBe('trace-1');
    expect(body).not.toHaveProperty('timestamp');
    expect(body).not.toHaveProperty('path');
  });

  it('Nest 内建 NotFound: msg 取 response.message，无 data 键', () => {
    const { reply, host } = createHost();
    const { filter } = createFilter();

    filter.catch(new NotFoundException('用户不存在'), host);

    const body = reply.send.mock.calls[0][0] as Record<string, unknown>;
    expect(body.code).toBe(404);
    expect(body.msg).toBe('用户不存在');
    expect(body).not.toHaveProperty('data');
  });

  it('字符串 response: msg 取该字符串', () => {
    const { reply, host } = createHost();
    const { filter } = createFilter();

    filter.catch(new HttpException('自定义错误', 400), host);

    const body = reply.send.mock.calls[0][0] as Record<string, unknown>;
    expect(body.code).toBe(400);
    expect(body.msg).toBe('自定义错误');
    expect(body).not.toHaveProperty('data');
  });

  it('ValidationPipe 数组 message: 校验错误走 error.errorData', () => {
    const { reply, host } = createHost();
    const { filter } = createFilter();

    filter.catch(new BadRequestException(['name must be a string']), host);

    const body = reply.send.mock.calls[0][0] as Record<string, any>;
    expect(body.code).toBe(400);
    expect(body.msg).toBe('Bad Request Exception');
    expect(body.error.errorData).toEqual(['name must be a string']);
  });

  it('ApiException: 包络保持 error 字段，不走 data 透传', () => {
    const { reply, host } = createHost();
    const { filter } = createFilter();

    filter.catch(ApiException.fromCode('900502' as never), host);

    const body = reply.send.mock.calls[0][0] as Record<string, unknown>;
    expect('error' in body).toBe(true);
    expect(body).not.toHaveProperty('data');
  });
});
