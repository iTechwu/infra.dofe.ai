import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ConfigService } from '@nestjs/config';
import Docker from 'dockerode';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { BotType } from './types';
import { dockerConfig } from '@dofe/infra-common/dist/config/env-config.service';
import { getDockerConnectionOptions } from './docker.utils';

const execAsync = promisify(exec);

interface ImageConfig {
  type: string; // Changed from BotType to support sandbox types
  image: string;
  /** Dockerfile path relative to openclaw source */
  dockerfile?: string;
  /** Build script path relative to openclaw source (for sandbox images) */
  buildScript?: string;
}

@Injectable()
export class DockerImageService implements OnModuleInit {
  private docker: Docker;
  private readonly openclawSrcPath: string;
  private readonly imageConfigs: ImageConfig[];

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly configService: ConfigService,
  ) {
    this.openclawSrcPath = dockerConfig.openclawSrcPath;

    this.imageConfigs = [
      {
        type: 'GATEWAY',
        image: dockerConfig.images.gateway,
        dockerfile: 'Dockerfile',
      },
      {
        type: 'TOOL_SANDBOX',
        image: dockerConfig.images.toolSandbox,
        dockerfile: 'Dockerfile.sandbox',
      },
      {
        type: 'BROWSER_SANDBOX',
        image: dockerConfig.images.browserSandbox,
        dockerfile: 'Dockerfile.sandbox-browser',
      },
    ];
  }

  async onModuleInit() {
    this.docker = null as unknown as Docker;

    const runInit = async () => {
      try {
        this.docker = new Docker(
          getDockerConnectionOptions(dockerConfig.dockerHost),
        );

        const pingWithTimeout = (ms: number) =>
          Promise.race([
            this.docker.ping(),
            new Promise((_, reject) =>
              setTimeout(() => reject(new Error('Docker ping timeout')), ms),
            ),
          ]);

        await pingWithTimeout(5000);
        // this.logger.info('Docker connection established for image service');

        void this.ensureImagesExist().catch((err) => {
          this.logger.warn('Image check/build failed, will retry on demand', {
            error: err?.message,
          });
        });
      } catch (_error) {
        this.logger.warn(
          'Docker not available, image auto-build will be skipped',
        );
        this.docker = null as unknown as Docker;
      }
    };

    this.logger.info('DockerImageService init scheduled in background');
    void runInit();
  }

  /**
   * Check if Docker is available
   */
  isAvailable(): boolean {
    return this.docker !== null;
  }

  /**
   * Ensure all required images exist, build if missing
   */
  private async ensureImagesExist(): Promise<void> {
    if (!this.isAvailable()) {
      this.logger.warn('Docker not available, skipping image check');
      return;
    }

    // this.logger.info('Checking required Docker images...');

    for (const config of this.imageConfigs) {
      const exists = await this.imageExists(config.image);
      if (!exists) {
        this.logger.info(
          `Image ${config.image} not found, building from openclaw source...`,
        );
        await this.buildImage(config);
        // } else {
        //   this.logger.info(`Image ${config.image} already exists`);
      }
    }
  }

  /**
   * Check if a Docker image exists locally
   */
  async imageExists(imageName: string): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await this.docker.getImage(imageName).inspect();
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Build a Docker image from openclaw source
   */
  private async buildImage(config: ImageConfig): Promise<void> {
    const openclawPath = this.resolveOpenclawPath();
    if (!openclawPath) {
      this.logger.warn(
        `OpenClaw source not found at ${this.openclawSrcPath}, skipping image build for ${config.image}`,
      );
      this.logger.warn(
        'To enable auto-build, set OPENCLAW_SRC_PATH to the openclaw repository path',
      );
      return;
    }

    try {
      if (config.dockerfile) {
        // Build using docker build command
        await this.buildWithDockerfile(config, openclawPath);
      } else if (config.buildScript) {
        // Build using shell script
        await this.buildWithScript(config, openclawPath);
      }
    } catch (error) {
      this.logger.error(`Failed to build image ${config.image}: ${error}`);
      throw error;
    }
  }

  /**
   * Build image using Dockerfile
   */
  private async buildWithDockerfile(
    config: ImageConfig,
    openclawPath: string,
  ): Promise<void> {
    this.logger.info(
      `Building ${config.image} from ${openclawPath}/${config.dockerfile}...`,
    );

    const platform = this.configService.get<string>(
      'DOCKER_PLATFORM',
      'linux/amd64',
    );
    const extensions = this.configService.get<string>(
      'OPENCLAW_EXTENSIONS',
      '',
    );

    let buildCmd = `docker build --platform ${platform} --build-arg TARGETPLATFORM=${platform}`;
    if (extensions) {
      buildCmd += ` --build-arg OPENCLAW_EXTENSIONS="${extensions}"`;
    }
    buildCmd += ` -t ${config.image} -f ${config.dockerfile} .`;

    this.logger.info(`Using platform: ${platform}`);
    if (extensions) {
      this.logger.info(`Including extensions: ${extensions}`);
    }

    const { stdout, stderr } = await execAsync(buildCmd, {
      cwd: openclawPath,
      maxBuffer: 50 * 1024 * 1024, // 50MB buffer for build output
    });

    if (stderr && !stderr.includes('Successfully built')) {
      this.logger.warn(`Build warnings: ${stderr}`);
    }
    this.logger.info(`Successfully built image: ${config.image}`);
  }

  /**
   * Build image using shell script
   */
  private async buildWithScript(
    config: ImageConfig,
    openclawPath: string,
  ): Promise<void> {
    const scriptPath = join(openclawPath, config.buildScript!);

    if (!existsSync(scriptPath)) {
      throw new Error(`Build script not found: ${scriptPath}`);
    }

    this.logger.info(`Building ${config.image} using ${config.buildScript}...`);

    const platform = this.configService.get<string>(
      'DOCKER_PLATFORM',
      'linux/amd64',
    );
    this.logger.info(`Using platform: ${platform}`);

    const { stdout, stderr } = await execAsync(`bash ${config.buildScript}`, {
      cwd: openclawPath,
      maxBuffer: 50 * 1024 * 1024,
      env: {
        ...process.env,
        // Pass image name to script if it supports it
        IMAGE_NAME: config.image,
        // Pass platform for cross-platform builds
        DOCKER_PLATFORM: platform,
      },
    });

    if (stderr) {
      this.logger.warn(`Build script warnings: ${stderr}`);
    }
    this.logger.info(`Successfully built image: ${config.image}`);
  }

  /**
   * Resolve openclaw source path to absolute path
   */
  private resolveOpenclawPath(): string | null {
    let openclawPath = this.openclawSrcPath;

    // If relative path, resolve from current working directory
    if (!openclawPath.startsWith('/')) {
      openclawPath = join(process.cwd(), openclawPath);
    }

    // Check if path exists
    if (existsSync(openclawPath)) {
      return openclawPath;
    }

    // Try common locations
    const commonPaths = [
      join(process.cwd(), '..', 'openclaw'),
      join(process.cwd(), '..', '..', 'openclaw'),
      '/Users/techwu/Documents/codes/xica.ai/openclaw', // Dev environment
    ];

    for (const path of commonPaths) {
      if (existsSync(path)) {
        this.logger.info(`Found openclaw at: ${path}`);
        return path;
      }
    }

    return null;
  }

  /**
   * Get image name for a bot type
   */
  getImageForType(botType: BotType): string {
    const config = this.imageConfigs.find((c) => c.type === botType);
    return config?.image || this.imageConfigs[0].image;
  }

  /**
   * Get all configured images
   */
  getConfiguredImages(): Record<BotType, string> {
    const result: Record<BotType, string> = {} as Record<BotType, string>;
    for (const config of this.imageConfigs) {
      result[config.type] = config.image;
    }
    return result;
  }

  /**
   * Manually trigger image build for a specific type
   */
  async buildImageForType(botType: BotType): Promise<void> {
    const config = this.imageConfigs.find((c) => c.type === botType);
    if (!config) {
      throw new Error(`Unknown bot type: ${botType}`);
    }

    await this.buildImage(config);
  }

  /**
   * Build image by name (used as fallback when pull fails)
   * @param imageName The full image name including tag
   * @throws Error if no build configuration found for the image
   */
  async buildImageForName(imageName: string): Promise<void> {
    const config = this.imageConfigs.find((c) => c.image === imageName);
    if (!config) {
      throw new Error(`No build configuration found for image: ${imageName}`);
    }

    await this.buildImage(config);
  }

  /**
   * Check and report image status
   */
  async getImageStatus(): Promise<
    Record<BotType, { image: string; exists: boolean }>
  > {
    const result: Record<BotType, { image: string; exists: boolean }> =
      {} as Record<BotType, { image: string; exists: boolean }>;

    for (const config of this.imageConfigs) {
      result[config.type] = {
        image: config.image,
        exists: await this.imageExists(config.image),
      };
    }

    return result;
  }
}
