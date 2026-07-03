import { Module } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AppConfigModule } from './config/app-config.module';
import { PipelineModule } from './pipeline/pipeline.module';
import { HealthController } from './health/health.controller';

@Module({
  imports: [AppConfigModule, EventEmitterModule.forRoot(), PipelineModule],
  controllers: [HealthController],
})
export class AppModule {}
