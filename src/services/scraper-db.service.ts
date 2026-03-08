import { EnhancedPuppeteerScraperService } from './enhanced-puppeteer-scraper.service';
import { DatabaseService } from './database.service';
import { CsvExportService } from './csv-export.service';
import { TelegramService } from './telegram.service';
import { PropertyItem, ScrapingResult } from '../interfaces/property.interface';

type SaveOptions = {
  exportCsv?: boolean;
  cleanOldData?: boolean;
  cleanOldDays?: number;
};

type SaveResult = {
  inserted: number;
  updated: number;
  skipped: number;
  totalInDb: number;
  statistics: {
    totalProperties: number;
    todayProperties: number;
    avgPrice: number;
    locationCounts: Array<{ location: string; count: number }>;
  };
};

export class ScraperDatabaseService {
  private scraper: EnhancedPuppeteerScraperService;
  private database: DatabaseService;
  private csvExport: CsvExportService;
  private telegramService: TelegramService;

  constructor() {
    this.scraper = new EnhancedPuppeteerScraperService();
    this.database = new DatabaseService();
    this.csvExport = new CsvExportService();
    this.telegramService = new TelegramService();
  }

  /**
   * Scrape properties and save to database
   */
  async scrapeAndSaveToDatabase(url: string, options: SaveOptions = {}): Promise<ScrapingResult & { dbStats?: SaveResult }> {
    try {
      // Scrape properties
      console.log('🔍 Starting property scraping...');
      const scrapingResult = await this.scraper.scrapeProperties(url);

      if (!scrapingResult.success) {
        return scrapingResult;
      }

      const dbStats = await this.savePropertiesToDatabase(scrapingResult.data, options);

      return {
        ...scrapingResult,
        dbStats,
      };

    } catch (error) {
      console.error('❌ Scraper database service failed:', error);
      throw error;
    } finally {
      await this.scraper.closeBrowser();
    }
  }

  /**
   * Save already-scraped properties to the database without triggering another scrape.
   */
  async savePropertiesToDatabase(properties: PropertyItem[], options: SaveOptions = {}): Promise<SaveResult> {
    try {
      await this.database.connect();
      await this.database.createTable();

      if (options.cleanOldData) {
        await this.database.deleteOldProperties(options.cleanOldDays || 30);
      }

      const initialCount = await this.database.getPropertiesCount();
      console.log(`📊 Initial database count: ${initialCount} properties`);

      const filteredProperties = properties.filter(property =>
        property.link && property.link.trim() !== '' &&
        property.price !== 'Price not found',
      );

      const { inserted, updated, skipped } = await this.database.upsertProperties(filteredProperties);

      if (this.telegramService.isConfigured()) {
        const unnotified = await this.database.getUnnotifiedProperties();
        if (unnotified.length > 0) {
          console.log(`📱 Sending Telegram notifications for ${unnotified.length} new properties...`);
          const sentIds = await this.telegramService.sendBatch(unnotified);
          if (sentIds.length > 0) {
            await this.database.markAsNotified(sentIds);
          }
        }
      }

      if (options.exportCsv) {
        await this.csvExport.exportToCSVEnhanced(filteredProperties);
      }

      const finalStats = await this.database.getStatistics();

      console.log('📊 Final Database Statistics:');
      console.log(`   Total Properties: ${finalStats.totalProperties}`);
      console.log(`   Today's Properties: ${finalStats.todayProperties}`);
      console.log(`   Average Price: ₪${finalStats.avgPrice}`);
      console.log(`   Top Locations:`);
      finalStats.locationCounts.slice(0, 5).forEach((loc, index) => {
        console.log(`     ${index + 1}. ${loc.location}: ${loc.count} properties`);
      });

      return {
        inserted,
        updated,
        skipped,
        totalInDb: finalStats.totalProperties,
        statistics: finalStats,
      };
    } catch (error) {
      console.error('❌ Failed to save already-scraped properties to database:', error);
      throw error;
    } finally {
      await this.database.disconnect();
    }
  }

  /**
   * Get all properties from database
   */
  async getAllPropertiesFromDatabase() {
    try {
      await this.database.connect();
      const properties = await this.database.getAllProperties();
      return properties;
    } catch (error) {
      console.error('❌ Failed to get properties from database:', error);
      throw error;
    } finally {
      await this.database.disconnect();
    }
  }

  /**
   * Export database properties to CSV
   */
  async exportDatabaseToCSV() {
    try {
      await this.database.connect();
      const properties = await this.database.getAllProperties();
      
      if (properties.length === 0) {
        console.log('📭 No properties found in database');
        return;
      }

      const csvPath = await this.csvExport.exportToCSVEnhanced(properties);
      console.log(`✅ Exported ${properties.length} properties from database to CSV: ${csvPath}`);
      
      return csvPath;
    } catch (error) {
      console.error('❌ Failed to export database to CSV:', error);
      throw error;
    } finally {
      await this.database.disconnect();
    }
  }

  /**
   * Get database statistics
   */
  async getDatabaseStatistics() {
    try {
      await this.database.connect();
      const stats = await this.database.getStatistics();
      return stats;
    } catch (error) {
      console.error('❌ Failed to get database statistics:', error);
      throw error;
    } finally {
      await this.database.disconnect();
    }
  }
} 