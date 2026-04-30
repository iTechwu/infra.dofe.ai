/**
 * Skill 压缩包/文件规范验证工具
 * 用于验证上传的 skill 是否符合 OpenClaw skill 规范和标准
 */
import * as path from 'path';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// yaml is used for parsing YAML content in skill files (indirect)
import * as yaml from 'js-yaml';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
// yaml is used indirectly through yaml.load
import { z } from 'zod';
import { parseSkillMd, type ParsedSkillMd } from './skill-md-parser.util';

// ============================================================================
// 常量定义
// ============================================================================

/** 允许的文件扩展名 */
export const ALLOWED_FILE_EXTENSIONS = [
  '.md',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.json',
  '.yaml',
  '.yml',
  '.sh',
  '.py',
  '.txt',
  '.mjs',
  '.cjs',
  '.html',
  '.css',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
];

/** 必需的核心文件 */
export const REQUIRED_FILES = ['SKILL.md'] as const;

/** 推荐的文件结构 */
export const RECOMMENDED_PATHS = [
  'SKILL.md',
  'scripts/',
  'references/',
  'tools/',
  'hooks/',
  'src/',
] as const;

/** 禁止的文件名模式 */
export const FORBIDDEN_PATTERNS = [
  /^\.env(\.|$)/i,
  /^credentials/i,
  /^private_key/i,
  /^_meta\.json$/i,
  /\.pem$/i,
  /\.key$/i,
  /\.p12$/i,
  /\.pfx$/i,
  /\.cer$/i,
  /\.crt$/i,
  /\.der$/i,
] as const;

/** 允许的可执行脚本 */
export const ALLOWED_SCRIPTS = [
  'scripts/init.sh',
  'scripts/install.sh',
] as const;

// ============================================================================
// Zod Schemas 用于验证
// ============================================================================

/** OpenClaw Plugin Manifest Schema */
export const OpenClawPluginManifestSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  version: z.string().min(1).max(20),
  kind: z.string().optional(),
  description: z.string().min(1).max(1000).optional(),
});

export type OpenClawPluginManifest = z.infer<
  typeof OpenClawPluginManifestSchema
>;

/** SKILL.md Frontmatter Schema */
export const SkillFrontmatterValidationSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().min(1).max(20),
  description: z.string().min(1).max(500).optional(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
  tags: z.array(z.string()).optional(),
  metadata: z
    .object({
      openclaw: z
        .object({
          userInvocable: z.boolean().optional(),
          disableModelInvocation: z.boolean().optional(),
          commandDispatch: z.boolean().optional(),
          commandTool: z.string().optional(),
          commandArgMode: z.enum(['raw', 'argv']).optional(),
          requires: z
            .object({
              env: z.array(z.string()).optional(),
              bins: z.array(z.string()).optional(),
              config: z.array(z.string()).optional(),
              os: z.array(z.string()).optional(),
              mcp: z.array(z.string()).optional(),
            })
            .optional(),
        })
        .optional(),
    })
    .optional(),
});

// ============================================================================
// 验证结果类型
// ============================================================================

export interface SkillValidationError {
  /** 错误代码 */
  code:
    | 'MISSING_REQUIRED_FILE'
    | 'FORBIDDEN_FILE'
    | 'INVALID_FILE_TYPE'
    | 'FILE_TOO_LARGE'
    | 'PATH_TRAVERSAL'
    | 'EMPTY_ARCHIVE'
    | 'INVALID_FRONTMATTER'
    | 'INVALID_MANIFEST'
    | 'INVALID_SCRIPT'
    | 'MALICIOUS_CONTENT'
    | 'TOTAL_SIZE_EXCEEDED'
    | 'TOO_MANY_FILES';
  /** 错误消息 */
  message: string;
  /** 相关的文件路径（如果有） */
  filePath?: string;
  /** 详细信息 */
  details?: Record<string, unknown>;
}

export interface SkillValidationWarning {
  /** 警告代码 */
  code:
    | 'MISSING_RECOMMENDED_FILE'
    | 'NON_STANDARD_STRUCTURE'
    | 'DEPRECATED_PATTERN'
    | 'EMPTY_FILE';
  /** 警告消息 */
  message: string;
  /** 相关的文件路径（如果有） */
  filePath?: string;
}

export interface SkillValidationResult {
  /** 是否通过验证 */
  valid: boolean;
  /** 错误列表 */
  errors: SkillValidationError[];
  /** 警告列表 */
  warnings: SkillValidationWarning[];
  /** 解析出的 skill 信息（如果可用） */
  skillInfo?: {
    name?: string;
    version?: string;
    description?: string;
    hasSkillMd: boolean;
    hasPluginManifest: boolean;
    hasInitScript: boolean;
    fileCount: number;
    totalSize: number;
  };
}

export interface SkillFile {
  relativePath: string;
  content: string;
  size?: number;
}

// ============================================================================
// 验证器实现
// ============================================================================

