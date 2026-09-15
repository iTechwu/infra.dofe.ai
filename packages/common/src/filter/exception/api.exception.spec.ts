import { ApiException, apiError } from './api.exception';

describe('ApiException message diagnosability', () => {
  it('keeps an empty message when no errorData is provided (i18n path unchanged)', () => {
    const ex = ApiException.fromCode('900502' as never);
    expect(ex.message).toBe('');
    expect(ex.errorData).toBeNull();
  });

  it('summarizes prisma error detail into the message (bounded, single line)', () => {
    const ex = apiError('900502' as never, {
      type: 'FOREIGN_KEY_CONSTRAINT',
      prismaCode: 'P2003',
      description: '外键约束失败，关联数据不存在',
      model: 'Memory',
      fields: ['tenant_id'],
      originalMessage: 'Invalid `prisma.write.memory.create()` invocation:\n  details...',
    } as never);
    expect(ex.message).toContain('prismaCode=P2003');
    expect(ex.message).toContain('外键约束失败');
    expect(ex.message).toContain('model=Memory');
    expect(ex.message).toContain('fields=tenant_id');
    expect(ex.message).not.toMatch(/\n/);
  });

  it('truncates oversized summaries to 500 characters', () => {
    const ex = apiError('900502' as never, {
      originalMessage: 'x'.repeat(2000),
    } as never);
    expect(ex.message.length).toBeLessThanOrEqual(600);
    expect(ex.message.endsWith('...')).toBe(true);
  });

  it('keeps toJSON response format unchanged (code/msg/error envelope)', () => {
    const ex = apiError('900502' as never, { description: 'boom' } as never);
    const json = ex.toJSON();
    expect(json.msg).toBe(ex.errorType);
    expect(json.error.errorData).toEqual({ description: 'boom' });
  });
});
