# Finance Hot Topics

A daily-updated dashboard tracking trending topics across finance and crypto news.
Built entirely on free infrastructure: GitHub Actions + GitHub Pages.

## Setup (one-time, ~5 minutes)

**1. Push this repo to GitHub**
```bash
cd finance-tracker
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/vibeotter1/finance-tracker.git
git push -u origin main
```

**2. Enable GitHub Actions write access**
Settings → Actions → General → Workflow permissions → **Read and write permissions** → Save

**3. Enable GitHub Pages**
Settings → Pages → Source → **Deploy from a branch** → Branch: `main`, Folder: `/docs` → Save

**4. Run the first update manually**
Actions → Daily Finance Topics Update → Run workflow

Your dashboard will be live at: **https://vibeotter1.github.io/finance-tracker**

After that, it updates automatically every day at 8 AM UTC.

## How it works

- `scripts/fetch_topics.py` pulls headlines from 7 RSS feeds + 4 Reddit finance subs + CoinGecko trending
- spaCy NER extracts named entities (orgs, people, events, places) from all headlines
- Topics ranked by cross-source mention frequency; new topics (not in yesterday's data) flagged
- Daily snapshot saved to `data/YYYY-MM-DD.json`; last 90 days aggregated into `docs/data.json`
- Dashboard reads `data.json` client-side and renders topic cards + 30-day trend chart

## Sources

RSS: Reuters Business, Reuters Finance, CoinDesk, CoinTelegraph, MarketWatch, Investing.com, Yahoo Finance  
Reddit: r/finance, r/investing, r/CryptoCurrency, r/economics  
Crypto: CoinGecko trending API
