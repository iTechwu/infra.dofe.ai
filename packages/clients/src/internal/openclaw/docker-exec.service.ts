/**
 * Docker Exec 服务
 *
 * 提供统一的 Docker 容器命令执行接口
 * 使用 Dockerode API 替代 CLI 命令，避免环境变量配置问题
 */
import { Inject, Injectable } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { firstValueFrom, timeout, catchError } from 'rxjs';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as stream from 'stream';
import { DockerService } from '@dofe/infra-docker';

/**
 * Docker exec 执行选项
 */
export interface DockerExecOptions {
  /** 执行超时（毫秒），默认 15000 */
  timeout?: number;
  /** 执行用户，默认容器默认用户 */
  user?: string;
  /** 是否在失败时抛出错误，默认 false */
  throwOnError?: boolean;
  /** 是否返回 stderr，默认 false */
  includeStderr?: boolean;
  /** 是否等待容器就绪（遇到 409 错误时自动重试），默认 false */
  waitForReady?: boolean;
  /** 等待容器就绪的最大时间（毫秒），默认 30000 */
  maxWaitMs?: number;
}

/**
 * Docker exec 执行结果
 */
export interface DockerExecResult {
  /** stdout 输出 */
  stdout: string;
  /** stderr 输出 */
  stderr: string;
  /** 是否执行成功（无错误抛出） */
  success: boolean;
  /** 执行耗时（毫秒） */
  durationMs: number;
}

