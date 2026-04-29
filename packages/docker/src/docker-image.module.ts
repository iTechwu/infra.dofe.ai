import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DockerImageService } from './docker-image.service';

@Module({
  imports: [ConfigModule],
  providers: [DockerImageService],
  exports: [DockerImageService],
})
export class DockerImageModule {}