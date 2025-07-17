import mysql from 'mysql2/promise';
import { PropertyItem } from '../interfaces/property.interface';

export interface DatabaseConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
}

export class DatabaseService {
  private connection: mysql.Connection | null = null;
  private config: DatabaseConfig;

  constructor(config?: DatabaseConfig) {
    this.config = config || {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'homie_user',
      password: process.env.DB_PASSWORD || 'homie_pass',
      database: process.env.DB_NAME || 'homie_db'
    };
  }

  /**
   * Connect to MySQL database
   */
  async connect(): Promise<void> {
    try {
      this.connection = await mysql.createConnection({
        host: this.config.host,
        port: this.config.port,
        user: this.config.user,
        password: this.config.password,
        database: this.config.database,
        charset: 'utf8mb4'
      });
      
      console.log('✅ Connected to MySQL database');
    } catch (error) {
      console.error('❌ Failed to connect to MySQL:', error);
      throw error;
    }
  }

  /**
   * Disconnect from MySQL database
   */
  async disconnect(): Promise<void> {
    if (this.connection) {
      await this.connection.end();
      this.connection = null;
      console.log('✅ Disconnected from MySQL database');
    }
  }

  /**
   * Create the rental_apartments table if it doesn't exist
   */
  async createTable(): Promise<void> {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS rental_apartments (
        id VARCHAR(255) PRIMARY KEY,
        title TEXT,
        price VARCHAR(255),
        location VARCHAR(255),
        rooms VARCHAR(255),
        floor VARCHAR(255),
        description TEXT,
        image_url TEXT,
        link TEXT NOT NULL,
        isWhatsappMessageSent BOOLEAN DEFAULT FALSE,
        scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_location (location),
        INDEX idx_price (price),
        INDEX idx_rooms (rooms),
        INDEX idx_scraped_at (scraped_at),
        INDEX idx_link (link),
        INDEX idx_whatsapp_sent (isWhatsappMessageSent)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `;

    try {
      await this.connection.execute(createTableQuery);
      console.log('✅ rental_apartments table created/verified');
    } catch (error) {
      console.error('❌ Failed to create table:', error);
      throw error;
    }
  }

  /**
   * Insert or update a single property (avoid duplicates)
   */
  async upsertProperty(property: PropertyItem): Promise<void> {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    // Skip properties without links
    if (!property.link || property.link.trim() === '') {
      console.log(`⚠️ Skipping property ${property.id} - no link provided`);
      return;
    }

    const upsertQuery = `
      INSERT INTO rental_apartments 
      (id, title, price, location, rooms, floor, description, image_url, link, isWhatsappMessageSent)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, FALSE)
      ON DUPLICATE KEY UPDATE
        title = VALUES(title),
        price = VALUES(price),
        location = VALUES(location),
        rooms = VALUES(rooms),
        floor = VALUES(floor),
        description = VALUES(description),
        image_url = VALUES(image_url),
        link = VALUES(link),
        updated_at = CURRENT_TIMESTAMP
    `;

    try {
      await this.connection.execute(upsertQuery, [
        property.id,
        property.title,
        property.price,
        property.location,
        property.rooms,
        property.floor,
        property.description,
        property.imageUrl,
        property.link
      ]);
    } catch (error) {
      console.error(`❌ Failed to upsert property ${property.id}:`, error);
      throw error;
    }
  }

  /**
   * Bulk insert/update properties (only those with links)
   */
  async upsertProperties(properties: PropertyItem[]): Promise<{ inserted: number; updated: number; skipped: number }> {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    // Filter properties to only include those with links
    const validProperties = properties.filter(property => {
      const hasLink = property.link && property.link.trim() !== '';
      if (!hasLink) {
        skipped++;
        console.log(`⚠️ Skipping property ${property.id} - no link`);
      }
      return hasLink;
    });

    console.log(`📀 Saving ${validProperties.length} properties to database (${skipped} skipped due to missing links)...`);

    try {
      // Start transaction
      await this.connection.beginTransaction();

      for (const property of validProperties) {
        // Check if property exists
        const checkQuery = 'SELECT id FROM rental_apartments WHERE id = ?';
        const [rows] = await this.connection.execute(checkQuery, [property.id]);
        
        const exists = Array.isArray(rows) && rows.length > 0;
        
        await this.upsertProperty(property);
        
        if (exists) {
          updated++;
        } else {
          inserted++;
        }
      }

      // Commit transaction
      await this.connection.commit();
      
      console.log(`✅ Database save completed: ${inserted} new, ${updated} updated, ${skipped} skipped`);
      return { inserted, updated, skipped };
      
    } catch (error) {
      // Rollback transaction on error
      await this.connection.rollback();
      console.error('❌ Failed to save properties to database:', error);
      throw error;
    }
  }

  /**
   * Get all properties from database
   */
  async getAllProperties(): Promise<PropertyItem[]> {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    const selectQuery = `
      SELECT id, title, price, location, rooms, floor, description, 
             image_url as imageUrl, link
      FROM rental_apartments 
      ORDER BY scraped_at DESC
    `;

    try {
      const [rows] = await this.connection.execute(selectQuery);
      // Add contactInfo as empty string since it's required by the interface
      return (rows as any[]).map(row => ({
        ...row,
        contactInfo: 'Contact info not available'
      })) as PropertyItem[];
    } catch (error) {
      console.error('❌ Failed to fetch properties from database:', error);
      throw error;
    }
  }

  /**
   * Get properties count
   */
  async getPropertiesCount(): Promise<number> {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    const countQuery = 'SELECT COUNT(*) as count FROM rental_apartments';

    try {
      const [rows] = await this.connection.execute(countQuery);
      const result = rows as Array<{ count: number }>;
      return result[0]?.count || 0;
    } catch (error) {
      console.error('❌ Failed to get properties count:', error);
      throw error;
    }
  }

  /**
   * Delete old properties (older than specified days)
   */
  async deleteOldProperties(days: number = 30): Promise<number> {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    const deleteQuery = `
      DELETE FROM rental_apartments 
      WHERE scraped_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `;

    try {
      const [result] = await this.connection.execute(deleteQuery, [days]);
      const deletedCount = (result as any).affectedRows || 0;
      
      if (deletedCount > 0) {
        console.log(`🗑️ Deleted ${deletedCount} old properties (older than ${days} days)`);
      }
      
      return deletedCount;
    } catch (error) {
      console.error('❌ Failed to delete old properties:', error);
      throw error;
    }
  }

  /**
   * Get database statistics
   */
  async getStatistics(): Promise<{
    totalProperties: number;
    todayProperties: number;
    avgPrice: number;
    locationCounts: Array<{ location: string; count: number }>;
  }> {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    try {
      // Total properties
      const totalQuery = 'SELECT COUNT(*) as total FROM rental_apartments';
      const [totalResult] = await this.connection.execute(totalQuery);
      const total = (totalResult as Array<{ total: number }>)[0]?.total || 0;

      // Today's properties
      const todayQuery = 'SELECT COUNT(*) as today FROM rental_apartments WHERE DATE(scraped_at) = CURDATE()';
      const [todayResult] = await this.connection.execute(todayQuery);
      const today = (todayResult as Array<{ today: number }>)[0]?.today || 0;

      // Average price (extract numeric value)
      const avgQuery = `
        SELECT AVG(CAST(REGEXP_REPLACE(price, '[^0-9]', '') AS UNSIGNED)) as avgPrice 
        FROM rental_apartments 
        WHERE price REGEXP '[0-9]'
      `;
      const [avgResult] = await this.connection.execute(avgQuery);
      const avgPrice = (avgResult as Array<{ avgPrice: number }>)[0]?.avgPrice || 0;

      // Location counts
      const locationQuery = `
        SELECT location, COUNT(*) as count 
        FROM rental_apartments 
        WHERE location IS NOT NULL AND location != '' 
        GROUP BY location 
        ORDER BY count DESC 
        LIMIT 10
      `;
      const [locationResult] = await this.connection.execute(locationQuery);
      const locationCounts = locationResult as Array<{ location: string; count: number }>;

      return {
        totalProperties: total,
        todayProperties: today,
        avgPrice: Math.round(avgPrice),
        locationCounts
      };
    } catch (error) {
      console.error('❌ Failed to get database statistics:', error);
      throw error;
    }
  }

  /**
   * Get all properties where WhatsApp message has not been sent
   */
  async getPropertiesWithoutWhatsAppMessage(): Promise<PropertyItem[]> {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    const query = `
      SELECT 
        id,
        title,
        price,
        location,
        rooms,
        floor,
        description,
        image_url as imageUrl,
        link,
        isWhatsappMessageSent,
        scraped_at,
        updated_at
      FROM rental_apartments 
      WHERE isWhatsappMessageSent = FALSE
      ORDER BY scraped_at DESC
    `;

    try {
      const [rows] = await this.connection.execute(query);
      return rows as PropertyItem[];
    } catch (error) {
      console.error('❌ Failed to get properties without WhatsApp message:', error);
      throw error;
    }
  }

  /**
   * Mark all properties as WhatsApp message sent
   */
  async markAllPropertiesAsWhatsAppSent(): Promise<number> {
    if (!this.connection) {
      throw new Error('Database connection not established');
    }

    const query = `
      UPDATE rental_apartments 
      SET isWhatsappMessageSent = TRUE, updated_at = CURRENT_TIMESTAMP
      WHERE isWhatsappMessageSent = FALSE
    `;

    try {
      const [result] = await this.connection.execute(query);
      const affectedRows = (result as any).affectedRows || 0;
      console.log(`✅ Marked ${affectedRows} properties as WhatsApp message sent`);
      return affectedRows;
    } catch (error) {
      console.error('❌ Failed to mark properties as WhatsApp sent:', error);
      throw error;
    }
  }
} 