# Humble Unclaimed Games Index

This repository automatically generates a browsable index of your **unclaimed Humble Bundle games** using [Playwright](https://playwright.dev/) for browser automation and GitHub Actions for scheduling. The generated site is published via GitHub Pages, allowing you to conveniently view and share available Humble Choice games.

---

## Features

- Automatically expands all Humble Choice months and collects **unclaimed games**.
- Generates a static `index.html` page with:
  - Sidebar **search box** to filter games
  - Jump-to-month navigation
  - Responsive grid layout
  - Platform icons (Steam, Epic, etc.)
- GitHub Actions integration for:
  - Automatic monthly updates (first Wednesday or fallback on the 10th)
  - Manual workflow dispatch
  - Updating GitHub Pages only when `index.html` changes
- Fully self-contained HTML output; no external CSS or JS dependencies required

---

## How It Works

1. **Authentication**  
   The scraper uses your Humble Bundle session data (truncated auth state) to access your account. This ensures it can see which games are unclaimed without needing your password.

2. **Browser Automation**  
   Playwright launches a headless or visible browser, opens Humble Bundle, expands all available months, and collects unclaimed games.

3. **HTML Generation**  
   Your collected games are rendered into a **custom HTML page** with:
   - A sidebar search box
   - Jump-to-month links
   - Responsive grid of game tiles
   - Hover effects and links to Humble pages

4. **GitHub Actions Integration**  
   - Automatically runs once a month on a scheduled cron job (first Wednesday approximation or the 10th if needed)  
   - Can also be run manually using `workflow_dispatch`  
   - Commits the updated `index.html` to a separate branch (`gh-pages`) only if there are changes

5. **GitHub Pages Deployment**  
   The `gh-pages` branch serves the site via GitHub Pages, giving you a live, browsable index of your unclaimed games.

---

## Setup

### 1. Clone the repository
```bash
git clone https://github.com/<your-username>/<repo>.git  
cd <repo>
```

### 2. Install dependencies

Install Node.js packages and Playwright browsers:
```bash
npm install  
npx playwright install --with-deps
```
> `--with-deps` ensures all system dependencies are installed for Playwright to run on Linux CI environments like GitHub Actions.

---

## Humble Auth Setup

The scraper requires your **Humble Bundle authentication** to access your account and determine which games are unclaimed. The recommended method is to export a **truncated auth state**, base64-encoded, as a GitHub Actions secret. This will export a state of a valid browser that is already logged in, and can interact on your behalf. Humble does not export a public API for these purposes.

```bash
npm run auth
```

This will run an automatic, isolated login container, and export auth information to `auth.json` for the following step. If you cannot get this to work, you can do it manually below.

### 1. Export Humble Auth

1. Open your browser and log into Humble Bundle.  
2. Export your session/auth state (truncated if needed) into a file, e.g., `auth.json`.  
3. Base64-encode the file for GitHub Actions;

PowerShell example:
```ps
$auth = Get-Content auth.json -Raw  
$encoded = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($auth))  
Write-Output $encoded
```

### 2. Add the auth secret in GitHub

1. Go to your repository **Settings → Secrets → Actions → New repository secret**.  
2. Name the secret `HUMBLEAUTHSTATE`.  
3. Paste the Base64-encoded string from above.

### 3. Updating the auth in the future

- If your Humble session expires, repeat the export steps above.  
- Replace the old secret with the new Base64 string.  
- The GitHub Actions workflow will automatically use the updated auth during the next run.

---

## Usage

### Run locally

node scrape.js

- Generates an updated `index.html` in your repository root.  
- Open `index.html` in your browser to view unclaimed games.  
- Sidebar search box filters games dynamically.  
- Month links in the sidebar allow navigation to a specific month.

---

### Run via GitHub Actions

- Automatically runs:
  - **First Wednesday of each month** (approximation)
  - **Fallback on the 10th**
- Can also run manually:
  1. Open **Actions** tab  
  2. Select **Humble Scraper**  
  3. Click **Run workflow**

- Workflow steps:
  1. Checkout the repository  
  2. Restore your Humble auth from the secret  
  3. Run the scraper  
  4. Generate the HTML page  
  5. Commit to `gh-pages` branch only if `index.html` changed  
  6. Push updates to GitHub Pages

---

## GitHub Pages Deployment

1. Go to **Settings → Pages** in your repository.  
2. Set **Branch**: `gh-pages`  
3. Set **Folder**: `/ (root)`  
4. Save changes.

The site will be available at:  
https://<username>.github.io/<repo>/

---

## Development Notes

- Playwright runs **headless in CI** and **headed locally** for easier debugging.  
- Sidebar search, month navigation, and hover effects are baked into the generated HTML.  
- The workflow will **skip commits** if `index.html` has not changed, preventing unnecessary rebuilds.

---

## Optional Improvements

- Display **last updated timestamp** on the page.  
- Highlight new months or recently added games.  
- Include additional metadata (platform, rating, etc.)  
- Separate CSS or JS for easier customization.

---

## License

This repository is intended for **personal automation purposes only**.  

> Redistribution of Humble Bundle keys or content may violate Humble Bundle’s Terms of Service. Use responsibly and do not share unclaimed keys publicly.
