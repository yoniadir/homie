import { Yad2ScraperService } from './services/yad2-scraper.service';
import { EnhancedPuppeteerScraperService } from './services/enhanced-puppeteer-scraper.service';
import { CsvExportService } from './services/csv-export.service';
import { ScraperDatabaseService } from './services/scraper-db.service';
import { PropertyItem } from './interfaces/property.interface';

// Main entry point for the TypeScript project
console.log('🏠 Homie - Real Estate Scraper Started');

// Initialize the scraper services
const basicScraperService = new Yad2ScraperService();
const enhancedScraperService = new EnhancedPuppeteerScraperService();
const csvExportService = new CsvExportService();
const scraperDatabaseService = new ScraperDatabaseService();

// The target URL for scraping Yad2
const targetUrl = 'https://www.yad2.co.il/realestate/rent?maxPrice=10000&minRooms=3&maxRooms=4&zoom=14&topArea=2&area=1&city=5000&neighborhood=1520';

/**
 * Main function to scrape properties with fallback strategy
 */
async function scrapeProperties(): Promise<void> {
  try {
    console.log('🔍 Starting property scraping...');
    console.log(`📍 Target URL: ${targetUrl}`);
    console.log('⏳ This may take a moment...\n');

    // Try basic scraper first
    console.log('🔧 Attempting basic HTTP scraping...');
    let result = await basicScraperService.scrapeProperties(targetUrl);

    // If basic scraper fails due to bot protection, use enhanced Puppeteer
    if (!result.success && result.error?.includes('Bot protection')) {
      console.log('🚀 Bot protection detected, switching to Enhanced Puppeteer...');
      console.log('⚠️  This will open a browser window - please don\'t close it during scraping\n');
      
      try {
        result = await enhancedScraperService.scrapeProperties(targetUrl);
      } finally {
        // Always close the browser
        await enhancedScraperService.closeBrowser();
      }
    }

    if (result.success) {
      console.log('✅ Scraping completed successfully!');
      console.log(`📊 Total properties found: ${result.totalItems}`);
      console.log(`🕐 Scraped at: ${result.timestamp.toLocaleString()}\n`);

      if (result.data.length > 0) {
        console.log('🏘️  Property Listings Length: ', result.data.length, '\n');
      } else {
        console.log('⚠️  No properties found. This could mean:');
        console.log('   - The website structure has changed');
        console.log('   - No properties match the search criteria');
        console.log('   - The scraping was blocked');
        
        // Still try to export empty results for debugging
        try {
          const csvPath = await csvExportService.exportToCSVEnhanced([], 'empty_results.csv');
          console.log(`📄 Empty results file created: ${csvPath}`);
        } catch (error) {
          console.warn('⚠️ Could not create empty results file:', error);
        }
      }
    } else {
      console.error('❌ Scraping failed:');
      console.error(`Error: ${result.error}`);
      console.error(`Timestamp: ${result.timestamp.toLocaleString()}`);
    }
  } catch (error) {
    console.error('💥 Unexpected error occurred:');
    console.error(error);
  }
}

/**
 * Function to use only the enhanced Puppeteer scraper with CSV and Database saving
 */
async function scrapeWithEnhancedPuppeteer(): Promise<void> {
  try {
    console.log('🚀 Starting Enhanced Puppeteer scraping...');
    console.log('⚠️  This will open a browser window - please don\'t close it during scraping\n');
    
    const result = await enhancedScraperService.scrapeProperties(targetUrl);
    
    if (result.success) {
      console.log('✅ Enhanced Puppeteer scraping completed successfully!');
      console.log(`📊 Total properties found: ${result.totalItems}`);
      console.log(`🕐 Scraped at: ${result.timestamp.toLocaleString()}\n`);

      if (result.data.length > 0) {
        console.log('🏘️  Property Listings:\n');
        
        // Show first 5 properties in console
        const displayProperties = result.data.slice(0, 5);
        displayProperties.forEach((property: PropertyItem, index: number) => {
          console.log(`--- Property ${index + 1} ---`);
          console.log(`🏠 Title: ${property.title}`);
          console.log(`💰 Price: ${property.price}`);
          console.log(`📍 Location: ${property.location}`);
          console.log(`🏠 Rooms: ${property.rooms}`);
          console.log(`🔢 Floor: ${property.floor}`);
          console.log(`🆔 ID: ${property.id}`);
          console.log(''); // Empty line for spacing
        });
        
        if (result.data.length > 5) {
          console.log(`... and ${result.data.length - 5} more properties\n`);
        }
        
        // Filter out properties with missing critical data
        const filteredProperties = result.data.filter((property: PropertyItem) => 
          property.link !== '' && 
          property.price !== 'Price not found'
        );
        
        console.log(`📊 Filtered properties: ${filteredProperties.length} (removed ${result.data.length - filteredProperties.length} incomplete entries)\n`);

        // Export to CSV
        try {
          console.log('📄 Exporting to CSV...');
          const csvPath = await csvExportService.exportToCSVEnhanced(filteredProperties);
          console.log(`✅ CSV export completed: ${csvPath}`);
        } catch (error) {
          console.error('❌ CSV export failed:', error);
        }

        // Save to Database if --db flag is provided
        const args = process.argv.slice(2);
        const saveToDatabase = args.includes('--db') || args.includes('--database');
        
        if (saveToDatabase) {
          try {
            console.log('📀 Saving to database...');
            const dbResult = await scraperDatabaseService.scrapeAndSaveToDatabase(targetUrl, {
              exportCsv: false, // We already exported to CSV above
              cleanOldData: true,
              cleanOldDays: 30
            });
            
            if (dbResult.success) {
              console.log('✅ Database save completed successfully!');
              console.log(`📀 Database Stats: ${dbResult.dbStats?.inserted} new, ${dbResult.dbStats?.updated} updated, ${dbResult.dbStats?.skipped} skipped`);
              console.log(`📊 Total in database: ${dbResult.dbStats?.totalInDb}`);
            } else {
              console.error('❌ Database save failed:', dbResult.error);
            }
          } catch (error) {
            console.error('❌ Database operation failed:', error);
          }
        } else {
          console.log('💡 To save to database, add --db flag: npm run dev:enhanced -- --db');
        }
      } else {
        console.log('⚠️  No properties found with enhanced scraping.');
      }
    } else {
      console.error('❌ Enhanced Puppeteer scraping failed:');
      console.error(`Error: ${result.error}`);
    }
  } catch (error) {
    console.error('💥 Unexpected error with enhanced scraping:', error);
  } finally {
    await enhancedScraperService.closeBrowser();
  }
}

