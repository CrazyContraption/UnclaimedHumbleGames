const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const repoRoot = path.join(__dirname, '..');

function readMonthLimit(args) {
  const inlineValue = args.find(arg => arg.startsWith('--months='));
  const separateIndex = args.indexOf('--months');
  const value = inlineValue ? inlineValue.split('=')[1] : separateIndex >= 0 ? args[separateIndex + 1] : null;
  const limit = Number.parseInt(value, 10);
  return Number.isInteger(limit) && limit > 0 ? limit : null;
}

(async () => {
  const monthLimit = readMonthLimit(process.argv.slice(2));
  const isCI = !!process.env.CI || !!process.env.GITHUB_ACTIONS || !!process.env.GITLAB_CI;
  console.log(`🚀 Starting scraper in ${isCI ? 'headless' : 'headed'} mode${monthLimit ? ` (max ${monthLimit} months)` : ''}...`);
  const browser = await chromium.launch({
    headless: isCI
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // --- Load cookies ---
  const cookies = JSON.parse(fs.readFileSync(path.join(repoRoot, 'auth.json'), 'utf-8'));

  await page.goto('https://www.humblebundle.com');
  await context.addCookies(cookies);

  // --- Go to keys page ---
  await page.goto('https://www.humblebundle.com/membership/home', {
    waitUntil: 'domcontentloaded'
  });

  // --- Validate auth ---
  if (page.url().includes('login')) {
    throw new Error('AUTH_EXPIRED');
  }

  console.log("✅ Logged in, expanding months...");

  // --- Expand all months ---
  page.on('console', msg => console.log('🌐 Browser:', msg.text()));

  await page.evaluate(async (maxMonths) => {
    function wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    const BUTTON_SELECTOR = '.see-more-months';
    const HIDDEN_CLASS = 'is-hidden';

    let hiddenCount = 0;
    let count = 1;
    while (hiddenCount < 8) {
      if (maxMonths && document.querySelectorAll('a.content-choices-footer').length + 1 >= maxMonths) {
        console.log(`👉 Month limit reached (${maxMonths}).`);
        break;
      }
      const button = document.querySelector(BUTTON_SELECTOR);
      if (button && !button.classList.contains(HIDDEN_CLASS)) {
        console.log(`👉 Clicking "See More Months" button ${count}...`);
        button.click();
        hiddenCount = 0;
        count++;
      } else {
        hiddenCount++;
      }
      await wait(500);
    }
    console.log('👉 No more "See More Months" buttons available.');
  }, monthLimit);

  console.log("📦 Collecting links...");

  const links = await page.$$eval(
    'a.content-choices-footer',
    els => els.map(e => e.href)
  );


  const collectedData = [];

  // Helper to extract platform/type/genre from tile
  function parseTile(el) {
    // Title
    const title = el.querySelector('.content-choice-title')?.textContent.trim() || '';
    // Image
    const image = el.querySelector('img.choice-image')?.src || '';
    // URL
    let url = '';
    const anchor = el.closest('a');
    if (anchor) url = anchor.href;
    // Platform (look for .fa-steam, .fa-origin, etc)
    let platform = '';
    const platformIcon = el.querySelector('.fa-steam, .fa-brands.fa-steam, .fa-origin, .fa-gog, .fa-ubisoft, .fa-epic');
    if (platformIcon) {
      if (platformIcon.classList.contains('fa-steam')) platform = 'steam';
      else if (platformIcon.classList.contains('fa-origin')) platform = 'origin';
      else if (platformIcon.classList.contains('fa-gog')) platform = 'gog';
      else if (platformIcon.classList.contains('fa-ubisoft')) platform = 'ubisoft';
      else if (platformIcon.classList.contains('fa-epic')) platform = 'epic';
    }
    // Type (try to infer from badges or text)
    let type = '';
    const typeBadge = el.querySelector('.badge, .content-choice-title + .badge');
    if (typeBadge) type = typeBadge.textContent.trim().toLowerCase();
    // Try to guess type from title
    if (!type) {
      if (/dlc/i.test(title)) type = 'dlc';
      else if (/subscription/i.test(title)) type = 'subscription';
      else type = 'game';
    }
    // Genre (not available, but could be parsed from title or left blank)
    let genre = '';
    // Optionally, you could use a mapping or leave blank
    return { title, image, url, platform, type, genre };
  }

  async function extract(page, baseUrlOverride = null) {
    return await page.evaluate((baseUrlOverride) => {
      const monthEl = document.querySelector('h3.content-choices-title');
      const month = monthEl ? monthEl.textContent.trim() : 'Unknown';
      const tilesContainer = document.querySelector('div.content-choice-tiles.js-content-choice-tiles');
      const tiles = tilesContainer ? Array.from(tilesContainer.querySelectorAll('div.content-choice')) : [];
      
      // Only unclaimed
      const items = tiles.filter(el => !el.closest('div.claimed')).map((el, idx) => {
        // Title
        const title = el.querySelector('.content-choice-title')?.textContent.trim() || '';
        
        // Image
        const image = el.querySelector('img.choice-image')?.src || '';
        
        // URL - find the clickable link using multiple strategies
        let url = '';
        
        // Strategy 1: Look for any <a> tag with href inside the tile
        let linkElement = el.querySelector('a[href]');
        
        // Strategy 2: Check if the tile itself is or has a parent that's a link
        if (!linkElement && el.tagName === 'A' && el.href) {
          linkElement = el;
        }
        
        // Strategy 3: Walk up the DOM tree to find an <a> ancestor
        if (!linkElement) {
          let parent = el.parentElement;
          while (parent && parent !== document.body) {
            if (parent.tagName === 'A' && parent.href) {
              linkElement = parent;
              break;
            }
            parent = parent.parentElement;
          }
        }
        
        // Strategy 4: Look for data attributes that might contain URL
        if (!linkElement) {
          const dataUrl = el.getAttribute('data-href') || el.getAttribute('data-url');
          if (dataUrl) url = dataUrl;
        }
        
        // Strategy 5: Check for onclick handler with URL (though unlikely)
        if (!url && !linkElement) {
          const onclick = el.getAttribute('onclick');
          if (onclick && onclick.includes('http')) {
            const match = onclick.match(/https?:\/\/[^\s'"]+/);
            if (match) url = match[0];
          }
        }
        
        if (linkElement && linkElement.href) {
          url = linkElement.href;
        }
        
        // Log for debugging
        console.log(`[${title}] url found: ${url || '(empty)'}`);
        
        // Platform - check for platform icons
        let platform = '';
        // Look for platform-specific font awesome classes
        const allIcons = el.querySelectorAll('[class*="fa-"]');
        for (const icon of allIcons) {
          const classes = icon.className;
          if (classes.includes('fa-steam')) {
            platform = 'steam';
            break;
          } else if (classes.includes('fa-origin') || classes.includes('fa-windows')) {
            platform = 'origin';
            break;
          } else if (classes.includes('fa-gog')) {
            platform = 'gog';
            break;
          } else if (classes.includes('fa-ubisoft')) {
            platform = 'ubisoft';
            break;
          } else if (classes.includes('fa-epic') || classes.includes('fa-app-store')) {
            platform = 'epic';
            break;
          }
        }
        
        // Type - check for badges or infer from title
        let type = '';
        const badgeEl = el.querySelector('.badge');
        if (badgeEl) {
          type = badgeEl.textContent.trim().toLowerCase();
        }
        if (!type) {
          if (/subscription/i.test(title) || /\b(one|1|two|2|three|3|four|4|six|6|twelve|12)\s*[-\s]+\s*months?\b/i.test(title)) {
            type = 'subscription';
          } else if (/dlc/i.test(title)) {
            type = 'dlc';
          } else {
            type = 'game';
          }
        }
        
        // Genre - try to extract from title or other elements
        let genre = '';
        // Genre might be in a separate element or we can leave it empty
        const genreEl = el.querySelector('.genre, .game-genre, [data-genre]');
        if (genreEl) {
          genre = genreEl.textContent.trim().toLowerCase();
        }
        
        return { title, image, url, platform, type, genre, month };
      });
      
      return { month, items };
    }, baseUrlOverride);
  }

  async function hasSelectGamesButton(targetPage) {
    return targetPage.locator('a, button').evaluateAll(elements => elements.some(element => {
      const label = element.textContent.replace(/\s+/g, ' ').trim();
      const style = window.getComputedStyle(element);
      return label === 'Select games' && style.display !== 'none' && style.visibility !== 'hidden' && element.offsetParent !== null;
    }));
  }

  async function enrichItemsFromModals(targetPage, data) {
    const tileButtons = targetPage.locator('div.content-choice:not(.claimed) .js-open-choice-modal');
    const itemCount = await tileButtons.count();
    const enrichedItems = [];

    for (let index = 0; index < itemCount; index++) {
      const item = data.items[index];
      if (!item) continue;

      try {
        const pageUrlBeforeClick = targetPage.url();
        await tileButtons.nth(index).click();
        const modal = targetPage.locator('.humblemodal-modal.humblemodal-modal--open');
        await modal.waitFor({ state: 'visible', timeout: 10000 });

        const modalData = await modal.evaluate(element => {
          const text = selector => element.querySelector(selector)?.textContent.replace(/\s+/g, ' ').trim() || '';
          const genres = text('.genres').split(/\s*,\s*/).map(value => value.trim()).filter(Boolean);
          const platformElement = element.querySelector('.choice-platforms .icons');
          const platformLabels = platformElement
            ? [...platformElement.querySelectorAll('[aria-label]')].map(icon => icon.getAttribute('aria-label')).filter(Boolean)
            : [];
          const platformText = platformElement?.textContent.replace(/\s+/g, ' ').trim() || '';
          const timeLimitText = [...element.querySelectorAll('.custom-instruction, [class*="deadline"], [class*="expiration"], [class*="expire"]')]
            .map(node => node.textContent.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
            .join(' ');
          const modalText = element.textContent.replace(/\s+/g, ' ').trim();

          return {
            genres,
            platform: platformLabels.join(', ') || platformText,
            hasTimeLimit: /redeem(?:ed)? by|redeem within|expires?|expiration|deadline|limited time/i.test(timeLimitText),
            timeLimitText,
            isExpired: /expired|no longer available|redemption period has ended|cannot be redeemed/i.test(modalText)
          };
        });

        const currentUrl = targetPage.url();
        const tileVanityPath = await tileButtons.nth(index).evaluate(button => {
          const anchor = button.closest('.content-choice')?.querySelector('.choice-content-anchor[id^="choice-"]');
          return anchor?.id.replace(/^choice-/, '') || '';
        });
        const monthSlug = (item.month || '').toLowerCase().replace(/\s+games?$/, '').replace(/[^a-z0-9]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
        const fallbackUrl = tileVanityPath
          ? new URL(`/membership/${monthSlug}/${tileVanityPath}`, pageUrlBeforeClick).href
          : pageUrlBeforeClick;
        const vanityUrl = currentUrl !== pageUrlBeforeClick ? currentUrl : fallbackUrl;
        enrichedItems.push({
          ...item,
          url: vanityUrl,
          genre: modalData.genres,
          platform: modalData.platform,
          hasTimeLimit: modalData.hasTimeLimit,
          timeLimitText: modalData.timeLimitText
        });

        await modal.locator('.js-close-modal').click();
        await modal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

        if (modalData.isExpired) {
          enrichedItems.pop();
          console.log(`⏳ Excluded expired item: ${item.title}`);
        }
      } catch (error) {
        console.error(`⚠️ Could not enrich ${item.title}:`, error.message);
        const openModal = targetPage.locator('.humblemodal-modal.humblemodal-modal--open');
        if (await openModal.count()) {
          await openModal.locator('.js-close-modal').click().catch(() => {});
        }
      }
    }

    return { ...data, items: enrichedItems };
  }


  console.log("📄 Extracting current page...");
  // Extract the first month to get its name
  const tempMainData = await extract(page, null);
  let firstMonthBaseUrl = null;
  if (tempMainData && tempMainData.month && tempMainData.month !== 'Unknown') {
    // Format: /membership/monthname-yearnumber (strip any trailing '-games' if present)
    let monthSlug = tempMainData.month
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, '')
      .replace(/\s+/g, '-');
    // Remove everything after and including the second dash, if present
    const dashIdx = monthSlug.indexOf('-');
    if (dashIdx !== -1) {
      const secondDashIdx = monthSlug.indexOf('-', dashIdx + 1);
      if (secondDashIdx !== -1) {
        monthSlug = monthSlug.substring(0, secondDashIdx);
      }
    }
    firstMonthBaseUrl = `https://www.humblebundle.com/membership/${monthSlug}`;
  }
  // Keep the landing-page scan isolated from the page used to expand and collect month links.
  const landingPage = await context.newPage();
  await landingPage.goto(page.url(), { waitUntil: 'domcontentloaded' });
  await landingPage.waitForLoadState('networkidle').catch(() => {});

  console.log(`(1/${monthLimit || links.length + 1}) 📄 Extracting active month...`);
  if (await hasSelectGamesButton(landingPage)) {
    const mainData = await enrichItemsFromModals(landingPage, await extract(landingPage, firstMonthBaseUrl));
    if (mainData.items.length > 0) {
      collectedData.push(mainData);
    }
  } else {
    console.log('⚠️ Skipping initial month because it has no visible "Select games" button.');
  }
  await landingPage.close();

  const linksToScrape = monthLimit ? links.slice(0, Math.max(0, monthLimit - 1)) : links;
  const totalMonths = monthLimit || linksToScrape.length + 1;
  console.log(`🔗 Visiting ${linksToScrape.length} previous months concurrently (max 3 at a time)...`);

  // Create array of indexed links to preserve order
  const indexedLinks = linksToScrape.map((link, index) => ({ link, index }));
  
  // Process links with controlled concurrency (max 3 concurrent)
  const CONCURRENCY = 3;
  const results = new Array(linksToScrape.length);
  
  for (let i = 0; i < indexedLinks.length; i += CONCURRENCY) {
    const batch = indexedLinks.slice(i, i + CONCURRENCY);
    
    // Create a promise for each link in the batch
    const batchPromises = batch.map(async ({ link, index }) => {
      try {
        console.log(`(${index + 2}/${totalMonths}) 📄 Extracting ${link}...`);
        
        // Create a new page for this concurrent request
        const tempPage = await context.newPage();
        await tempPage.goto(link);
        if (!(await hasSelectGamesButton(tempPage))) {
          console.log(`(${index + 2}/${totalMonths}) ⚠️ Skipping unpaid month without a visible "Select games" button.`);
          await tempPage.close();
          return { index, data: null };
        }
        const data = await enrichItemsFromModals(tempPage, await extract(tempPage));
        await tempPage.close();
        
        if (data.items.length > 0) {
          console.log(`(${index + 2}/${totalMonths}) ✅ Added ${data.items.length} unclaimed games from ${data.month}`);
        } else {
          console.log(`(${index + 2}/${totalMonths}) ⚠️ No unclaimed games found for ${data.month}`);
        }
        
        return { index, data };
      } catch (error) {
        console.error(`(${index + 2}/${totalMonths}) ❌ Error extracting ${link}:`, error.message);
        return { index, data: null };
      }
    });
    
    // Wait for all promises in the batch to complete
    const batchResults = await Promise.all(batchPromises);
    
    // Store results in their original positions
    batchResults.forEach(({ index, data }) => {
      results[index] = data;
    });
  }
  
  // Add all non-null results to collectedData in order
  results.forEach(data => {
    if (data && data.items.length > 0) {
      collectedData.push(data);
    }
  });

  console.log("🧱 Generating HTML...");


  // Write JSON data for external use
  fs.writeFileSync(path.join(repoRoot, 'UnclaimedHumbleGames.json'), JSON.stringify(collectedData, null, 2));

  // Generate modern HTML by injecting the data into the template
  const templatePath = path.join(repoRoot, 'modern_template.html');
  let template = fs.readFileSync(templatePath, 'utf-8');
  // Insert the data as a JS variable right after <body>
  const updatedAt = new Date().toISOString();
  const injectScript = `<script>window.UNCLAIMED_HUMBLE_GAMES = ${JSON.stringify(collectedData)}; window.UNCLAIMED_HUMBLE_GAMES_UPDATED_AT = ${JSON.stringify(updatedAt)};</script>`;
  template = template.replace('<body>', `<body>\n${injectScript}`);
  fs.writeFileSync(path.join(repoRoot, 'index.html'), template);

  console.log("✅ Done! index.html generated.");

  await browser.close();

})();
