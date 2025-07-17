# Homie - TypeScript Project

A modern TypeScript project with comprehensive configuration and example code.

## Project Structure

```
homie/
├── src/
│   └── index.ts          # Main entry point
├── dist/                 # Compiled JavaScript output
├── node_modules/         # Dependencies
├── package.json          # Project configuration
├── tsconfig.json         # TypeScript configuration
├── .prettierrc           # Code formatting rules
├── .gitignore            # Git ignore patterns
└── README.md             # This file
```

## Features

- **TypeScript 5.x** with strict type checking
- **Modern ES2020** target
- **Source maps** for debugging
- **Declaration files** generation
- **Prettier** for code formatting
- **Web scraping service** for Yad2 real estate listings
- **Bot protection detection** and handling
- **Puppeteer integration** for advanced scraping
- **Debug utilities** for analyzing website structure

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

Dependencies are already installed. If you need to reinstall:

```bash
npm install
```

### Available Scripts

- `npm run build` - Compile TypeScript to JavaScript
- `npm run start` - Run the compiled JavaScript
- `npm run dev` - Run the web scraping service (fallback strategy)
- `npm run dev:enhanced` - Run with Enhanced Puppeteer mode only
- `npm run scrape:csv` - Run enhanced scraper and export to CSV
- `npm run test:csv` - Test CSV export functionality
- `npm run test:enhanced` - Test the Enhanced Puppeteer scraper
- `npm run debug` - Debug website structure and bot protection
- `npm run watch` - Watch for changes and recompile
- `npm run clean` - Remove compiled files

### Development

For development, use:

```bash
npm run dev
```

This runs the TypeScript code directly without compilation.

For production builds:

```bash
npm run build
npm run start
```

## Web Scraping Service

This project includes a comprehensive web scraping service for [Yad2](https://www.yad2.co.il), Israel's leading real estate platform.

### Features

- **Axios-based scraper** for simple HTTP requests
- **Puppeteer-based scraper** for handling JavaScript-heavy pages
- **Bot protection detection** (ShieldSquare Captcha, Cloudflare)
- **Flexible data extraction** with multiple selector fallbacks
- **Debug utilities** for analyzing website structure

### Bot Protection Issue

⚠️ **Important**: Yad2 uses ShieldSquare Captcha to protect against automated scraping. The basic HTTP scraper will encounter bot protection. For successful scraping, you'll need to:

1. **Use Puppeteer** (recommended): Handles JavaScript and can bypass some bot protection
2. **Use rotating proxies**: Distribute requests across multiple IP addresses
3. **Implement delays**: Add random delays between requests
4. **Use residential proxies**: More likely to bypass detection
5. **Consider headless browser detection**: Some sites detect headless browsers

### Usage Examples

```bash
# Run with fallback strategy (Basic → Enhanced if needed)
npm run dev

# Run with Enhanced Puppeteer mode only
npm run dev:enhanced

# Test the Enhanced Puppeteer scraper
npm run test:enhanced

# Debug website structure
npm run debug
```

```typescript
// Basic usage with bot protection detection
import { Yad2ScraperService } from './services/yad2-scraper.service';

const scraper = new Yad2ScraperService();
const result = await scraper.scrapeProperties(url);

// Enhanced usage with Puppeteer (recommended for Yad2)
import { EnhancedPuppeteerScraperService } from './services/enhanced-puppeteer-scraper.service';

const enhancedScraper = new EnhancedPuppeteerScraperService();
const result = await enhancedScraper.scrapeProperties(url);
await enhancedScraper.closeBrowser();
```

### Enhanced Puppeteer Features

The Enhanced Puppeteer Configuration includes:

- **Non-headless mode**: Runs visible browser to avoid headless detection
- **Stealth techniques**: Removes webdriver properties and mocks browser APIs
- **Human-like behavior**: Random delays, mouse movements, and scrolling
- **Bot protection handling**: Automatic detection and retry logic
- **Realistic browser settings**: Proper viewport, user agent, and headers

### Data Structure

Each property item includes:
- `id`: Unique identifier
- `title`: Property title
- `price`: Rental price
- `location`: Property location
- `rooms`: Number of rooms
- `area`: Property area
- `floor`: Floor number
- `description`: Property description
- `imageUrl`: Property image URL
- `link`: Link to full listing
- `contactInfo`: Contact information

## Configuration

### TypeScript Configuration

The `tsconfig.json` includes:

- Strict type checking
- ES2020 target
- Source maps for debugging
- Declaration file generation
- Comprehensive compiler options

### Code Formatting

Prettier is configured with:

- Single quotes
- Semicolons
- 2-space indentation
- 80-character line width

## Contributing

1. Make your changes
2. Run `npm run build` to ensure compilation
3. Test your changes with `npm run dev`
4. Follow the existing code style

## License

ISC