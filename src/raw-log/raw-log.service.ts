import { Injectable, Logger } from '@nestjs/common';
import { appendFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { AppConfigService } from '../config/app-config.service';
import { SourceMessage } from '../common/source-message.interface';

@Injectable()
export class RawLogService {
  private readonly logger = new Logger(RawLogService.name);

  constructor(private readonly config: AppConfigService) {
    mkdirSync(dirname(this.config.rawLogFilePath), { recursive: true });
  }

  append(message: SourceMessage): void {
    const line = JSON.stringify({
      receivedAt: new Date().toISOString(),
      id: message.id,
      date: message.date,
      text: message.text,
      hasMedia: Boolean(message.media),
    });
    this.logger.log(`Новое сообщение из источника [id=${message.id}]: ${message.text?.slice(0, 120) ?? ''}`);
    appendFileSync(this.config.rawLogFilePath, line + '\n', { encoding: 'utf-8' });
  }
}
