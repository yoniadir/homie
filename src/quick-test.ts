import { EnhancedPuppeteerScraperService } from './services/enhanced-puppeteer-scraper.service';
import { CsvExportService } from './services/csv-export.service';

async function quickTest() {
  const scraper = new EnhancedPuppeteerScraperService();
  const csvService = new CsvExportService();
  
  console.log('🚀 Quick Test: Enhanced Scraper + CSV Export');
  console.log('=============================================\n');
  
  try {
    // Test URL - smaller search for faster testing
    const testUrl = 'https://www.yad2.co.il/realestate/rent?maxPrice=8000&minRooms=3&maxRooms=3&city=5000&neighborhood=1520';
    
    console.log('📍 Test URL:', testUrl);
    console.log('⏳ This will take 30-60 seconds...\n');
    
    // Scrape properties
    const result = await scraper.scrapeProperties(testUrl);
    
    if (result.success && result.data.length > 0) {
      console.log(`✅ Scraping successful: ${result.data.length} properties found`);
      
      // Show sample data
      console.log('\n📋 Sample Property:');
      const sample = result.data[0];
      if (sample) {
        console.log(`  Title: ${sample.title.substring(0, 60)}...`);
        console.log(`  Price: ${sample.price}`);
        console.log(`  Rooms: ${sample.rooms}`);
      }
      
      // Export to CSV
      console.log('\n📄 Exporting to CSV...');
      const csvPath = await csvService.exportToCSVEnhanced(result.data);
      console.log(`✅ CSV export completed: ${csvPath}`);
      
      console.log('\n🎉 Quick test completed successfully!');
      
    } else {
      console.log(`❌ Scraping failed: ${result.error}`);
    }
    
  } catch (error) {
    console.error('💥 Quick test error:', error);
  } finally {
    await scraper.closeBrowser();
    console.log('🔄 Browser closed');
  }
}

quickTest().catch(console.error); 