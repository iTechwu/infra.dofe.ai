import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { MlflowClient } from './mlflow.client';

@Module({
  imports: [HttpModule.register({ timeout: 30000 })],
  providers: [MlflowClient],
  exports: [MlflowClient],
})
export class MlflowModule {}
