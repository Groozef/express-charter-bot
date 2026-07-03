import 'dotenv/config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import { Telegraf } from 'telegraf';
import { TransformerService } from '../src/transformer/transformer.service';
import { AppConfigService } from '../src/config/app-config.service';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
    } catch (error) {
      console.error(`[id=${message.id}] ошибка публикации: ${(error as Error).message}`);
    }

    await sleep(2500); // пауза между постами, чтобы не словить flood-wait от Bot API
  }

  await client.disconnect();
  console.log('Готово.');
  process.exit(0);
}

main();
