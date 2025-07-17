# Database Setup Guide

This guide explains how to set up and use the MySQL database for storing scraped property data.

## Prerequisites

- Docker and Docker Compose installed
- Node.js and npm installed

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Start MySQL Database

```bash
# Start MySQL and phpMyAdmin
npm run docker:up

# Check if containers are running
docker ps

# View MySQL logs
npm run docker:logs
```

### 3. Database Access

- **MySQL Database**: `localhost:3306`
- **phpMyAdmin**: `http://localhost:8080`

**Database Credentials:**
- Host: `localhost`
- Port: `3306`
- Database: `homie_db`
- Username: `homie_user`
- Password: `homie_pass`
- Root Password: `root123`

### 4. Test Database Integration

```bash
# Test database functionality
npm run test:database

# Scrape and save to database
npm run scrape:db
```

## Data Filtering

### Database Storage Requirements
Properties are only saved to the database if they meet **ALL** of these criteria:
- ✅ **Has a valid link** (not empty, not null)
- ✅ **Has a valid price** (not "Price not found", not empty, not null)

### CSV Export
CSV files are more inclusive and contain:
- ✅ **All properties with links** (regardless of price)
- ✅ **Properties without prices** are included in CSV but excluded from database

## Usage

### Scraping with Database

```typescript
import { ScraperDatabaseService } from './services/scraper-db.service';

const scraperDb = new ScraperDatabaseService();

// Scrape and save to database
await scraperDb.scrapeAndSaveToDatabase(url, {
  exportCsv: true,        // Also export to CSV
  cleanOldData: true,     // Clean old data
  cleanOldDays: 30        // Delete data older than 30 days
});
```

### Database Operations

```typescript
// Get all properties from database
const properties = await scraperDb.getAllPropertiesFromDatabase();

// Export database to CSV
await scraperDb.exportDatabaseToCSV();

// Get database statistics
const stats = await scraperDb.getDatabaseStatistics();
```

## Table Schema

The `rental_apartments` table has the following structure:

```sql
CREATE TABLE rental_apartments (
  id VARCHAR(255) PRIMARY KEY,      -- Unique property ID from Yad2
  title TEXT,                       -- Property title
  price VARCHAR(255),               -- Price information (REQUIRED)
  location VARCHAR(255),            -- Location/neighborhood
  rooms VARCHAR(255),               -- Number of rooms
  floor VARCHAR(255),               -- Floor information
  description TEXT,                 -- Property description
  image_url TEXT,                   -- Main image URL
  link TEXT NOT NULL,               -- Link to property page (REQUIRED)
  scraped_at TIMESTAMP,             -- When property was first scraped
  updated_at TIMESTAMP              -- When property was last updated
);
```

## Features

### Data Quality Filtering
- **Database**: Only high-quality properties (with link AND price)
- **CSV**: More inclusive (all properties with links)
- **Skip Tracking**: Detailed reporting of why properties were skipped

### Duplicate Prevention
- Properties are identified by their unique ID from Yad2
- Existing properties are updated instead of duplicated
- New properties are inserted, existing ones are updated

### Data Cleanup
- Automatically removes old properties (configurable days)
- Maintains database performance

### Statistics
- Total properties count
- Today's new properties
- Average price calculations
- Location distribution

## Example Output

```bash
📀 Saving 45 properties to database...
⚠️ Skipped 8 properties:
   - 3 properties skipped due to no link
   - 5 properties skipped due to no price
✅ Database save completed: 12 new, 33 updated, 8 skipped
```

This ensures your database contains only properties that are both accessible (have links) and actionable (have prices), while maintaining complete data in CSV files for analysis and debugging. 