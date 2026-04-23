#!/usr/bin/env python3
import json
import os
from collections import defaultdict
from datetime import datetime, timedelta, timezone

import feedparser
import requests
import spacy

RSS_FEEDS = [
    ("Reuters Business", "https://feeds.reuters.com/reuters/businessNews"),
    ("Reuters Finance", "https://feeds.reuters.com/reuters/financialsNews"),
    ("CoinDesk", "https://www.coindesk.com/arc/outboundfeeds/rss/"),
    ("CoinTelegraph", "https://cointelegraph.com/rss"),
    ("MarketWatch", "https://feeds.marketwatch.com/marketwatch/topstories"),
    ("Investing.com", "https://www.investing.com/rss/news.rss"),
    ("Yahoo Finance", "https://finance.yahoo.com/news/rssindex"),
]

REDDIT_SUBS = ["finance", "investing", "CryptoCurrency", "economics"]
HEADERS = {"User-Agent": "FinanceTracker/1.0 (github.com/vibeotter1/finance-tracker)"}
NER_LABELS = {"ORG", "PERSON", "GPE", "PRODUCT", "EVENT", "LAW"}
DATA_DIR = "data"
DOCS_DIR = "docs"


def fetch_rss():
    items = []
    for name, url in RSS_FEEDS:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:20]:
                title = entry.get("title", "").strip()
                if title:
                    items.append({
                        "title": title,
                        "url": entry.get("link", ""),
                        "source": name,
                    })
        except Exception as e:
            print(f"  RSS {name}: {e}")
    return items


def fetch_reddit():
    items = []
    for sub in REDDIT_SUBS:
        try:
            url = f"https://www.reddit.com/r/{sub}/top.json?t=day&limit=25"
            r = requests.get(url, headers=HEADERS, timeout=10)
            r.raise_for_status()
            for post in r.json()["data"]["children"]:
                d = post["data"]
                items.append({
                    "title": d["title"],
                    "url": f"https://reddit.com{d['permalink']}",
                    "source": f"r/{sub}",
                })
        except Exception as e:
            print(f"  Reddit r/{sub}: {e}")
    return items


def fetch_crypto_trending():
    try:
        r = requests.get(
            "https://api.coingecko.com/api/v3/search/trending",
            headers=HEADERS,
            timeout=10,
        )
        r.raise_for_status()
        return [
            {
                "name": c["item"]["name"],
                "symbol": c["item"]["symbol"].upper(),
                "market_cap_rank": c["item"].get("market_cap_rank"),
                "thumb": c["item"]["thumb"],
            }
            for c in r.json().get("coins", [])[:10]
        ]
    except Exception as e:
        print(f"  CoinGecko: {e}")
        return []


def fetch_stock_quote(symbol, browser_headers):
    try:
        url = f"https://query2.finance.yahoo.com/v8/finance/chart/{symbol}?interval=1d&range=1d"
        r = requests.get(url, headers=browser_headers, timeout=8)
        r.raise_for_status()
        result = r.json().get("chart", {}).get("result", [])
        if not result:
            return None
        meta = result[0]["meta"]
        price = meta.get("regularMarketPrice", 0)
        prev = meta.get("previousClose") or meta.get("chartPreviousClose") or price
        change_pct = ((price - prev) / prev * 100) if prev else 0
        name = meta.get("longName") or meta.get("shortName") or symbol
        return {
            "symbol": symbol,
            "name": name,
            "price": round(price, 2),
            "change_pct": round(change_pct, 2),
        }
    except Exception:
        return None


def fetch_stock_trending():
    browser_headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
    }
    try:
        r = requests.get(
            "https://query1.finance.yahoo.com/v1/finance/trending/US?count=10",
            headers=HEADERS, timeout=10,
        )
        r.raise_for_status()
        result = r.json().get("finance", {}).get("result", [])
        if not result:
            return []
        symbols = [q["symbol"] for q in result[0].get("quotes", [])[:10]]
    except Exception as e:
        print(f"  Yahoo Finance trending symbols: {e}")
        return []

    stocks = []
    for symbol in symbols:
        quote = fetch_stock_quote(symbol, browser_headers)
        if quote:
            stocks.append(quote)
    print(f"  Fetched {len(stocks)}/{len(symbols)} stock quotes")
    return stocks


def extract_topics(items, nlp):
    entity_items = defaultdict(list)

    for item in items:
        doc = nlp(item["title"])
        seen = set()
        for ent in doc.ents:
            name = ent.text.strip()
            if ent.label_ in NER_LABELS and len(name) > 2 and name not in seen:
                seen.add(name)
                entity_items[name].append(item)

    topics = []
    for entity, linked in sorted(entity_items.items(), key=lambda x: -len(x[1])):
        if len(linked) < 2:
            continue
        topics.append({
            "name": entity,
            "count": len(linked),
            "sources": sorted({i["source"] for i in linked}),
            "articles": linked[:5],
            "is_new": False,
        })

    return topics[:30]


def load_previous_topics():
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    path = os.path.join(DATA_DIR, f"{yesterday}.json")
    if os.path.exists(path):
        with open(path) as f:
            return {t["name"].lower() for t in json.load(f).get("topics", [])}
    return set()


def rebuild_dashboard_data():
    cutoff = datetime.now(timezone.utc) - timedelta(days=90)
    snapshots = []
    for fname in sorted(os.listdir(DATA_DIR)):
        if not fname.endswith(".json"):
            continue
        try:
            date = datetime.strptime(fname[:-5], "%Y-%m-%d").replace(tzinfo=timezone.utc)
        except ValueError:
            continue
        if date >= cutoff:
            with open(os.path.join(DATA_DIR, fname)) as f:
                snapshots.append(json.load(f))
    with open(os.path.join(DOCS_DIR, "data.json"), "w") as f:
        json.dump(snapshots, f)
    return len(snapshots)


def main():
    os.makedirs(DATA_DIR, exist_ok=True)
    os.makedirs(DOCS_DIR, exist_ok=True)

    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    print(f"Fetching topics for {today}...")

    nlp = spacy.load("en_core_web_sm")

    rss_items = fetch_rss()
    reddit_items = fetch_reddit()
    crypto = fetch_crypto_trending()
    stocks = fetch_stock_trending()
    all_items = rss_items + reddit_items

    print(f"  {len(rss_items)} RSS + {len(reddit_items)} Reddit = {len(all_items)} total")

    topics = extract_topics(all_items, nlp)
    prev = load_previous_topics()
    for t in topics:
        t["is_new"] = t["name"].lower() not in prev

    snapshot = {
        "date": today,
        "topics": topics,
        "crypto_trending": crypto,
        "stock_trending": stocks,
        "total_articles": len(all_items),
    }

    out = os.path.join(DATA_DIR, f"{today}.json")
    with open(out, "w") as f:
        json.dump(snapshot, f, indent=2)
    print(f"  Saved {out} ({len(topics)} topics)")

    n = rebuild_dashboard_data()
    print(f"  Rebuilt docs/data.json ({n} snapshots)")


if __name__ == "__main__":
    main()
