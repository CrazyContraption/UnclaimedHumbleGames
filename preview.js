// preview.js
// Generates a preview HTML file using the modern template and real/sample data.
// Usage: node preview.js [input.json] [output.html]

const fs = require('fs');
const path = require('path');

const input = process.argv[2];
const output = process.argv[3] || 'preview.html';

// Generate data: use provided file, extract from index.html, or use realistic defaults
let data;

if (input && fs.existsSync(input)) {
  // Use provided JSON input
  data = JSON.parse(fs.readFileSync(input, 'utf-8'));
} else if (fs.existsSync(path.join(__dirname, 'index.html'))) {
  // Try to extract data from generated index.html
  try {
    const indexHtml = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
    const match = indexHtml.match(/window\.UNCLAIMED_HUMBLE_GAMES = (\[[\s\S]*?\]);/);
    if (match && match[1]) {
      data = JSON.parse(match[1]);
      // Take first 3 months for preview
      data = data.slice(0, 3);
    } else {
      throw new Error('Could not extract data from index.html');
    }
  } catch (err) {
    console.log('⚠️  Could not extract from index.html, using realistic sample data...');
    data = generateRealisticSampleData();
  }
} else {
  // Generate realistic sample data for offline testing
  data = generateRealisticSampleData();
}

function generateRealisticSampleData() {
  return [
    {
      month: 'May 2026',
      items: [
        {
          title: 'Diablo IV',
          image: 'https://hb.imgix.net/d0e8cf05c9e5f76c2cd02b2d26d109a6b31b5465.png?auto=compress,format&fit=clip&h=383&w=667',
          url: 'https://www.humblebundle.com/membership/home',
          platform: 'steam',
          type: 'game',
          genre: 'action',
          month: 'May 2026'
        },
        {
          title: 'Shin Megami Tensei V: Vengeance',
          image: 'https://hb.imgix.net/6a8b60ac86212519980c25f8e5f600792f722ea5.jpg?auto=compress,format&fit=clip&h=383&w=667',
          url: 'https://www.humblebundle.com/membership/home',
          platform: 'steam',
          type: 'game',
          genre: 'rpg',
          month: 'May 2026'
        },
        {
          title: 'Crysis 3 Remastered',
          image: 'https://hb.imgix.net/f328b6315c6731b17e9b65e1c8d625ac53dc5d3b.jpg?auto=compress,format&fit=clip&h=383&w=667',
          url: 'https://www.humblebundle.com/membership/home',
          platform: 'steam',
          type: 'game',
          genre: 'action',
          month: 'May 2026'
        }
      ]
    },
    {
      month: 'April 2026',
      items: [
        {
          title: 'Daemon X Machina: Titanic Scion',
          image: 'https://hb.imgix.net/0495b3c546d0e76443413387e99b4b5791feb15c.jpg?auto=compress,format&fit=clip&h=383&w=667',
          url: 'https://www.humblebundle.com/membership/april-2026',
          platform: 'steam',
          type: 'game',
          genre: 'action',
          month: 'April 2026'
        },
        {
          title: 'The Lord of the Rings: Return to Moria',
          image: 'https://hb.imgix.net/5a2e280700df8c211ac623eb61499e497f94946b.jpg?auto=compress,format&fit=clip&h=383&w=667',
          url: 'https://www.humblebundle.com/membership/april-2026',
          platform: 'steam',
          type: 'game',
          genre: 'adventure',
          month: 'April 2026'
        }
      ]
    },
    {
      month: 'March 2026',
      items: [
        {
          title: 'Chants of Sennaar',
          image: 'https://hb.imgix.net/a02cb4e3f86d1b24e348bc000501becd7805e7c4.jpg?auto=compress,format&fit=clip&h=383&w=667',
          url: 'https://www.humblebundle.com/membership/march-2026',
          platform: 'gog',
          type: 'game',
          genre: 'adventure',
          month: 'March 2026'
        },
        {
          title: 'Sworn',
          image: 'https://hb.imgix.net/c0e8b759ae7a1ec58521f5ce9586b11653281d6a.jpg?auto=compress,format&fit=clip&h=383&w=667',
          url: 'https://www.humblebundle.com/membership/march-2026',
          platform: 'steam',
          type: 'game',
          genre: 'rpg',
          month: 'March 2026'
        },
        {
          title: 'Etrian Odyssey III HD',
          image: 'https://hb.imgix.net/de70fea177a99620cf8bba93f3a90bfe71ee3e91.jpg?auto=compress,format&fit=clip&h=383&w=667',
          url: 'https://www.humblebundle.com/membership/march-2026',
          platform: 'steam',
          type: 'game',
          genre: 'rpg',
          month: 'March 2026'
        }
      ]
    },
    {
      month: 'February 2026',
      items: [
        {
          title: 'StarVaders',
          image: 'https://hb.imgix.net/2fe76d830fb3f0d03e826cd9cc9b548ba6961c4b.jpg?auto=compress,format&fit=clip&h=383&w=667',
          url: 'https://www.humblebundle.com/membership/february-2026',
          platform: 'steam',
          type: 'game',
          genre: 'action',
          month: 'February 2026'
        },
        {
          title: 'Squirrel with a Gun',
          image: 'https://hb.imgix.net/f199f801a1b9a3729a1904f6691bfa5ab3291247.jpg?auto=compress,format&fit=clip&h=383&w=667',
          url: 'https://www.humblebundle.com/membership/february-2026',
          platform: 'steam',
          type: 'game',
          genre: 'action',
          month: 'February 2026'
        }
      ]
    }
  ];
}

// Use the same HTML generation as scrape.js (modern template + data injection)
const templatePath = path.join(__dirname, 'modern_template.html');
let template = fs.readFileSync(templatePath, 'utf-8');
const updatedAt = new Date().toISOString();
const injectScript = `<script>window.UNCLAIMED_HUMBLE_GAMES = ${JSON.stringify(data)}; window.UNCLAIMED_HUMBLE_GAMES_UPDATED_AT = ${JSON.stringify(updatedAt)};</script>`;
template = template.replace('<body>', `<body>\n${injectScript}`);
fs.writeFileSync(output, template);
console.log(`✅ Preview generated: ${output}`);
