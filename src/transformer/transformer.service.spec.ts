import { TransformerService } from './transformer.service';
import { AppConfigService } from '../config/app-config.service';

function makeService(
  trackingText = 'Здравствуйте! Пишу с канала Express Charter KZ',
  linkLabel = '📲 Писать со Скрином (WhatsApp)',
  footerText = '📌 Для заявки: скриншот этого поста + не удаляйте текст, который откроется в WhatsApp',
): TransformerService {
  const fakeConfig = {
    whatsappTrackingText: trackingText,
    whatsappLinkLabel: linkLabel,
    postFooterText: footerText,
  } as AppConfigService;
  return new TransformerService(fakeConfig);
}

describe('TransformerService', () => {
  it('прячет длинную wa.me-ссылку за HTML-тегом <a>, вставляет подпись перед ней и вырезает рекламу их канала', async () => {
    const trackingText = 'Здравствуйте! Пишу с канала Express Charter KZ';
    const linkLabel = '📲 Писать со Скрином (WhatsApp)';
    const footerText = '📌 Для заявки: скриншот этого поста + не удаляйте текст, который откроется в WhatsApp';
    const service = makeService(trackingText, linkLabel, footerText);
    const raw = [
      '🇰🇿 Алматы ➔ Батуми (Грузия) 🇬🇪 (Econom)',
      '02.07 A (03:20-06:50) 60 000🔥',
      '',
      '📲 Писать (WhatsApp): wa.me/77784949562',
      '✅Каналы по Турам и Авиа: www.AviaTravel.kz/kanal',
    ].join('\n');

    const result = await service.compose(raw);
    const lines = result.split('\n');

    expect(result).toContain('02.07 A (03:20-06:50) 60 000🔥');
    expect(result).not.toContain('AviaTravel.kz');
    expect(result).not.toContain('Каналы по Турам и Авиа');
    expect(result).toContain(
      `<a href="wa.me/77784949562?text=${encodeURIComponent(trackingText)}">${linkLabel}</a>`,
    );
    // закодированный текст живёт только внутри href, Telegram его не покажет — видимый текст только label
    const visibleText = result.replace(/<a href="[^"]*">/g, '').replace(/<\/a>/g, '');
    expect(visibleText).not.toContain('%D0%97');
    expect(visibleText).toContain(linkLabel);

    const footerIndex = lines.indexOf(footerText);
    const linkLineIndex = lines.findIndex((line) => line.includes('<a href='));
    expect(footerIndex).toBeGreaterThanOrEqual(0);
    expect(footerIndex).toBe(linkLineIndex - 1);
  });

  it('экранирует &, < и > в остальном тексте, чтобы не сломать HTML-парсинг Telegram', async () => {
    const service = makeService('ref', 'LABEL', 'FOOTER');
    const result = await service.compose('Цена 5 < 10 && тур > обычного\nwa.me/77011112233');

    expect(result).toContain('5 &lt; 10 &amp;&amp; тур &gt; обычного');
  });

  it('экранирует & внутри href, если у ссылки уже были query-параметры', async () => {
    const service = makeService('ref GRZ', 'LABEL', 'FOOTER');
    const result = await service.compose('wa.me/77011112233?foo=bar');
    expect(result).toBe(
      `FOOTER\n<a href="wa.me/77011112233?foo=bar&amp;text=${encodeURIComponent('ref GRZ')}">LABEL</a>`,
    );
  });

  it('не трогает сообщения без wa.me ссылок (кроме экранирования) и не добавляет подпись', async () => {
    const service = makeService('ref GRZ', 'LABEL', 'FOOTER');
    const raw = 'Просто текст без ссылок и цен';
    expect(await service.compose(raw)).toBe(raw);
  });
});
