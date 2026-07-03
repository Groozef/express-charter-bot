import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { SOURCE_MESSAGE_EVENT } from '../userbot/userbot.service';
import { SourceMessage } from '../common/source-message.interface';
import { RawLogService } from '../raw-log/raw-log.service';
import { StateService } from '../state/state.service';
import { TransformerService } from '../transformer/transformer.service';
import { PublisherService } from '../publisher/publisher.service';

@Injectable()
export class PipelineService {
  private readonly logger = new Logger(PipelineService.name);

  constructor(
    private readonly rawLog: RawLogService,
    private readonly state: StateService,
    private readonly transformer: TransformerService,
    private readonly publisher: PublisherService,
  ) {}

  @OnEvent(SOURCE_MESSAGE_EVENT)
  async handleSourceMessage(message: SourceMessage): Promise<void> {
    if (this.state.isProcessed(message.id)) {
      this.logger.warn(`Сообщение ${message.id} уже обработано ранее, пропускаем`);
      return;
    }

    this.rawLog.append(message);
    const text = await this.transformer.compose(message.text);

    if (text === null) {
      this.state.markProcessed(message.id);
      this.logger.log(`Сообщение ${message.id} без ссылки WhatsApp — не предложение тура, пропускаем публикацию`);
      return;
    }

    try {
      if (message.media) {
        if (message.media.isPhoto) {
          await this.publisher.publishPhoto(message.media.buffer, text);
        } else {
          await this.publisher.publishDocument(message.media.buffer, message.media.filename ?? 'file', text);
        }
      } else {
        await this.publisher.publishText(text);
      }

      this.state.markProcessed(message.id);
      this.logger.log(`Сообщение ${message.id} опубликовано в целевой канал`);
    } catch (error) {
      this.logger.error(`Не удалось опубликовать сообщение ${message.id}: ${(error as Error).message}`);
    }
  }
}
