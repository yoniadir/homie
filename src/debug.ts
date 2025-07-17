import { DebugScraperService } from './services/debug-scraper.service';

const debugService = new DebugScraperService();
const targetUrl = 'https://www.yad2.co.il/realestate/rent?maxPrice=10000&minRooms=3&maxRooms=4&zoom=14&topArea=2&area=1&city=5000&neighborhood=1520';

console.log('🔍 Debug Mode - Analyzing Yad2 Page Structure');
console.log('===============================================\n');

debugService.debugPageStructure(targetUrl).catch(console.error); 