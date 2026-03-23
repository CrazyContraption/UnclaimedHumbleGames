const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  const page = await context.newPage();

  console.log("\n👉 Opening login page...");
  await page.goto('https://www.humblebundle.com/login');

  console.log("👉 Log in, then press ENTER here...\n");
  await new Promise(resolve => process.stdin.once('data', resolve));

  const cookies = await context.cookies();

  // Keep only Humble cookies (small + stable)
  const filtered = cookies.filter(c =>
    c.domain.includes('humblebundle.com')
  );

  fs.writeFileSync('auth.json', JSON.stringify(filtered, null, 2));

  console.log(`✅ Saved ${filtered.length} cookies to auth.json`);

  await browser.close();
})();