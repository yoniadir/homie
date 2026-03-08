import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { Browser, Page } from 'puppeteer';
import { PropertyItem, ScrapingResult } from '../interfaces/property.interface';
import fs from 'fs';
import path from 'path';
import os from 'os';

puppeteer.use(StealthPlugin());

const MAX_RETRIES = 3;
const RETRY_DELAYS_MS = [45_000, 90_000, 180_000];

export class EnhancedPuppeteerScraperService {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private homepageWarmedUp = false;
  private activeProfileDir: string | null = null;
  private usingTempProfile = false;
  private launchDiagnosticsLogged = false;
  private resolvedUserAgent: string | null = null;
  private readonly acceptLanguage = 'he-IL,he;q=0.9,en-US;q=0.8,en;q=0.7';
  private readonly timezone = 'Asia/Jerusalem';
  private readonly geolocation = { latitude: 32.0853, longitude: 34.7818, accuracy: 25 };

  async initBrowser(useTempProfile = false): Promise<void> {
    if (this.browser) return;

    const isDocker = process.env.DOCKER_ENV === 'true' || process.env.NODE_ENV === 'production';
    const headlessEnv = process.env.PUPPETEER_HEADLESS;
    const headless = headlessEnv === 'false' ? false : headlessEnv === 'true' ? true : isDocker;
    // Persistent profile: reuse cookies/session (fewer bot prompts). Temp profile: avoid "Chrome opens then closes" when the persistent profile is locked (e.g. another Chrome using it or leftover lock).
    const persistentProfileDir = path.resolve(
      process.cwd(),
      isDocker ? 'browser-profile-docker' : 'browser-profile',
    );
    const profileDir = useTempProfile
      ? path.join(os.tmpdir(), `puppeteer-profile-${process.pid}-${Date.now()}`)
      : persistentProfileDir;
    await this.cleanupStaleProfileLocks(profileDir);

    const args = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-blink-features=AutomationControlled',
      '--window-size=1920,1080',
      '--lang=he-IL',
      '--enable-webgl',
      '--ignore-gpu-blocklist',
      '--use-angle=swiftshader-webgl',
      '--use-gl=angle',
    ];
    if (headless) {
      args.push('--headless=new');
    }

    const proxyUrl = process.env.PROXY_URL;
    if (proxyUrl) {
      const cleaned = proxyUrl.replace(/\/+$/, '');
      args.push(`--proxy-server=${cleaned}`);
      console.log(`🌐 Using proxy: ${cleaned.replace(/:[^:@]+@/, ':***@')}`);
    }

    const headlessSource =
      headlessEnv === 'false'
        ? 'PUPPETEER_HEADLESS=false'
        : headlessEnv === 'true'
          ? 'PUPPETEER_HEADLESS=true'
          : isDocker
            ? 'default (Docker → headless)'
            : 'default (local → headed)';

    if (isDocker && !headless) {
      const display = process.env.DISPLAY || '';
      if (!display) {
        console.warn('⚠️ DISPLAY is not set — Chrome may fall back to headless. Ensure the process is run under xvfb-run (e.g. xvfb-run -a node ...).');
      } else {
        console.log(`🖥️ Virtual display: DISPLAY=${display}`);
      }
    }

    const launchOptions: Parameters<typeof puppeteer.launch>[0] = {
      headless,
      ...(isDocker && { executablePath: '/usr/bin/google-chrome-stable' }),
      userDataDir: profileDir,
      args,
    };
    if (isDocker && !headless && process.env.DISPLAY) {
      launchOptions.env = { ...process.env, DISPLAY: process.env.DISPLAY };
    }

    const isTargetClosedError = (e: unknown): boolean => {
      const err = e as Error & { cause?: unknown };
      const msg = err?.message ? err.message + (err.cause != null ? String(err.cause) : '') : String(e);
      return /Target closed|Protocol error.*Target\.(setAutoAttach|setDiscoverTargets)/i.test(msg);
    };

