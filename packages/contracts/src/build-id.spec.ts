import { describe, expect, it } from 'vitest';

import {
  APP_BUILD_PATTERN,
  compareGenerations,
  extractGeneration,
  isSkippedAppBuild,
  isValidAppBuild,
} from './build-id';

describe('extractGeneration', () => {
  it('解析 -gNN 后缀', () => {
    expect(extractGeneration('2025.03.18-abcdef-g42')).toBe(42);
    expect(extractGeneration('2025.03.18-abcdef-g1')).toBe(1);
  });

  it('无后缀或非法值返回 0', () => {
    expect(extractGeneration('hozonauto')).toBe(0);
    expect(extractGeneration('2025.03.18-abcdef')).toBe(0);
    expect(extractGeneration('dev')).toBe(0);
  });
});

describe('isValidAppBuild', () => {
  it('接受规范构建号', () => {
    expect(isValidAppBuild('2025.03.18-abcdef-g1')).toBe(true);
    expect(isValidAppBuild('2026.09.28-000000-g1')).toBe(true);
  });

  it('拒绝品牌串、白名单值与非字符串', () => {
    expect(isValidAppBuild('hozonauto')).toBe(false);
    expect(isValidAppBuild('dev')).toBe(false);
    expect(isValidAppBuild(undefined)).toBe(false);
  });
});

describe('isSkippedAppBuild', () => {
  it('空值与白名单值放行', () => {
    expect(isSkippedAppBuild(undefined)).toBe(true);
    expect(isSkippedAppBuild('')).toBe(true);
    expect(isSkippedAppBuild('dev')).toBe(true);
    expect(isSkippedAppBuild('server')).toBe(true);
  });

  it('其余值不放行', () => {
    expect(isSkippedAppBuild('hozonauto')).toBe(false);
  });
});

describe('compareGenerations', () => {
  it('按代际号比较', () => {
    expect(compareGenerations('2025.03.18-aaaaaa-g1', '2025.03.18-bbbbbb-g2')).toBe(-1);
    expect(compareGenerations('2025.03.18-aaaaaa-g2', '2025.03.18-bbbbbb-g1')).toBe(1);
    expect(compareGenerations('2025.03.18-aaaaaa-g1', '2026.01.01-bbbbbb-g1')).toBe(0);
  });
});

describe('APP_BUILD_PATTERN', () => {
  it('hash 段限定 hex，拒绝品牌串', () => {
    expect(APP_BUILD_PATTERN.test('2025.03.18-hozonauto-g1')).toBe(false);
    expect(APP_BUILD_PATTERN.test('2025.03.18-abc123-g10')).toBe(true);
  });
});
