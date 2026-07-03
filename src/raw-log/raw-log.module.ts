import { Module } from '@nestjs/common';
import { RawLogService } from './raw-log.service';

@Module({
  providers: [RawLogService],
  exports: [RawLogService],
})
export class RawLogModule {}
