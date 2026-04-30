/**
 * SKILL.md 解析工具
 * 用于解析技能文件的 YAML frontmatter 和提取配置需求
 */
import * as yaml from 'js-yaml';
import {
  SkillConfigRequirements,
  SkillEligibility,
  SkillFrontmatter,
  SkillInvocationMode,
} from '@repo/contracts';

/**
 * 解析后的 SKILL.md 内容
 */
export interface ParsedSkillMd {
  /** 技能名称 */
  name: string;
  /** 版本 */
  version: string;
  /** 描述 */
  description: string;
  /** 主页 */
  homepage?: string;
  /** 仓库 */
  repository?: string;
  /** 用户可调用 */
  userInvocable?: boolean;
  /** 标签 */
  tags?: string[];
  /** 元数据（包含 openclaw.requires 等） */
  metadata?: Record<string, unknown>;
  /** 原始 frontmatter 对象 */
  frontmatter: Record<string, unknown>;
  /** Markdown 正文内容 */
  content: string;
}

/**
 * OpenClaw 特定的元数据结构
 */
export interface OpenClawMetadata {
  emoji?: string;
  userInvocable?: boolean;
  disableModelInvocation?: boolean;
  commandDispatch?: boolean;
  commandTool?: string;
  commandArgMode?: 'raw' | 'argv';
  requires?: {
    env?: string[];
    bins?: string[];
    config?: string[];
    os?: string[];
    mcp?: string[];
  };
  primaryEnv?: string;
  mcpServers?: unknown[];
}

/**
 * Skill 中定义的 MCP Server 配置
 */
export interface SkillMcpConfig {
  /** MCP Server 名称 */
  server: string;
  /** 服务器类型：stdio、http、container、git */
  type: 'stdio' | 'http' | 'streamableHttp' | 'sse' | 'container' | 'git';
  // stdio 类型字段
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // http 类型字段
  url?: string;
  headers?: Record<string, string>;
  // container 类型字段
  image?: string;
  imageTag?: string;
  containerPort?: number;
  containerEnv?: Record<string, string>;
  healthCheckPath?: string;
  // git 类型字段
  gitRepository?: string;
  gitBranch?: string;
  gitTag?: string;
  dockerfile?: string;
  buildArgs?: Record<string, string>;
}

/**
 * 解析 SKILL.md 内容
 * 提取 YAML frontmatter 和 Markdown 内容
 */
export function parseSkillMd(mdContent: string): ParsedSkillMd {
  // 匹配 YAML frontmatter (--- ... ---)
  const frontmatterMatch = mdContent.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);

  if (!frontmatterMatch) {
    // 没有 frontmatter，整个内容作为 Markdown
    return {
      name: '',
      version: '1.0.0',
      description: '',
      content: mdContent,
      frontmatter: {},
    };
  }

  const [, yamlContent, markdownContent] = frontmatterMatch;

  // 使用 js-yaml 解析 YAML frontmatter
  let frontmatter: Record<string, unknown> = {};
  try {
    const parsed = yaml.load(yamlContent);
    frontmatter =
      parsed && typeof parsed === 'object'
        ? (parsed as Record<string, unknown>)
        : {};
  } catch {
    // YAML 解析失败，使用空对象
  }

  return {
    name: (frontmatter.name as string) || '',
    version: String(frontmatter.version || '1.0.0'),
    description: (frontmatter.description as string) || '',
    homepage: frontmatter.homepage as string | undefined,
    repository: frontmatter.repository as string | undefined,
    userInvocable: frontmatter['user-invocable'] as boolean | undefined,
    tags: frontmatter.tags as string[] | undefined,
    metadata: frontmatter.metadata as Record<string, unknown> | undefined,
    content: markdownContent.trim(),
    frontmatter,
  };
}

/**
 * 从解析后的 SKILL.md 中提取 OpenClaw 配置需求
 */
