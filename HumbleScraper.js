function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function clickAllViewMoreButtons() {
  console.log('Expanding views, please wait - this may take a moment.');
    const BUTTON_SELECTOR = '.see-more-months';
    const HIDDEN_CLASS = 'is-hidden';
    const INTERVAL_MS = 500;
    const MAX_HIDDEN_COUNT = 8;

    let hiddenCount = 0;

    while (hiddenCount < MAX_HIDDEN_COUNT) {
        const button = document.querySelector(BUTTON_SELECTOR);
        if (button && !button.classList.contains(HIDDEN_CLASS)) {
            button.click();
            hiddenCount = 0; // Reset if button was visible and clicked
        } else {
            hiddenCount++;
        }
        await wait(INTERVAL_MS);
    }
}

clickAllViewMoreButtons().then(() => {
  console.log('All views expanded, starting data collection...');
  const links = Array.from(document.querySelectorAll('a.content-choices-footer'));
  const totalTabs = links.length;
  let receivedCount = 0;
  const collectedData = [];

  const sessionId = 'dataCollector_' + Math.random().toString(36).substring(2);
  const delayMs = 0;

  function extractContentChoiceData(doc, url) {
    const monthEl = doc.querySelector('h3.content-choices-title');
    const month = monthEl ? monthEl.textContent.trim() : 'Unknown';
    const baseUrl = "https://www.humblebundle.com/membership/june-2025" // Adjust this base URL as needed

    const tilesContainer = doc.querySelector('div.content-choice-tiles.js-content-choice-tiles');
    const tiles = tilesContainer ? Array.from(tilesContainer.querySelectorAll('div.content-choice')) : [];

    const items = tiles
      .filter(el => !el.closest('div.claimed'))
      .map(el => {
        const targetId = el.querySelector('div[id]')?.id;
        const wrapper = document.createElement('a');
        const cleanId = targetId?.replace(/^choice-/, '');
        wrapper.href = baseUrl + '/' + cleanId;
        wrapper.target = '_blank';
        wrapper.innerHTML = el.outerHTML;
        return wrapper.outerHTML;
      });

    return { month, items };
  }

  // Extract from main page first
  const mainData = extractContentChoiceData(document, window.location.href);
  if (mainData.items.length > 0) {
    collectedData.push(mainData);
  }

  window.addEventListener('message', function handleMessage(event) {
    if (event.data && event.data.type === sessionId) {
      if (event.data.payload.length > 0) {
        collectedData.push({ month: event.data.month, items: event.data.payload });
      }
      receivedCount++;
      if (receivedCount === totalTabs) {
        window.removeEventListener('message', handleMessage);
        generateHTML(collectedData);
      }
    }
  });

  (async function() {
    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      const win = window.open(link.href, '_blank');

      const interval = setInterval(() => {
        try {
          if (win.document && win.document.readyState === "complete") {
            clearInterval(interval);
            win.eval(`
              (function() {
                const monthEl = document.querySelector('h3.content-choices-title');
                const month = monthEl ? monthEl.textContent.trim() : 'Unknown';
                const baseUrl = window.location.href.split('#')[0];
                const tilesContainer = document.querySelector('div.content-choice-tiles.js-content-choice-tiles');
                const tiles = tilesContainer ? Array.from(tilesContainer.querySelectorAll('div.content-choice')) : [];

                const items = tiles
                  .filter(el => !el.closest('div.claimed'))
                  .map(el => {
                    const targetId = el.querySelector('div[id]')?.id;
                    const wrapper = document.createElement('a');
                    const cleanId = targetId?.replace(/^choice-/, '');
                    wrapper.href = baseUrl + '/' + cleanId;
                    wrapper.target = '_blank';
                    wrapper.innerHTML = el.outerHTML;
                    return wrapper.outerHTML;
                  });

                window.opener.postMessage({ type: "${sessionId}", month, payload: items }, "*");
                window.close();
              })();
            `);
          }
        } catch (e) {}
        window.focus();
      }, 1500);
      window.focus();
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  })();

  function generateHTML(data) {
    const win = window.open('', '_blank');
    const filteredData = data.filter(group => group.items && group.items.length > 0);
    const monthLinks = filteredData.map(group => `<a href="#${group.month.replace(/\s+/g, '_')}">${group.month}</a>`).join('<br>');

    const html = `<!DOCTYPE html>
    <html lang="en">
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
        <div id="searchBoxContainer">
          <input type="text" id="searchBox" placeholder="Search..." />
        </div>
        <h2>Jump to Month</h2>
        ${monthLinks}
        <br>
        <br>
        <br>
      </aside>
      <main>
        <h1>Crazy's Unclaimed Humble Games</h1>
        ${filteredData.map(group => `
          <section id="${group.month.replace(/\s+/g, '_')}">
            <h2>${group.month}</h2>
            <div class="grid">
              ${group.items.map(html => `<div class="grid-item">${html}</div>`).join('\n\n')}
            </div>
            <br><br>
          </section>
        `).join('')}
      </main>

      <script>
        document.getElementById('searchBox').addEventListener('input', function () {
          const search = this.value.toLowerCase();
        
          document.querySelectorAll('section').forEach(section => {
            const items = section.querySelectorAll('.grid-item');
            let anyVisible = false;
        
            items.forEach(item => {
              const match = item.textContent.toLowerCase().includes(search);
              item.classList.toggle('hidden', !match);
              if (match) anyVisible = true;
            });
        
            section.style.display = search && !anyVisible ? 'none' : '';
          });
        });
      </script>
    </body>
    </html>`;
    win.document.write(html);
    win.document.close();
  }
});
