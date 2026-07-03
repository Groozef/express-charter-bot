import { Module } from '@nestjs/common';
import { UserbotService } from './userbot.service';

@Module({
  providers: [UserbotService],
  exports: [UserbotService],
})
export class UserbotModule {}
