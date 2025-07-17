import puppeteer, { Browser, Page } from 'puppeteer';
import { PropertyItem, ScrapingResult } from '../interfaces/property.interface';

export class PuppeteerScraperService {
  private browser: Browser | null = null;

  /**
   * Initialize the browser
   */
  async initBrowser(): Promise<void> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      });
    }
  }

  /**
   * Close the browser
   */
  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Scrapes property listings from Yad2 using Puppeteer
   * @param url - The Yad2 URL to scrape
   * @returns Promise<ScrapingResult>
   */
  async scrapeProperties(url: string): Promise<ScrapingResult> {
    let page: Page | null = null;
    
    try {
      console.log(`🚀 Starting Puppeteer scraping: ${url}`);
      
      await this.initBrowser();
      
      if (!this.browser) {
        throw new Error('Failed to initialize browser');
      }

      page = await this.browser.newPage();
      
      // Set user agent and viewport
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to the page
      console.log('🔍 Navigating to page...');
      await page.goto(url, { 
        waitUntil: 'networkidle2',
        timeout: 30000 
      });

      // Wait a bit for any dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get page title to check for bot protection
      const title = await page.title();
      console.log(`📄 Page title: ${title}`);

      if (title.includes('ShieldSquare Captcha') || title.includes('Captcha')) {
        console.warn('🚫 Bot protection detected, trying to handle...');
        
        // Try to wait for potential auto-redirect or content loading
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check if we're still on the captcha page
        const newTitle = await page.title();
        if (newTitle.includes('ShieldSquare Captcha') || newTitle.includes('Captcha')) {
          return {
            success: false,
            data: [],
            error: 'Bot protection (ShieldSquare Captcha) is still active. Manual intervention may be required.',
            timestamp: new Date(),
            totalItems: 0
          };
        }
      }

      // Look for the feed list container
      console.log('🔍 Looking for feed-list container...');
      
      // Wait for the feed list to appear (if it exists)
      try {
        await page.waitForSelector('[data-testid="feed-list"]', { timeout: 10000 });
      } catch (error) {
        console.log('Feed-list container not found, trying alternative selectors...');
      }

      // Extract property data using evaluate
      const properties = await page.evaluate(() => {
        const extractedProperties: any[] = [];
        
        // Define multiple selectors to try
        const selectors = [
          '[data-testid="feed-list"] [data-testid*="item"]',
          '[data-testid="feed-list"] .feeditem',
          '[data-testid="feed-list"] .item',
          '[data-testid="feed-list"] > div',
          '[data-testid="feed-list"] article',
          '.feed-list-item',
          '.item-card',
          '.property-card'
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          
          if (elements.length > 0) {
            console.log(`Found ${elements.length} items with selector: ${selector}`);
            
            elements.forEach((element, index) => {
              try {
                const property = {
                  id: element.getAttribute('data-id') || element.id || `item-${index}`,
                  title: element.querySelector('[data-testid="title"], .title, h2, h3')?.textContent?.trim() || 'No title',
                  price: element.querySelector('[data-testid="price"], .price')?.textContent?.trim() || 'Price not available',
                  location: element.querySelector('[data-testid="location"], .location, .address')?.textContent?.trim() || 'Location not available',
                  rooms: element.querySelector('[data-testid="rooms"], .rooms')?.textContent?.trim() || 'Rooms not specified',
                  area: element.querySelector('[data-testid="area"], .area, .size')?.textContent?.trim() || 'Area not specified',
                  floor: element.querySelector('[data-testid="floor"], .floor')?.textContent?.trim() || 'Floor not specified',
                  description: element.querySelector('[data-testid="description"], .description, p')?.textContent?.trim() || 'No description',
                  imageUrl: element.querySelector('img')?.getAttribute('src') || element.querySelector('img')?.getAttribute('data-src') || '',
                  link: element.querySelector('a')?.getAttribute('href') || '',
                  contactInfo: element.querySelector('[data-testid="contact"], .contact, .phone')?.textContent?.trim() || 'Contact info not available'
                };

                // Only add if we have meaningful data and a valid link
                if ((property.title !== 'No title' || property.price !== 'Price not available') && property.link !== '') {
                  extractedProperties.push(property);
                }
              } catch (error) {
                console.warn(`Error extracting property at index ${index}:`, error);
              }
            });
            
            if (extractedProperties.length > 0) {
              break; // Stop trying other selectors if we found items
            }
          }
        }

        return extractedProperties;
      });

      console.log(`✅ Successfully extracted ${properties.length} properties`);

      return {
        success: true,
        data: properties,
        timestamp: new Date(),
        totalItems: properties.length
      };

    } catch (error) {
      console.error('❌ Puppeteer scraping failed:', error);
      
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
        totalItems: 0
      };
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Take a screenshot of the page for debugging
   */
  async takeScreenshot(url: string, filename: string = 'screenshot.png'): Promise<string> {
    let page: Page | null = null;
    
    try {
      await this.initBrowser();
      
      if (!this.browser) {
        throw new Error('Failed to initialize browser');
      }

      page = await this.browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      await page.goto(url, { waitUntil: 'networkidle2' });
      
      await page.screenshot({ path: filename as `${string}.png`, fullPage: true });
      
      return filename;
    } catch (error) {
      throw new Error(`Screenshot failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      if (page) {
        await page.close();
      }
    }
  }
} 