export class SkillValidator {
  private readonly maxFileSize: number;
  private readonly maxTotalSize: number;
  private readonly maxFileCount: number;

  constructor(options?: {
    maxFileSize?: number;
    maxTotalSize?: number;
    maxFileCount?: number;
  }) {
    this.maxFileSize = options?.maxFileSize ?? 1024 * 1024; // 1MB
    this.maxTotalSize = options?.maxTotalSize ?? 10 * 1024 * 1024; // 10MB
    this.maxFileCount = options?.maxFileCount ?? 50;
  }

  /**
   * 验证 skill 文件集合
   */
  validate(files: SkillFile[]): SkillValidationResult {
    const errors: SkillValidationError[] = [];
    const warnings: SkillValidationWarning[] = [];
    let totalSize = 0;

    // 基础检查
    if (files.length === 0) {
      errors.push({
        code: 'EMPTY_ARCHIVE',
        message: '压缩包为空，没有包含任何文件',
      });
      return { valid: false, errors, warnings };
    }

    if (files.length > this.maxFileCount) {
      errors.push({
        code: 'TOO_MANY_FILES',
        message: `文件数量超过限制 (最多 ${this.maxFileCount} 个文件)`,
        details: { count: files.length, limit: this.maxFileCount },
      });
    }

    // 检查必需文件
    const filePaths = files.map((f) => f.relativePath);
    for (const requiredFile of REQUIRED_FILES) {
      if (
        !filePaths.some(
          (p) =>
            p === requiredFile ||
            p.toLowerCase() === requiredFile.toLowerCase(),
        )
      ) {
        errors.push({
          code: 'MISSING_REQUIRED_FILE',
          message: `缺少必需文件: ${requiredFile}`,
          filePath: requiredFile,
        });
      }
    }

    // 验证每个文件
    const validFiles: SkillFile[] = [];
    for (const file of files) {
      const fileErrors = this.validateFile(file);
      errors.push(...fileErrors);

      if (fileErrors.length === 0) {
        validFiles.push(file);
        const fileSize = file.size ?? Buffer.byteLength(file.content, 'utf8');
        totalSize += fileSize;
      }
    }

    // 检查总大小
    if (totalSize > this.maxTotalSize) {
      errors.push({
        code: 'TOTAL_SIZE_EXCEEDED',
        message: `总文件大小超过限制 (最大 ${this.formatSize(this.maxTotalSize)})`,
        details: { totalSize, limit: this.maxTotalSize },
      });
    }

    // 检查推荐的文件结构
    this.checkRecommendedStructure(filePaths, warnings);

    // 解析 SKILL.md 获取更多信息
    const skillMdFile = validFiles.find((f) => f.relativePath === 'SKILL.md');
    let parsedSkill: ParsedSkillMd | undefined;
    if (skillMdFile?.content) {
      try {
        parsedSkill = parseSkillMd(skillMdFile.content);
        this.validateFrontmatter(parsedSkill, errors, warnings);
      } catch {
        // 解析失败不阻止安装，只是添加警告
        warnings.push({
          code: 'NON_STANDARD_STRUCTURE',
          message: 'SKILL.md 解析失败，请检查格式是否正确',
          filePath: 'SKILL.md',
        });
      }
    }

    // 检查 openclaw.plugin.json
    const pluginManifestFile = validFiles.find(
      (f) => f.relativePath === 'openclaw.plugin.json',
    );
    let pluginManifest: OpenClawPluginManifest | undefined;
    if (pluginManifestFile?.content) {
      try {
        const parsed = JSON.parse(pluginManifestFile.content);
        const result = OpenClawPluginManifestSchema.safeParse(parsed);
        if (result.success) {
          pluginManifest = result.data;
        } else {
          warnings.push({
            code: 'NON_STANDARD_STRUCTURE' as const,
            message: 'openclaw.plugin.json 格式不正确',
            filePath: 'openclaw.plugin.json',
          });
        }
      } catch {
        warnings.push({
          code: 'NON_STANDARD_STRUCTURE' as const,
          message: 'openclaw.plugin.json 不是有效的 JSON',
          filePath: 'openclaw.plugin.json',
        });
      }
    }

    // 检查是否有 init 脚本
    const hasInitScript = validFiles.some(
      (f) => f.relativePath === 'scripts/init.sh',
    );

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      skillInfo: {
        name: parsedSkill?.name || pluginManifest?.name,
        version: parsedSkill?.version || pluginManifest?.version,
        description: parsedSkill?.description || pluginManifest?.description,
        hasSkillMd: !!skillMdFile,
        hasPluginManifest: !!pluginManifestFile,
        hasInitScript,
        fileCount: validFiles.length,
        totalSize,
      },
    };
  }

  /**
   * 验证单个文件
   */
  private validateFile(file: SkillFile): SkillValidationError[] {
    const errors: SkillValidationError[] = [];
    const normalizedPath = path.normalize(file.relativePath);

    // 检查路径遍历
    if (normalizedPath.startsWith('..') || path.isAbsolute(normalizedPath)) {
      errors.push({
        code: 'PATH_TRAVERSAL',
        message: '文件路径包含不安全的路径遍历',
        filePath: file.relativePath,
      });
      return errors;
    }

    // 检查禁止的文件
    for (const pattern of FORBIDDEN_PATTERNS) {
      if (pattern.test(normalizedPath)) {
        errors.push({
          code: 'FORBIDDEN_FILE',
          message: `禁止上传敏感文件: ${normalizedPath}`,
          filePath: file.relativePath,
        });
        return errors;
      }
    }

    // 检查文件扩展名
    const ext = path.extname(normalizedPath).toLowerCase();
    if (ext && !ALLOWED_FILE_EXTENSIONS.includes(ext)) {
      errors.push({
        code: 'INVALID_FILE_TYPE',
        message: `不支持的文件类型: ${ext}`,
        filePath: file.relativePath,
        details: { allowedExtensions: ALLOWED_FILE_EXTENSIONS },
      });
      return errors;
    }

    // 检查文件大小
    const fileSize = file.size ?? Buffer.byteLength(file.content, 'utf8');
    if (fileSize > this.maxFileSize) {
      errors.push({
        code: 'FILE_TOO_LARGE',
        message: `文件超过大小限制 (最大 ${this.formatSize(this.maxFileSize)})`,
        filePath: file.relativePath,
        details: { size: fileSize, limit: this.maxFileSize },
      });
      return errors;
    }

    // 检查脚本文件（只允许特定位置的脚本）
    if (normalizedPath.endsWith('.sh')) {
      const isAllowed = (ALLOWED_SCRIPTS as readonly string[]).includes(
        normalizedPath,
      );
      if (!isAllowed) {
        errors.push({
          code: 'INVALID_SCRIPT',
          message: `脚本文件只能放在 ${ALLOWED_SCRIPTS.join(', ')}`,
          filePath: file.relativePath,
        });
        return errors;
      }
    }

    // 检查恶意内容（简单的启发式检查）
    if (this.hasMaliciousContent(file.content)) {
      errors.push({
        code: 'MALICIOUS_CONTENT',
        message: '文件包含可疑内容',
        filePath: file.relativePath,
      });
      return errors;
    }

    return errors;
  }

  /**
   * 检查推荐的文件结构
   */
  private checkRecommendedStructure(
    filePaths: string[],
    warnings: SkillValidationWarning[],
  ): void {
    const hasScripts = filePaths.some((p) => p.startsWith('scripts/'));
    const hasReferences = filePaths.some((p) => p.startsWith('references/'));

    if (!hasScripts && !hasReferences) {
      warnings.push({
        code: 'NON_STANDARD_STRUCTURE',
        message: '推荐包含 scripts/ 或 references/ 目录以获得更好的组织',
      });
    }
  }

  /**
   * 验证 frontmatter
   */
  private validateFrontmatter(
    parsed: ParsedSkillMd,
    errors: SkillValidationError[],
    warnings: SkillValidationWarning[],
  ): void {
    const result = SkillFrontmatterValidationSchema.safeParse(
      parsed.frontmatter,
    );

    if (!result.success) {
      for (const issue of result.error.issues) {
        warnings.push({
          code: 'NON_STANDARD_STRUCTURE' as const,
          message: `SKILL.md frontmatter: ${issue.path.join('.')} - ${issue.message}`,
          filePath: 'SKILL.md',
        });
      }
    }

    // 检查必需字段
    if (!parsed.name) {
      warnings.push({
        code: 'MISSING_RECOMMENDED_FILE',
        message: 'SKILL.md 中缺少 name 字段',
        filePath: 'SKILL.md',
      });
    }

    if (!parsed.version) {
      warnings.push({
        code: 'MISSING_RECOMMENDED_FILE',
        message: 'SKILL.md 中缺少 version 字段',
        filePath: 'SKILL.md',
      });
    }
  }

  /**
   * 简单的恶意内容检查
   */
  private hasMaliciousContent(content: string): boolean {
    // 检查常见的危险模式（非常基础的检查）
    const dangerousPatterns = [
      /rm\s+-rf\s+\/\s*/i,
      /mkfs\s+/i,
      /dd\s+if=/i,
      /:\(\)\s*\{[\s\S]*:\s*\|\s*:\s*&\s*\};\s*:/, // Fork bomb
    ];

    return dangerousPatterns.some((p) => p.test(content));
  }

  /**
   * 格式化文件大小
   */
  private formatSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// ============================================================================
// 导出默认验证器实例
// ============================================================================

export const defaultSkillValidator = new SkillValidator();

/**
 * 便捷函数：验证 skill 文件
 */
export function validateSkillFiles(files: SkillFile[]): SkillValidationResult {
  return defaultSkillValidator.validate(files);
}
