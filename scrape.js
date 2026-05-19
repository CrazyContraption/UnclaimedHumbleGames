const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const isCI = !!process.env.CI || !!process.env.GITHUB_ACTIONS || !!process.env.GITLAB_CI;
  console.log(`🚀 Starting scraper in ${isCI ? 'headless' : 'headed'} mode...`);
  const browser = await chromium.launch({
    headless: isCI
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  // --- Load cookies ---
  const cookies = JSON.parse(fs.readFileSync('auth.json', 'utf-8'));

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

  await page.evaluate(async () => {
    function wait(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }

    const BUTTON_SELECTOR = '.see-more-months';
    const HIDDEN_CLASS = 'is-hidden';

    let hiddenCount = 0;
    let count = 1;
    while (hiddenCount < 8) {
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
  });

  console.log("📦 Collecting links...");

  const links = await page.$$eval(
    'a.content-choices-footer',
    els => els.map(e => e.href)
  );

  const collectedData = [];

  async function extract(page, baseUrlOverride = null) {
    return await page.evaluate((baseUrlOverride) => {
      const monthEl = document.querySelector('h3.content-choices-title');
      const month = monthEl ? monthEl.textContent.trim() : 'Unknown';

      const tilesContainer = document.querySelector(
        'div.content-choice-tiles.js-content-choice-tiles'
      );

      const tiles = tilesContainer
        ? Array.from(tilesContainer.querySelectorAll('div.content-choice'))
        : [];

      const items = tiles
        .filter(el => !el.closest('div.claimed'))
        .map(el => {
          const targetId = el.querySelector('div[id]')?.id;
          // Use override if provided, else use current URL
          const baseUrl = baseUrlOverride || window.location.href.split('#')[0];
          const cleanId = targetId?.replace(/^choice-/, '');

          const wrapper = document.createElement('a');
          wrapper.href = baseUrl + '/' + cleanId;
          wrapper.target = '_blank';
          wrapper.innerHTML = el.outerHTML;

          return wrapper.outerHTML;
        });

      return { month, items };
    }, baseUrlOverride);
  }


  console.log("📄 Extracting current page...");
  // Try to get the correct base URL for the first month
  let firstMonthBaseUrl = null;
  if (links.length > 0) {
    // Use the first link, but strip any trailing slash
    firstMonthBaseUrl = links[0].replace(/\/$/, '');
  }
  const mainData = await extract(page, firstMonthBaseUrl);
  if (mainData.items.length > 0) {
    collectedData.push(mainData);
  }

  console.log(`🔗 Visiting ${links.length} months...`);

  let current = 1;
  for (const link of links) {
    console.log(`(${current}/${links.length}) 📄 Extracting ${link}`);
    await page.goto(link);

    const data = await extract(page);
    if (data.items.length > 0) {
      collectedData.push(data);
      console.log(`(${current}/${links.length}) ✅ Added ${data.items.length} unclaimed games from ${data.month}`);
    } else {
      console.log(`(${current}/${links.length}) ⚠️ No unclaimed games found for ${data.month}`);
    }
    current++;
  }

  console.log("🧱 Generating HTML...");

  function generateHTML(data) {
    const filteredData = data.filter(group => group.items.length > 0);

    const monthLinks = filteredData
      .map(group => `<a href="#${group.month.replace(/\s+/g, '_')}">${group.month}</a>`)
      .join('<br>');

    let html = `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8">
    <title>Crazy's Unclaimed Humble Games</title>
    <style>
      html {
        scroll-behavior: smooth;
      }
      body { font-family: sans-serif; margin: 0; display: flex; }
      aside {
        width: 200px;
        background: #f4f4f4;
        padding: 20px;
        height: 100vh;
        overflow-y: auto;
        position: fixed;
        box-shadow: 2px 0 5px rgba(0,0,0,0.1);
      }
      main {
        margin-left: 240px;
        padding: 40px;
        flex: 1;
      }
      #searchBox {
        width: 90%;
        padding: 10px;
        font-size: 16px;
      }
      .grid {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
      }
      .grid-item {
        flex: 0 0 calc(20% - 16px);
        box-sizing: border-box;
        background: white;
      }
      .hidden { display: none; }
      a { text-decoration: none; color: inherit; display: block; }
      a:hover {
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.3);
        transform: translateY(-4px) scale(1.02);
        transition: all 0.2s ease-in-out;
        z-index: 10;
        position: relative;
      }
      #searchBoxContainer {
        position: sticky;
        top: 0;
        background: #f4f4f4;
      }
    </style>
  </head>
  <body>
    <aside>
      <h2>Search</h2>
      <input type="text" id="searchBox" />
      <h2>Jump</h2>
      ${monthLinks}
    </aside>
    <main>
<h1>Crazy's Unclaimed Humble Games</h1>
${filteredData.map(group => `
<section id="${group.month.replace(/\s+/g, '_')}">
<h2>${group.month}</h2>
<div class="grid">
${group.items.map(i => `<div class="grid-item">${i}</div>`).join('')}
</div>
</section>
`).join('')}
    </main>
    <script>
document.getElementById('searchBox').addEventListener('input', function () {
  const search = this.value.toLowerCase();
  document.querySelectorAll('.grid-item').forEach(item => {
    item.classList.toggle('hidden', !item.textContent.toLowerCase().includes(search));
  });
});
    </script>
  </body>
</html>`;

    html = html.replace(/<i class="hb hb-steam/g, '<i class="fa-brands fa-steam');
    html = html.replace(/<i class="hb hb-/g, '<i class="fa fa-');

    fs.writeFileSync('index.html', html);
  }

  generateHTML(collectedData);

  console.log("✅ Done! index.html generated.");

  await browser.close();
})();