/**
 * Function to scrape with database-first approach (integrated scraping and database saving)
 */
async function scrapeWithDatabaseIntegration(): Promise<void> {
  try {
    console.log('🚀 Starting integrated scraping with database...');
    console.log('⚠️  This will open a browser window - please don\'t close it during scraping\n');
    
    const result = await scraperDatabaseService.scrapeAndSaveToDatabase(targetUrl, {
      exportCsv: true,         // Export to CSV as well
      cleanOldData: true,      // Clean old data
      cleanOldDays: 30         // Keep data for 30 days
    });
    
    if (result.success) {
      console.log('✅ Integrated scraping and database save completed!');
      console.log(`📊 Total properties scraped: ${result.totalItems}`);
      console.log(`📀 Database: ${result.dbStats?.inserted} new, ${result.dbStats?.updated} updated, ${result.dbStats?.skipped} skipped`);
      console.log(`📊 Total in database: ${result.dbStats?.totalInDb}`);
      
      if (result.dbStats?.statistics) {
        console.log('\n📊 Database Statistics:');
        console.log(`   Today's Properties: ${result.dbStats.statistics.todayProperties}`);
        console.log(`   Average Price: ₪${result.dbStats.statistics.avgPrice}`);
        console.log(`   Top Locations:`);
        result.dbStats.statistics.locationCounts.slice(0, 5).forEach((loc: any, index: number) => {
          console.log(`     ${index + 1}. ${loc.location}: ${loc.count} properties`);
        });
      }
    } else {
      console.error('❌ Integrated scraping failed:', result.error);
    }
  } catch (error) {
    console.error('💥 Unexpected error with integrated scraping:', error);
  }
}

/**
 * Helper function to format property data for export
 */
function formatPropertiesForExport(properties: PropertyItem[]): object[] {
  return properties.map(property => ({
    id: property.id,
    title: property.title,
    price: property.price,
    location: property.location,
    rooms: property.rooms,
    floor: property.floor,
    description: property.description,
    imageUrl: property.imageUrl,
    link: property.link,
    contactInfo: property.contactInfo
  }));
}

/**
 * Example function to demonstrate how to use the scraper programmatically
 */
async function getPropertiesData(): Promise<PropertyItem[]> {
  // Try basic scraper first
  let result = await basicScraperService.scrapeProperties(targetUrl);
  
  // If basic scraper fails due to bot protection, use enhanced Puppeteer
  if (!result.success && result.error?.includes('Bot protection')) {
    try {
      result = await enhancedScraperService.scrapeProperties(targetUrl);
    } finally {
      await enhancedScraperService.closeBrowser();
    }
  }
  
  return result.success ? result.data : [];
}

// Check command line arguments to determine which scraper to use
const args = process.argv.slice(2);
const useEnhancedOnly = args.includes('--enhanced') || args.includes('-e');
const useDatabase = args.includes('--db') || args.includes('--database');
const useIntegrated = args.includes('--integrated') || args.includes('-i');

console.log('🎯 Scraping Mode Detection:');
console.log(`   Enhanced: ${useEnhancedOnly}`);
console.log(`   Database: ${useDatabase}`);
console.log(`   Integrated: ${useIntegrated}\n`);

if (useIntegrated) {
  console.log('🔄 Using integrated scraping mode (scraping + database + CSV)\n');
  scrapeWithDatabaseIntegration().catch(console.error);
} else if (useEnhancedOnly) {
  console.log('🚀 Using Enhanced Puppeteer mode only\n');
  scrapeWithEnhancedPuppeteer().catch(console.error);
} else {
  console.log('🔧 Using fallback strategy (Basic → Enhanced)\n');
  scrapeProperties().catch(console.error);
}

// Export the services and functions for use in other modules
export { basicScraperService, enhancedScraperService, scraperDatabaseService, getPropertiesData, formatPropertiesForExport }; 