# MadTracker

A privacy-first asset tracker PWA for Cryptocurrencies, Brazilian Stocks (B3), US Stocks, and Forex Pairs.

## Stack

- **Backend:** Python 3 / Flask (`app.py`)
- **Frontend:** Vanilla JavaScript PWA (no framework)
- **Data:** `assets.json` (watchlist), `alerts.json` (price alerts), `portfolio.json` (trades)
- **Templates:** Jinja2 (`templates/`)
- **Static assets:** `static/` (JS, CSS, icons, service worker)

## How to run

```
python3 app.py
```

Serves on port 5000. The workflow "Start application" handles this automatically.

## Key features

- Multi-source crypto price aggregation (Hyperliquid, MEXC, KuCoin, Gate.io, OKX, Kraken, Bitfinex, CoinGecko, CoinCap, CryptoCompare)
- Brazilian (B3) and US stock tracking
- Forex pair monitoring
- Multi-currency display (BRL, USD, EUR)
- Watchlist, portfolio/trade tracking, price alerts
- AI assistant ("Mad AI") for portfolio analysis
- Home-screen widget support
- PWA (installable, service worker)

## External APIs used

- Multiple public crypto exchange APIs (no keys required for most)
- CoinGecko, CoinCap, CryptoCompare (public endpoints)
- B3/US stock data via public market data providers
- Jumper.xyz portfolio API

## Notes

- No database — all data stored in local JSON files (`assets.json`, `alerts.json`, `portfolio.json`)
- No authentication required
- The "Mad AI" feature may require an AI API key (check `app.py` around the `/api/madai` route)

## User preferences

