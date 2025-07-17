import * as fs from 'fs';
import * as path from 'path';
import { PropertyItem } from '../interfaces/property.interface';

export class CsvExportService {
  /**
   * Export properties to CSV file
   * @param properties - Array of property items to export
   * @param filename - Optional filename (default: properties_TIMESTAMP.csv)
   * @returns Promise<string> - Path to the created CSV file
   */
  async exportToCSV(properties: PropertyItem[], filename?: string): Promise<string> {
    try {
      // Create exports directory if it doesn't exist
      const exportsDir = path.join(process.cwd(), 'exports');
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      // Generate filename if not provided
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const timeStr = new Date().toLocaleTimeString('he-IL', { hour12: false }).replace(/:/g, '-');
        filename = `yad2_properties_${timestamp}_${timeStr}.csv`;
      }

      const filePath = path.join(exportsDir, filename);

      // Create CSV content
      const csvContent = this.generateCSVContent(properties);

      // Write to file
      fs.writeFileSync(filePath, csvContent, 'utf8');

      console.log(`✅ CSV export completed: ${filePath}`);
      console.log(`📊 Exported ${properties.length} properties`);

      return filePath;
    } catch (error) {
      console.error('❌ CSV export failed:', error);
      throw error;
    }
  }

  /**
   * Generate CSV content from properties array
   * @param properties - Array of property items
   * @returns string - CSV formatted content
   */
  private generateCSVContent(properties: PropertyItem[]): string {
    // Define CSV headers
    const headers = [
      'ID',
      'Title',
      'Price',
      'Location', 
      'Rooms',
      'Floor',
      'Description',
      'Image URL',
      'Link',
      'Contact Info',
      'Timestamp'
    ];

    // Create CSV rows
    const rows = properties.map(property => [
      this.escapeCsvField(property.id),
      this.escapeCsvField(property.title),
      this.escapeCsvField(property.price),
      this.escapeCsvField(property.location),
      this.escapeCsvField(property.rooms),
      this.escapeCsvField(property.floor),
      this.escapeCsvField(property.description),
      this.escapeCsvField(property.imageUrl),
      this.escapeCsvField(property.link),
      this.escapeCsvField(property.contactInfo),
      this.escapeCsvField(new Date().toISOString())
    ]);

    // Combine headers and rows
    const allRows = [headers, ...rows];

    // Convert to CSV string
    return allRows.map(row => row.join(',')).join('\n');
  }

  /**
   * Escape CSV field to handle commas, quotes, and newlines
   * @param field - Field value to escape
   * @returns string - Escaped field value
   */
  private escapeCsvField(field: string): string {
    if (!field) return '""';
    
    // Convert to string and remove extra whitespace
    const cleaned = String(field).trim();
    
    // If field contains comma, quote, or newline, wrap in quotes and escape internal quotes
    if (cleaned.includes(',') || cleaned.includes('"') || cleaned.includes('\n') || cleaned.includes('\r')) {
      return `"${cleaned.replace(/"/g, '""')}"`;
    }
    
    return `"${cleaned}"`;
  }

  /**
   * Export properties with enhanced formatting for Hebrew content
   * @param properties - Array of property items to export
   * @param filename - Optional filename
   * @returns Promise<string> - Path to the created CSV file
   */
  async exportToCSVEnhanced(properties: PropertyItem[], filename?: string): Promise<string> {
    try {
      // Create exports directory if it doesn't exist
      const exportsDir = path.join(process.cwd(), 'exports');
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }

      // Generate filename if not provided
      if (!filename) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
        const timeStr = new Date().toLocaleTimeString('he-IL', { hour12: false }).replace(/:/g, '-');
        filename = `yad2_properties_enhanced_${timestamp}_${timeStr}.csv`;
      }

      const filePath = path.join(exportsDir, filename);

      // Enhanced CSV with additional processing
      const enhancedProperties = properties.map(property => ({
        ...property,
        // Clean and format price
        priceClean: this.extractNumericPrice(property.price),
        // Extract room number
        roomsNumber: this.extractRoomNumber(property.rooms),
        // Clean title (remove duplicates and extra text)
        titleClean: this.cleanTitle(property.title),
        // Extract city/neighborhood
        cityNeighborhood: this.extractLocation(property.title + ' ' + property.location),
        // Export timestamp
        exportedAt: new Date().toISOString()
      }));

      // Enhanced headers (removed area columns)
      const headers = [
        'ID',
        'Title (Original)',
        'Title (Cleaned)',
        'Price (Original)', 
        'Price (Numeric)',
        'Location',
        'City/Neighborhood',
        'Rooms (Original)',
        'Rooms (Number)',
        'Floor',
        'Description',
        'Image URL',
        'Link',
        'Exported At'
      ];

      // Create enhanced CSV rows (removed area fields)
      const rows = enhancedProperties.map(property => [
        this.escapeCsvField(property.id),
        this.escapeCsvField(property.title),
        this.escapeCsvField(property.titleClean),
        this.escapeCsvField(property.price),
        this.escapeCsvField(property.priceClean),
        this.escapeCsvField(property.location),
        this.escapeCsvField(property.cityNeighborhood),
        this.escapeCsvField(property.rooms),
        this.escapeCsvField(property.roomsNumber),
        this.escapeCsvField(property.floor),
        this.escapeCsvField(property.description),
        this.escapeCsvField(property.imageUrl),
        this.escapeCsvField(property.link),
        this.escapeCsvField(property.exportedAt)
      ]);

      // Combine headers and rows
      const allRows = [headers, ...rows];
      const csvContent = allRows.map(row => row.join(',')).join('\n');

      // Write to file with UTF-8 BOM for proper Hebrew display in Excel
      const bom = '\uFEFF';
      fs.writeFileSync(filePath, bom + csvContent, 'utf8');

      console.log(`✅ Enhanced CSV export completed: ${filePath}`);
      console.log(`📊 Exported ${properties.length} properties with enhanced data`);
      console.log(`📂 File location: ${filePath}`);

      return filePath;
    } catch (error) {
      console.error('❌ Enhanced CSV export failed:', error);
      throw error;
    }
  }

  /**
   * Extract numeric price from price string
   */
  private extractNumericPrice(price: string): string {
    if (!price) return '';
    const match = price.match(/(\d[\d,]*)/);
    return match && match[1] ? match[1].replace(/,/g, '') : '';
  }

  /**
   * Extract room number from rooms string
   */
  private extractRoomNumber(rooms: string): string {
    if (!rooms) return '';
    const match = rooms.match(/(\d+(?:\.\d+)?)/);
    return match && match[1] ? match[1] : '';
  }

  /**
   * Clean title by removing duplicates and agency names
   */
  private cleanTitle(title: string): string {
    if (!title) return '';
    
    // Remove common real estate agency patterns
    let cleaned = title
      .replace(/ריל קפיטל/g, '')
      .replace(/פרופרטי \d+/g, '')
      .replace(/הומלי בא לי בית/g, '')
      .replace(/גלובס נכסים/g, '')
      .replace(/נדב פרז - נדל"ן תל אביבי/g, '')
      .replace(/מני אדטו ניהול ותיווך נדל"ן/g, '')
      .replace(/בר בן נכסים/g, '')
      .replace(/תיקי נדלן/g, '')
      .replace(/Proud Tlv Real Estate/g, '')
      .trim();

    // Remove duplicate words
    const words = cleaned.split(' ');
    const uniqueWords = words.filter((word, index) => 
      words.indexOf(word) === index || word.length < 3
    );
    
    return uniqueWords.join(' ').trim();
  }

  /**
   * Extract location information
   */
  private extractLocation(text: string): string {
    if (!text) return '';
    
    // Look for Tel Aviv areas
    const locations = [
      'תל אביב יפו', 'תל אביב', 'לב תל אביב', 'לב העיר צפון',
      'דיזינגוף', 'רוטשילד', 'בן יהודה', 'נחמני', 'מזא"ה',
      'מונטיפיורי', 'בלפור', 'אוליפנט', 'קרית ספר'
    ];
    
    for (const location of locations) {
      if (text.includes(location)) {
        return location;
      }
    }
    
    return '';
  }

  /**
   * Classify property type
   */
  private classifyPropertyType(title: string): string {
    if (!title) return 'Unknown';
    
    if (title.includes('דירה')) return 'Apartment';
    if (title.includes('בית פרטי') || title.includes('קוטג')) return 'House';
    if (title.includes('פנטהאוז') || title.includes('גג')) return 'Penthouse';
    if (title.includes('סאבלט')) return 'Sublet';
    if (title.includes('דירת גן')) return 'Garden Apartment';
    if (title.includes('לופט') || title.includes('סטודיו')) return 'Studio/Loft';
    
    return 'Apartment'; // Default
  }
} 