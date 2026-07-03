import 'dotenv/config';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname } from 'path';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import { Telegraf } from 'telegraf';
import { TransformerService } from '../src/transformer/transformer.service';
import { AppConfigService } from '../src/config/app-config.service';

const MAX_PROCESSED_IDS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Пишем в тот же state.json, что использует живой пайплайн (StateService) — иначе после
// бэкфилла опрос (polling) в UserbotService посчитает эти же сообщения "новыми" и продублирует их.
function loadProcessedIds(stateFilePath: string): Set<number> {
  if (!existsSync(stateFilePath)) return new Set();
  const raw = JSON.parse(readFileSync(stateFilePath, 'utf-8'));
  return new Set<number>(raw.processedIds ?? []);
}

function saveProcessedIds(stateFilePath: string, ids: Set<number>): void {
  mkdirSync(dirname(stateFilePath), { recursive: true });
  const trimmed = [...ids].slice(-MAX_PROCESSED_IDS);
  writeFileSync(stateFilePath, JSON.stringify({ processedIds: trimmed }), 'utf-8');
}

async function main() {
  const count = Number(process.argv[2] ?? '20');

  const apiId = Number(process.env.TG_API_ID);
  const apiHash = process.env.TG_API_HASH;
  const session = process.env.TG_SESSION;
  const sourceChannelId = process.env.SOURCE_CHANNEL_ID;
  const botToken = process.env.BOT_TOKEN;
  const targetChannelId = process.env.TARGET_CHANNEL_ID;

  if (!apiId || !apiHash || !session || !sourceChannelId || !botToken || !targetChannelId) {
    console.error('Заполните .env полностью перед запуском backfill (TG_API_ID, TG_API_HASH, TG_SESSION, SOURCE_CHANNEL_ID, TARGET_CHANNEL_ID, BOT_TOKEN).');
    process.exit(1);
  }

  const fakeConfig = {
    whatsappTrackingText:
      process.env.WHATSAPP_TRACKING_TEXT ?? 'Здравствуйте! Пишу по объявлению из канала @groozeff',
    whatsappLinkLabel: process.env.WHATSAPP_LINK_LABEL ?? '📲 Писать со Скрином (WhatsApp)',
    postFooterText:
      process.env.POST_FOOTER_TEXT ??
      '📌 Для заявки: скриншот этого поста + не удаляйте текст, который откроется в WhatsApp',
  } as AppConfigService;
  const transformer = new TransformerService(fakeConfig);

  console.log('Подключаюсь юзерботом...');
  const client = new TelegramClient(new StringSession(session), apiId, apiHash, { connectionRetries: 5 });
  await client.connect();

  const bot = new Telegraf(botToken);
  const stateFilePath = process.env.STATE_FILE_PATH ?? './data/state.json';
  const processedIds = loadProcessedIds(stateFilePath);

  console.log(`Забираю последние ${count} сообщений из ${sourceChannelId}...`);
  const messages = await client.getMessages(sourceChannelId, { limit: count });
  const ordered = [...messages].reverse(); // публикуем от старых к новым, как в исходном канале

  console.log(`Найдено ${ordered.length} сообщений. Публикую с паузой между постами...`);

  for (const message of ordered) {
    const text = message.message ?? '';
    if (!text && !message.media) {
      continue; // служебные сообщения без текста и медиа пропускаем
    }

    const composed = await transformer.compose(text);

    if (composed === null) {
      console.log(`[id=${message.id}] без ссылки WhatsApp — не предложение тура, пропускаю`);
      processedIds.add(message.id);
      continue;
    }

    // MessageMediaWebPage — превьюшка ссылки (например, аватарка WhatsApp-контакта), не настоящее медиа поста
    const isRealMedia =
      message.media instanceof Api.MessageMediaPhoto || message.media instanceof Api.MessageMediaDocument;

    try {
      if (isRealMedia) {
        const buffer = (await client.downloadMedia(message)) as Buffer | undefined;
        const isPhoto = message.media instanceof Api.MessageMediaPhoto;

        if (buffer && isPhoto) {
          await bot.telegram.sendPhoto(targetChannelId, { source: buffer }, { caption: composed, parse_mode: 'HTML' });
        } else if (buffer) {
          await bot.telegram.sendDocument(
            targetChannelId,
            { source: buffer, filename: 'file' },
            { caption: composed, parse_mode: 'HTML' },
          );
        } else {
          await bot.telegram.sendMessage(targetChannelId, composed, { parse_mode: 'HTML' });
        }
      } else {
        await bot.telegram.sendMessage(targetChannelId, composed, { parse_mode: 'HTML' });
      }
      console.log(`[id=${message.id}] опубликовано`);
      processedIds.add(message.id);
    } catch (error) {
      console.error(`[id=${message.id}] ошибка публикации: ${(error as Error).message}`);
    }

    await sleep(2500); // пауза между постами, чтобы не словить flood-wait от Bot API
  }

  saveProcessedIds(stateFilePath, processedIds);
  await client.disconnect();
  console.log('Готово.');
  process.exit(0);
}

main();
