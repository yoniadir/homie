import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001';

async function testAPI() {
  try {
    console.log('🧪 Testing Homie Scraper API...\n');

    // Test health check
    console.log('1. Health Check:');
    const healthResponse = await axios.get(`${API_BASE_URL}/health`);
    console.log('✅ Health:', healthResponse.data);
    console.log('');

    // Get API info
    console.log('2. API Information:');
    const infoResponse = await axios.get(`${API_BASE_URL}/`);
    console.log('✅ API Info:', infoResponse.data.name);
    console.log('');

    // Start scraping job
    console.log('3. Starting Scraping Job:');
    const scrapeResponse = await axios.post(`${API_BASE_URL}/scrape`, {
      options: {
        exportCsv: true,
        cleanOldData: true,
        cleanOldDays: 30
      }
    });
    console.log('✅ Scraping started:', scrapeResponse.data);
    const jobId = scrapeResponse.data.jobId;
    console.log('');

    // Monitor job progress
    console.log('4. Monitoring Job Progress:');
    let jobCompleted = false;
    let attempts = 0;
    const maxAttempts = 60; // Wait up to 10 minutes

    while (!jobCompleted && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
      
      const statusResponse = await axios.get(`${API_BASE_URL}/scrape/${jobId}`);
      const job = statusResponse.data.job;
      
      console.log(`📊 Job ${jobId}:`);
      console.log(`   Status: ${job.status}`);
      console.log(`   Progress: ${job.progress || 'N/A'}`);
      console.log(`   Duration: ${Math.round(job.duration / 1000)}s`);
      
      if (job.status === 'completed') {
        console.log('✅ Job completed successfully!');
        console.log(`📊 Results: ${job.result?.totalItems || 0} properties scraped`);
        if (job.result?.dbStats) {
          console.log(`📀 Database: ${job.result.dbStats.inserted} new, ${job.result.dbStats.updated} updated`);
        }
        jobCompleted = true;
      } else if (job.status === 'failed') {
        console.log('❌ Job failed:', job.error);
        jobCompleted = true;
      }
      
      attempts++;
      console.log('');
    }

    // Get database statistics
    console.log('5. Database Statistics:');
    const statsResponse = await axios.get(`${API_BASE_URL}/stats`);
    console.log('✅ Database Stats:', statsResponse.data.statistics);
    console.log('');

    // Get all jobs
    console.log('6. All Jobs:');
    const jobsResponse = await axios.get(`${API_BASE_URL}/scrape`);
    console.log('✅ Total Jobs:', jobsResponse.data.total);
    console.log('');

    console.log('🎉 API Test completed successfully!');

  } catch (error) {
    console.error('❌ API Test failed:', error instanceof Error ? error.message : error);
  }
}

// Run the test
testAPI();


