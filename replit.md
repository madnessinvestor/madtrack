# CryptoAIO

A privacy-first asset tracker for Cryptocurrencies, Brazilian Stocks (B3), US Stocks, and Forex Pairs. Built with Flask (Python) and Vanilla JavaScript as a Progressive Web App (PWA).

## Stack

- **Backend**: Python 3.12 + Flask
- **Frontend**: Vanilla JS, PWA (service worker, manifest)
- **Data**: No database — assets stored in `assets.json` (local file), prices fetched live from public APIs

## How to Run

The `Start application` workflow runs:
```
python3 app.py
```
This starts a Flask dev server on port 5000.

## Project Structure

- `app.py` — Flask backend; all price-fetching logic (Hyperliquid, MEXC, KuCoin, Gate.io, OKX, Kraken, Bitfinex, CoinGecko, CoinCap, CryptoCompare, B3, US stocks, Forex)
- `templates/` — Jinja2 HTML templates (`index.html`, `widget.html`, `widget_settings.html`)
- `static/` — JS modules (`app.js`, `dashboard.js`, `trade.js`, `madai.js`, `widget.js`, `alerts.js`, `i18n.js`), CSS, PWA manifest & service worker
- `assets.json` — persisted watchlist (auto-created)
- `alerts.json` — persisted price alerts (auto-created)

## Deployment

Uses gunicorn:
```
gunicorn --bind=0.0.0.0:5000 --reuse-port app:app
```

## No Secrets Required

All price data comes from public APIs — no API keys needed to run the app.

## User Preferences
