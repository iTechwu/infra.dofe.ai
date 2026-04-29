/**
 * Sensitive Data Masker
 *
 * 提供审计日志中敏感数据的脱敏功能
 *
 * 脱敏策略：
 * - API Key: 保留前4位和后4位，中间用 *** 替换
 * - Email: 保留前2位和域名，中间用 *** 替换
 * - Phone: 保留前3位和后2位，中间用 *** 替换
 * - IP Address: 保留前两段，后两段用 *** 替换
 * - Password/Secret: 完全替换为 [REDACTED]
 */

/** 脱敏规则类型 */
export type MaskRule =
  | 'api_key'
  | 'email'
  | 'phone'
  | 'ip'
  | 'password'
  | 'secret'
  | 'default';

/** 已知的敏感字段名映射 */
const SENSITIVE_FIELD_RULES: Record<string, MaskRule> = {
  // API Keys
  apiKey: 'api_key',
  api_key: 'api_key',
  key: 'api_key',
  token: 'api_key',
  accessToken: 'api_key',
  access_token: 'api_key',
  refreshToken: 'api_key',
  refresh_token: 'api_key',
  secretKey: 'api_key',
  secret_key: 'api_key',
  authorization: 'api_key',

  // Passwords
  password: 'password',
  pwd: 'password',
  pass: 'password',
  secret: 'secret',
  privateKey: 'secret',
  private_key: 'secret',

  // Email
  email: 'email',
  mail: 'email',

  // Phone
  phone: 'phone',
  mobile: 'phone',
  telephone: 'phone',
  tel: 'phone',

  // IP Address
  ip: 'ip',
  ipAddress: 'ip',
  ip_address: 'ip',
  clientIp: 'ip',
  client_ip: 'ip',
};

/**
 * 脱敏 API Key
 * 示例: sk-abc123xyz789 -> sk-a***z789
 */
export function maskApiKey(value: string): string {
  if (!value || value.length < 12) {
    return '***';
  }
  const prefixLen = 4;
  const suffixLen = 4;
  const prefix = value.slice(0, prefixLen);
  const suffix = value.slice(-suffixLen);
  return `${prefix}***${suffix}`;
}

/**
 * 脱敏邮箱
 * 示例: example@domain.com -> ex***@domain.com
 */
export function maskEmail(value: string): string {
  if (!value || !value.includes('@')) {
    return '***';
  }
  const [localPart, domain] = value.split('@');
  if (localPart.length <= 2) {
    return `${localPart[0]}***@${domain}`;
  }
  const prefix = localPart.slice(0, 2);
  return `${prefix}***@${domain}`;
}

/**
 * 脱敏手机号
 * 示例: 13812345678 -> 138***78
 */
export function maskPhone(value: string): string {
  if (!value || value.length < 8) {
    return '***';
  }
  const prefixLen = 3;
  const suffixLen = 2;
  const prefix = value.slice(0, prefixLen);
  const suffix = value.slice(-suffixLen);
  return `${prefix}***${suffix}`;
}

/**
 * 脱敏 IP 地址
 * 示例: 192.168.1.100 -> 192.168.*.*
 */
export function maskIpAddress(value: string): string {
  if (!value) {
    return '***';
  }
  const parts = value.split('.');
  if (parts.length !== 4) {
    return '***';
  }
  return `${parts[0]}.${parts[1]}.*.*`;
}

/**
 * 脱敏密码/密钥（完全隐藏）
 */
export function maskPassword(): string {
  return '[REDACTED]';
}

/**
 * 通用脱敏（保留首尾各2位）
 */
export function maskDefault(value: string): string {
  if (!value || value.length < 6) {
    return '***';
  }
  const prefix = value.slice(0, 2);
  const suffix = value.slice(-2);
  return `${prefix}***${suffix}`;
}

/**
 * 根据规则脱敏值
 */
export function maskValue(value: unknown, rule: MaskRule): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value !== 'string') {
    return value;
  }

  switch (rule) {
    case 'api_key':
      return maskApiKey(value);
    case 'email':
      return maskEmail(value);
    case 'phone':
      return maskPhone(value);
    case 'ip':
      return maskIpAddress(value);
    case 'password':
    case 'secret':
      return maskPassword();
    default:
      return maskDefault(value);
  }
}

/**
 * 获取字段的脱敏规则
 */
export function getFieldMaskRule(fieldName: string): MaskRule | null {
  const normalizedField = fieldName.toLowerCase();
  return SENSITIVE_FIELD_RULES[normalizedField] || null;
}

/**
 * 判断字段名是否为敏感字段
 */
export function isSensitiveField(fieldName: string): boolean {
  return getFieldMaskRule(fieldName) !== null;
}

/**
 * 脱敏对象中的敏感字段
 *
 * @param obj 要脱敏的对象
 * @param additionalFields 额外的敏感字段列表
 * @returns 脱敏后的对象
 */
export function maskSensitiveData<T extends Record<string, unknown>>(
  obj: T,
  additionalFields: string[] = [],
): T {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // 检查是否为敏感字段
    const rule = getFieldMaskRule(key);

    if (rule) {
      // 使用对应规则脱敏
      result[key] = maskValue(value, rule);
    } else if (
      additionalFields.some((f) => f.toLowerCase() === key.toLowerCase())
    ) {
      // 额外的敏感字段使用默认规则
      result[key] = maskValue(value, 'default');
    } else if (typeof value === 'object' && value !== null) {
      // 递归处理嵌套对象
      if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === 'object' && item !== null
            ? maskSensitiveData(
                item as Record<string, unknown>,
                additionalFields,
              )
            : item,
        );
      } else {
        result[key] = maskSensitiveData(
          value as Record<string, unknown>,
          additionalFields,
        );
      }
    } else {
      result[key] = value;
    }
  }

  return result as T;
}

/**
 * 脱敏审计日志详情
 *
 * @param detail 审计日志详情对象
 * @returns 脱敏后的详情
 */
export function maskAuditLogDetail<T extends Record<string, unknown>>(
  detail: T,
): T {
  return maskSensitiveData(detail);
}