@Injectable()
export class DockerExecService {
  private readonly defaultTimeout = 15000;
  private readonly dockerSocketPath = '/var/run/docker.sock';

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly httpService: HttpService,
    private readonly dockerService: DockerService,
  ) {}

  /**
   * 等待容器进入运行状态
   * 解决 HTTP 409 错误：容器停止或重启时无法执行 exec
   *
   * @param containerId 容器 ID
   * @param maxWaitMs 最大等待时间（毫秒）
   * @param pollIntervalMs 轮询间隔（毫秒）
   */
  async waitForContainerRunning(
    containerId: string,
    maxWaitMs: number = 30000,
    pollIntervalMs: number = 1000,
  ): Promise<boolean> {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      try {
        const inspectUrl = `http://localhost/containers/${containerId}/json`;
        const response = await firstValueFrom(
          this.httpService
            .get(inspectUrl, {
              socketPath: this.dockerSocketPath,
              timeout: 5000,
            })
            .pipe(
              timeout(5000),
              catchError((error) => {
                throw error;
              }),
            ),
        );

        const state = response.data?.State;
        if (state?.Status === 'running') {
          this.logger.debug('DockerExecService: Container is running', {
            containerId: containerId.substring(0, 12),
          });
          return true;
        }

        this.logger.debug(
          'DockerExecService: Container not running, waiting...',
          {
            containerId: containerId.substring(0, 12),
            status: state?.Status,
          },
        );

        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        // 容器不存在（404）时立即返回，不再等待
        if (
          errorMessage.includes('404') ||
          errorMessage.includes('no such container')
        ) {
          this.logger.warn(
            'DockerExecService: Container does not exist, stopping wait',
            {
              containerId: containerId.substring(0, 12),
              error: errorMessage,
            },
          );
          return false;
        }
        this.logger.warn(
          'DockerExecService: Failed to check container status',
          {
            containerId: containerId.substring(0, 12),
            error: errorMessage,
          },
        );
        await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
      }
    }

    this.logger.error(
      'DockerExecService: Timeout waiting for container to be running',
      {
        containerId: containerId.substring(0, 12),
        maxWaitMs,
      },
    );
    return false;
  }

  /**
   * 在容器内执行命令
   *
   * @param containerId 容器 ID
   * @param cmd 命令数组，如 ['node', '-e', script]
   * @param options 执行选项
   * @returns 执行结果
   */
  async executeCommand(
    containerId: string,
    cmd: string[],
    options?: DockerExecOptions,
  ): Promise<DockerExecResult> {
    const {
      timeout: execTimeout = this.defaultTimeout,
      user,
      throwOnError = false,
      waitForReady = false,
      maxWaitMs = 30000,
    } = options ?? {};

    const startTime = Date.now();
    const maxRetries = 3; // 409 错误最大重试次数
    const retryDelayMs = 1000; // 重试间隔

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // 如果需要等待容器就绪，先检查容器状态
        if (waitForReady || attempt > 0) {
          const isReady = await this.waitForContainerRunning(
            containerId,
            maxWaitMs,
          );
          if (!isReady) {
            return {
              stdout: '',
              stderr: 'Container is not running after waiting',
              success: false,
              durationMs: Date.now() - startTime,
            };
          }
        }

        // Step 1: 创建 exec 实例
        const execId = await this.createExec(containerId, cmd, {
          user,
          timeout: execTimeout,
        });

        // Step 2: 启动 exec 并获取输出
        const rawOutput = await this.startExec(execId, execTimeout);

        // Step 3: 解析输出
        const { stdout, stderr } = this.parseOutput(rawOutput);

        this.logger.debug('DockerExecService: 命令执行成功', {
          containerId,
          cmd: cmd.join(' ').substring(0, 100),
          durationMs: Date.now() - startTime,
          stdoutLength: stdout.length,
          attempt: attempt + 1,
        });

        return {
          stdout,
          stderr,
          success: true,
          durationMs: Date.now() - startTime,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        const errorMessage = lastError.message;

        // 检查是否是 409 冲突错误（容器正在重启或状态不一致）
        if (errorMessage.includes('409') || errorMessage.includes('Conflict')) {
          this.logger.warn('DockerExecService: 容器状态冲突，等待重试', {
            containerId,
            attempt: attempt + 1,
            maxRetries,
            error: errorMessage,
          });

          // 如果还有重试机会，等待后重试
          if (attempt < maxRetries - 1) {
            await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
            continue;
          }
        }

        // 非 409 错误或重试次数用尽，记录错误
        this.logger.error('DockerExecService: 命令执行失败', {
          containerId,
          cmd: cmd.join(' ').substring(0, 100),
          error: errorMessage,
          durationMs: Date.now() - startTime,
          attempts: attempt + 1,
        });

        if (throwOnError) {
          throw error;
        }

        return {
          stdout: '',
          stderr: errorMessage,
          success: false,
          durationMs: Date.now() - startTime,
        };
      }
    }

    // 所有重试都失败
    return {
      stdout: '',
      stderr: lastError?.message || 'Max retries exceeded',
      success: false,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * 执行 Node.js 脚本
   *
   * @param containerId 容器 ID
   * @param script Node.js 脚本内容
   * @param options 执行选项
   */
  async executeNodeScript(
    containerId: string,
    script: string,
    options?: DockerExecOptions,
  ): Promise<DockerExecResult> {
    return this.executeCommand(containerId, ['node', '-e', script], options);
  }

  /**
   * 执行 Shell 命令
   *
   * @param containerId 容器 ID
   * @param command Shell 命令
   * @param options 执行选项
   */
  async executeShellCommand(
    containerId: string,
    command: string,
    options?: DockerExecOptions,
  ): Promise<DockerExecResult> {
    return this.executeCommand(containerId, ['sh', '-c', command], options);
  }

  /**
   * 验证名称是否安全（防止注入）
   *
   * @param name 要验证的名称
   * @returns 是否安全
   */
  isValidName(name: string): boolean {
    const safeNamePattern = /^[a-zA-Z0-9_\-.]+$/;
    return safeNamePattern.test(name);
  }

  /**
   * 复制文件到容器
   * 使用 Dockerode putArchive API 替代 docker cp CLI
   * 写入后自动修复文件权限为 node:node（OpenClaw 运行用户）
   *
   * @param containerId 容器 ID
   * @param sourcePath 宿主机文件路径
   * @param destPath 容器内目标路径（文件完整路径）
   * @param owner 文件所有者（默认 'node:node'，OpenClaw 运行用户）
   */
  async copyFileToContainer(
    containerId: string,
    sourcePath: string,
    destPath: string,
    owner: string = 'node:node',
  ): Promise<void> {
    try {
      // 读取源文件内容
      const fileContent = await fs.readFile(sourcePath);
      const fileName = path.basename(destPath);
      const destDir = path.dirname(destPath);

      // 创建 tar 包（Dockerode putArchive 需要 tar 格式）
      const tarBuffer = await this.createTarBuffer(fileName, fileContent);

      // 使用 Dockerode putArchive API
      // 注意：putArchive 的 path 参数是容器内的目录，不是完整文件路径
      await this.dockerService.putArchive(containerId, tarBuffer, destDir);

      // 修复文件权限：putArchive 写入的文件默认归 root 所有
      // OpenClaw 以 node 用户运行，需要 node:node 权限才能读取配置
      await this.executeCommand(containerId, ['chown', owner, destPath]);

      this.logger.info(
        'DockerExecService: File copied to container with correct permissions',
        {
          containerId: containerId.substring(0, 12),
          sourcePath,
          destPath,
          owner,
        },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('DockerExecService: Failed to copy file to container', {
        containerId: containerId.substring(0, 12),
        sourcePath,
        destPath,
        error: errorMessage,
      });
      throw new Error(`Failed to copy file to container: ${errorMessage}`);
    }
  }

  /**
   * 复制目录到容器
   * 使用 Dockerode putArchive API
   *
   * @param containerId 容器 ID
   * @param sourceDir 宿主机目录路径
   * @param destDir 容器内目标目录路径
   */
  async copyDirectoryToContainer(
    containerId: string,
    sourceDir: string,
    destDir: string,
  ): Promise<void> {
    try {
      // 获取源目录名，用于 tar 包中的路径前缀
      const dirName = path.basename(sourceDir);

      // 验证源目录存在
      const stat = await fs.stat(sourceDir);
      if (!stat.isDirectory()) {
        throw new Error(`Source path is not a directory: ${sourceDir}`);
      }

      // 创建目录的 tar 包（包含目录名前缀）
      const tarBuffer = await this.createTarBufferFromDirectory(
        sourceDir,
        dirName,
      );

      this.logger.info('DockerExecService: Created tar archive for directory', {
        containerId: containerId.substring(0, 12),
        sourceDir,
        dirName,
        tarBufferSize: tarBuffer.length,
      });

      // 使用 Dockerode putArchive API
      await this.dockerService.putArchive(containerId, tarBuffer, destDir);

      this.logger.info(
        'DockerExecService: Directory copied to container via Dockerode',
        {
          containerId: containerId.substring(0, 12),
          sourceDir,
          destDir,
        },
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        'DockerExecService: Failed to copy directory to container',
        {
          containerId: containerId.substring(0, 12),
          sourceDir,
          destDir,
          error: errorMessage,
        },
      );
      throw new Error(`Failed to copy directory to container: ${errorMessage}`);
    }
  }

  /**
   * 创建单个文件的 tar 包 Buffer
   * tar 格式：512 字节 header + 文件内容（填充到 512 字节对齐）+ 两个 512 字节的空 block 作为结束
   */
  private async createTarBuffer(
    fileName: string,
    content: Buffer,
  ): Promise<Buffer> {
    // tar header (512 bytes)
    const header = Buffer.alloc(512);

    // 文件名 (0-99)
    Buffer.from(fileName).copy(header, 0);

    // 文件模式 (100-107) - "0000644\0"
    Buffer.from('0000644\0').copy(header, 100);

    // UID (108-115) - "0000000\0"
    Buffer.from('0000000\0').copy(header, 108);

    // GID (116-123) - "0000000\0"
    Buffer.from('0000000\0').copy(header, 116);

    // 文件大小 (124-135) - 8 字节 octal
    const sizeStr = content.length.toString(8).padStart(11, '0') + '\0';
    Buffer.from(sizeStr).copy(header, 124);

    // mtime (136-147) - "00000000000\0"
    Buffer.from('00000000000\0').copy(header, 136);

    // checksum 占位 (148-155) - "        " (8 spaces)
    Buffer.from('        ').copy(header, 148);

    // type flag (156) - '0' for regular file
    header[156] = 0x30; // '0'

    // link name (157-256) - 空
    // magic (257-262) - "ustar\0"
    Buffer.from('ustar\0').copy(header, 257);

    // version (263-264) - "00"
    Buffer.from('00').copy(header, 263);

    // uname (265-296) - "root\0"
    Buffer.from('root\0').copy(header, 265);

    // gname (297-328) - "root\0"
    Buffer.from('root\0').copy(header, 297);

    // 计算 checksum
    let checksum = 0;
    for (let i = 0; i < 512; i++) {
      checksum += header[i];
    }
    // checksum 字段本身在计算时视为空格 (8 个空格 = 8 * 32 = 256)
    const checksumStr = checksum.toString(8).padStart(6, '0') + '\0 ';
    Buffer.from(checksumStr).copy(header, 148);

    // 文件内容填充到 512 字节对齐
    const paddedContent = this.padTo512(content);

    return Buffer.concat([header, paddedContent]);
  }

  /**
   * 创建目录的 tar 包 Buffer
   *
   * @param sourceDir 源目录路径
   * @param dirPrefix tar 包中的目录前缀（可选，用于保留目录名）
   */
  private async createTarBufferFromDirectory(
    sourceDir: string,
    dirPrefix?: string,
  ): Promise<Buffer> {
    const parts: Buffer[] = [];
    const files = await this.listFilesRecursively(sourceDir);

    this.logger.info('DockerExecService: Creating tar archive from directory', {
      sourceDir,
      dirPrefix,
      fileCount: files.length,
      files: files.slice(0, 10).map((f) => path.relative(sourceDir, f)),
    });

    for (const file of files) {
      let relativePath = path.relative(sourceDir, file);
      // 如果有目录前缀，添加到路径前面
      if (dirPrefix) {
        relativePath = path.join(dirPrefix, relativePath);
      }
      // 关键修复：确保 tar 包内使用 POSIX 路径格式（使用 / 而非 \）
      // 否则在 Windows 上创建的 tar 包在 Linux 容器中解压会失败
      relativePath = relativePath.split(path.sep).join('/');

      const content = await fs.readFile(file);
      const tarEntry = await this.createTarBuffer(relativePath, content);
      parts.push(tarEntry);
    }

    // 结束标记
    parts.push(Buffer.alloc(1024));

    return Buffer.concat(parts);
  }

  /**
   * 递归列出目录下所有文件
   * 忽略以 . 开头的文件和 node_modules 目录
   */
  private async listFilesRecursively(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      // 忽略以 . 开头的文件/目录（如 .DS_Store, .git）
      if (entry.name.startsWith('.')) {
        continue;
      }
      // 忽略 node_modules 目录
      if (entry.name === 'node_modules') {
        continue;
      }

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        const subFiles = await this.listFilesRecursively(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * 将 Buffer 填充到 512 字节对齐
   */
  private padTo512(buffer: Buffer): Buffer {
    const remainder = buffer.length % 512;
    if (remainder === 0) return buffer;
    const padding = Buffer.alloc(512 - remainder);
    return Buffer.concat([buffer, padding]);
  }

  // --- 私有方法 ---

  private async createExec(
    containerId: string,
    cmd: string[],
    options: { user?: string; timeout: number },
  ): Promise<string> {
    const execCreateUrl = `http://localhost/containers/${containerId}/exec`;
    const execCreateBody: Record<string, unknown> = {
      AttachStdout: true,
      AttachStderr: true,
      Cmd: cmd,
    };
    if (options.user) {
      execCreateBody.User = options.user;
    }

    const response = await firstValueFrom(
      this.httpService
        .post(execCreateUrl, execCreateBody, {
          socketPath: this.dockerSocketPath,
          timeout: options.timeout,
        })
        .pipe(
          timeout(options.timeout),
          catchError((error) => {
            this.logger.error('DockerExecService: 创建 exec 失败', {
              containerId,
              cmd: cmd.join(' ').substring(0, 100),
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
          }),
        ),
    );

    const execId = response.data?.Id;
    if (!execId) {
      throw new Error('Failed to create exec instance: no exec ID returned');
    }
    return execId;
  }

  private async startExec(
    execId: string,
    timeoutMs: number,
  ): Promise<ArrayBuffer> {
    const execStartUrl = `http://localhost/exec/${execId}/start`;

    const response = await firstValueFrom(
      this.httpService
        .post(
          execStartUrl,
          { Detach: false, Tty: false },
          {
            socketPath: this.dockerSocketPath,
            timeout: timeoutMs,
            responseType: 'arraybuffer',
          },
        )
        .pipe(
          timeout(timeoutMs),
          catchError((error) => {
            this.logger.error('DockerExecService: 启动 exec 失败', {
              execId,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw error;
          }),
        ),
    );

    return response.data;
  }

  /**
   * 解析 Docker exec 多路复用流输出
   * Docker exec 输出格式：每帧 8 字节头 + payload
   * 头部：[stream_type(1), 0, 0, 0, size(4 bytes big-endian)]
   */
  private parseOutput(data: ArrayBuffer): { stdout: string; stderr: string } {
    const buffer = Buffer.from(data);
    let stdout = '';
    let stderr = '';
    let offset = 0;

    while (offset + 8 <= buffer.length) {
      const streamType = buffer[offset];
      const size = buffer.readUInt32BE(offset + 4);
      offset += 8;

      if (offset + size > buffer.length) break;

      const content = buffer.subarray(offset, offset + size).toString('utf-8');
      if (streamType === 1) {
        stdout += content;
      } else if (streamType === 2) {
        stderr += content;
      }
      offset += size;
    }

    // 如果解析失败（非多路复用格式），返回原始字符串作为 stdout
    if (!stdout && !stderr && buffer.length > 0) {
      stdout = buffer.toString('utf-8');
    }

    return { stdout: stdout.trim(), stderr: stderr.trim() };
  }
}
