import puppeteer from 'puppeteer';

async function testPuppeteer() {
  try {
    console.log('🔍 Testing Puppeteer Chrome launch...');
    
    const browser = await puppeteer.launch({
      headless: false,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    console.log('✅ Browser launched successfully');
    
    const page = await browser.newPage();
    console.log('✅ New page created');
    
    await page.goto('https://www.google.com');
    console.log('✅ Navigation successful');
    
    const title = await page.title();
    console.log(`✅ Page title: ${title}`);
    
    await browser.close();
    console.log('✅ Browser closed successfully');
    
  } catch (error) {
    console.error('❌ Puppeteer test failed:', error);
  }
}

testPuppeteer(); 