    try {
      this.browser = await puppeteer.launch(launchOptions);
      await this.browser.defaultBrowserContext().overridePermissions('https://www.yad2.co.il', ['geolocation']);
      // Verify the browser stays alive (Chrome can exit right after launch with a locked profile).
      this.page = await this.browser.newPage();
      await this.preparePage(this.page);
      this.activeProfileDir = profileDir;
      this.usingTempProfile = useTempProfile;
      this.resolvedUserAgent = await this.browser.userAgent();
    } catch (e) {
      if (this.page) {
        try {
          await this.page.close();
        } catch {
          /* ignore */
        }
        this.page = null;
      }
      if (this.browser) {
        try {
          await this.browser.close();
        } catch {
          /* ignore */
        }
        this.browser = null;
      }
      if (!useTempProfile && isTargetClosedError(e)) {
        console.warn('⚠️ Browser exited immediately (profile may be in use). Retrying with a temporary profile for this run.');
        return this.initBrowser(true);
      }
      throw e;
    }

    console.log(
      headless
        ? `🌑 Chrome running in headless mode (${headlessSource})`
        : `🖥️ Chrome running in headed mode (${headlessSource})`,
    );
    console.log(
      `📁 Browser profile: ${this.activeProfileDir}${this.usingTempProfile ? ' (temporary fallback)' : ''}`,
    );
    console.log(`🌐 Browser runtime: ${await this.browser.version()}`);
  }

  async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.page = null;
      this.homepageWarmedUp = false;
      this.launchDiagnosticsLogged = false;
      this.activeProfileDir = null;
      this.usingTempProfile = false;
      this.resolvedUserAgent = null;
    }
  }

  async scrapeProperties(url: string): Promise<ScrapingResult> {
    let allProperties: PropertyItem[] = [];
    let currentPage = 1;
    const maxPages = 5;

    try {
      await this.initBrowser();
      if (!this.browser) throw new Error('Failed to initialize browser');

      console.log('🔍 Starting multi-page scraping...');

      while (currentPage <= maxPages) {
        console.log(`📄 Scraping page ${currentPage}...`);
        const pageUrl = this.addPageParameter(url, currentPage);

        const pageResult = await this.scrapeSinglePageWithRetry(pageUrl);

        if (!pageResult.success) {
          console.warn(`⚠️ Failed to scrape page ${currentPage}: ${pageResult.error}`);
          break;
        }

        if (pageResult.data.length === 0) {
          console.log(`📄 No properties found on page ${currentPage}, stopping pagination`);
          break;
        }

        allProperties = [...allProperties, ...pageResult.data];
        console.log(`✅ Page ${currentPage} scraped: ${pageResult.data.length} properties (Total: ${allProperties.length})`);

        const hasNext = pageResult._hasNextPage ?? (currentPage === 1);
        if (!hasNext) {
          console.log(`📄 Reached last page (${currentPage})`);
          break;
        }

        currentPage++;
        await this.randomDelay(8000, 15000);
      }

      return {
        success: true,
        data: allProperties,
        timestamp: new Date(),
        totalItems: allProperties.length,
      };
    } catch (error) {
      console.error('❌ Multi-page scraping failed:', error);
      return {
        success: false,
        data: allProperties,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
        totalItems: allProperties.length,
      };
    }
  }

  // ── Retry wrapper ──────────────────────────────────────────────

  private async scrapeSinglePageWithRetry(url: string): Promise<ScrapingResult & { _hasNextPage?: boolean }> {
    let result = await this.scrapeSinglePage(url);

    if (result.success) return result;

    const isInitialCaptcha = (result.error ?? '').toLowerCase().includes('bot protection');
    if (!isInitialCaptcha) return result;

    for (let retry = 0; retry < MAX_RETRIES; retry++) {
      const delay = RETRY_DELAYS_MS[retry] ?? 120_000;
      console.log(`⏳ Captcha detected, retrying in ${delay / 1000}s (retry ${retry + 1}/${MAX_RETRIES})...`);
      await new Promise(r => setTimeout(r, delay));

      result = await this.scrapeSinglePage(url);

      if (result.success) return result;

      const isCaptcha = (result.error ?? '').toLowerCase().includes('bot protection');
      if (!isCaptcha) return result;
    }

    return result;
  }

  // ── Core single-page scraper ───────────────────────────────────

  private async scrapeSinglePage(url: string): Promise<ScrapingResult & { _hasNextPage?: boolean }> {
    let page: Page | null = null;

    try {
      if (!this.browser) throw new Error('Browser not initialized');
      page = await this.getOrCreatePage();

      if (!this.homepageWarmedUp) {
        await this.warmUpWithHomepage(page);
      }

      await this.randomDelay(3000, 6000);

      console.log(`🔍 Navigating to: ${url}`);
      await page.goto(url, { waitUntil: 'networkidle2', timeout: 60_000 });

      await this.simulateHumanBehavior(page);

      const blocked = await this.isBotProtectionActive(page);
      if (blocked) {
        console.warn('🚫 Bot protection detected, trying patient evasion...');
        const resolved = await this.handleCaptchaPatient(page);
        if (!resolved) {
          return {
            success: false,
            data: [],
            error: 'Bot protection is still active after patient wait',
            timestamp: new Date(),
            totalItems: 0,
          };
        }
        console.log('✅ Bot protection resolved');
      }

      await this.randomDelay(3000, 5000);

      const properties = await this.extractProperties(page);
      const hasNextPage = await this.checkPaginationOnPage(page);

      return {
        success: true,
        data: properties,
        timestamp: new Date(),
        totalItems: properties.length,
        _hasNextPage: hasNextPage,
      };
    } catch (error) {
      console.error('❌ Single page scraping failed:', error);
      return {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        timestamp: new Date(),
        totalItems: 0,
      };
    }
  }

  // ── Stealth overrides ──────────────────────────────────────────

  private async applyStealthOverrides(page: Page): Promise<void> {
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

      Object.defineProperty(navigator, 'plugins', {
        get: () => [
          {
            0: { type: 'application/x-google-chrome-pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: null },
            description: 'Portable Document Format',
            filename: 'internal-pdf-viewer',
            length: 1,
            name: 'Chrome PDF Plugin',
          },
          {
            0: { type: 'application/pdf', suffixes: 'pdf', description: 'Portable Document Format', enabledPlugin: null },
            description: 'Portable Document Format',
            filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai',
            length: 1,
            name: 'Chrome PDF Viewer',
          },
        ],
      });

      Object.defineProperty(navigator, 'languages', {
        get: () => ['he', 'he-IL', 'en-US', 'en'],
      });

      Object.defineProperty(navigator, 'language', {
        get: () => 'he-IL',
      });

      Object.defineProperty(navigator, 'hardwareConcurrency', {
        get: () => 8,
      });

      Object.defineProperty(navigator, 'deviceMemory', {
        get: () => 8,
      });

      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters: any) =>
        originalQuery.call(window.navigator.permissions, parameters);

      if (typeof (window as Window & { chrome?: unknown }).chrome === 'undefined') {
        Object.defineProperty(window, 'chrome', {
          writable: true,
          enumerable: true,
          configurable: true,
          value: { runtime: {}, loadTimes: () => ({}), csi: () => ({}) },
        });
      }

      Object.defineProperty(screen, 'availWidth', { value: 1920 });
      Object.defineProperty(screen, 'availHeight', { value: 1080 });
      Object.defineProperty(screen, 'width', { value: 1920 });
      Object.defineProperty(screen, 'height', { value: 1080 });
    });
  }

  private async setViewportAndHeaders(page: Page): Promise<void> {
    await page.setViewport({
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      isMobile: false,
      hasTouch: false,
      isLandscape: true,
    });

    const chosenUA = process.env.PUPPETEER_USER_AGENT?.trim() || this.resolvedUserAgent || (await page.browser().userAgent());
    await this.configureBrowserIdentity(page, chosenUA);

    if (!this.launchDiagnosticsLogged) {
      const runtimeDetails = await page.evaluate(() => ({
        userAgent: navigator.userAgent,
        platform: navigator.platform,
        language: navigator.language,
        languages: navigator.languages,
        webdriver: navigator.webdriver,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }));
      console.log('🧭 Browser fingerprint:', runtimeDetails);
      this.launchDiagnosticsLogged = true;
    }
  }

  // ── Homepage warmup (referrer chain) ───────────────────────────

  private async warmUpWithHomepage(page: Page): Promise<void> {
    console.log('🏠 Warming up with homepage visit...');
    await page.goto('https://www.yad2.co.il/', { waitUntil: 'networkidle2', timeout: 60_000 });

    await this.simulateHumanBehavior(page);
    await this.randomDelay(4000, 8000);

    this.homepageWarmedUp = true;
    console.log('🏠 Homepage warmup complete');
  }

  // ── Bot protection detection & handling ────────────────────────

  private async isBotProtectionActive(page: Page): Promise<boolean> {
    const title = await page.title();
    return title.includes('ShieldSquare') || title.includes('Captcha') || title.includes('Access Denied');
  }

  private async handleCaptchaPatient(page: Page): Promise<boolean> {
    const viewport = page.viewport();
    const centerX = viewport ? viewport.width / 2 : 960;
    const centerY = viewport ? viewport.height / 2 : 540;

    // Phase 1: gentle mouse movement, let JS challenge timers run
    for (let i = 0; i < 6; i++) {
      await this.bezierMouseMove(page, Math.random() * 1200 + 100, Math.random() * 700 + 100);
      await this.randomDelay(1500, 3500);
    }

    await page.mouse.click(centerX, centerY);
    await this.randomDelay(2000, 4000);
    await this.waitForPotentialNavigation(page, 12_000);

    // Phase 2: wait patiently for auto-resolve (ShieldSquare JS challenge timeout)
    console.log('⏳ Waiting for challenge to auto-resolve...');
    await this.randomDelay(30_000, 45_000);
    await this.waitForPotentialNavigation(page, 12_000);

    if (!(await this.isBotProtectionActive(page))) return true;

    // Phase 3: try scrolling + clicking and wait again
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 3));
    await this.randomDelay(3000, 5000);
    const clickX = viewport ? Math.random() * viewport.width * 0.5 + viewport.width * 0.25 : 400;
    const clickY = viewport ? Math.random() * viewport.height * 0.5 + viewport.height * 0.25 : 300;
    await page.mouse.click(clickX, clickY);
    await this.randomDelay(20_000, 35_000);
    await this.waitForPotentialNavigation(page, 12_000);

    return !(await this.isBotProtectionActive(page));
  }

  // ── Human behavior simulation ──────────────────────────────────

  private async simulateHumanBehavior(page: Page): Promise<void> {
    // Bezier mouse movements across the page
    const targets = this.generateRandomPoints(5 + Math.floor(Math.random() * 4));
    for (const pt of targets) {
      await this.bezierMouseMove(page, pt.x, pt.y);
      await this.randomDelay(300, 1200);
    }

    // Incremental smooth scrolling
    const scrollSteps = 4 + Math.floor(Math.random() * 4);
    for (let i = 0; i < scrollSteps; i++) {
      const scrollAmount = 150 + Math.floor(Math.random() * 250);
      await page.evaluate((amount) => {
        window.scrollBy({ top: amount, behavior: 'smooth' });
      }, scrollAmount);
      await this.randomDelay(1500, 3500);
    }

    // Hover over a visible link briefly
    try {
      const linkBoxes = await page.$$('a[href]');
      if (linkBoxes.length > 3) {
        const target = linkBoxes[Math.floor(Math.random() * Math.min(linkBoxes.length, 10))]!;
        const box = await target.boundingBox();
        if (box) {
          await this.bezierMouseMove(page, box.x + box.width / 2, box.y + box.height / 2);
          await this.randomDelay(500, 1500);
        }
      }
    } catch { /* element gone – harmless */ }

    await this.randomDelay(2000, 5000);
  }

  private async bezierMouseMove(page: Page, endX: number, endY: number): Promise<void> {
    const start = await page.evaluate(() => ({ x: window.scrollX + 400, y: window.scrollY + 300 }));
    const steps = 15 + Math.floor(Math.random() * 15);

    const cp1x = start.x + (endX - start.x) * 0.3 + (Math.random() - 0.5) * 200;
    const cp1y = start.y + (endY - start.y) * 0.1 + (Math.random() - 0.5) * 200;
    const cp2x = start.x + (endX - start.x) * 0.7 + (Math.random() - 0.5) * 200;
    const cp2y = start.y + (endY - start.y) * 0.9 + (Math.random() - 0.5) * 200;

    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const u = 1 - t;
      const x = u * u * u * start.x + 3 * u * u * t * cp1x + 3 * u * t * t * cp2x + t * t * t * endX;
      const y = u * u * u * start.y + 3 * u * u * t * cp1y + 3 * u * t * t * cp2y + t * t * t * endY;
      await page.mouse.move(x, y);
      await new Promise(r => setTimeout(r, 8 + Math.floor(Math.random() * 18)));
    }
  }

  private generateRandomPoints(count: number): Array<{ x: number; y: number }> {
    const points: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < count; i++) {
      points.push({ x: 100 + Math.random() * 1600, y: 100 + Math.random() * 800 });
    }
    return points;
  }

  // ── Pagination (check on already-loaded page, no extra request) ─

  private async checkPaginationOnPage(page: Page): Promise<boolean> {
    return page.evaluate(() => {
      const bodyText = document.body.textContent || '';
      const hebrewMatch = bodyText.match(/עמוד\s*(\d+)\s*מתוך\s*(\d+)/);
      if (hebrewMatch) {
        const cur = parseInt(hebrewMatch[1]!);
        const total = parseInt(hebrewMatch[2]!);
        return cur < total;
      }

      const currentPageMatch = window.location.href.match(/page=(\d+)/);
      const currentNum = currentPageMatch ? parseInt(currentPageMatch[1]!) : 1;
      const nextPageLink = document.querySelector(`a[href*="page=${currentNum + 1}"]`);
      if (nextPageLink) return true;

      const paginationButtons = Array.from(document.querySelectorAll('[class*="pagination"] a, [class*="paging"] a, nav a[href*="page="]'));
      for (const btn of paginationButtons) {
        const href = btn.getAttribute('href') || '';
        const pageMatch = href.match(/page=(\d+)/);
        if (pageMatch && parseInt(pageMatch[1]!) > currentNum) return true;
      }

      return false;
    });
  }

  // ── Property extraction (unchanged logic from previous fix) ────

  private async extractProperties(page: Page): Promise<PropertyItem[]> {
    return page.evaluate(() => {
      const items: any[] = [];

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
        '.result-item',
      ];

      for (const selector of selectors) {
        const container = document.querySelector(selector);
        if (!container) continue;

        const itemSelectors = [
          'div[class*="item"]',
          'div[class*="card"]',
          'article',
          'li',
          'div[data-testid*="item"]',
          'div[data-testid*="card"]',
          'div[class*="property"]',
          'div[class*="listing"]',
        ];

        for (const itemSelector of itemSelectors) {
          const propertyElements = container.querySelectorAll(itemSelector);
          if (propertyElements.length === 0) continue;

          propertyElements.forEach((element, index) => {
            try {
              const textContent = element.textContent?.trim() || '';

              const priceElement = element.querySelector('.feed-item-price_price__ygoeF');
              const price = priceElement ? priceElement.textContent?.trim() || '' : '';

              const roomMatch = textContent.match(/(\d+)\s*חדר/);
              const rooms = roomMatch ? roomMatch[1] + ' rooms' : '';

              const floorElements = element.querySelectorAll('.item-data-content_itemInfoLine__AeoPP');
              const floorText = floorElements.length > 1 && floorElements[1] ? floorElements[1].textContent?.trim() || '' : '';
              const floorMatch = floorText.match(/קומה\s*‎?(\d+)‏?/);
              const floor = floorMatch ? `קומה ${floorMatch[1]}` : '';

              const areaMatch = textContent.match(/(\d+)\s*מ["']ר|(\d+)\s*מטר|(\d+)\s*sqm/);
              const area = areaMatch ? (areaMatch[1] || areaMatch[2] || areaMatch[3]) + ' מ"ר' : '';

              const locationElement = element.querySelector('.item-data-content_heading__tphH4');
              const location = locationElement ? locationElement.textContent?.trim() || '' : '';

              const img = element.querySelector('img');
              const imageUrl = img ? (img.getAttribute('src') || img.getAttribute('data-src') || '') : '';

              const anchors = element.querySelectorAll('a[href*="/realestate/item/"]');
              const listingLink = anchors.length > 0 ? anchors[0]?.getAttribute('href') ?? null : null;
              const fallbackLink = element.querySelector('a');
              const href = (listingLink || (fallbackLink ? fallbackLink.getAttribute('href') : null)) || '';
              const fullLink = href.startsWith('http') ? href : (href ? 'https://www.yad2.co.il' + href : '');

              const baseId = (() => {
                try {
                  const linkMatch = fullLink.match(/\/realestate\/item\/([^?\/]+)/);
                  return linkMatch ? linkMatch[1] : `property-${Date.now()}-${index}`;
                } catch {
                  return `property-${Date.now()}-${index}`;
                }
              })();
              const propertyId = items.some((p) => p.id === baseId) ? `${baseId}-${index}` : baseId;

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
                  rawText: textContent,
                };

                const alreadyHave = items.some((p) => p.id === propertyId);
                if (!alreadyHave) {
                  items.push(property);
                }
              }
            } catch { /* skip element */ }
          });

          if (items.length > 0) break;
        }

        if (items.length > 0) break;
      }

      if (items.length === 0) {
        console.log('❌ No properties found. Analyzing page structure...');
        const allDivs = document.querySelectorAll('div');
        console.log(`📊 Total div elements on page: ${allDivs.length}`);
        const divsWithText = Array.from(allDivs).filter(div => {
          const text = div.textContent?.trim() || '';
          return text.length > 20 && text.length < 500;
        });
        console.log(`📊 Div elements with reasonable text content: ${divsWithText.length}`);
        divsWithText.slice(0, 3).forEach((div, i) => {
          console.log(`🔍 Sample div ${i + 1}:`, div.textContent?.substring(0, 100) + '...');
        });
      }

      return items;
    });
  }

  // ── Utilities ──────────────────────────────────────────────────

  private addPageParameter(url: string, pageNumber: number): string {
    try {
      const urlObj = new URL(url);
      urlObj.searchParams.set('page', pageNumber.toString());
      return urlObj.toString();
    } catch {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}page=${pageNumber}`;
    }
  }

  private async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  private async cleanupStaleProfileLocks(profileDir: string): Promise<void> {
    const lockFiles = ['SingletonLock', 'SingletonSocket', 'SingletonCookie', 'DevToolsActivePort'];

    for (const fileName of lockFiles) {
      const filePath = path.join(profileDir, fileName);
      try {
        await fs.promises.rm(filePath, { force: true });
      } catch {
        // Ignore cleanup failures; Chrome may still be able to launch.
      }
    }
  }

  private async getOrCreatePage(): Promise<Page> {
    if (this.page && !this.page.isClosed()) {
      return this.page;
    }

    if (!this.browser) {
      throw new Error('Browser not initialized');
    }

    this.page = await this.browser.newPage();
    await this.preparePage(this.page);
    return this.page;
  }

  private async preparePage(page: Page): Promise<void> {
    await this.applyStealthOverrides(page);
    await this.setViewportAndHeaders(page);
    await page.setGeolocation(this.geolocation);
  }

  private async configureBrowserIdentity(page: Page, userAgent: string): Promise<void> {
    const client = await page.createCDPSession();
    const chromeVersion = /Chrome\/(\d+)/.exec(userAgent)?.[1] ?? '145';
    const metadata = {
      brands: [
        { brand: 'Google Chrome', version: chromeVersion },
        { brand: 'Chromium', version: chromeVersion },
        { brand: 'Not.A/Brand', version: '24' },
      ],
      fullVersion: `${chromeVersion}.0.0.0`,
      platform: 'Linux',
      platformVersion: '6.1.0',
      architecture: 'x86',
      model: '',
      mobile: false,
      wow64: false,
      bitness: '64',
    };

    await client.send('Network.enable');
    await client.send('Network.setUserAgentOverride', {
      userAgent,
      acceptLanguage: this.acceptLanguage,
      platform: 'Linux x86_64',
      userAgentMetadata: metadata,
    } as any);
    await client.send('Emulation.setTimezoneOverride', { timezoneId: this.timezone });
    await client.send('Emulation.setLocaleOverride', { locale: 'he-IL' } as any);

    await page.setExtraHTTPHeaders({
      'Accept-Language': this.acceptLanguage,
    });
  }

  private async waitForPotentialNavigation(page: Page, timeout: number): Promise<void> {
    try {
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout });
    } catch {
      /* no navigation happened */
    }
  }
}
