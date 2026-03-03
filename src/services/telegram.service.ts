import axios from 'axios';
import { PropertyItem } from '../interfaces/property.interface';

export class TelegramService {
  private readonly token = process.env.TELEGRAM_BOT_TOKEN;
  private readonly chatId = process.env.TELEGRAM_CHAT_ID;
  private readonly baseUrl = 'https://api.telegram.org';

  isConfigured(): boolean {
    return Boolean(this.token && this.chatId);
  }

  async sendPropertyAlert(property: PropertyItem): Promise<void> {
    if (!this.token || !this.chatId) {
      console.warn('⚠️ Telegram not configured: TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID required');
      return;
    }

    const message = this.formatMessage(property);
    await axios.post(`${this.baseUrl}/bot${this.token}/sendMessage`, {
      chat_id: this.chatId,
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: false
    });
  }

  private formatMessage(p: PropertyItem): string {
    return [
      '🏠 <b>New Apartment Found!</b>',
      `💰 ${p.price}`,
      `📍 ${p.location}`,
      `🛏 ${p.rooms} rooms | Floor ${p.floor}`,
      `📐 ${p.area}`,
      `🔗 <a href="${p.link}">View Listing</a>`
    ].join('\n');
  }

  async sendBatch(properties: PropertyItem[]): Promise<void> {
    if (!this.isConfigured()) {
      console.warn('⚠️ Telegram not configured; skipping notifications');
      return;
    }
    for (const property of properties) {
      try {
        await this.sendPropertyAlert(property);
        await new Promise((r) => setTimeout(r, 500));
      } catch (error) {
        console.error(`❌ Failed to send Telegram alert for property ${property.id}:`, error);
      }
    }
  }
}
