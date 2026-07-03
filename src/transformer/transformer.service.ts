import { Injectable } from '@nestjs/common';
import { AppConfigService } from '../config/app-config.service';

// wa.me/79991234567 или https://wa.me/79991234567, с уже существующими параметрами или без
const WA_ME_LINK = /(?:https?:\/\/)?wa\.me\/\d+(?:\?\S*)?/g;
const HAS_WA_ME = /wa\.me/i;
// чужая реклама: домен, который не wa.me (их канал/сайт), либо явная подпись "Каналы по..."
const FOREIGN_DOMAIN = /\b(?:https?:\/\/)?(?:www\.)?[a-zA-Z0-9-]+\.(?:kz|com|ru|net|org|info|io|site|shop)\b\S*/gi;
const CHANNEL_PROMO_LABEL = /канал/i;

@Injectable()
export class TransformerService {
  constructor(private readonly config: AppConfigService) {}

  // Пост источника публикуется почти как есть — без наценки и без подмены контактов.
  // Правки: 1) ссылка wa.me с меткой ?text=... зашивается в HTML-тег <a href="...">,
  // видимый текст — короткая подпись, а не длинная строка с %D0%97... Сообщение уходит
  // с parse_mode: 'HTML', поэтому весь остальной текст экранируется (&, <, >), чтобы
  // Telegram не спотыкался на случайных спецсимволах в посте источника.
  // 2) строка с чужой рекламой (их канал/сайт) вырезается.
  // 3) прямо перед строкой с WhatsApp добавляется короткое напоминание про два
  // обязательных пункта заявки — чтобы было видно сразу в посте, а не только после клика.
  async compose(rawText: string): Promise<string> {
    return this.tagWhatsappLinks(rawText ?? '');
  }

  private tagWhatsappLinks(text: string): string {
    const rawLinks = [...new Set(text.match(WA_ME_LINK) ?? [])];
    // экранируем всегда, а не только когда есть ссылка — сообщение в любом случае уходит
    // с parse_mode: 'HTML', и случайный "<"/"&" в посте источника не должен ломать парсинг
    let html = this.escapeHtml(text);

    if (rawLinks.length === 0) {
      return html;
    }

    const tag = encodeURIComponent(this.config.whatsappTrackingText);

    for (const rawLink of rawLinks) {
      const separator = rawLink.includes('?') ? '&' : '?';
      const href = `${rawLink}${separator}text=${tag}`.replace(/&/g, '&amp;');
      const anchor = `<a href="${href}">${this.config.whatsappLinkLabel}</a>`;
      html = html.split(this.escapeHtml(rawLink)).join(anchor);
    }

    const lines = html.split('\n').filter((line) => !this.isForeignPromoLine(line));
    const waLineIndex = lines.findIndex((line) => HAS_WA_ME.test(line));

    if (waLineIndex === -1) {
      lines.push('', this.config.postFooterText);
    } else {
      lines.splice(waLineIndex, 0, this.config.postFooterText);
    }

    return lines.join('\n').trim();
  }

  private isForeignPromoLine(line: string): boolean {
    if (HAS_WA_ME.test(line)) return false;

    const domains = line.match(FOREIGN_DOMAIN) ?? [];
    if (domains.length > 0) return true;

    return CHANNEL_PROMO_LABEL.test(line);
  }

  private escapeHtml(text: string): string {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
}
