import { EnhancedPuppeteerScraperService } from './services/enhanced-puppeteer-scraper.service';

async function testEnhancedScraper() {
  const scraper = new EnhancedPuppeteerScraperService();
  const testUrl = 'https://www.yad2.co.il/realestate/rent?maxPrice=10000&minRooms=3&maxRooms=4&zoom=14&topArea=2&area=1&city=5000&neighborhood=1520';

  try {
    console.log('🧪 Testing Enhanced Puppeteer Scraper');
    console.log('=====================================\n');
    
    console.log('🚀 Starting test...');
    const result = await scraper.scrapeProperties(testUrl);
    
    if (result.success) {
      console.log('✅ Test passed!');
      console.log(`📊 Found ${result.totalItems} properties`);
      console.log(`🕐 Completed at: ${result.timestamp.toLocaleString()}`);
    } else {
      console.log('❌ Test failed:');
      console.log(`Error: ${result.error}`);
    }
    
  } catch (error) {
    console.error('💥 Test error:', error);
  } finally {
    await scraper.closeBrowser();
    console.log('🏁 Test completed, browser closed');
  }
}

testEnhancedScraper().catch(console.error); 