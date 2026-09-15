const fs = require('fs');
const path = require('path');

const targetUrl = (process.argv[2] || process.env.REMOVE_URL || '').trim();
const indexPath = process.env.INDEX_FILE || path.join(__dirname, '..', 'index.html');

if (!targetUrl) {
  console.error('Usage: node scripts/remove-url.js <url>');
  process.exit(1);
}

try {
  new URL(targetUrl);
} catch {
  console.error(`Invalid URL: ${targetUrl}`);
  process.exit(1);
}

const html = fs.readFileSync(indexPath, 'utf8');
const dataMatch = html.match(/window\.UNCLAIMED_HUMBLE_GAMES = (\[[\s\S]*?\]);/);

if (!dataMatch) {
  throw new Error(`Could not find game data in ${indexPath}`);
}

const data = JSON.parse(dataMatch[1]);
let removedCount = 0;
const updatedData = data
  .map(group => ({
    ...group,
    items: (group.items || []).filter(item => {
      const matches = item.url === targetUrl;
      if (matches) removedCount++;
      return !matches;
    })
  }))
  .filter(group => group.items.length > 0);

if (removedCount === 0) {
  console.error(`No item found for URL: ${targetUrl}`);
  process.exit(1);
}

const replacement = `window.UNCLAIMED_HUMBLE_GAMES = ${JSON.stringify(updatedData)};`;
const updatedHtml = html.replace(dataMatch[0], replacement);
fs.writeFileSync(indexPath, updatedHtml);

console.log(`Removed ${removedCount} item${removedCount === 1 ? '' : 's'} for ${targetUrl}`);