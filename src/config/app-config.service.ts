import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService) {}

  private require(key: string): string {
    const value = this.config.get<string>(key);
    if (!value) {
      throw new Error(`Отсутствует обязательная переменная окружения: ${key}`);
    }
    return value;
  }

  get port(): number {
    return Number(this.config.get<string>('PORT') ?? '3000');
  }

  get botToken(): string {
    return this.require('BOT_TOKEN');
  }

  get targetChannelId(): string {
    return this.require('TARGET_CHANNEL_ID');
  }

  get sourceChannelId(): string {
    return this.require('SOURCE_CHANNEL_ID');
  }

  get tgApiId(): number {
    return Number(this.require('TG_API_ID'));
  }

  get tgApiHash(): string {
    return this.require('TG_API_HASH');
  }

  get tgSession(): string {
    return this.config.get<string>('TG_SESSION') ?? '';
  }

  // текст, который автоматически подставляется в поле ввода WhatsApp при переходе по ссылке —
  // так источник видит, что клиент пришёл из нашего канала, даже если сам пост не трогали
  get whatsappTrackingText(): string {
    return this.config.get<string>('WHATSAPP_TRACKING_TEXT') ?? 'Здравствуйте! Пишу по объявлению из канала @groozeff';
  }

  // видимый текст HTML-ссылки <a href="...">, которая прячет длинный закодированный wa.me-URL
  get whatsappLinkLabel(): string {
    return this.config.get<string>('WHATSAPP_LINK_LABEL') ?? '📲 Писать со Скрином (WhatsApp)';
  }

  // короткая подпись под каждым постом с обязательными условиями заявки — добавляется,
  // только если в посте была wa.me-ссылка (иначе оформлять всё равно не через что)
  get postFooterText(): string {
    return (
      this.config.get<string>('POST_FOOTER_TEXT') ??
      '📌 Для заявки: скриншот этого поста + не удаляйте текст, который откроется в WhatsApp'
    );
  }

  get stateFilePath(): string {
    return this.config.get<string>('STATE_FILE_PATH') ?? './data/state.json';
  }

  get rawLogFilePath(): string {
    return this.config.get<string>('RAW_LOG_FILE_PATH') ?? './logs/raw-messages.log';
  }
}
