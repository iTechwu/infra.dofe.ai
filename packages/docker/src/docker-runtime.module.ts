import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DockerService } from './docker.service';
import { DockerImageModule } from './docker-image.module';

@Module({
  imports: [ConfigModule, DockerImageModule],
  providers: [DockerService],
  exports: [DockerService],
})
export class DockerRuntimeModule {}
