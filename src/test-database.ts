import { ScraperDatabaseService } from './services/scraper-db.service';

async function testDatabase() {
  const scraperDb = new ScraperDatabaseService();
  
  try {
    // Test URL - you can replace with your actual URL
    const url = 'https://www.yad2.co.il/realestate/rent?maxPrice=10000&minRooms=3&maxRooms=4&zoom=14&topArea=2&area=1&city=5000&neighborhood=1520';
    
    console.log('🚀 Testing scraper with database integration...');
    
    // Scrape and save to database
    const result = await scraperDb.scrapeAndSaveToDatabase(url, {
      exportCsv: true,
      cleanOldData: true,
      cleanOldDays: 30
    });
    
    console.log('✅ Test completed successfully');
    console.log(`📊 Scraped ${result.totalItems} properties`);
    console.log(`📀 Database: ${result.dbStats?.inserted} new, ${result.dbStats?.updated} updated`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testDatabase();