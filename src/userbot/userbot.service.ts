import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { NewMessage, NewMessageEvent } from 'telegram/events';
import { Api } from 'telegram/tl';
import { AppConfigService } from '../config/app-config.service';
import { SourceMessage } from '../common/source-message.interface';

export const SOURCE_MESSAGE_EVENT = 'source.message';

const WATCHDOG_INTERVAL_MS = 30_000;
const MAX_CONSECUTIVE_DISCONNECTS = 3; // ~90 секунд без связи — считаем сессию мёртвой
const INITIAL_CONNECT_TIMEOUT_MS = 60_000; // сторож включается только ПОСЛЕ connect(), поэтому сам connect() тоже нужно ограничивать по времени
const POLL_INTERVAL_MS = 60_000;

@Injectable()
export class UserbotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UserbotService.name);
  private client: TelegramClient;
  private watchdog: NodeJS.Timeout;
  private poller: NodeJS.Timeout;
  private consecutiveDisconnects = 0;

  constructor(
    private readonly config: AppConfigService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async onModuleInit(): Promise<void> {
    if (!this.config.tgSession) {
      this.logger.error(
        'TG_SESSION не задан. Запустите "npm run generate:session" один раз, чтобы залогиниться под аккаунтом, который состоит в канале-источнике, и добавить полученную строку в .env',
      );
      return;
    }

    this.client = new TelegramClient(
      new StringSession(this.config.tgSession),
      this.config.tgApiId,
      this.config.tgApiHash,
      // connectionRetries по умолчанию Infinity — не ограничиваем, иначе после исчерпания попыток
      // клиент зависает без переподключения, но процесс не падает
      {},
    );

    await this.connectWithTimeout();

    this.client.addEventHandler(
      (event: NewMessageEvent) => this.processMessage(event.message),
      new NewMessage({ chats: [this.config.sourceChannelId] }),
    );

    this.logger.log(`Юзербот подключен и слушает канал-источник ${this.config.sourceChannelId}`);

    // страховка: если клиент всё же надолго зависнет в разрыве соединения (баг/edge-case
    // в переподключении GramJS), роняем процесс — docker перезапустит контейнер с чистого листа
    this.watchdog = setInterval(() => this.checkConnection(), WATCHDOG_INTERVAL_MS);

    // страховка №2: живой NewMessage-поток иногда молча ничего не присылает, хотя соединение
    // выглядит рабочим (getMessages при этом отрабатывает нормально) — похоже на тихий обрыв
    // серверного push-канала (NAT/firewall), который не триггерит переподключение. Поэтому
    // параллельно раз в минуту опрашиваем канал напрямую — дубликаты безопасны, PipelineService
    // сам отсеет уже обработанные id через StateService.
    this.poller = setInterval(() => this.pollRecentMessages(), POLL_INTERVAL_MS);
  }

  async onModuleDestroy(): Promise<void> {
    clearInterval(this.watchdog);
    clearInterval(this.poller);
    await this.client?.disconnect();
  }

  private async connectWithTimeout(): Promise<void> {
    const timeout = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`подключение зависло дольше ${INITIAL_CONNECT_TIMEOUT_MS / 1000}с`)), INITIAL_CONNECT_TIMEOUT_MS);
    });

    try {
      await Promise.race([this.client.connect(), timeout]);
    } catch (error) {
      // GramJS сам по себе иногда зависает в бесконечном ретрае первого коннекта (наблюдали на практике —
      // почти 2 часа без единой попытки). Проще перезапустить процесс целиком, чем чинить его внутреннее состояние.
      this.logger.error(`Не удалось подключиться при старте: ${(error as Error).message} — перезапускаю процесс`);
      process.exit(1);
    }
  }

  private checkConnection(): void {
    if (this.client?.connected) {
      this.consecutiveDisconnects = 0;
      return;
    }

    this.consecutiveDisconnects += 1;
    this.logger.warn(`Юзербот не на связи (${this.consecutiveDisconnects}/${MAX_CONSECUTIVE_DISCONNECTS})`);

    if (this.consecutiveDisconnects >= MAX_CONSECUTIVE_DISCONNECTS) {
      this.logger.error('Соединение не восстановилось — перезапускаю процесс');
      process.exit(1);
    }
  }

  private async pollRecentMessages(): Promise<void> {
    if (!this.client?.connected) return;

    try {
      const messages = await this.client.getMessages(this.config.sourceChannelId, { limit: 5 });
      for (const message of [...messages].reverse()) {
        await this.processMessage(message);
      }
    } catch (error) {
      this.logger.warn(`Не удалось опросить канал-источник: ${(error as Error).message}`);
    }
  }

  private async processMessage(message: Api.Message): Promise<void> {
    try {
      const payload: SourceMessage = {
        id: message.id,
        date: message.date,
        text: message.message ?? '',
      };

      // MessageMediaWebPage — это автосгенерированная Telegram превьюшка ссылки (например,
      // аватарка WhatsApp-контакта из wa.me-ссылки), а не настоящее медиа поста. Её тянуть не нужно —
      // берём только реальные приложенные фото/документы.
      const isRealMedia =
        message.media instanceof Api.MessageMediaPhoto || message.media instanceof Api.MessageMediaDocument;

      if (isRealMedia) {
        const buffer = (await this.client.downloadMedia(message)) as Buffer | undefined;
        if (buffer) {
          payload.media = {
            buffer,
            isPhoto: message.media instanceof Api.MessageMediaPhoto,
          };
        }
      }

      this.eventEmitter.emit(SOURCE_MESSAGE_EVENT, payload);
    } catch (error) {
      this.logger.error(`Не удалось обработать входящее сообщение источника: ${(error as Error).message}`);
    }
  }
}
