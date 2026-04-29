import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DockerRuntimeModule } from './docker-runtime.module';
import { DockerImageModule } from './docker-image.module';

@Module({
  imports: [ConfigModule, DockerRuntimeModule, DockerImageModule],
  exports: [DockerRuntimeModule, DockerImageModule],
})
export class DockerModule {}
