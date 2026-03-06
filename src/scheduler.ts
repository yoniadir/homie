import 'dotenv/config';
import cron from 'node-cron';
import { ScraperDatabaseService } from './services/scraper-db.service';

const targetUrls = [
  'https://www.yad2.co.il/realestate/rent?minPrice=8000&maxPrice=13000&minRooms=3&maxRooms=4&zoom=14&topArea=2&area=1&city=5000&neighborhood=1461',
  'https://www.yad2.co.il/realestate/rent?minPrice=8000&maxPrice=13000&minRooms=3&maxRooms=4&zoom=14&topArea=2&area=1&city=5000&neighborhood=1520'
];

/** Only one scheduled run at a time (one browser at a time). */
let scheduledRunInProgress = false;

async function runScheduledScrape(): Promise<void> {
  if (scheduledRunInProgress) {
    console.log(`⏭️ [Scheduler] Skipping this tick — previous run still in progress (one browser at a time)`);
    return;
  }
  scheduledRunInProgress = true;
  try {
    console.log(`🕐 [Scheduler] Starting scheduled scrape at ${new Date().toISOString()}`);
    const scraperDb = new ScraperDatabaseService();

    for (let i = 0; i < targetUrls.length; i++) {
      const url = targetUrls[i]!;
      try {
        console.log(`🔄 [Scheduler] Scraping ${i + 1}/${targetUrls.length}...`);
        await scraperDb.scrapeAndSaveToDatabase(url, {
          exportCsv: i === targetUrls.length - 1,
          cleanOldData: i === 0,
          cleanOldDays: 30
        });
      } catch (error) {
        console.error(`❌ [Scheduler] Failed to scrape URL ${i + 1}:`, error);
      }
    }

    console.log('✅ [Scheduler] Scheduled scrape run completed');
  } finally {
    scheduledRunInProgress = false;
  }
}

const ISRAEL_TZ = 'Asia/Jerusalem';

function main(): void {
  // Default: every 30 min between 8:00 and 23:30 Israel time (Tel-Aviv)
  const cronExpression = process.env.SCRAPE_CRON || '0,30 8-23 * * *';

  if (!cron.validate(cronExpression)) {
    console.error(`❌ Invalid SCRAPE_CRON: ${cronExpression}`);
    process.exit(1);
  }

  console.log('🏠 Homie Scheduler started');
  console.log(`📅 Schedule: ${cronExpression} (Israel ${ISRAEL_TZ}: 8:00–23:30 by default)`);
  console.log('⏳ Waiting for first run...\n');

  cron.schedule(cronExpression, () => {
    runScheduledScrape().catch((err) => console.error('❌ [Scheduler] Run failed:', err));
  }, { timezone: ISRAEL_TZ });
}

main();
