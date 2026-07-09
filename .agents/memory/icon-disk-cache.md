---
name: Icon disk cache
description: How token icons are downloaded and cached locally in CryptoAIO
---

## What was built
Token icons are now downloaded from external sources and saved permanently to `static/icons/tokens/{SYM}.png`. The frontend tries the local file before making any API call.

## Flow
1. Warmup (`_load_icons`) runs on startup and downloads all tracked-asset icons to disk (1.5s delay per token to respect CoinGecko rate limits).
2. Frontend (`tryCryptoIcon` in `static/app.js`): tries CDN1 → CDN2 → `/static/icons/tokens/{SYM}.png` → `/api/icon`.
3. `/api/icon`: checks disk first, then calls `_download_icon_to_disk` which tries CoinGecko → ErikThiart CDN → spothq CDN → CoinCap CDN.
4. Downloaded icon URLs are persisted to `static/icons/icon_urls.json` (no nulls, atomic write).

## Key safety decisions
- `_symbol_valid()` enforces `^[A-Z0-9]{1,20}$` before any path construction (path traversal fix).
- `_fetch_icon_url` distinguishes 429/network errors (transient — do NOT cache None) from confirmed misses (cache None in memory, never on disk).
- File writes use temp + `os.replace()` with per-symbol locks (`_file_lock_for`).
- No-cache headers are NOT applied to `/static/icons/tokens/` (tokens get `Cache-Control: public, max-age=86400`).

## WARNING: do NOT use sed to edit app.py
Multiple times during development, `sed` with `\n` in the replacement silently duplicated the file content or truncated string literals. Always use the Edit tool or Python for file modifications.
