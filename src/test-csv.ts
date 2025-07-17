import { CsvExportService } from './services/csv-export.service';
import { PropertyItem } from './interfaces/property.interface';

async function testCsvExport() {
  const csvService = new CsvExportService();
  
  // Create sample property data
  const sampleProperties: PropertyItem[] = [
    {
      id: 'test-1',
      title: 'דירה 3 חדרים בתל אביב',
      price: '8500₪',
      location: 'תל אביב יפו',
      rooms: '3 חדרים',
      area: '80 מ"ר',
      floor: 'קומה 2',
      description: 'דירה יפה במרכז העיר',
      imageUrl: 'https://example.com/image1.jpg',
      link: 'https://yad2.co.il/property/1',
      contactInfo: '050-1234567'
    },
    {
      id: 'test-2', 
      title: 'בית פרטי 4 חדרים',
      price: '12000₪',
      location: 'רמת גן',
      rooms: '4 חדרים',
      area: '120 מ"ר',
      floor: 'קרקע',
      description: 'בית עם גינה',
      imageUrl: 'https://example.com/image2.jpg',
      link: 'https://yad2.co.il/property/2',
      contactInfo: '052-9876543'
    }
  ];

  try {
    console.log('🧪 Testing CSV Export Service');
    console.log('===============================\n');
    
    console.log(`📊 Sample data: ${sampleProperties.length} properties`);
    
    // Test basic CSV export
    console.log('📄 Testing basic CSV export...');
    const basicPath = await csvService.exportToCSV(sampleProperties, 'test_basic.csv');
    console.log(`✅ Basic CSV created: ${basicPath}`);
    
    // Test enhanced CSV export
    console.log('📄 Testing enhanced CSV export...');
    const enhancedPath = await csvService.exportToCSVEnhanced(sampleProperties, 'test_enhanced.csv');
    console.log(`✅ Enhanced CSV created: ${enhancedPath}`);
    
    console.log('\n🎉 CSV export test completed successfully!');
    console.log('📂 Check the exports/ directory for the CSV files');
    
  } catch (error) {
    console.error('❌ CSV export test failed:', error);
  }
}

testCsvExport().catch(console.error); 