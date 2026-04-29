import { Injectable, Inject, OnModuleInit } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';
import { ConfigService } from '@nestjs/config';
import Docker from 'dockerode';

export interface ContainerInfo {
  id: string;
  state: string;
  running: boolean;
  exitCode: number;
  startedAt: string;
  finishedAt: string;
}

export interface CreateContainerOptions {
  hostname: string;
  isolationKey: string;
  name: string;
  port: number;
  gatewayToken: string;
  aiProvider: string;
  model: string;
  channelType: string;
  workspacePath: string;
  apiKey?: string;
  apiBaseUrl?: string;
  proxyUrl?: string;
  proxyToken?: string;
  apiType?: string;
  botType?: string;
}

@Injectable()
export class DockerService implements OnModuleInit {
  private docker: Docker | null = null;
  private readonly containerPrefix = 'clawbot-manager-';
  private readonly portStart: number;
  private readonly dataDir: string;
  private readonly secretsDir: string;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
    private readonly configService: ConfigService,
  ) {
    this.portStart = this.configService.get<number>('DOCKER_PORT_START', 9200);
    this.dataDir = this.configService.get<string>('DOCKER_DATA_DIR', '/data/bots');
    this.secretsDir = this.configService.get<string>('DOCKER_SECRETS_DIR', '/data/secrets');
  }

  async onModuleInit() {
    try {
      const dockerHost = this.configService.get<string>('DOCKER_HOST');
      if (dockerHost) {
        this.docker = new Docker({ host: dockerHost, port: 2375 });
      } else {
        this.docker = new Docker({ socketPath: '/var/run/docker.sock' });
      }

      await this.docker.ping();
      this.logger.info('Docker connection established');
    } catch (error) {
      this.logger.warn(
        'Docker not available, container operations will be simulated',
        { error: error instanceof Error ? error.message : String(error) },
      );
      this.docker = null;
    }
  }

  isAvailable(): boolean {
    return this.docker !== null;
  }

  async createContainer(options: CreateContainerOptions): Promise<string> {
    if (!this.isAvailable()) {
      this.logger.warn('Docker not available, simulating container creation');
      return `simulated-${options.isolationKey}`;
    }

    const containerName = `${this.containerPrefix}${options.isolationKey}`;
    const image = this.configService.get<string>('DOCKER_GATEWAY_IMAGE', 'openclaw:latest');

    const container = await this.docker.createContainer({
      name: containerName,
      Image: image,
      Env: [
        `BOT_HOSTNAME=${options.hostname}`,
        `BOT_NAME=${options.name}`,
        `BOT_PORT=${options.port}`,
        `OPENCLAW_GATEWAY_TOKEN=${options.gatewayToken}`,
        `CHANNEL_TYPE=${options.channelType}`,
        `AI_PROVIDER=${options.aiProvider}`,
        `AI_MODEL=${options.model}`,
      ],
      ExposedPorts: {
        [`${options.port}/tcp`]: {},
      },
      HostConfig: {
        PortBindings: {
          [`${options.port}/tcp`]: [{ HostPort: String(options.port) }],
        },
        RestartPolicy: { Name: 'unless-stopped' },
      },
      Labels: {
        'clawbot-manager.managed': 'true',
        'clawbot-manager.isolation-key': options.isolationKey,
      },
    });

    this.logger.info(`Container created: ${container.id}`);
    return container.id;
  }

  async startContainer(containerId: string): Promise<void> {
    if (!this.isAvailable()) {
      this.logger.warn('Docker not available, simulating container start');
      return;
    }

    const container = this.docker.getContainer(containerId);
    await container.start();
    this.logger.info(`Container started: ${containerId}`);
  }

  async stopContainer(containerId: string): Promise<boolean> {
    if (!this.isAvailable()) {
      this.logger.warn('Docker not available, simulating container stop');
      return true;
    }

    const container = this.docker.getContainer(containerId);
    try {
      await container.stop({ t: 10 });
      this.logger.info(`Container stopped: ${containerId}`);
      return true;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        error.statusCode === 304
      ) {
        this.logger.info(`Container already stopped: ${containerId}`);
        return false;
      }
      throw error;
    }
  }

  async removeContainer(containerId: string): Promise<void> {
    if (!this.isAvailable()) {
      this.logger.warn('Docker not available, simulating container removal');
      return;
    }

    const container = this.docker.getContainer(containerId);
    await container.remove({ force: true });
    this.logger.info(`Container removed: ${containerId}`);
  }

  async getContainerStatus(containerId: string): Promise<ContainerInfo | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const container = this.docker.getContainer(containerId);
      const info = await container.inspect();

      return {
        id: info.Id,
        state: info.State.Status,
        running: info.State.Running,
        exitCode: info.State.ExitCode ?? 0,
        startedAt: info.State.StartedAt,
        finishedAt: info.State.FinishedAt ?? '',
      };
    } catch {
      return null;
    }
  }

  async allocatePort(usedPorts: number[]): Promise<number> {
    let dockerUsedPorts: number[] = [];
    if (this.isAvailable()) {
      try {
        const containers = await this.docker.listContainers({ all: true });
        dockerUsedPorts = containers.flatMap((c) =>
          c.Ports.filter((p) => p.PublicPort).map((p) => p.PublicPort),
        );
      } catch (error) {
        this.logger.warn(
          'Failed to list Docker containers for port allocation',
          error,
        );
      }
    }

    const allUsedPorts = new Set([...usedPorts, ...dockerUsedPorts]);
    let port = Number(this.portStart) || 9200;
    while (allUsedPorts.has(port)) {
      port++;
    }
    return port;
  }

  async getContainerLogs(
    containerId: string,
    options: { tail?: number; since?: number } = {},
  ): Promise<string> {
    if (!this.isAvailable()) {
      return 'Docker not available';
    }

    const container = this.docker.getContainer(containerId);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: options.tail || 100,
      since: options.since,
    });

    return logs.toString();
  }
}