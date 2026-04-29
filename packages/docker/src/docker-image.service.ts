import { Injectable, Inject } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ConfigService } from '@nestjs/config';
import Docker from 'dockerode';

@Injectable()
export class DockerImageService {
  private docker: Docker | null = null;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly configService: ConfigService,
  ) {
    // Docker client will be initialized in onModuleInit of DockerService
    // This service receives it via injection or creates its own
  }

  setDocker(docker: Docker) {
    this.docker = docker;
  }

  async pullImage(imageName: string): Promise<void> {
    if (!this.docker) {
      throw new Error('Docker client not initialized');
    }

    await new Promise<void>((resolve, reject) => {
      this.docker.pull(imageName, (err: Error | null, stream: NodeJS.ReadableStream) => {
        if (err) {
          return reject(err);
        }
        this.docker.modem.followProgress(
          stream,
          (followErr: Error | null) => {
            if (followErr) reject(followErr);
            else resolve();
          },
        );
      });
    });

    this.logger.info(`Image pulled: ${imageName}`);
  }

  async buildImage(imageName: string, dockerfileContext: string): Promise<void> {
    if (!this.docker) {
      throw new Error('Docker client not initialized');
    }

    await new Promise<void>((resolve, reject) => {
      this.docker.buildImage(
        { context: dockerfileContext, src: ['Dockerfile'] },
        { t: imageName },
        (err: Error | null, stream: NodeJS.ReadableStream) => {
          if (err) {
            return reject(err);
          }
          this.docker.modem.followProgress(
            stream,
            (followErr: Error | null) => {
              if (followErr) reject(followErr);
              else resolve();
            },
          );
        },
      );
    });

    this.logger.info(`Image built: ${imageName}`);
  }

  async listImages(): Promise<Docker.ImageInfo[]> {
    if (!this.docker) {
      return [];
    }

    return await this.docker.listImages();
  }

  async getImageId(imageName: string): Promise<string | null> {
    if (!this.docker) {
      return null;
    }

    try {
      const image = this.docker.getImage(imageName);
      const info = await image.inspect();
      return info.Id || null;
    } catch {
      return null;
    }
  }
}