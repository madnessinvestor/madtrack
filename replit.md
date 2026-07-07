# MadTracker

A privacy-first asset tracker PWA for Cryptocurrencies, Brazilian Stocks (B3), US Stocks, and Forex Pairs.

## Stack
- **Backend**: Python / Flask (single file: `app.py`)
- **Frontend**: Vanilla JavaScript PWA (`static/`, `templates/`)
- **Data**: No database — assets stored in `assets.json`, alerts in `alerts.json`

## How to run
```
python3 app.py
```
Serves on port 5000. No API keys required — fetches from public endpoints (Hyperliquid, MEXC, KuCoin, Gate.io, OKX, Kraken, Bitfinex, CoinGecko, CoinCap, CryptoCompare, etc.).

## Key files
- `app.py` — all Flask routes and price-fetching logic (~1953 lines)
- `static/app.js` — main frontend logic
- `static/style.css` — all styles
- `templates/index.html` — main PWA shell
- `assets.json` — persisted watchlist
- `alerts.json` — persisted price alerts

## Notes
- Icon 404s for obscure symbols are expected/harmless — the `/api/icon` endpoint returns 404 when no icon is found externally
- Production: gunicorn configured (`gunicorn --bind=0.0.0.0:5000 --reuse-port app:app`)
- `_save_json_file` uses a `threading.Lock` + `tempfile.mkstemp` for safe concurrent writes

## User preferences
