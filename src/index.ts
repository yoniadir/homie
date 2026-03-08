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

// The target URLs for scraping Yad2 (neighborhoods 1461, 1520; minPrice=8000, maxPrice=13000)
const targetUrls = [
  'https://www.yad2.co.il/realestate/rent?minPrice=8000&maxPrice=13000&minRooms=3&maxRooms=4&zoom=14&topArea=2&area=1&city=5000&neighborhood=1461',
  'https://www.yad2.co.il/realestate/rent?minPrice=8000&maxPrice=13000&minRooms=3&maxRooms=4&zoom=14&topArea=2&area=1&city=5000&neighborhood=1520'
];

/**
 * Main function to scrape properties with fallback strategy from multiple URLs
 */
async function scrapeProperties(): Promise<void> {
  let allProperties: PropertyItem[] = [];
  let totalSuccessful = 0;
  let totalFailed = 0;

  try {
    console.log('🔍 Starting property scraping...');
    console.log(`📍 Target URLs: ${targetUrls.length} locations`);
    targetUrls.forEach((url, index) => {
      console.log(`   ${index + 1}. ${url}`);
    });
    console.log('⏳ This may take a moment...\n');

    for (let i = 0; i < targetUrls.length; i++) {
      const targetUrl = targetUrls[i];
      console.log(`🔧 [${i + 1}/${targetUrls.length}] Scraping: ${targetUrl!.split('neighborhood=')[1] ? 'neighborhood ' + targetUrl!.split('neighborhood=')[1] : 'location ' + (i + 1)}...`);
      
      try {
        // Try basic scraper first
        let result = await basicScraperService.scrapeProperties(targetUrl!);

        // If basic scraper fails due to bot protection, use enhanced Puppeteer
        if (!result.success && result.error?.includes('Bot protection')) {
          console.log('🚀 Bot protection detected, switching to Enhanced Puppeteer...');
          console.log('⚠️  This will open a browser window - please don\'t close it during scraping\n');
          
          try {
            result = await enhancedScraperService.scrapeProperties(targetUrl!);
          } finally {
            // Always close the browser
            await enhancedScraperService.closeBrowser();
          }
        }

        if (result.success) {
          console.log(`✅ [${i + 1}/${targetUrls.length}] Success: ${result.totalItems} properties found`);
          allProperties.push(...result.data);
          totalSuccessful++;
        } else {
          console.error(`❌ [${i + 1}/${targetUrls.length}] Failed: ${result.error}`);
          totalFailed++;
        }
      } catch (error) {
        console.error(`💥 [${i + 1}/${targetUrls.length}] Unexpected error:`, error);
        totalFailed++;
      }
    }

    console.log('\n📊 Scraping Summary:');
    console.log(`✅ Successful: ${totalSuccessful}/${targetUrls.length} URLs`);
    console.log(`❌ Failed: ${totalFailed}/${targetUrls.length} URLs`);
    console.log(`📊 Total properties found: ${allProperties.length}`);

    if (allProperties.length > 0) {
      console.log('\n🏘️  Combined Property Listings Length: ', allProperties.length, '\n');
    } else {
      console.log('⚠️  No properties found from any URL. This could mean:');
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
  } catch (error) {
    console.error('💥 Unexpected error occurred:');
    console.error(error);
  }
}

/**
 * Function to use only the enhanced Puppeteer scraper with CSV and Database saving for multiple URLs
 */
async function scrapeWithEnhancedPuppeteer(): Promise<void> {
  let allProperties: PropertyItem[] = [];
  let totalSuccessful = 0;
  let totalFailed = 0;

  try {
    console.log('🚀 Starting Enhanced Puppeteer scraping...');
    console.log(`📍 Target URLs: ${targetUrls.length} locations`);
    console.log('⚠️  This will open a browser window - please don\'t close it during scraping\n');
    
    for (let i = 0; i < targetUrls.length; i++) {
      const targetUrl = targetUrls[i];
      console.log(`🚀 [${i + 1}/${targetUrls.length}] Enhanced scraping: ${targetUrl!.split('neighborhood=')[1] ? 'neighborhood ' + targetUrl!.split('neighborhood=')[1] : 'location ' + (i + 1)}...`);
      
      try {
        const result = await enhancedScraperService.scrapeProperties(targetUrl!);
        
        if (result.success) {
          console.log(`✅ [${i + 1}/${targetUrls.length}] Success: ${result.totalItems} properties found`);
          allProperties.push(...result.data);
          totalSuccessful++;
        } else {
          console.error(`❌ [${i + 1}/${targetUrls.length}] Failed: ${result.error}`);
          totalFailed++;
        }
      } catch (error) {
        console.error(`💥 [${i + 1}/${targetUrls.length}] Unexpected error:`, error);
        totalFailed++;
      }
    }

    console.log('\n📊 Enhanced Scraping Summary:');
    console.log(`✅ Successful: ${totalSuccessful}/${targetUrls.length} URLs`);
    console.log(`❌ Failed: ${totalFailed}/${targetUrls.length} URLs`);
    console.log(`📊 Total properties found: ${allProperties.length}\n`);

    if (allProperties.length > 0) {
      console.log('🏘️  Combined Property Listings:\n');
      
      // Show first 5 properties in console
      const displayProperties = allProperties.slice(0, 5);
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
      
      if (allProperties.length > 5) {
        console.log(`... and ${allProperties.length - 5} more properties\n`);
      }
      
      // Filter out properties with missing critical data
      const filteredProperties = allProperties.filter((property: PropertyItem) => 
        property.link !== '' && 
        property.price !== 'Price not found'
      );
      
      console.log(`📊 Filtered properties: ${filteredProperties.length} (removed ${allProperties.length - filteredProperties.length} incomplete entries)\n`);

      // Export to CSV
      try {
        console.log('📄 Exporting to CSV...');
        const csvPath = await csvExportService.exportToCSVEnhanced(filteredProperties);
        console.log(`✅ CSV export completed: ${csvPath}`);
        console.log(`📊 Exported ${filteredProperties.length} properties with enhanced data`);
      } catch (error) {
        console.error('❌ CSV export failed:', error);
      }

      // Save to Database if --db flag is provided
      const args = process.argv.slice(2);
      const saveToDatabase = args.includes('--db') || args.includes('--database');
      
      if (saveToDatabase) {
        try {
          console.log('📀 Saving to database...');
          const dbStats = await scraperDatabaseService.savePropertiesToDatabase(filteredProperties, {
            exportCsv: false, // We already exported to CSV above
            cleanOldData: true,
            cleanOldDays: 30
          });

          console.log('✅ Database save completed successfully!');
          console.log(`📀 Combined Database Stats: ${dbStats.inserted} new, ${dbStats.updated} updated, ${dbStats.skipped} skipped`);
        } catch (error) {
          console.error('❌ Database operation failed:', error);
        }
      } else {
        console.log('💡 To save to database, add --db flag: npm run dev:enhanced -- --db');
      }
    } else {
      console.log('⚠️  No properties found with enhanced scraping from any URL.');
    }
  } catch (error) {
    console.error('💥 Unexpected error with enhanced scraping:', error);
  } finally {
    await enhancedScraperService.closeBrowser();
  }
}

/**
 * Function to scrape with database-first approach (integrated scraping and database saving) for multiple URLs
 */
async function scrapeWithDatabaseIntegration(): Promise<void> {
  let totalItems = 0;
  let totalInserted = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalSuccessful = 0;
  let totalFailed = 0;

  try {
    console.log('🚀 Starting integrated scraping with database...');
    console.log(`📍 Target URLs: ${targetUrls.length} locations`);
    console.log('⚠️  This will open a browser window - please don\'t close it during scraping\n');
    
    for (let i = 0; i < targetUrls.length; i++) {
      const targetUrl = targetUrls[i];
      console.log(`🔄 [${i + 1}/${targetUrls.length}] Integrated scraping: ${targetUrl!.split('neighborhood=')[1] ? 'neighborhood ' + targetUrl!.split('neighborhood=')[1] : 'location ' + (i + 1)}...`);
      
      try {
        const result = await scraperDatabaseService.scrapeAndSaveToDatabase(targetUrl!, {
          exportCsv: i === targetUrls.length - 1, // Export CSV only on last URL
          cleanOldData: i === 0,      // Clean old data only on first URL
          cleanOldDays: 30         // Keep data for 30 days
        });
        
        if (result.success) {
          console.log(`✅ [${i + 1}/${targetUrls.length}] Success: ${result.totalItems} properties processed`);
          totalItems += result.totalItems || 0;
          totalInserted += result.dbStats?.inserted || 0;
          totalUpdated += result.dbStats?.updated || 0;
          totalSkipped += result.dbStats?.skipped || 0;
          totalSuccessful++;
        } else {
          console.error(`❌ [${i + 1}/${targetUrls.length}] Failed: ${result.error}`);
          totalFailed++;
        }
      } catch (error) {
        console.error(`💥 [${i + 1}/${targetUrls.length}] Unexpected error:`, error);
        totalFailed++;
      }
    }
    
    console.log('\n📊 Integrated Scraping Summary:');
    console.log(`✅ Successful: ${totalSuccessful}/${targetUrls.length} URLs`);
    console.log(`❌ Failed: ${totalFailed}/${targetUrls.length} URLs`);
    console.log(`📊 Total properties scraped: ${totalItems}`);
    console.log(`📀 Combined Database Stats: ${totalInserted} new, ${totalUpdated} updated, ${totalSkipped} skipped`);
    
    // Get final statistics without triggering another scrape
    if (totalSuccessful > 0) {
      try {
        const finalStats = await scraperDatabaseService.getDatabaseStatistics();

        if (finalStats) {
          console.log('\n📊 Final Database Statistics:');
          console.log(`   Today's Properties: ${finalStats.todayProperties}`);
          console.log(`   Average Price: ₪${finalStats.avgPrice}`);
          console.log(`   Top Locations:`);
          finalStats.locationCounts.slice(0, 5).forEach((loc: any, index: number) => {
            console.log(`     ${index + 1}. ${loc.location}: ${loc.count} properties`);
          });
        }
      } catch (error) {
        console.warn('⚠️ Could not fetch final statistics:', error);
      }
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
 * Example function to demonstrate how to use the scraper programmatically with multiple URLs
 */
async function getPropertiesData(): Promise<PropertyItem[]> {
  let allProperties: PropertyItem[] = [];
  
  for (const targetUrl of targetUrls) {
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
    
    if (result.success) {
      allProperties.push(...result.data);
    }
  }
  
  return allProperties;
}

// Check command line arguments to determine which scraper to use
const args = process.argv.slice(2);
const useEnhancedOnly = args.includes('--enhanced') || args.includes('-e');
const useDatabase = args.includes('--db') || args.includes('--database');
const useIntegrated = args.includes('--integrated') || args.includes('-i');

console.log('🎯 Scraping Mode Detection:');
console.log(`   Enhanced: ${useEnhancedOnly}`);
console.log(`   Database: ${useDatabase}`);
console.log(`   Integrated: ${useIntegrated}`);
console.log(`   URLs to scrape: ${targetUrls.length}\n`);

if (useIntegrated) {
  console.log('🔄 Using integrated scraping mode (scraping + database + CSV) for multiple URLs\n');
  scrapeWithDatabaseIntegration().catch(console.error);
} else if (useEnhancedOnly) {
  console.log('🚀 Using Enhanced Puppeteer mode only for multiple URLs\n');
  scrapeWithEnhancedPuppeteer().catch(console.error);
} else {
  console.log('🔧 Using fallback strategy (Basic → Enhanced) for multiple URLs\n');
  scrapeProperties().catch(console.error);
}

// Export the services and functions for use in other modules
export { basicScraperService, enhancedScraperService, scraperDatabaseService, getPropertiesData, formatPropertiesForExport }; 