export function extractConfigRequirements(
  parsed: ParsedSkillMd,
): SkillConfigRequirements | undefined {
  const metadata = parsed.metadata;
  if (!metadata) return undefined;

  const openclaw = metadata.openclaw as OpenClawMetadata | undefined;
  if (!openclaw) return undefined;

  const requires = openclaw.requires;
  if (!requires) return undefined;

  const envList = requires.env;
  const primaryEnv = openclaw.primaryEnv;
  const emoji = openclaw.emoji;

  const result: SkillConfigRequirements = {};

  if (Array.isArray(envList) && envList.length > 0) {
    result.env = envList.map((name) => ({
      name,
      required: true,
      isPrimary: name === primaryEnv,
    }));
  }

  if (Array.isArray(requires.bins) && requires.bins.length > 0) {
    result.bins = requires.bins;
  }

  if (Array.isArray(requires.config) && requires.config.length > 0) {
    result.config = requires.config;
  }

  if (Array.isArray(requires.os) && requires.os.length > 0) {
    result.os = requires.os;
  }

  if (Array.isArray(requires.mcp) && requires.mcp.length > 0) {
    result.requiresMcp = requires.mcp;
  }

  if (emoji) {
    result.emoji = emoji;
  }

  if (primaryEnv) {
    result.primaryEnv = primaryEnv;
  }

  if (Object.keys(result).length === 0) {
    return undefined;
  }

  return result;
}

/**
 * 提取 OpenClaw metadata（结构化）
 */
export function extractOpenClawMetadata(
  parsed: ParsedSkillMd,
): OpenClawMetadata | undefined {
  const metadata = parsed.metadata;
  if (!metadata || typeof metadata !== 'object') return undefined;

  const openclaw = (metadata as Record<string, unknown>).openclaw;
  if (!openclaw || typeof openclaw !== 'object') return undefined;

  return openclaw as OpenClawMetadata;
}

/**
 * 提取 Skill frontmatter（结构化）
 */
export function extractSkillFrontmatter(
  parsed: ParsedSkillMd,
): SkillFrontmatter | undefined {
  const openclaw = extractOpenClawMetadata(parsed);

  const frontmatter: SkillFrontmatter = {
    name: parsed.name || undefined,
    description: parsed.description || undefined,
    version: parsed.version || undefined,
  };

  if (openclaw) {
    frontmatter.metadata = {
      openclaw: {
        userInvocable: openclaw.userInvocable,
        disableModelInvocation: openclaw.disableModelInvocation,
        commandDispatch: openclaw.commandDispatch,
        commandTool: openclaw.commandTool,
        commandArgMode: openclaw.commandArgMode,
        requires: extractConfigRequirements(parsed),
      },
    };
  }

  if (
    !frontmatter.name &&
    !frontmatter.description &&
    !frontmatter.version &&
    !frontmatter.metadata
  ) {
    return undefined;
  }

  return frontmatter;
}

/**
 * 计算技能调用模式
 */
export function extractInvocationMode(
  parsed: ParsedSkillMd,
): SkillInvocationMode {
  const openclaw = extractOpenClawMetadata(parsed);

  const userInvocable =
    openclaw?.userInvocable ?? parsed.userInvocable ?? false;
  const disableModelInvocation = openclaw?.disableModelInvocation ?? false;

  if (userInvocable && !disableModelInvocation) {
    return 'both';
  }
  if (userInvocable) {
    return 'manual';
  }
  return 'model';
}

/**
 * 提取技能调用能力
 */
export function extractInvocationCapabilities(parsed: ParsedSkillMd): {
  invocationMode: SkillInvocationMode;
  dispatchable: boolean;
} {
  const openclaw = extractOpenClawMetadata(parsed);

  return {
    invocationMode: extractInvocationMode(parsed),
    dispatchable: Boolean(openclaw?.commandDispatch),
  };
}

/**
 * 评估技能可执行性
 */
