import puppeteer, { Browser, Page } from 'puppeteer';
import { PropertyItem, ScrapingResult } from '../interfaces/property.interface';

export class EnhancedPuppeteerScraperService {
  private browser: Browser | null = null;

  async initBrowser(): Promise<void> {
    if (!this.browser) {
      // Detect if running in Docker
      const isDocker = process.env.DOCKER_ENV === 'true' || process.env.NODE_ENV === 'production';
      
      this.browser = await puppeteer.launch({
        headless: isDocker,
        ...(isDocker && { executablePath: '/usr/bin/google-chrome-stable' }),
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--no-first-run',
          '--disable-extensions',
          '--disable-default-apps',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--disable-ipc-flooding-protection',
          '--disable-renderer-backgrounding',
          '--disable-backgrounding-occluded-windows',
          '--disable-background-timer-throttling',
          '--disable-background-networking',
          '--disable-breakpad',
          '--disable-component-extensions-with-background-pages',
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--disable-features=TranslateUI,BlinkGenPropertyTrees',
          '--disable-hang-monitor',
          '--disable-prompt-on-repost',
          '--disable-sync',
          '--disable-web-security',
          '--metrics-recording-only',
          '--no-default-browser-check',
          '--no-first-run',
          '--safebrowsing-disable-auto-update',
          '--enable-automation',
          '--password-store=basic',
          '--use-mock-keychain'
        ]
      });
    }
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async scrapeProperties(url: string): Promise<ScrapingResult> {
    let allProperties: PropertyItem[] = [];
    let currentPage = 1;
    let maxPages = 5; // Reduced from 10 for more reasonable limit
    
    try {
      await this.initBrowser();
      
      if (!this.browser) {
        throw new Error('Failed to initialize browser');
      }

      console.log('🔍 Starting multi-page scraping...');
      
      // Always try at least 2 pages for this specific site
      const minPages = 1;
      
      while (currentPage <= maxPages) {
        console.log(`📄 Scraping page ${currentPage}...`);
        
        // Construct URL for current page
        const pageUrl = this.addPageParameter(url, currentPage);
        
        // Scrape this page
        const pageResult = await this.scrapeSinglePage(pageUrl);
        
        if (!pageResult.success) {
          console.warn(`⚠️ Failed to scrape page ${currentPage}: ${pageResult.error}`);
          break;
        }
        
        // If no properties found on this page, we've reached the end
        if (pageResult.data.length === 0) {
          console.log(`📄 No properties found on page ${currentPage}, stopping pagination`);
          break;
        }
        
        // Add properties from this page
        allProperties = [...allProperties, ...pageResult.data];
        console.log(`✅ Page ${currentPage} scraped: ${pageResult.data.length} properties (Total: ${allProperties.length})`);
        
        // For the first page, always try page 2 (don't rely on pagination detection)
        if (currentPage === 1) {
          console.log(`📄 Completed page 1, trying page 2...`);
          currentPage++;
          await this.randomDelay(5000, 8000); // Longer delay between pages
          continue;
        }
        
        // For subsequent pages, check for next page
        const hasNextPage = await this.checkForNextPage(pageUrl);
        if (!hasNextPage) {
          console.log(`📄 Reached last page (${currentPage})`);
          break;
        }
        
        currentPage++;
        
        // Add delay between pages to avoid being blocked
        await this.randomDelay(5000, 8000);
      }

      return {
        success: true,
        data: allProperties,
        timestamp: new Date(),
        totalItems: allProperties.length
      };

    } catch (error) {
      console.error('❌ Multi-page scraping failed:', error);
      
      return {
        success: false,
        data: allProperties,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
        totalItems: allProperties.length
      };
    }
  }

