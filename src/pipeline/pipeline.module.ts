import { Module } from '@nestjs/common';
import { UserbotModule } from '../userbot/userbot.module';
import { TransformerModule } from '../transformer/transformer.module';
import { PublisherModule } from '../publisher/publisher.module';
import { RawLogModule } from '../raw-log/raw-log.module';
import { StateModule } from '../state/state.module';
import { PipelineService } from './pipeline.service';

@Module({
  imports: [UserbotModule, TransformerModule, PublisherModule, RawLogModule, StateModule],
  providers: [PipelineService],
})
export class PipelineModule {}
