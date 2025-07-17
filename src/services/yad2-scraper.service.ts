import axios, { AxiosResponse } from 'axios';
import * as cheerio from 'cheerio';
import { PropertyItem, ScrapingResult } from '../interfaces/property.interface';

export class Yad2ScraperService {
  private readonly baseUrl = 'https://www.yad2.co.il';
  private readonly userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  constructor() {
    // Configure axios defaults
    axios.defaults.headers.common['User-Agent'] = this.userAgent;
    axios.defaults.headers.common['Accept'] = 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8';
    axios.defaults.headers.common['Accept-Language'] = 'he,en-US;q=0.7,en;q=0.3';
    axios.defaults.headers.common['Accept-Encoding'] = 'gzip, deflate, br';
    axios.defaults.headers.common['Connection'] = 'keep-alive';
    axios.defaults.headers.common['Upgrade-Insecure-Requests'] = '1';
  }

  /**
   * Scrapes property listings from Yad2 based on the provided URL
   * @param url - The Yad2 URL to scrape
   * @returns Promise<ScrapingResult>
   */
  async scrapeProperties(url: string): Promise<ScrapingResult> {
    try {
      console.log(`Starting to scrape: ${url}`);
      
      const response: AxiosResponse<string> = await axios.get(url, {
        timeout: 30000,
        headers: {
          'Referer': 'https://www.yad2.co.il/',
          'Cache-Control': 'no-cache',
        }
      });

      if (response.status !== 200) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = response.data;
      const $ = cheerio.load(html);

      // Check for bot protection (ShieldSquare Captcha, Cloudflare, etc.)
      const pageTitle = $('title').text();
      const isProtected = this.detectBotProtection(pageTitle, html);
      
      if (isProtected.detected) {
        console.warn('🚫 Bot protection detected:', isProtected.type);
        return {
          success: false,
          data: [],
          error: `Bot protection detected: ${isProtected.type}. ${isProtected.message}`,
          timestamp: new Date(),
          totalItems: 0
        };
      }

      // Find the feed list container
      const feedListContainer = $('[data-testid="feed-list"]');
      
      if (feedListContainer.length === 0) {
        console.warn('No feed-list container found');
        return {
          success: false,
          data: [],
          error: 'No feed-list container found on the page',
          timestamp: new Date(),
          totalItems: 0
        };
      }

      console.log(`Found feed-list container with ${feedListContainer.length} element(s)`);

      // Extract property items from the feed list
      const properties: PropertyItem[] = [];
      
      // Look for property items within the feed list
      feedListContainer.find('[data-testid*="item"], .feeditem, .item').each((index, element) => {
        const $element = $(element);
        
        try {
          const property = this.extractPropertyData($element, $);
          if (property) {
            properties.push(property);
          }
        } catch (error) {
          console.warn(`Error extracting property at index ${index}:`, error);
        }
      });

      // If no items found in the specific structure, try alternative selectors
      if (properties.length === 0) {
        console.log('No items found with primary selectors, trying alternative selectors...');
        
        // Try different selectors that might contain property data
        const alternativeSelectors = [
          '[data-testid="feed-list"] > div',
          '[data-testid="feed-list"] article',
          '[data-testid="feed-list"] .feed-item',
          '[data-testid="feed-list"] li',
          '.feed-list-item',
          '.item-card'
        ];

        for (const selector of alternativeSelectors) {
          const items = $(selector);
          if (items.length > 0) {
            console.log(`Found ${items.length} items with selector: ${selector}`);
            
            items.each((index, element) => {
              const $element = $(element);
              try {
                const property = this.extractPropertyData($element, $);
                if (property) {
                  properties.push(property);
                }
              } catch (error) {
                console.warn(`Error extracting property at index ${index}:`, error);
              }
            });
            
            if (properties.length > 0) {
              break; // Stop trying other selectors if we found items
            }
          }
        }
      }

      console.log(`Successfully extracted ${properties.length} properties`);

      return {
        success: true,
        data: properties,
        timestamp: new Date(),
        totalItems: properties.length
      };

    } catch (error) {
      console.error('Error scraping properties:', error);
      
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
        totalItems: 0
      };
    }
  }

  /**
   * Detects bot protection systems
   * @param pageTitle - The page title
   * @param html - The HTML content
   * @returns Object with detection result and type
   */
  private detectBotProtection(pageTitle: string, html: string): { detected: boolean; type: string; message: string } {
    // Check for ShieldSquare Captcha
    if (pageTitle.includes('ShieldSquare Captcha') || html.includes('ShieldSquare')) {
      return {
        detected: true,
        type: 'ShieldSquare Captcha',
        message: 'The website is using ShieldSquare bot protection. Consider using a headless browser like Puppeteer or Selenium for scraping.'
      };
    }

    // Check for Cloudflare
    if (pageTitle.includes('Cloudflare') || html.includes('cf-browser-verification')) {
      return {
        detected: true,
        type: 'Cloudflare Bot Protection',
        message: 'The website is using Cloudflare bot protection. Consider using a headless browser or proxy service.'
      };
    }

    // Check for generic captcha or bot detection
    if (pageTitle.toLowerCase().includes('captcha') || 
        html.includes('captcha') || 
        html.includes('bot detection') ||
        html.includes('access denied')) {
      return {
        detected: true,
        type: 'Generic Bot Protection',
        message: 'The website has bot protection enabled. Consider using alternative scraping methods.'
      };
    }

    return {
      detected: false,
      type: 'None',
      message: 'No bot protection detected'
    };
  }

  /**
   * Extracts property data from a single element
   * @param $element - Cheerio element containing property data
   * @param $ - Cheerio root instance
   * @returns PropertyItem or null if data cannot be extracted
   */
  private extractPropertyData($element: cheerio.Cheerio<any>, $: cheerio.CheerioAPI): PropertyItem | null {
    try {
      // Extract basic information with fallbacks
      const title = this.extractText($element, [
        '[data-testid="title"]',
        '.title',
        'h2',
        'h3',
        '.item-title',
        '.property-title'
      ]) || 'No title available';

      const price = this.extractText($element, [
        '[data-testid="price"]',
        '.price',
        '.item-price',
        '.property-price',
        '[class*="price"]'
      ]) || 'Price not available';

      const location = this.extractText($element, [
        '[data-testid="location"]',
        '.location',
        '.address',
        '.item-location',
        '.property-location'
      ]) || 'Location not available';

      const rooms = this.extractText($element, [
        '[data-testid="rooms"]',
        '.rooms',
        '.item-rooms',
        '[class*="room"]'
      ]) || 'Rooms not specified';

      const area = this.extractText($element, [
        '[data-testid="area"]',
        '.area',
        '.size',
        '.item-area',
        '[class*="area"]'
      ]) || 'Area not specified';

      const floor = this.extractText($element, [
        '[data-testid="floor"]',
        '.floor',
        '.item-floor',
        '[class*="floor"]'
      ]) || 'Floor not specified';

      const description = this.extractText($element, [
        '[data-testid="description"]',
        '.description',
        '.item-description',
        '.property-description',
        'p'
      ]) || 'No description available';

      // Extract image URL
      const imageUrl = this.extractImageUrl($element, [
        '[data-testid="image"] img',
        '.item-image img',
        '.property-image img',
        'img'
      ]) || '';

      // Extract link
      const link = this.extractLink($element, [
        'a[href]',
        '[data-testid="link"]'
      ]) || '';

      // Extract contact info
      const contactInfo = this.extractText($element, [
        '[data-testid="contact"]',
        '.contact',
        '.phone',
        '.item-contact'
      ]) || 'Contact info not available';

      // Generate a unique ID (you might want to extract actual ID from the element)
      const id = this.generatePropertyId($element, title, price);

      // Only return the property if we have at least title and price
      if (title !== 'No title available' || price !== 'Price not available') {
        return {
          id,
          title,
          price,
          location,
          rooms,
          area,
          floor,
          description,
          imageUrl,
          link,
          contactInfo
        };
      }

      return null;
    } catch (error) {
      console.warn('Error extracting property data:', error);
      return null;
    }
  }

  /**
   * Extracts text content using multiple selectors as fallbacks
   */
  private extractText($element: cheerio.Cheerio<any>, selectors: string[]): string {
    for (const selector of selectors) {
      const text = $element.find(selector).first().text().trim();
      if (text) {
        return text;
      }
    }
    return '';
  }

  /**
   * Extracts image URL using multiple selectors as fallbacks
   */
  private extractImageUrl($element: cheerio.Cheerio<any>, selectors: string[]): string {
    for (const selector of selectors) {
      const img = $element.find(selector).first();
      const src = img.attr('src') || img.attr('data-src') || '';
      if (src) {
        return src.startsWith('http') ? src : `${this.baseUrl}${src}`;
      }
    }
    return '';
  }

  /**
   * Extracts link URL using multiple selectors as fallbacks
   */
  private extractLink($element: cheerio.Cheerio<any>, selectors: string[]): string {
    for (const selector of selectors) {
      const href = $element.find(selector).first().attr('href') || '';
      if (href) {
        return href.startsWith('http') ? href : `${this.baseUrl}${href}`;
      }
    }
    return '';
  }

  /**
   * Generates a unique property ID
   */
  private generatePropertyId($element: cheerio.Cheerio<any>, title: string, price: string): string {
    // Try to extract actual ID from element attributes
    const actualId = $element.attr('data-id') || $element.attr('id') || '';
    if (actualId) {
      return actualId;
    }

    // Generate hash-like ID based on title and price
    const combined = `${title}-${price}`;
    return combined.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16) + '-' + Date.now().toString(36);
  }
} 