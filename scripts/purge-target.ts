import 'dotenv/config';
import { Telegraf } from 'telegraf';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const botToken = process.env.BOT_TOKEN;
  const targetChannelId = process.env.TARGET_CHANNEL_ID;
  const upTo = Number(process.argv[2] ?? '300');

  if (!botToken || !targetChannelId) {
    console.error('Заполните .env: BOT_TOKEN, TARGET_CHANNEL_ID.');
    process.exit(1);
  }

  // Bot API не даёт списка истории канала — перебираем ID сообщений подряд от 1 до upTo
  // и пытаемся удалить каждое. Несуществующие/уже удалённые ID просто вернут ошибку — это ок.
  const bot = new Telegraf(botToken);

  let deleted = 0;
  let missing = 0;

  console.log(`Перебираю ID сообщений 1..${upTo} в канале ${targetChannelId}...`);

  for (let id = 1; id <= upTo; id++) {
    try {
      await bot.telegram.deleteMessage(targetChannelId, id);
      deleted++;
    } catch {
      missing++;
    }
    await sleep(60); // не флудить Bot API
  }

  console.log(`Готово. Удалено: ${deleted}, пропущено (не найдено/уже удалено): ${missing}.`);
  process.exit(0);
}

main();
