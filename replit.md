# MadTracker

A privacy-first asset tracker PWA for Cryptocurrencies, Brazilian Stocks (B3), US Stocks, and Forex Pairs.

## Stack
- **Backend**: Python 3.12 + Flask
- **Frontend**: Vanilla JavaScript, PWA (Service Worker + manifest)
- **No database**: Data persisted in `assets.json` (local file)

## How to run
The app is configured to start automatically via the **Start application** workflow:
```
python3 app.py
```
Runs on port 5000. For production, gunicorn is used:
```
gunicorn --bind=0.0.0.0:5000 --reuse-port app:app
```

## Project structure
- `app.py` — Flask backend, all API routes and price-fetching logic
- `templates/` — Jinja2 HTML templates (`index.html`, `widget.html`, `widget_settings.html`)
- `static/` — CSS, JS, icons, fonts, PWA manifest and service worker
- `assets.json` — Persisted watchlist/portfolio data (auto-created)
- `alerts.json` — Persisted price alerts

## Key features
- Multi-source crypto price aggregation (Hyperliquid, MEXC, KuCoin, Gate.io, OKX, Kraken, Bitfinex, CoinGecko, CoinCap, CryptoCompare)
- Brazilian stocks (B3) and US stocks
- Forex pairs with flag icons
- Multi-currency display (BRL, USD, EUR)
- Watchlist, portfolio/trade tracking, wallet dashboard
- Price alerts
- Offline-capable PWA

## User preferences