export function evaluateSkillEligibility(
  requirements: SkillConfigRequirements | undefined,
  runtime: {
    env?: Record<string, string | undefined>;
    bins?: string[];
    config?: Record<string, unknown>;
    os?: string;
    mcp?: string[];
  },
): SkillEligibility {
  if (!requirements) {
    return { eligible: true, reasons: [] };
  }

  const missing: NonNullable<SkillEligibility['missing']> = {};
  const reasons: string[] = [];

  if (requirements.env?.length) {
    const missingEnv = requirements.env
      .map((item) => item.name)
      .filter((name) => !runtime.env?.[name]);
    if (missingEnv.length) {
      missing.env = missingEnv;
      reasons.push(`Missing env: ${missingEnv.join(', ')}`);
    }
  }

  if (requirements.bins?.length) {
    const runtimeBins = new Set(runtime.bins || []);
    const missingBins = requirements.bins.filter(
      (bin) => !runtimeBins.has(bin),
    );
    if (missingBins.length) {
      missing.bins = missingBins;
      reasons.push(`Missing bins: ${missingBins.join(', ')}`);
    }
  }

  if (requirements.config?.length) {
    const missingConfig = requirements.config.filter(
      (key) => runtime.config?.[key] === undefined,
    );
    if (missingConfig.length) {
      missing.config = missingConfig;
      reasons.push(`Missing config: ${missingConfig.join(', ')}`);
    }
  }

  if (requirements.os?.length && runtime.os) {
    if (!requirements.os.includes(runtime.os)) {
      missing.os = [runtime.os];
      reasons.push(`Unsupported OS: ${runtime.os}`);
    }
  }

  if (requirements.requiresMcp?.length) {
    const runtimeMcp = new Set(runtime.mcp || []);
    const missingMcp = requirements.requiresMcp.filter(
      (server) => !runtimeMcp.has(server),
    );
    if (missingMcp.length) {
      missing.mcp = missingMcp;
      reasons.push(`Missing MCP: ${missingMcp.join(', ')}`);
    }
  }

  const hasMissing = Object.keys(missing).length > 0;

  return {
    eligible: !hasMissing,
    reasons,
    missing: hasMissing ? missing : undefined,
  };
}

/**
 * 从 SKILL.md 内容中直接提取配置需求
 * 便捷函数，合并解析和提取两步
 */
export function parseSkillMdConfigRequirements(
  mdContent: string,
): SkillConfigRequirements | undefined {
  const parsed = parseSkillMd(mdContent);
  return extractConfigRequirements(parsed);
}

/**
 * 从解析后的 SKILL.md 中提取 MCP Server 配置
 * 用于自动创建 MCP Server
 */
export function extractMcpConfig(
  parsed: ParsedSkillMd,
): SkillMcpConfig | undefined {
  const metadata = parsed.metadata;
  if (!metadata) return undefined;

  const mcp = metadata.mcp as Record<string, unknown> | undefined;
  if (!mcp) return undefined;

  const server = mcp.server as string | undefined;
  const type = mcp.type as string | undefined;

  if (!server || !type) return undefined;

  // 标准化类型
  const validTypes = [
    'stdio',
    'http',
    'streamableHttp',
    'sse',
    'container',
    'git',
  ];
  const normalizedType = validTypes.includes(type) ? type : 'stdio';

  const config: SkillMcpConfig = {
    server,
    type: normalizedType as SkillMcpConfig['type'],
  };

  // http 类型字段
  if (['http', 'streamableHttp', 'sse'].includes(type)) {
    config.url = mcp.url as string | undefined;
    config.headers = mcp.headers as Record<string, string> | undefined;
  }

  // stdio 类型字段
  if (type === 'stdio') {
    config.command = mcp.command as string | undefined;
    config.args = mcp.args as string[] | undefined;
    config.env = mcp.env as Record<string, string> | undefined;
  }

  // container 类型字段
  if (type === 'container') {
    config.image = mcp.image as string | undefined;
    config.imageTag = mcp.imageTag as string | undefined;
    config.containerPort = mcp.containerPort as number | undefined;
    config.containerEnv = mcp.containerEnv as
      | Record<string, string>
      | undefined;
    config.healthCheckPath = mcp.healthCheckPath as string | undefined;
  }

  // git 类型字段
  if (type === 'git') {
    config.gitRepository = mcp.gitRepository as string | undefined;
    config.gitBranch = mcp.gitBranch as string | undefined;
    config.gitTag = mcp.gitTag as string | undefined;
    config.dockerfile = mcp.dockerfile as string | undefined;
    config.buildArgs = mcp.buildArgs as Record<string, string> | undefined;
    // git 类型也支持 container 相关字段（构建后运行时使用）
    config.containerPort = mcp.containerPort as number | undefined;
    config.containerEnv = mcp.containerEnv as
      | Record<string, string>
      | undefined;
    config.healthCheckPath = mcp.healthCheckPath as string | undefined;
  }

  return config;
}