  private async scrapeSinglePage(url: string): Promise<ScrapingResult> {
    let page: Page | null = null;
    
    try {
      if (!this.browser) {
        throw new Error('Browser not initialized');
      }

      page = await this.browser.newPage();
      
      // Enhanced stealth - remove automation indicators
      await page.evaluateOnNewDocument(() => {
        // Remove webdriver property completely
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
        
        // Override the plugins property to return a fake but reasonable plugins array
        Object.defineProperty(navigator, 'plugins', {
          get: () => [
            {
              0: {
                type: "application/x-google-chrome-pdf",
                suffixes: "pdf",
                description: "Portable Document Format",
                enabledPlugin: null
              },
              description: "Portable Document Format",
              filename: "internal-pdf-viewer",
              length: 1,
              name: "Chrome PDF Plugin"
            },
            {
              0: {
                type: "application/pdf",
                suffixes: "pdf",
                description: "Portable Document Format",
                enabledPlugin: null
              },
              description: "Portable Document Format",
              filename: "mhjfbmdgcfjbbpaeojofohoefgiehjai",
              length: 1,
              name: "Chrome PDF Viewer"
            }
          ],
        });
        
        // Mock languages
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en', 'he'],
        });
        
        // Mock permissions
        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters: any) => originalQuery(parameters);
        
        // Override chrome runtime
        Object.defineProperty(window, 'chrome', {
          writable: true,
          enumerable: true,
          configurable: false,
          value: {
            runtime: {}
          }
        });
        
        // Mock screen properties
        Object.defineProperty(screen, 'availWidth', { value: 1920 });
        Object.defineProperty(screen, 'availHeight', { value: 1080 });
        Object.defineProperty(screen, 'width', { value: 1920 });
        Object.defineProperty(screen, 'height', { value: 1080 });
      });

      // Set more realistic viewport and user agent
      await page.setViewport({ 
        width: 1920, 
        height: 1080,
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
        isLandscape: true
      });
      
      // Rotate user agents
      const userAgents = [
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
      ];
      
      const randomUA = userAgents[Math.floor(Math.random() * userAgents.length)] || userAgents[0]!;
      await page.setUserAgent(randomUA);

      // Set additional headers to look more like a real browser
      await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9,he;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0'
      });

      // Add much longer delay before navigation
      await this.randomDelay(5000, 10000);

      // Navigate with more realistic behavior
      console.log(`🔍 Navigating to: ${url}`);
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 45000 
      });

      // More extensive human behavior simulation
      await this.simulateExtensiveHumanBehavior(page);

      // Check for bot protection
      const title = await page.title();
      console.log(`📄 Page title: ${title}`);

      if (title.includes('ShieldSquare') || title.includes('Captcha') || title.includes('Access Denied')) {
        console.warn('🚫 Bot protection detected, trying advanced evasion...');
        
        // Try clicking somewhere on the page
        await page.mouse.click(Math.random() * 800, Math.random() * 600);
        await this.randomDelay(2000, 4000);
        
        // Try scrolling
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight / 4);
        });
        await this.randomDelay(3000, 6000);
        
        // Try typing something (simulate search)
        await page.keyboard.type('test', { delay: 100 });
        await this.randomDelay(1000, 3000);
        
        // Wait much longer
        await this.randomDelay(15000, 25000);
        
        // Check again
        const newTitle = await page.title();
        if (newTitle.includes('ShieldSquare') || newTitle.includes('Captcha') || newTitle.includes('Access Denied')) {
          return {
            success: false,
            data: [],
            error: 'Bot protection is still active. Try: 1) Using VPN/different IP, 2) Waiting longer between requests, 3) Manual browsing first',
            timestamp: new Date(),
            totalItems: 0
          };
        }
      }

      // Wait longer for content to load
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Extract properties with detailed logic
      const properties = await page.evaluate(() => {
        const items: any[] = [];
        
        // Look for Yad2-specific property selectors
        const selectors = [
          '[data-testid="feed-list"]',
          '.feeditem',
          '.item-card',
          '.property-card',
          'article',
          '.listing',
          '.feed-item',
          '[class*="item"]',
          '[class*="card"]',
          '.item',
          '.result-item'
        ];

        console.log('🔍 Searching for property elements...');
        
        for (const selector of selectors) {
          const container = document.querySelector(selector);
          if (container) {
            console.log(`✅ Found container with selector: ${selector}`);
            
            // Try to find individual property items within the container
            const itemSelectors = [
              'div[class*="item"]',
              'div[class*="card"]',
              'article',
              'li',
              'div[data-testid*="item"]',
              'div[data-testid*="card"]',
              'div[class*="property"]',
              'div[class*="listing"]'
            ];
            
            for (const itemSelector of itemSelectors) {
              const propertyElements = container.querySelectorAll(itemSelector);
              if (propertyElements.length > 0) {
                console.log(`📋 Found ${propertyElements.length} property elements with: ${itemSelector}`);
                
                propertyElements.forEach((element, index) => {
                  try {
                    // Extract all text content for analysis
                    const textContent = element.textContent?.trim() || '';
                    const innerHtml = element.innerHTML;
                    
                    const priceElement = element.querySelector('.feed-item-price_price__ygoeF');
                    const price = priceElement ? priceElement.textContent?.trim() || '' : '';
                    
                    // Look for room indicators
                    const roomMatch = textContent.match(/(\d+)\s*חדר/);
                    const rooms = roomMatch ? roomMatch[1] + ' rooms' : '';

                    // Look for floor number - get the second element with this class and extract floor number
                    const floorElements = element.querySelectorAll('.item-data-content_itemInfoLine__AeoPP');
                    const floorText = floorElements.length > 1 && floorElements[1] ? floorElements[1].textContent?.trim() || '' : '';
                    const floorMatch = floorText.match(/קומה\s*‎?(\d+)‏?/);
                    const floor = floorMatch ? `קומה ${floorMatch[1]}` : '';
                    
                    // Look for area indicators  
                    const areaMatch = textContent.match(/(\d+)\s*מ["']ר|(\d+)\s*מטר|(\d+)\s*sqm/);
                    const area = areaMatch ? (areaMatch[1] || areaMatch[2] || areaMatch[3]) + ' מ"ר' : '';
                    
                    // Extract location from the heading element
                    const locationElement = element.querySelector('.item-data-content_heading__tphH4');
                    const location = locationElement ? locationElement.textContent?.trim() || '' : '';
                    
                    // Extract images
                    const img = element.querySelector('img');
                    const imageUrl = img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '';
                    
                    // Extract links
                    const link = element.querySelector('a');
                    const href = link ? link.getAttribute('href') || '' : '';
                    
                    // Extract property ID from the link
                    const fullLink = href.startsWith('http') ? href : (href ? 'https://www.yad2.co.il' + href : '');
                    const propertyId = (() => {
                      try {
                        // Extract ID from URL pattern: /realestate/item/{ID}
                        const linkMatch = fullLink.match(/\/realestate\/item\/([^?\/]+)/);
                        return linkMatch ? linkMatch[1] : `property-${Date.now()}-${index}`;
                      } catch (error) {
                        console.warn('⚠️ Error extracting property ID from link:', error);
                        return `property-${Date.now()}-${index}`;
                      }
                    })();
                    
                    // Only add if we found some meaningful content
                    if (textContent.length > 50 || price || rooms || area) {
                      const property = {
                        id: propertyId,
                        title: textContent.substring(0, 100) + (textContent.length > 100 ? '...' : ''),
                        price: price || 'Price not found',
                        location: location || 'Location not specified',
                        rooms: rooms || 'Rooms not specified',
                        area: area || 'Area not specified',
                        floor: floor || 'Floor not specified',
                        description: textContent.substring(0, 200) + (textContent.length > 200 ? '...' : ''),
                        imageUrl: imageUrl.startsWith('http') ? imageUrl : (imageUrl ? 'https://www.yad2.co.il' + imageUrl : ''),
                        link: fullLink,
                        contactInfo: 'Contact info not available',
                        rawText: textContent
                      };
                      
                      items.push(property);
                      console.log(`✅ Extracted property ${index + 1} (ID: ${propertyId}): ${property.title.substring(0, 50)}...`);
                    }
                  } catch (error) {
                    console.warn(`⚠️ Error extracting property ${index}:`, error);
                  }
                });
                
                if (items.length > 0) {
                  break; // Stop trying other selectors if we found items
                }
              }
            }
            
            if (items.length > 0) {
              break; // Stop trying other container selectors if we found items
            }
          }
        }
        
        if (items.length === 0) {
          console.log('❌ No properties found. Analyzing page structure...');
          
          // Debug: Show all elements that might be properties
          const allDivs = document.querySelectorAll('div');
          console.log(`📊 Total div elements on page: ${allDivs.length}`);
          
          const divsWithText = Array.from(allDivs).filter(div => {
            const text = div.textContent?.trim() || '';
            return text.length > 20 && text.length < 500;
          });
          
          console.log(`📊 Div elements with reasonable text content: ${divsWithText.length}`);
          
          // Show first few for debugging
          divsWithText.slice(0, 3).forEach((div, index) => {
            console.log(`🔍 Sample div ${index + 1}:`, div.textContent?.substring(0, 100) + '...');
          });
        }

        return items;
      });

      return {
        success: true,
        data: properties,
        timestamp: new Date(),
        totalItems: properties.length
      };

    } catch (error) {
      console.error('❌ Single page scraping failed:', error);
      
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

  private async checkForNextPage(currentUrl: string): Promise<boolean> {
    let page: Page | null = null;
    
    try {
      if (!this.browser) {
        return false;
      }

      page = await this.browser.newPage();
      await page.goto(currentUrl, { waitUntil: 'networkidle2', timeout: 30000 });
      
      // In headless mode, wait much longer for dynamic content to load
      const isDocker = process.env.DOCKER_ENV === 'true' || process.env.NODE_ENV === 'production';
      const waitTime = isDocker ? 8000 : 3000;
      await new Promise(resolve => setTimeout(resolve, waitTime));
      
      // Check for pagination indicators
      const hasNextPage = await page.evaluate(() => {
        // Method 1: Look for pagination text in Hebrew
        const bodyText = document.body.textContent || '';
        const pageMatch = bodyText.match(/עמוד\s*(\d+)\s*מתוך\s*(\d+)/);
        
        if (pageMatch) {
          const currentPage = parseInt(pageMatch[1]!);
          const totalPages = parseInt(pageMatch[2]!);
          console.log(`📊 Hebrew pagination: Current ${currentPage} of ${totalPages}`);
          return currentPage < totalPages;
        }
        
        // Method 2: Look for page 2 link specifically
        const page2Link = document.querySelector('a[href*="page=2"]');
        if (page2Link) {
          console.log(`📊 Found page 2 link: ${page2Link.getAttribute('href')}`);
          return true;
        }
        
        // Method 3: Check if we're on page 1 and there are results (assume more pages exist)
        const currentPageMatch = window.location.href.match(/page=(\d+)/);
        const currentPageNum = currentPageMatch ? parseInt(currentPageMatch[1]!) : 1;
        const hasResults = document.querySelectorAll('[class*="item"], [class*="card"], article').length > 0;
        
        console.log(`📊 Current page: ${currentPageNum}, Has results: ${hasResults}`);
        
        // If we're on page 1 and have results, assume page 2 exists
        if (currentPageNum === 1 && hasResults) {
          return true;
        }
        
        return false;
      });
      
      return hasNextPage;
    } catch (error) {
      console.warn('⚠️ Error checking for next page:', error);
      // Fallback: if we can't check and we're on page 1, assume page 2 exists
      const currentPageMatch = currentUrl.match(/page=(\d+)/);
      const currentPageNum = currentPageMatch ? parseInt(currentPageMatch[1]!) : 1;
      return currentPageNum === 1;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  private addPageParameter(url: string, pageNumber: number): string {
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.set('page', pageNumber.toString());
      return urlObj.toString();
    } catch (error) {
      // Fallback for invalid URLs
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}page=${pageNumber}`;
    }
  }

  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private async simulateExtensiveHumanBehavior(page: Page): Promise<void> {
    // Multiple random mouse movements
    for (let i = 0; i < 3; i++) {
      await page.mouse.move(Math.random() * 1200, Math.random() * 800);
      await this.randomDelay(500, 1500);
    }
    
    // Random scrolling pattern
    await page.evaluate(() => {
      window.scrollTo(0, Math.random() * 300);
    });
    await this.randomDelay(2000, 4000);
    
    // More scrolling
    await page.evaluate(() => {
      window.scrollTo(0, Math.random() * 600);
    });
    await this.randomDelay(3000, 6000);
    
    // Random click (but not on anything important)
    await page.mouse.click(Math.random() * 100 + 50, Math.random() * 100 + 50);
    await this.randomDelay(1000, 3000);
  }
} 