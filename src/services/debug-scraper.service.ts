import axios from 'axios';
import * as cheerio from 'cheerio';

export class DebugScraperService {
  private readonly userAgent = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  /**
   * Debug function to inspect the HTML structure
   */
  async debugPageStructure(url: string): Promise<void> {
    try {
      console.log('🔍 Debugging page structure...');
      
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': this.userAgent,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'he,en-US;q=0.7,en;q=0.3',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Referer': 'https://www.yad2.co.il/',
          'Cache-Control': 'no-cache',
        }
      });

      const $ = cheerio.load(response.data);
      
      console.log('📄 Page title:', $('title').text());
      console.log('📊 Page size:', response.data.length, 'characters');
      
      // Check for various data-testid attributes
      const testIds = [
        'feed-list',
        'feed-item',
        'property-item',
        'listing-item',
        'item-card',
        'property-card'
      ];
      
      console.log('\n🔍 Looking for data-testid attributes:');
      testIds.forEach(testId => {
        const elements = $(`[data-testid="${testId}"]`);
        console.log(`  - data-testid="${testId}": ${elements.length} elements found`);
      });
      
      // Check for common class names
      const classNames = [
        'feed-list',
        'feed-item',
        'property-item',
        'listing-item',
        'item-card',
        'property-card',
        'feeditem',
        'item'
      ];
      
      console.log('\n🔍 Looking for common class names:');
      classNames.forEach(className => {
        const elements = $(`.${className}`);
        console.log(`  - class="${className}": ${elements.length} elements found`);
      });
      
      // Check for any elements with "feed" or "item" in their attributes
      console.log('\n🔍 Looking for elements with "feed" or "item" in attributes:');
      const feedElements = $('[class*="feed"], [id*="feed"], [data-testid*="feed"]');
      console.log(`  - Elements with "feed": ${feedElements.length}`);
      
      const itemElements = $('[class*="item"], [id*="item"], [data-testid*="item"]');
      console.log(`  - Elements with "item": ${itemElements.length}`);
      
      // List all data-testid attributes on the page
      console.log('\n📝 All data-testid attributes found:');
      const allTestIds = new Set<string>();
      $('[data-testid]').each((index, element) => {
        const testId = $(element).attr('data-testid');
        if (testId) {
          allTestIds.add(testId);
        }
      });
      
      if (allTestIds.size > 0) {
        Array.from(allTestIds).sort().forEach(testId => {
          console.log(`  - ${testId}`);
        });
      } else {
        console.log('  No data-testid attributes found');
      }
      
      // Check if the page contains JavaScript that might be loading content
      console.log('\n🔍 JavaScript analysis:');
      const scripts = $('script');
      console.log(`  - Total script tags: ${scripts.length}`);
      
      let hasReactOrVue = false;
      scripts.each((index, script) => {
        const src = $(script).attr('src') || '';
        const content = $(script).html() || '';
        
        if (src.includes('react') || src.includes('vue') || content.includes('React') || content.includes('Vue')) {
          hasReactOrVue = true;
        }
      });
      
      console.log(`  - Contains React/Vue: ${hasReactOrVue}`);
      
      // Sample a small part of the HTML to see structure
      console.log('\n📋 Sample HTML structure (first 1000 characters):');
      console.log(response.data.substring(0, 1000));
      
    } catch (error) {
      console.error('❌ Debug failed:', error);
    }
  }
} 