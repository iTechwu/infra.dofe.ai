import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DockerService } from './docker.service';
import { DockerImageService } from './docker-image.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [DockerService, DockerImageService],
  exports: [DockerService, DockerImageService],
})
export class DockerModule {}