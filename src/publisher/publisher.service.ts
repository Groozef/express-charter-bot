import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Telegraf } from 'telegraf';
import { AppConfigService } from '../config/app-config.service';

@Injectable()
export class PublisherService implements OnModuleInit {
  private readonly logger = new Logger(PublisherService.name);
  private bot: Telegraf;

  constructor(private readonly config: AppConfigService) {}

  onModuleInit(): void {
    this.bot = new Telegraf(this.config.botToken);
    this.logger.log('Bot API клиент инициализирован для публикации в целевой канал');
  }

  async publishText(text: string): Promise<void> {
    await this.bot.telegram.sendMessage(this.config.targetChannelId, text, { parse_mode: 'HTML' });
  }

  async publishPhoto(buffer: Buffer, caption: string): Promise<void> {
    await this.bot.telegram.sendPhoto(
      this.config.targetChannelId,
      { source: buffer },
      { caption, parse_mode: 'HTML' },
    );
  }

  async publishDocument(buffer: Buffer, filename: string, caption: string): Promise<void> {
    await this.bot.telegram.sendDocument(
      this.config.targetChannelId,
      { source: buffer, filename },
      { caption, parse_mode: 'HTML' },
    );
  }
}
