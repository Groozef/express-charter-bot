import 'dotenv/config';
import { Telegraf } from 'telegraf';

async function main() {
  const botToken = process.env.BOT_TOKEN;
  const targetChannelId = process.env.TARGET_CHANNEL_ID;

  if (!botToken || !targetChannelId) {
    console.error('Заполните .env: BOT_TOKEN, TARGET_CHANNEL_ID.');
    process.exit(1);
  }

  const text = [
    '📋 Как оформить заявку',
    '',
    '1. Под понравившимся туром жмите на ссылку WhatsApp — откроется чат с готовым сообщением "Пишу с канала Express Charter KZ по этому объявлению". Не удаляйте этот текст — по нему заявку привязывают к нашему каналу.',
    '2. Обязательно приложите скриншот самого объявления (тот пост, который вас заинтересовал) — без него заявку не примут в обработку.',
    '',
    'Без этих двух пунктов заявка может не засчитаться. Если случайно стёрли текст — просто напишите: "Пишу с канала Express Charter KZ".',
  ].join('\n');

  const bot = new Telegraf(botToken);
  const message = await bot.telegram.sendMessage(targetChannelId, text);
  await bot.telegram.pinChatMessage(targetChannelId, message.message_id);

  console.log(`Опубликовано и закреплено, message_id=${message.message_id}`);
  process.exit(0);
}

main();
