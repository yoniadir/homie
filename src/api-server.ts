import express from 'express';
import cors from 'cors';
import { ScraperDatabaseService } from './services/scraper-db.service';
import { DatabaseService } from './services/database.service';

const app = express();
const port = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// Store for tracking scraping jobs
interface ScrapingJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  progress?: string;
  result?: any;
  error?: string;
  url?: string;
}

const jobs: Map<string, ScrapingJob> = new Map();

// Generate unique job ID
const generateJobId = (): string => {
  return 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// Default target URL
const DEFAULT_URL = 'https://www.yad2.co.il/realestate/rent?maxPrice=10000&minRooms=3&maxRooms=4&zoom=14&topArea=2&area=1&city=5000&neighborhood=1520';

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

/**
 * Get API information
 */
app.get('/', (req, res) => {
  res.json({
    name: 'Homie Real Estate Scraper API',
    version: '1.0.0',
    endpoints: {
      'GET /': 'API information',
      'GET /health': 'Health check',
      'POST /scrape': 'Start scraping job',
      'GET /scrape/:jobId': 'Get scraping job status',
      'GET /scrape': 'List all jobs',
      'GET /stats': 'Get database statistics',
      'GET /properties': 'Get all properties from database',
      'GET /whatsapp/unsent': 'Get properties that haven\'t been sent via WhatsApp',
      'POST /whatsapp/mark-sent': 'Mark all properties as WhatsApp message sent',
      'POST /export': 'Export database to CSV',
      'POST /whatsapp/export-new': 'Export new properties via WhatsApp',
      'POST /whatsapp/export-today': 'Export today\'s properties via WhatsApp',
      'POST /whatsapp/export-stats': 'Export database statistics via WhatsApp',
      'DELETE /jobs/:jobId': 'Delete a completed job',
      'DELETE /jobs': 'Clear all completed jobs'
    },
    documentation: {
      scrape: {
        method: 'POST',
        url: '/scrape',
        body: {
          url: 'optional - URL to scrape (uses default if not provided)',
          options: {
            exportCsv: 'boolean - whether to export to CSV (default: true)',
            cleanOldData: 'boolean - whether to clean old data (default: true)',
            cleanOldDays: 'number - days to keep data (default: 30)'
          }
        }
      }
    }
  });
});

/**
 * Start a scraping job
 */
app.post('/scrape', async (req, res) => {
  try {
    const { url, options } = req.body;
    const targetUrl = url || DEFAULT_URL;
    const scrapingOptions = {
      exportCsv: true,
      cleanOldData: true,
      cleanOldDays: 30,
      ...options
    };

    const jobId = generateJobId();
    const job: ScrapingJob = {
      id: jobId,
      status: 'pending',
      startTime: new Date(),
      url: targetUrl
    };

    jobs.set(jobId, job);

    // Start scraping asynchronously
    runScrapingJob(jobId, targetUrl, scrapingOptions);

    res.json({
      success: true,
      jobId,
      message: 'Scraping job started',
      status: 'pending',
      checkStatusUrl: `/scrape/${jobId}`
    });
  } catch (error) {
    console.error('Error starting scraping job:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start scraping job',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get scraping job status
 */
app.get('/scrape/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }

  return res.json({
    success: true,
    job: {
      id: job.id,
      status: job.status,
      startTime: job.startTime,
      endTime: job.endTime,
      progress: job.progress,
      url: job.url,
      duration: job.endTime ? job.endTime.getTime() - job.startTime.getTime() : Date.now() - job.startTime.getTime(),
      result: job.result,
      error: job.error
    }
  });
});

/**
 * List all jobs
 */
app.get('/scrape', (req, res) => {
  const allJobs = Array.from(jobs.values()).map(job => ({
    id: job.id,
    status: job.status,
    startTime: job.startTime,
    endTime: job.endTime,
    url: job.url,
    duration: job.endTime ? job.endTime.getTime() - job.startTime.getTime() : Date.now() - job.startTime.getTime()
  }));

  res.json({
    success: true,
    jobs: allJobs,
    total: allJobs.length
  });
});

/**
 * Get database statistics
 */
app.get('/stats', async (req, res) => {
  try {
    const scraperDb = new ScraperDatabaseService();
    const stats = await scraperDb.getDatabaseStatistics();
    
    res.json({
      success: true,
      statistics: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting database statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get database statistics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Get all properties from database
 */
app.get('/properties', async (req, res) => {
  try {
    const scraperDb = new ScraperDatabaseService();
    const properties = await scraperDb.getAllPropertiesFromDatabase();
    
    res.json({
      success: true,
      properties,
      count: properties.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting properties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get properties',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Export database to CSV
 */
app.post('/export', async (req, res) => {
  try {
    const scraperDb = new ScraperDatabaseService();
    const csvPath = await scraperDb.exportDatabaseToCSV();
    
    res.json({
      success: true,
      csvPath,
      message: 'Database exported to CSV',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error exporting to CSV:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export to CSV',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Delete a completed job
 */
app.delete('/jobs/:jobId', (req, res) => {
  const { jobId } = req.params;
  const job = jobs.get(jobId);

  if (!job) {
    return res.status(404).json({
      success: false,
      error: 'Job not found'
    });
  }

  if (job.status === 'running') {
    return res.status(400).json({
      success: false,
      error: 'Cannot delete a running job'
    });
  }

  jobs.delete(jobId);
  return res.json({
    success: true,
    message: 'Job deleted successfully'
  });
});

/**
 * Clear all completed jobs
 */
app.delete('/jobs', (req, res) => {
  const completedJobs = Array.from(jobs.entries()).filter(([_, job]) => 
    job.status === 'completed' || job.status === 'failed'
  );

  completedJobs.forEach(([jobId, _]) => {
    jobs.delete(jobId);
  });

  res.json({
    success: true,
    message: `Cleared ${completedJobs.length} completed jobs`,
    remaining: jobs.size
  });
});

/**
 * Get all properties that haven't been sent via WhatsApp
 */
app.get('/whatsapp/unsent', async (req, res) => {
  try {
    const dbService = new DatabaseService();
    await dbService.connect();
    
    const unsentProperties = await dbService.getPropertiesWithoutWhatsAppMessage();
    
    await dbService.disconnect();
    
    res.json({
      success: true,
      properties: unsentProperties,
      count: unsentProperties.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting unsent properties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get unsent properties',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Mark all properties as WhatsApp message sent
 */
app.post('/whatsapp/mark-sent', async (req, res) => {
  try {
    const dbService = new DatabaseService();
    await dbService.connect();
    
    const updatedCount = await dbService.markAllPropertiesAsWhatsAppSent();
    
    await dbService.disconnect();
    
    res.json({
      success: true,
      message: `Successfully marked ${updatedCount} properties as WhatsApp message sent`,
      updatedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error marking properties as sent:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to mark properties as sent',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * Run scraping job asynchronously
 */
async function runScrapingJob(jobId: string, url: string, options: any): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) return;

  try {
    job.status = 'running';
    job.progress = 'Starting scraper...';
    console.log(`🚀 Starting scraping job ${jobId} for URL: ${url}`);

    const scraperDb = new ScraperDatabaseService();
    
    job.progress = 'Scraping properties...';
    const result = await scraperDb.scrapeAndSaveToDatabase(url, options);

    job.status = 'completed';
    job.endTime = new Date();
    job.result = {
      success: result.success,
      totalItems: result.totalItems,
      dbStats: result.dbStats,
      timestamp: result.timestamp
    };
    job.progress = 'Completed successfully';

    console.log(`✅ Scraping job ${jobId} completed successfully`);
    console.log(`📊 Results: ${result.totalItems} properties scraped`);
  } catch (error) {
    job.status = 'failed';
    job.endTime = new Date();
    job.error = error instanceof Error ? error.message : 'Unknown error';
    job.progress = 'Failed';

    console.error(`❌ Scraping job ${jobId} failed:`, error);
  }
}

/**
 * Cleanup old jobs periodically
 */
setInterval(() => {
  const cutoffTime = new Date();
  cutoffTime.setHours(cutoffTime.getHours() - 24); // Keep jobs for 24 hours

  for (const [jobId, job] of jobs.entries()) {
    if (job.endTime && job.endTime < cutoffTime) {
      jobs.delete(jobId);
      console.log(`🗑️ Cleaned up old job: ${jobId}`);
    }
  }
}, 60 * 60 * 1000); // Run every hour

// Start server
app.listen(port, () => {
  console.log(`🌐 Homie Scraper API Server running on port ${port}`);
  console.log(`📖 API Documentation: http://localhost:${port}`);
  console.log(`🔍 Health Check: http://localhost:${port}/health`);
  console.log(`📊 Database Stats: http://localhost:${port}/stats`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Received SIGINT, shutting down gracefully...');
  process.exit(0);
}); 