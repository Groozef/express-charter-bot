import 'dotenv/config';
import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import input from 'input';

async function main() {
  const apiId = Number(process.env.TG_API_ID);
  const apiHash = process.env.TG_API_HASH;

  if (!apiId || !apiHash) {
    console.error('Заполните TG_API_ID и TG_API_HASH в .env перед запуском (получить на https://my.telegram.org).');
    process.exit(1);
  }

  console.log('Входите под аккаунтом, который состоит в канале-источнике (иначе бот не сможет читать его посты).\n');

  const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 5,
  });

  await client.start({
    phoneNumber: async () => input.text('Номер телефона (в формате +7...): '),
    password: async () => input.text('Облачный пароль (2FA), если включен, иначе Enter: '),
    phoneCode: async () => input.text('Код из Telegram: '),
    onError: (err) => console.error(err),
  });

  console.log('\nГотово! Добавьте эту строку в .env как TG_SESSION:\n');
  console.log(client.session.save());

  await client.disconnect();
  process.exit(0);
}

main();
