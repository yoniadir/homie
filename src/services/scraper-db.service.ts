import { EnhancedPuppeteerScraperService } from './enhanced-puppeteer-scraper.service';
import { DatabaseService } from './database.service';
import { CsvExportService } from './csv-export.service';
import { ScrapingResult } from '../interfaces/property.interface';

export class ScraperDatabaseService {
  private scraper: EnhancedPuppeteerScraperService;
  private database: DatabaseService;
  private csvExport: CsvExportService;

  constructor() {
    this.scraper = new EnhancedPuppeteerScraperService();
    this.database = new DatabaseService();
    this.csvExport = new CsvExportService();
  }

  /**
   * Scrape properties and save to database
   */
  async scrapeAndSaveToDatabase(url: string, options: {
    exportCsv?: boolean;
    cleanOldData?: boolean;
    cleanOldDays?: number;
  } = {}): Promise<ScrapingResult & { dbStats?: any }> {
    try {
      // Connect to database
      await this.database.connect();
      
      // Ensure table exists
      await this.database.createTable();

      // Clean old data if requested
      if (options.cleanOldData) {
        await this.database.deleteOldProperties(options.cleanOldDays || 30);
      }

      // Get initial count
      const initialCount = await this.database.getPropertiesCount();
      console.log(`📊 Initial database count: ${initialCount} properties`);

      // Scrape properties
      console.log('🔍 Starting property scraping...');
      const scrapingResult = await this.scraper.scrapeProperties(url);

      if (!scrapingResult.success) {
        return scrapingResult;
      }

    // Filter properties for CSV export (same logic as before)
    const filteredProperties = scrapingResult.data.filter(property => 
        property.link && property.link.trim() !== '' && 
        property.price !== 'Price not found'
    );

      // Save to database (only properties with links)
      const { inserted, updated, skipped } = await this.database.upsertProperties(filteredProperties);

      // Export to CSV if requested
      if (options.exportCsv) {

        await this.csvExport.exportToCSVEnhanced(filteredProperties);
      }

      // Get final statistics
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
        ...scrapingResult,
        dbStats: {
          inserted,
          updated,
          skipped,
          totalInDb: finalStats.totalProperties,
          statistics: finalStats
        }
      };

    } catch (error) {
      console.error('❌ Scraper database service failed:', error);
      throw error;
    } finally {
      // Always disconnect
      await this.database.disconnect();
      await this.scraper.closeBrowser();
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