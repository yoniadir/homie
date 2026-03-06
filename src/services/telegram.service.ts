import axios, { AxiosError } from 'axios';
import { PropertyItem } from '../interfaces/property.interface';

/** Delay between messages (ms). Telegram allows ~20 msg/min to same private chat; 3.5s keeps us under that. */
const DELAY_BETWEEN_MESSAGES_MS = 3500;

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

  /**
   * Sends Telegram alerts for each property, respecting rate limits (~20 msg/min to same chat).
   * On 429 (Too Many Requests), waits for Retry-After and retries.
   * @returns IDs of properties that were successfully sent (only these should be marked as notified).
   */
  async sendBatch(properties: PropertyItem[]): Promise<string[]> {
    const sentIds: string[] = [];
    if (!this.isConfigured()) {
      console.warn('⚠️ Telegram not configured; skipping notifications');
      return sentIds;
    }

    for (let i = 0; i < properties.length; i++) {
      const property = properties[i];
      const ok = await this.sendOneWithRetry(property);
      if (ok) sentIds.push(property.id);
      if (i < properties.length - 1) {
        await new Promise((r) => setTimeout(r, DELAY_BETWEEN_MESSAGES_MS));
      }
    }

    if (properties.length > 0) {
      console.log(`📱 Telegram: ${sentIds.length}/${properties.length} notifications sent`);
      if (sentIds.length < properties.length) {
        console.warn(`⚠️ ${properties.length - sentIds.length} failed; they will be retried on next run`);
      }
    }
    return sentIds;
  }

  private async sendOneWithRetry(property: PropertyItem, isRetry = false): Promise<boolean> {
    try {
      await this.sendPropertyAlert(property);
      return true;
    } catch (error) {
      const axiosError = error as AxiosError<{ description?: string }>;
      const status = axiosError.response?.status;
      const retryAfter = axiosError.response?.headers?.['retry-after'];
      let waitSec = typeof retryAfter === 'string' ? parseInt(retryAfter, 10) : NaN;
      const MAX_RETRY_AFTER_SEC = 120;
      if (!Number.isNaN(waitSec) && waitSec > MAX_RETRY_AFTER_SEC) {
        console.warn(`⏳ Telegram Retry-After ${waitSec}s capped to ${MAX_RETRY_AFTER_SEC}s`);
        waitSec = MAX_RETRY_AFTER_SEC;
      }

      if (status === 429 && !isRetry && !Number.isNaN(waitSec) && waitSec > 0) {
        console.warn(`⏳ Telegram rate limited; waiting ${waitSec}s before retry...`);
        await new Promise((r) => setTimeout(r, waitSec * 1000));
        return this.sendOneWithRetry(property, true);
      }

      console.error(`❌ Failed to send Telegram alert for property ${property.id}:`, axiosError.message);
      return false;
    }
  }
}