/**
 * 从解析后的 SKILL.md 中提取单个 MCP Server 配置（内部辅助函数）
 */
function parseSingleMcpConfig(
  mcp: Record<string, unknown>,
): SkillMcpConfig | null {
  const server = mcp.server as string | undefined;
  const type = mcp.type as string | undefined;
  if (!server || !type) return null;

  const validTypes = [
    'stdio',
    'http',
    'streamableHttp',
    'sse',
    'container',
    'git',
  ];
  const normalizedType = validTypes.includes(type) ? type : 'stdio';

  const config: SkillMcpConfig = {
    server,
    type: normalizedType as SkillMcpConfig['type'],
  };

  if (['http', 'streamableHttp', 'sse'].includes(type)) {
    config.url = mcp.url as string | undefined;
    config.headers = mcp.headers as Record<string, string> | undefined;
  }
  if (type === 'stdio') {
    config.command = mcp.command as string | undefined;
    config.args = mcp.args as string[] | undefined;
    config.env = mcp.env as Record<string, string> | undefined;
  }
  if (type === 'container') {
    config.image = mcp.image as string | undefined;
    config.imageTag = mcp.imageTag as string | undefined;
    config.containerPort = mcp.containerPort as number | undefined;
    config.containerEnv = mcp.containerEnv as
      | Record<string, string>
      | undefined;
    config.healthCheckPath = mcp.healthCheckPath as string | undefined;
  }
  if (type === 'git') {
    config.gitRepository = mcp.gitRepository as string | undefined;
    config.gitBranch = mcp.gitBranch as string | undefined;
    config.gitTag = mcp.gitTag as string | undefined;
    config.dockerfile = mcp.dockerfile as string | undefined;
    config.buildArgs = mcp.buildArgs as Record<string, string> | undefined;
    config.containerPort = mcp.containerPort as number | undefined;
    config.containerEnv = mcp.containerEnv as
      | Record<string, string>
      | undefined;
    config.healthCheckPath = mcp.healthCheckPath as string | undefined;
  }

  return config;
}

/**
 * 从解析后的 SKILL.md 中提取多个 MCP Server 配置（新格式：mcpServers 数组）
 * 兼容旧格式：单个 mcp 配置
 */
export function extractMcpConfigs(parsed: ParsedSkillMd): SkillMcpConfig[] {
  const metadata = parsed.metadata;
  if (!metadata) return [];

  const openclaw = metadata.openclaw as Record<string, unknown> | undefined;
  if (!openclaw) return [];

  // 优先读取 mcpServers 数组（新格式）
  const mcpServers = openclaw.mcpServers as unknown[] | undefined;
  if (Array.isArray(mcpServers) && mcpServers.length > 0) {
    return mcpServers
      .map((item) => parseSingleMcpConfig(item as Record<string, unknown>))
      .filter((c): c is SkillMcpConfig => c !== null);
  }

  // 兼容旧格式：单个 mcp 配置（metadata.mcp）
  const single = extractMcpConfig(parsed);
  return single ? [single] : [];
}

/**
 * 从 SKILL.md 内容中直接提取多个 MCP 配置
 */
export function parseSkillMdMcpConfigs(mdContent: string): SkillMcpConfig[] {
  const parsed = parseSkillMd(mdContent);
  return extractMcpConfigs(parsed);
}

/**
 * 构建 Skill definition 对象
 * 用于存储到数据库
 */
export function buildSkillDefinition(
  parsed: ParsedSkillMd,
  options?: {
    nameZh?: string | null;
    descriptionZh?: string | null;
    sourceUrl?: string;
  },
): Record<string, unknown> {
  return {
    name: parsed.name,
    nameZh: options?.nameZh || null,
    description: parsed.description,
    descriptionZh: options?.descriptionZh || null,
    version: parsed.version,
    homepage: parsed.homepage,
    repository: parsed.repository,
    userInvocable: parsed.userInvocable,
    tags: parsed.tags,
    metadata: parsed.metadata,
    content: parsed.content,
    frontmatter: parsed.frontmatter,
    sourceUrl: options?.sourceUrl,
  };
}
