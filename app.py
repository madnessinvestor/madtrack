from flask import Flask, render_template, jsonify, request, send_file
import json, os, uuid, urllib.request, concurrent.futures, time, threading, time as _time

app = Flask(__name__)
DATA_FILE = "assets.json"
_icon_cache  = {}
_mcap_cache  = {}
MCAP_TTL     = 600

# Symbol autocomplete cache: list of {symbol, name, exchange}
_search_cache = []
_search_lock  = threading.Lock()

def _mcap_get(sym):
    entry = _mcap_cache.get(sym.upper())
    if entry and time.time() - entry[1] < MCAP_TTL:
        return entry[0]
    return None

def _mcap_set(sym, val):
    if val is not None:
        _mcap_cache[sym.upper()] = (val, time.time())

def load_assets():
    if os.path.exists(DATA_FILE):
        try:
            return json.load(open(DATA_FILE))
        except Exception:
            return []
    return []

def save_assets(assets):
    with open(DATA_FILE, "w") as f:
        json.dump(assets, f)

def http_get(url, timeout=5):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "MadTracker/1.0"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except Exception:
        return None

def http_post(url, data, timeout=8):
    try:
        body = json.dumps(data).encode()
        req = urllib.request.Request(url, data=body, headers={
            "User-Agent": "MadTracker/1.0",
            "Content-Type": "application/json"
        }, method="POST")
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except Exception:
        return None

import re as _re
_SYMBOL_RE = _re.compile(r'^[A-Z0-9.\-]{1,20}$')

def valid_symbol(sym: str) -> bool:
    return bool(_SYMBOL_RE.match(sym))

def safe_float(v):
    try:
        f = float(v)
        return f if f > 0 else None
    except Exception:
        return None

def signed_float(v):
    """Like safe_float but allows negative values (e.g. daily change %)."""
    try:
        return float(v)
    except Exception:
        return None

# ─── API fetchers ─────────────────────────────────────────────────────────────

def api_hyperliquid(sym):
    sym = sym.upper()
    # Fetch all mids and meta in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as ex:
        f_mids = ex.submit(http_post, "https://api.hyperliquid.xyz/info", {"type": "allMids"})
        f_meta = ex.submit(http_post, "https://api.hyperliquid.xyz/info", {"type": "metaAndAssetCtxs"})
        mids = f_mids.result()
        meta = f_meta.result()

    if not mids or sym not in mids:
        return None
    price = safe_float(mids[sym])
    if not price:
        return None

    change = volume = high = low = None
    if meta and len(meta) >= 2:
        for i, asset in enumerate(meta[0].get("universe", [])):
            if asset.get("name") == sym and i < len(meta[1]):
                ctx = meta[1][i]
                prev = safe_float(ctx.get("prevDayPx"))
                if prev:
                    change = round((price - prev) / prev * 100, 2)
                volume = safe_float(ctx.get("dayNtlVlm"))
                high   = safe_float(ctx.get("dayHigh")) if ctx.get("dayHigh") else None
                low    = safe_float(ctx.get("dayLow"))  if ctx.get("dayLow")  else None
                break

    return {"price": price, "change24h": change, "high24h": high, "low24h": low,
            "volume24h": volume, "market_cap": None, "source": "Hyperliquid"}

def api_hyperliquid_spot(sym):
    """Try to get price from Hyperliquid spot markets."""
    sym = sym.upper()
    meta = http_post("https://api.hyperliquid.xyz/info", {"type": "spotMeta"})
    if not meta:
        return None
    tokens = meta.get("tokens", [])
    # Find the token index
    token_idx = None
    for t in tokens:
        if t.get("name", "").upper() == sym:
            token_idx = t.get("index")
            break
    if token_idx is None:
        return None

    # Find spot pair for this token (prefer canonical, then /USDC, then any)
    universe = meta.get("universe", [])
    usdc_idx = next((t["index"] for t in tokens if t.get("name") == "USDC"), 0)
    pair_idx = None
    for pair in universe:
        toks = pair.get("tokens", [])
        if len(toks) >= 1 and toks[0] == token_idx and pair.get("isCanonical"):
            pair_idx = pair.get("index")
            break
    if pair_idx is None:
        for pair in universe:
            toks = pair.get("tokens", [])
            if len(toks) >= 2 and toks[0] == token_idx and toks[1] == usdc_idx:
                pair_idx = pair.get("index")
                break
    if pair_idx is None:
        for pair in universe:
            toks = pair.get("tokens", [])
            if len(toks) >= 1 and toks[0] == token_idx:
                pair_idx = pair.get("index")
                break
    if pair_idx is None:
        return None

    ctx_data = http_post("https://api.hyperliquid.xyz/info", {"type": "spotMetaAndAssetCtxs"})
    if not ctx_data or len(ctx_data) < 2:
        return None

    ctxs = ctx_data[1]
    if pair_idx >= len(ctxs):
        return None
    ctx = ctxs[pair_idx]
    price = safe_float(ctx.get("midPx") or ctx.get("markPx"))
    if not price:
        return None
    prev = safe_float(ctx.get("prevDayPx"))
    change = round((price - prev) / prev * 100, 2) if prev else None
    return {
        "price": price, "change24h": change,
        "high24h": None, "low24h": None,
        "volume24h": safe_float(ctx.get("dayNtlVlm")),
        "market_cap": None, "source": "Hyperliquid Spot"
    }

def api_mexc(sym):
    s = sym.upper() + "USDT"
    d = http_get(f"https://api.mexc.com/api/v3/ticker/24hr?symbol={s}")
    if d and safe_float(d.get("lastPrice")):
        return {
            "price": float(d["lastPrice"]),
            "change24h": round(float(d.get("priceChangePercent", 0)), 2),
            "high24h": safe_float(d.get("highPrice")),
            "low24h": safe_float(d.get("lowPrice")),
            "volume24h": safe_float(d.get("quoteVolume")),
            "market_cap": None, "source": "MEXC"
        }

def api_kucoin(sym):
    s = sym.upper() + "-USDT"
    d = http_get(f"https://api.kucoin.com/api/v1/market/stats?symbol={s}")
    if d and d.get("data", {}).get("last"):
        row = d["data"]
        price = safe_float(row.get("last"))
        if price:
            return {
                "price": price,
                "change24h": round(float(row.get("changeRate", 0)) * 100, 2),
                "high24h": safe_float(row.get("high")),
                "low24h": safe_float(row.get("low")),
                "volume24h": safe_float(row.get("volValue")),
                "market_cap": None, "source": "KuCoin"
            }

def api_gateio(sym):
    s = sym.upper() + "_USDT"
    d = http_get(f"https://api.gateio.ws/api/v4/spot/tickers?currency_pair={s}")
    if d and isinstance(d, list) and d:
        row = d[0]
        price = safe_float(row.get("last"))
        if price:
            return {
                "price": price,
                "change24h": round(float(row.get("change_percentage", 0)), 2),
                "high24h": safe_float(row.get("high_24h")),
                "low24h": safe_float(row.get("low_24h")),
                "volume24h": safe_float(row.get("quote_volume")),
                "market_cap": None, "source": "Gate.io"
            }

def api_okx(sym):
    s = sym.upper() + "-USDT"
    d = http_get(f"https://www.okx.com/api/v5/market/ticker?instId={s}")
    if d and d.get("data"):
        row = d["data"][0]
        price = safe_float(row.get("last"))
        open24 = safe_float(row.get("open24h"))
        change = round((price - open24) / open24 * 100, 2) if price and open24 else None
        if price:
            return {
                "price": price, "change24h": change,
                "high24h": safe_float(row.get("high24h")),
                "low24h": safe_float(row.get("low24h")),
                "volume24h": safe_float(row.get("volCcy24h")),
                "market_cap": None, "source": "OKX"
            }

def api_kraken(sym):
    s = sym.upper()
    pair = ("XBT" if s == "BTC" else s) + "USD"
    d = http_get(f"https://api.kraken.com/0/public/Ticker?pair={pair}")
    if d and not d.get("error") and d.get("result"):
        key = list(d["result"].keys())[0]
        row = d["result"][key]
        price = safe_float(row["c"][0])
        open_p = safe_float(row.get("o"))
        if price:
            change = round((price - open_p) / open_p * 100, 2) if open_p else None
            return {
                "price": price, "change24h": change,
                "high24h": safe_float(row.get("h", [None])[0]),
                "low24h": safe_float(row.get("l", [None])[0]),
                "volume24h": None, "market_cap": None, "source": "Kraken"
            }

def api_cryptocompare(sym):
    s = sym.upper()
    d = http_get(f"https://min-api.cryptocompare.com/data/pricemultifull?fsyms={s}&tsyms=USD")
    if d and d.get("RAW", {}).get(s, {}).get("USD"):
        row = d["RAW"][s]["USD"]
        price = safe_float(row.get("PRICE"))
        if price:
            return {
                "price": price,
                "change24h": round(float(row.get("CHANGEPCT24HOUR", 0)), 2),
                "high24h": safe_float(row.get("HIGH24HOUR")),
                "low24h": safe_float(row.get("LOW24HOUR")),
                "volume24h": safe_float(row.get("VOLUME24HOURTO")),
                "market_cap": safe_float(row.get("MKTCAP")),
                "source": "CryptoCompare"
            }

def api_coincap(sym):
    s = sym.lower()
    d = http_get(f"https://api.coincap.io/v2/assets?search={s}&limit=5")
    if d and d.get("data"):
        for asset in d["data"]:
            if asset.get("symbol", "").lower() == s:
                price = safe_float(asset.get("priceUsd"))
                if price:
                    return {
                        "price": price,
                        "change24h": round(float(asset.get("changePercent24Hr") or 0), 2),
                        "high24h": None, "low24h": None,
                        "volume24h": safe_float(asset.get("volumeUsd24Hr")),
                        "market_cap": safe_float(asset.get("marketCapUsd")),
                        "source": "CoinCap"
                    }

def _coingecko_coin_data(sym):
    s = sym.lower()
    search = http_get(f"https://api.coingecko.com/api/v3/search?query={s}")
    if not search or not search.get("coins"):
        return None, None
    coin_id = None
    for c in search["coins"]:
        if c.get("symbol", "").lower() == s:
            coin_id = c["id"]
            break
    if not coin_id:
        coin_id = search["coins"][0]["id"]
    d = http_get(f"https://api.coingecko.com/api/v3/coins/{coin_id}?localization=false&tickers=false&community_data=false&developer_data=false")
    return coin_id, d

def api_coingecko(sym):
    coin_id, d = _coingecko_coin_data(sym)
    if d and d.get("market_data"):
        md = d["market_data"]
        price = safe_float(md.get("current_price", {}).get("usd"))
        if price:
            img = d.get("image", {}).get("small") or d.get("image", {}).get("large")
            if img:
                _icon_cache[sym.upper()] = img
            return {
                "price": price,
                "change24h": round(float(md.get("price_change_percentage_24h") or 0), 2),
                "high24h": safe_float(md.get("high_24h", {}).get("usd")),
                "low24h": safe_float(md.get("low_24h", {}).get("usd")),
                "volume24h": safe_float(md.get("total_volume", {}).get("usd")),
                "market_cap": safe_float(md.get("market_cap", {}).get("usd")),
                "source": "CoinGecko"
            }

def api_bitfinex(sym):
    s = sym.upper()
    ticker = f"t{s}USD"
    d = http_get(f"https://api-pub.bitfinex.com/v2/ticker/{ticker}")
    if d and isinstance(d, list) and len(d) >= 10:
        price = safe_float(d[6])
        if price:
            return {
                "price": price,
                "change24h": round(float(d[5]) * 100, 2),
                "high24h": safe_float(d[8]),
                "low24h": safe_float(d[9]),
                "volume24h": None, "market_cap": None, "source": "Bitfinex"
            }

def api_brapi(sym):
    s = sym.upper()
    d = http_get(f"https://brapi.dev/api/quote/{s}")
    if d and d.get("results"):
        r = d["results"][0]
        price = safe_float(r.get("regularMarketPrice"))
        if price:
            return {
                "price": price,
                "change24h": signed_float(r.get("regularMarketChangePercent")),
                "high24h": safe_float(r.get("regularMarketDayHigh")),
                "low24h": safe_float(r.get("regularMarketDayLow")),
                "volume24h": safe_float(r.get("regularMarketVolume")),
                "market_cap": safe_float(r.get("marketCap")),
                "source": "brapi.dev"
            }

def api_forex(sym):
    s = sym.upper()
    if len(s) != 6:
        return None
    known = {"USD", "EUR", "BRL", "GBP", "JPY", "CHF", "AUD", "CAD"}
    from_cur, to_cur = s[:3], s[3:]
    if from_cur not in known or to_cur not in known:
        return None
    d = http_get(f"https://brapi.dev/api/quote/{s}=X")
    if d and d.get("results"):
        r = d["results"][0]
        price = safe_float(r.get("regularMarketPrice"))
        if price:
            return {
                "price": price,
                "change24h": signed_float(r.get("regularMarketChangePercent")),
                "high24h": safe_float(r.get("regularMarketDayHigh")),
                "low24h": safe_float(r.get("regularMarketDayLow")),
                "volume24h": None, "market_cap": None, "source": "Câmbio"
            }
    d = http_get(f"https://api.frankfurter.app/latest?from={from_cur}&to={to_cur}")
    if d and d.get("rates", {}).get(to_cur):
        price = safe_float(d["rates"][to_cur])
        if price:
            return {
                "price": price, "change24h": None,
                "high24h": None, "low24h": None,
                "volume24h": None, "market_cap": None, "source": "Câmbio"
            }
    return None

def _fetch_icon_url(symbol):
    """Fetch icon URL using a single CoinGecko search call (faster, less rate-limit pressure)."""
    sym = symbol.upper()
    if sym in _icon_cache:
        return _icon_cache[sym]
    s = sym.lower()
    search = http_get(f"https://api.coingecko.com/api/v3/search?query={s}", timeout=8)
    url = None
    if search and search.get("coins"):
        # Prefer exact symbol match, then fall back to first result
        for c in search["coins"]:
            if c.get("symbol", "").lower() == s:
                url = c.get("large") or c.get("thumb")
                break
        if not url:
            url = search["coins"][0].get("large") or search["coins"][0].get("thumb")
    _icon_cache[sym] = url
    return url

# Priority order — Hyperliquid perp first, then spot, then working CEXes, then stocks/forex
APIS = [
    api_forex,
    api_hyperliquid, api_hyperliquid_spot,
    api_mexc, api_kucoin, api_gateio,
    api_okx, api_kraken, api_cryptocompare,
    api_coincap, api_coingecko, api_bitfinex,
    api_brapi
]

def fetch_price(symbol):
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(APIS)) as ex:
        futures = {ex.submit(fn, symbol): fn for fn in APIS}
        for future in concurrent.futures.as_completed(futures):
            fn = futures[future]
            try:
                r = future.result()
                if r and r.get("price"):
                    results[fn] = r
            except Exception:
                pass

    primary = None
    for fn in APIS:
        if fn in results:
            primary = dict(results[fn])
            break
    if not primary:
        return None

    fill = ["change24h", "high24h", "low24h", "volume24h", "market_cap"]
    for fn in APIS:
        if fn not in results:
            continue
        r = results[fn]
        for field in fill:
            if primary.get(field) is None and r.get(field) is not None:
                primary[field] = r[field]
        if all(primary.get(f) is not None for f in fill):
            break

    if primary.get("market_cap") is not None:
        _mcap_set(symbol, primary["market_cap"])
    else:
        primary["market_cap"] = _mcap_get(symbol)

    return primary

# ─── Portfolio (Trade) ────────────────────────────────────────────────────────

PORTFOLIO_FILE = "portfolio_data.json"

def load_portfolio():
    if os.path.exists(PORTFOLIO_FILE):
        try:
            return json.load(open(PORTFOLIO_FILE))
        except Exception:
            return []
    return []

def save_portfolio(tokens):
    with open(PORTFOLIO_FILE, "w") as f:
        json.dump(tokens, f)

@app.route("/api/portfolio", methods=["GET"])
def get_portfolio():
    tokens = load_portfolio()
    if not tokens:
        return jsonify([])
    def fetch_one(t):
        sym = t.get("ticker", "").upper()
        r = fetch_price(sym)
        icon_url = _icon_cache.get(sym)
        result = dict(t)
        result["current_price"] = r["price"] if r else None
        result["icon_url"] = icon_url
        return result
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(tokens))) as ex:
        out = list(ex.map(fetch_one, tokens))
    return jsonify(out)

@app.route("/api/portfolio", methods=["POST"])
def add_portfolio_trade():
    data = request.get_json(silent=True) or {}
    sym = data.get("ticker", "").strip().upper()
    if not sym:
        return jsonify({"ok": False, "error": "no ticker"}), 400
    try:
        qty = float(data.get("qty", 0))
        price_paid = float(data.get("price_paid", 0))
        if qty == 0 or price_paid <= 0:
            raise ValueError
    except (TypeError, ValueError):
        return jsonify({"ok": False, "error": "invalid qty/price"}), 400
    date_str = data.get("date", "")
    tokens = load_portfolio()
    trade = {"date": date_str, "qty": qty, "price_paid": price_paid}
    existing = next((t for t in tokens if t["ticker"] == sym), None)
    if existing:
        existing.setdefault("trades", []).append(trade)
    else:
        tokens.append({"id": int(_time.time() * 1000), "ticker": sym, "trades": [trade]})
    save_portfolio(tokens)
    return jsonify({"ok": True})

@app.route("/api/portfolio/<ticker>", methods=["DELETE"])
def delete_portfolio_token(ticker):
    tokens = [t for t in load_portfolio() if t.get("ticker", "").upper() != ticker.upper()]
    save_portfolio(tokens)
    return jsonify({"ok": True})

@app.route("/api/portfolio/<ticker>/trade/<int:idx>", methods=["DELETE"])
def delete_portfolio_trade(ticker, idx):
    tokens = load_portfolio()
    for t in tokens:
        if t.get("ticker", "").upper() == ticker.upper():
            trades = t.get("trades", [])
            if 0 <= idx < len(trades):
                trades.pop(idx)
    save_portfolio(tokens)
    return jsonify({"ok": True})

@app.route("/api/portfolio/<ticker>", methods=["PUT"])
def rename_portfolio_token(ticker):
    data = request.get_json(silent=True) or {}
    new_ticker = data.get("ticker", "").strip().upper()
    if not new_ticker:
        return jsonify({"ok": False}), 400
    tokens = load_portfolio()
    for t in tokens:
        if t.get("ticker", "").upper() == ticker.upper():
            t["ticker"] = new_ticker
    save_portfolio(tokens)
    return jsonify({"ok": True})

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/widget")
def widget():
    return render_template("widget.html")

@app.route("/widget/settings")
def widget_settings():
    return render_template("widget_settings.html")

@app.route("/favicon.ico")
def favicon():
    return send_file("static/icons/icon-192.png", mimetype="image/png")

@app.route("/api/search")
def search_symbols():
    q = request.args.get("q", "").strip().upper()
    if not q or len(q) < 1:
        return jsonify([])
    with _search_lock:
        cache = list(_search_cache)
    matches = [s for s in cache if q in s["symbol"].upper()]
    matches.sort(key=lambda s: (not s["symbol"].upper().startswith(q), s["symbol"]))
    return jsonify(matches[:15])

@app.route("/api/icon")
def get_icon():
    sym = request.args.get("symbol", "").strip().upper()
    if not sym:
        return jsonify({"error": "no symbol"}), 400
    url = _fetch_icon_url(sym)
    if url:
        return jsonify({"url": url})
    return jsonify({"error": "not found"}), 404

@app.route("/api/price")
def get_price():
    sym = request.args.get("symbol", "").strip().upper()
    if not sym:
        return jsonify({"error": "no symbol"}), 400
    result = fetch_price(sym)
    if result:
        result["symbol"] = sym
        return jsonify(result)
    return jsonify({"error": "not found"}), 404

@app.route("/api/assets", methods=["GET"])
def get_assets():
    assets = load_assets()
    def fetch_one(a):
        sym = a.get("symbol", "").upper()
        r = fetch_price(sym)
        icon_url = _icon_cache.get(sym)
        if r:
            return {**r, "symbol": sym, "id": sym, "icon_url": icon_url}
        return {"symbol": sym, "id": sym, "price": None, "change24h": None,
                "high24h": None, "low24h": None, "volume24h": None,
                "market_cap": None, "source": None, "icon_url": icon_url}
    if not assets:
        return jsonify([])
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(assets))) as ex:
        out = list(ex.map(fetch_one, assets))
    return jsonify(out)

@app.route("/api/assets", methods=["POST"])
def add_asset():
    data = request.get_json(silent=True) or {}
    sym = data.get("symbol", "").strip().upper()
    if not sym or not valid_symbol(sym):
        return jsonify({"ok": False, "error": "invalid symbol"}), 400
    assets = load_assets()
    if not any(a["symbol"] == sym for a in assets):
        assets.append({"symbol": sym})
        save_assets(assets)
    return jsonify({"ok": True})

@app.route("/api/assets/<symbol>", methods=["DELETE"])
def delete_asset(symbol):
    assets = [a for a in load_assets() if a.get("symbol", "").upper() != symbol.upper()]
    save_assets(assets)
    return jsonify({"ok": True})

@app.route("/api/assets/order", methods=["PUT"])
def reorder_assets():
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"ok": False, "error": "invalid request body"}), 400
    symbols = body.get("symbols")
    if not isinstance(symbols, list) or len(symbols) == 0:
        return jsonify({"ok": False, "error": "symbols must be a non-empty list"}), 400
    current = {a["symbol"].upper(): a for a in load_assets()}
    ordered = [current[s.upper()] for s in symbols if isinstance(s, str) and s.upper() in current]
    if not ordered:
        return jsonify({"ok": False, "error": "no valid symbols matched"}), 400
    save_assets(ordered)
    return jsonify({"ok": True})

@app.route("/api/rates")
def get_rates():
    d = http_get("https://api.frankfurter.app/latest?from=USD&to=EUR,BRL", timeout=5)
    if d and d.get("rates"):
        return jsonify(d["rates"])
    return jsonify({"EUR": 0.92, "BRL": 5.70})

# ─── Price history (candles) ──────────────────────────────────────────────────

def _candles_hyperliquid(sym, interval, start_ms, end_ms):
    data = http_post("https://api.hyperliquid.xyz/info", {
        "type": "candleSnapshot",
        "req": {"coin": sym, "interval": interval, "startTime": start_ms, "endTime": end_ms}
    }, timeout=8)
    if not data or not isinstance(data, list) or not data:
        return None
    out = [{"t": c.get("t"), "o": safe_float(c.get("o")), "h": safe_float(c.get("h")),
             "l": safe_float(c.get("l")), "c": safe_float(c.get("c"))} for c in data if "t" in c]
    return out if out else None

def _candles_mexc(sym, interval, limit):
    mexc_int = {"1h": "60m", "4h": "4h", "1d": "1d"}.get(interval, "60m")
    data = http_get(f"https://api.mexc.com/api/v3/klines?symbol={sym}USDT&interval={mexc_int}&limit={limit}", timeout=8)
    if not data or not isinstance(data, list):
        return None
    out = [{"t": c[0], "o": safe_float(c[1]), "h": safe_float(c[2]),
            "l": safe_float(c[3]), "c": safe_float(c[4])} for c in data if len(c) >= 5]
    return out if out else None

def _candles_gate(sym, interval, limit):
    gate_int = {"1h": "1h", "4h": "4h", "1d": "1d"}.get(interval, "1h")
    data = http_get(
        f"https://api.gateio.ws/api/v4/spot/candlesticks?currency_pair={sym}_USDT"
        f"&interval={gate_int}&limit={limit}", timeout=8)
    if not data or not isinstance(data, list):
        return None
    out = [{"t": int(c[0]) * 1000, "o": safe_float(c[5]), "h": safe_float(c[3]),
            "l": safe_float(c[4]), "c": safe_float(c[2])} for c in data if len(c) >= 6]
    return out if out else None

def _candles_okx(sym, interval, limit):
    okx_int = {"1h": "1H", "4h": "4H", "1d": "1Dutc"}.get(interval, "1H")
    data = http_get(
        f"https://www.okx.com/api/v5/market/candles?instId={sym}-USDT"
        f"&bar={okx_int}&limit={limit}", timeout=8)
    if not data or not data.get("data"):
        return None
    out = [{"t": int(c[0]), "o": safe_float(c[1]), "h": safe_float(c[2]),
            "l": safe_float(c[3]), "c": safe_float(c[4])} for c in data["data"] if len(c) >= 5]
    return out[::-1] if out else None

_FOREX_CURRENCIES = {"USD","EUR","BRL","GBP","JPY","CHF","AUD","CAD","CNY","NZD","MXN","SEK","NOK","DKK"}

def _is_forex(sym):
    s = sym.upper()
    return len(s) == 6 and s[:3] in _FOREX_CURRENCIES and s[3:] in _FOREX_CURRENCIES

def _candles_forex(sym, period):
    """Fetch OHLC candles for a forex pair via Yahoo Finance v8 API."""
    s = sym.upper()
    range_map = {
        "1D":  ("1d",  "60m"),
        "1W":  ("5d",  "1h"),
        "1M":  ("1mo", "1d"),
        "3M":  ("3mo", "1d"),
        "1Y":  ("1y",  "1d"),
        "ALL": ("5y",  "1wk"),
    }
    rng, interval = range_map.get(period, ("1mo", "1d"))
    data = None
    for host in ("query1.finance.yahoo.com", "query2.finance.yahoo.com"):
        url = f"https://{host}/v8/finance/chart/{s}=X?range={rng}&interval={interval}"
        try:
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json",
            })
            with urllib.request.urlopen(req, timeout=10) as r:
                data = json.loads(r.read().decode())
            break
        except Exception:
            continue
    if not data:
        return None
    try:
        result = data["chart"]["result"][0]
        timestamps = result["timestamp"]
        quote  = result["indicators"]["quote"][0]
        opens  = quote.get("open",  [])
        highs  = quote.get("high",  [])
        lows   = quote.get("low",   [])
        closes = quote.get("close", [])
    except (KeyError, IndexError, TypeError):
        return None
    out = []
    for i, ts in enumerate(timestamps):
        cl = closes[i] if i < len(closes) else None
        if cl is None:
            continue
        o = (opens[i] if i < len(opens) else None) or cl
        h = (highs[i] if i < len(highs) else None) or cl
        l = (lows[i]  if i < len(lows)  else None) or cl
        out.append({"t": int(ts) * 1000, "o": o, "h": h, "l": l, "c": cl})
    return out if len(out) >= 2 else None

@app.route("/api/history")
def get_history():
    sym    = request.args.get("symbol", "").upper().strip()
    period = request.args.get("period", "1D").upper()
    if not sym:
        return jsonify({"error": "no symbol"}), 400

    # Forex pairs: use brapi.dev (Yahoo Finance)
    if _is_forex(sym):
        candles = _candles_forex(sym, period)
        if candles:
            return jsonify({"symbol": sym, "period": period, "candles": candles})
        return jsonify({"error": "no history"}), 404

    period_conf = {"1D": ("1h", 24), "1W": ("4h", 42), "1M": ("1d", 30), "3M": ("1d", 90), "1Y": ("1d", 365), "ALL": ("1d", 1095)}
    interval, count = period_conf.get(period, ("1h", 24))
    interval_ms     = {"1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000}
    now_ms   = int(time.time() * 1000)
    start_ms = now_ms - count * interval_ms[interval]

    candles = (
        _candles_hyperliquid(sym, interval, start_ms, now_ms) or
        _candles_mexc(sym, interval, count) or
        _candles_gate(sym, interval, count) or
        _candles_okx(sym, interval, count)
    )

    if not candles:
        return jsonify({"error": "no history"}), 404

    return jsonify({"symbol": sym, "period": period, "candles": candles})


@app.route("/api/perf")
def api_perf():
    """Return % price change over 6M, 1Y, 2Y and all-time for a symbol."""
    sym = request.args.get("symbol", "").upper().strip()
    if not sym:
        return jsonify({"error": "no symbol"}), 400

    interval_ms = 86_400_000   # 1 day in ms
    count       = 366          # 1 year of daily candles
    now_ms      = int(time.time() * 1000)
    start_ms    = now_ms - count * interval_ms

    if _is_forex(sym):
        candles = _candles_forex(sym, "1Y")
    else:
        candles = (
            _candles_hyperliquid(sym, "1d", start_ms, now_ms) or
            _candles_mexc(sym, "1d", count) or
            _candles_gate(sym, "1d", count) or
            _candles_okx(sym, "1d", count)
        )

    if not candles or len(candles) < 2:
        return jsonify({"error": "no history"}), 404

    closes = [c["c"] for c in candles if c.get("c") is not None]
    if len(closes) < 2:
        return jsonify({"error": "no data"}), 404

    current = closes[-1]

    def pct(days_ago):
        target = now_ms - days_ago * interval_ms
        best   = min(candles, key=lambda c: abs(c["t"] - target))
        old    = best.get("c")
        if old and old != 0 and (now_ms - best["t"]) >= days_ago * interval_ms * 0.5:
            return round((current - old) / old * 100, 2)
        return None

    return jsonify({
        "current":  current,
        "perf_1w":  pct(7),
        "perf_1m":  pct(30),
        "perf_3m":  pct(90),
        "perf_1y":  pct(365),
    })


# ─── Background warmup ────────────────────────────────────────────────────────

_coinlore_cache = {}

def _warmup():
    """Background: warm up symbol list, market caps, and icons for tracked assets."""

    def _load_icons():
        """Pre-fetch icons for all currently tracked assets sequentially to avoid rate-limits."""
        try:
            assets = load_assets()
            syms = [a.get("symbol", "").upper() for a in assets if a.get("symbol")]
            to_fetch = [s for s in syms if len(s) != 6 and s not in _icon_cache]
            for sym in to_fetch:
                _fetch_icon_url(sym)
                time.sleep(0.3)   # gentle pacing — avoids CoinGecko rate-limit
        except Exception:
            pass

    def run_icons():
        time.sleep(0.5)   # start icon fetch almost immediately
        _load_icons()

    def run_heavy():
        time.sleep(1)
        _load_symbols()
        _load_mcaps()

    def _load_symbols():
        try:
            seen = set()
            entries = []

            # Hyperliquid perps
            meta = http_post("https://api.hyperliquid.xyz/info",
                             {"type": "metaAndAssetCtxs"}, timeout=10)
            if meta and len(meta) >= 1:
                for asset in meta[0].get("universe", []):
                    name = asset.get("name", "")
                    if name and not name.startswith("@") and not name.startswith("#"):
                        sym = name.upper()
                        if sym not in seen:
                            seen.add(sym)
                            entries.append({"symbol": sym, "exchange": "Hyperliquid"})

            # Hyperliquid spot
            spot = http_post("https://api.hyperliquid.xyz/info",
                             {"type": "spotMeta"}, timeout=10)
            if spot:
                for t in spot.get("tokens", []):
                    name = t.get("name", "")
                    if name and not name.startswith("@") and not name.startswith("#"):
                        sym = name.upper()
                        if sym not in seen:
                            seen.add(sym)
                            entries.append({"symbol": sym, "exchange": "Hyperliquid Spot"})

            with _search_lock:
                _search_cache.clear()
                _search_cache.extend(entries)
        except Exception:
            pass

    def _load_mcaps():
        try:
            pages = range(0, 500, 100)
            def fetch_page(start):
                return http_get(
                    f"https://api.coinlore.net/api/tickers/?start={start}&limit=100",
                    timeout=10)
            with concurrent.futures.ThreadPoolExecutor(max_workers=5) as ex:
                results = list(ex.map(fetch_page, pages))
            for page in results:
                if page and page.get("data"):
                    for coin in page["data"]:
                        sym = (coin.get("symbol") or "").upper()
                        cap = safe_float(coin.get("market_cap_usd"))
                        if sym and cap:
                            _coinlore_cache[sym] = cap
                            _mcap_set(sym, cap)
        except Exception:
            pass

    threading.Thread(target=run_icons, daemon=True).start()
    threading.Thread(target=run_heavy, daemon=True).start()

ALERTS_FILE = "alerts.json"

def load_alerts():
    if os.path.exists(ALERTS_FILE):
        try:
            return json.load(open(ALERTS_FILE))
        except Exception:
            return []
    return []

def save_alerts(alerts):
    with open(ALERTS_FILE, "w") as f:
        json.dump(alerts, f)

@app.route("/api/alerts", methods=["GET"])
def get_alerts():
    return jsonify(load_alerts())

@app.route("/api/alerts", methods=["POST"])
def create_alert():
    data = request.get_json() or {}
    ticker = (data.get("ticker") or "").upper().strip()
    try:
        target = float(data.get("target", 0))
    except (TypeError, ValueError):
        return jsonify({"error": "invalid target"}), 400
    direction = data.get("direction", "above")
    if not ticker or target <= 0 or direction not in ("above", "below"):
        return jsonify({"error": "invalid data"}), 400
    try:
        repeat_interval = int(data.get("repeat_interval", 0))
        if repeat_interval not in (0, 60, 300, 900, 3600):
            repeat_interval = 0
    except (TypeError, ValueError):
        repeat_interval = 0
    alerts = load_alerts()
    alerts.append({
        "id": str(uuid.uuid4())[:8],
        "ticker": ticker,
        "target": target,
        "direction": direction,
        "triggered": False,
        "repeat_interval": repeat_interval,
        "last_fired_at": None,
    })
    save_alerts(alerts)
    return jsonify({"ok": True})

@app.route("/api/alerts/<alert_id>", methods=["DELETE"])
def delete_alert(alert_id):
    save_alerts([a for a in load_alerts() if a["id"] != alert_id])
    return jsonify({"ok": True})

@app.route("/api/alerts/<alert_id>/trigger", methods=["POST"])
def trigger_alert_route(alert_id):
    alerts = load_alerts()
    for a in alerts:
        if a["id"] == alert_id:
            a["last_fired_at"] = _time.time()
            # One-time alert: mark as done. Repeating: keep active for next cycle.
            if a.get("repeat_interval", 0) == 0:
                a["triggered"] = True
            break
    save_alerts(alerts)
    return jsonify({"ok": True})

@app.route("/api/alerts/<alert_id>/reset", methods=["POST"])
def reset_alert(alert_id):
    alerts = load_alerts()
    for a in alerts:
        if a["id"] == alert_id:
            a["triggered"] = False
            a["last_fired_at"] = None
            break
    save_alerts(alerts)
    return jsonify({"ok": True})

# ─── TX Hash Lookup ──────────────────────────────────────────────────────────

def _tx_fetch(url, timeout=8):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "MadTracker/1.0", "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except Exception:
        return None

def _tx_post(url, payload, timeout=10):
    try:
        data = json.dumps(payload).encode()
        req = urllib.request.Request(url, data=data,
            headers={"Content-Type": "application/json", "User-Agent": "MadTracker/1.0"},
            method="POST")
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode())
    except Exception:
        return None

_STABLECOINS = {"USDT","USDC","DAI","BUSD","FDUSD","TUSD","USDE","FRAX","LUSD",
                "USDBC","USDC.E","USDV","PYUSD","GUSD","DOLA","CUSD","SUSD","MUSD","USDP",
                "USDH","USDD","CRVUSD","GHO","USDR","USDX","EUSD","LISUSD","MKUSD",
                "USDC.e","USDT.e","USDCE","USDTE","EURS","AGEUR","EURA",
                "USD₮0","USDT0","USD0","USDM","USDY","USDV2"}

EVM_CHAINS = [
    ("Ethereum",     "https://eth.blockscout.com",      "ETH"),
    ("BSC",          "https://bsc.blockscout.com",      "BNB"),
    ("Polygon",      "https://polygon.blockscout.com",  "MATIC"),
    ("Arbitrum One", "https://arbitrum.blockscout.com", "ETH"),
    ("Base",         "https://base.blockscout.com",     "ETH"),
    ("Optimism",     "https://optimism.blockscout.com", "ETH"),
]

# key → (display name, blockscout base url, native symbol)
NETWORK_MAP = {
    "ethereum":  ("Ethereum",     "https://eth.blockscout.com",               "ETH"),
    "base":      ("Base",         "https://base.blockscout.com",              "ETH"),
    "arbitrum":  ("Arbitrum One", "https://arbitrum.blockscout.com",          "ETH"),
    "optimism":  ("Optimism",     "https://optimism.blockscout.com",          "ETH"),
    "bsc":       ("BSC",          "https://bsc.blockscout.com",               "BNB"),
    "polygon":   ("Polygon",      "https://polygon.blockscout.com",           "MATIC"),
    "hyperevm":  ("HyperEVM",     "https://hyperevmscan.io",                  "HYPE"),
    "avalanche": ("Avalanche",    "https://avalanche.blockscout.com",         "AVAX"),
    "zksync":    ("zkSync Era",   "https://zksync.blockscout.com",            "ETH"),
    "linea":     ("Linea",        "https://explorer.linea.build",             "ETH"),
    "scroll":    ("Scroll",       "https://scroll.blockscout.com",            "ETH"),
    "mantle":    ("Mantle",       "https://mantle.blockscout.com",            "MNT"),
}

# ── HyperEVM: direct RPC lookup (no Blockscout available) ─────────────────────
_HYPER_RPC   = "https://rpc.hyperliquid.xyz/evm"
_TRANSFER_SIG = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"
_SYM_SEL      = "0x95d89b41"   # symbol()
_DEC_SEL      = "0x313ce567"   # decimals()
_erc20_cache  = {}             # contract → (symbol, decimals)

def _rpc(method, params):
    payload = json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params}).encode()
    try:
        req = urllib.request.Request(
            _HYPER_RPC, payload,
            {"Content-Type": "application/json", "Accept": "application/json"},
        )
        with urllib.request.urlopen(req, timeout=8) as r:
            return json.loads(r.read()).get("result")
    except Exception:
        return None

def _erc20_meta(addr):
    addr = addr.lower()
    if addr in _erc20_cache:
        return _erc20_cache[addr]
    def eth_call_str(sel):
        res = _rpc("eth_call", [{"to": addr, "data": sel}, "latest"]) or "0x"
        try:
            b = bytes.fromhex(res[2:])
            length = int.from_bytes(b[32:64], "big")
            return b[64:64+length].decode("utf-8", "ignore").strip()
        except Exception:
            return ""
    def eth_call_uint(sel):
        res = _rpc("eth_call", [{"to": addr, "data": sel}, "latest"]) or "0x0"
        try:
            return int(res, 16)
        except Exception:
            return 18
    sym = eth_call_str(_SYM_SEL)
    dec = eth_call_uint(_DEC_SEL)
    _erc20_cache[addr] = (sym, dec)
    return sym, dec

def _lookup_hyperevm_rpc(hash_):
    h = hash_ if hash_.startswith("0x") else f"0x{hash_}"
    receipt = _rpc("eth_getTransactionReceipt", [h])
    if not receipt:
        return jsonify({"error": "not_found"}), 404

    tx_from = (receipt.get("from") or "").lower()
    try:
        native_val = int(receipt.get("value", "0x0") or "0x0", 16) / 1e18
    except Exception:
        native_val = 0.0

    # Also fetch tx for native value (receipt may not carry it)
    tx = _rpc("eth_getTransactionByHash", [h]) or {}
    try:
        native_val = int(tx.get("value", "0x0") or "0x0", 16) / 1e18
    except Exception:
        pass

    # Decode ERC-20 Transfer events from logs
    transfers = []
    for log in (receipt.get("logs") or []):
        topics = log.get("topics") or []
        if not topics or topics[0].lower() != _TRANSFER_SIG:
            continue
        contract = log.get("address", "").lower()
        sym, dec  = _erc20_meta(contract)
        if not sym:
            continue
        from_a = ("0x" + topics[1][-40:]).lower() if len(topics) > 1 else ""
        to_a   = ("0x" + topics[2][-40:]).lower() if len(topics) > 2 else ""
        data   = log.get("data", "0x0")
        try:
            raw_val = int(data, 16)
        except Exception:
            raw_val = 0
        transfers.append({
            "token": {"symbol": sym},
            "total": {"value": str(raw_val), "decimals": str(dec)},
            "from":  {"hash": from_a},
            "to":    {"hash": to_a},
        })

    # Build a fake tx_data dict for _parse_evm_result
    tx_data = {"value": tx.get("value", "0x0")}
    # Timestamp from block (best effort)
    block_ts = None
    block_num = receipt.get("blockNumber")
    if block_num:
        blk = _rpc("eth_getBlockByNumber", [block_num, False]) or {}
        ts_hex = blk.get("timestamp", "")
        if ts_hex:
            try:
                import datetime as _dt
                block_ts = _dt.datetime.utcfromtimestamp(int(ts_hex, 16)).strftime("%Y-%m-%d %H:%M:%S")
            except Exception:
                pass

    parsed = _parse_evm_result(tx_from, transfers, tx_data, "HYPE", "HyperEVM", block_ts)
    if not transfers and native_val > 0:
        parsed = {
            "network": "HyperEVM", "ticker": "HYPE",
            "qty": round(native_val, 10), "total_usd": None, "timestamp": block_ts,
        }
    return jsonify(parsed)

# ──────────────────────────────────────────────────────────────────────────────
def _blockscout_all_transfers(base_url, hash_):
    """
    Fetch ALL token transfers for a tx from Blockscout v2.
    The main /api/v2/transactions/{hash} endpoint caps inline token_transfers
    at ~10. For complex swaps we need the dedicated paginated endpoint.
    Returns a deduplicated list in the same Blockscout transfer dict format.
    """
    seen = set()
    result = []

    def add(transfers):
        for t in (transfers or []):
            key = (
                ((t.get("from") or {}).get("hash") or "").lower(),
                ((t.get("to")   or {}).get("hash") or "").lower(),
                (t.get("token") or {}).get("symbol", ""),
                ((t.get("total") or {}).get("value") or ""),
            )
            if key not in seen:
                seen.add(key)
                result.append(t)

    # Paginate through the dedicated token-transfers endpoint
    next_page = None
    for _ in range(10):   # max 10 pages (= up to ~500 transfers)
        url = f"{base_url}/api/v2/transactions/{hash_}/token-transfers?type=ERC-20"
        if next_page:
            url += f"&{next_page}"
        page = _tx_fetch(url, timeout=8)
        if not page:
            break
        add(page.get("items") or [])
        next_page_params = page.get("next_page_params")
        if not next_page_params:
            break
        # Build query string from next_page_params dict
        next_page = "&".join(f"{k}={v}" for k, v in next_page_params.items())

    return result


def _lookup_evm_single(hash_, chain_name, base_url, native_sym):
    """Fetch a tx from a specific EVM chain. Tries Blockscout v2, then Etherscan-style API."""
    h = hash_ if hash_.startswith("0x") else f"0x{hash_}"
    # 1) Blockscout v2
    for candidate in [h, hash_]:
        data = _tx_fetch(f"{base_url}/api/v2/transactions/{candidate}")
        if data and data.get("hash"):
            tx_from = (data.get("from") or {}).get("hash", "")
            ts      = _ts_fmt(data.get("timestamp"))

            # Fetch ALL token transfers (dedicated endpoint, paginated)
            # Fall back to the inline list if the dedicated endpoint fails
            all_transfers = _blockscout_all_transfers(base_url, candidate)
            if not all_transfers:
                all_transfers = data.get("token_transfers") or []

            # Blockscout v2 returns `value` as a decimal string, not hex.
            # Normalise it so _parse_evm_result can parse it correctly.
            raw_value = str(data.get("value") or "0")
            if raw_value.startswith("0x"):
                tx_data = data
            else:
                # Wrap in a dict with hex-encoded value for the parser
                tx_data = dict(data)
                try:
                    tx_data["value"] = hex(int(raw_value))
                except Exception:
                    tx_data["value"] = "0x0"

            return jsonify(_parse_evm_result(tx_from, all_transfers, tx_data, native_sym, chain_name, ts))

    # 2) Etherscan-style API fallback
    for candidate in [h, hash_]:
        url  = f"{base_url}/api?module=proxy&action=eth_getTransactionByHash&txhash={candidate}"
        data = _tx_fetch(url)
        if data and data.get("result"):
            tx = data["result"]
            try:
                native_val = int(tx.get("value", "0x0") or "0x0", 16) / 1e18
            except Exception:
                native_val = 0.0
            return jsonify({
                "network":   chain_name,
                "ticker":    native_sym if native_val > 0 else "",
                "qty":       round(native_val, 10) if native_val > 0 else None,
                "total_usd": None,
                "timestamp": None,
            })
    return jsonify({"error": "not_found"}), 404

def _ts_fmt(iso_str):
    if not iso_str:
        return None
    try:
        return str(iso_str).replace("T", " ")[:19]
    except Exception:
        return None

_WRAPPED_NATIVE = {"WETH","WBNB","WMATIC","WAVAX","WFTM","WONE","WHYPE","WCORE","WGLMR"}

def _parse_evm_result(tx_from, transfers, tx_data, native_sym, chain_name, timestamp):
    """
    DEX swap parser that finds the TRUE buyer/seller in a transaction.

    Strategy:
      1. Compute net token deltas for EVERY address in the transfer list.
      2. Identify the "user" as the address with the clearest buy or sell pattern:
           BUY  = net positive non-stable  AND  net negative stable  (spent USDC, got BTC)
           SELL = net negative non-stable  AND  net positive stable   (sold BTC, got USDC)
         tx_from gets a tie-breaking bonus so it wins when equally scored.
      3. Exclude clear router/pool addresses: addresses where MANY different tokens
         flow in AND out (they are intermediaries, not the user).
      4. Fall back to tx_from if no clean pattern is found.

    This correctly handles:
      - Multi-hop routes (intermediate tokens never touch the user's address)
      - Smart-contract wallets / meta-txs (tx_from is a relayer/bundler)
      - Sells (non-stable → stable) and token-to-token swaps
    """
    tx_from = tx_from.lower()

    # --- Step 1: compute net delta per (address, symbol) ---
    is_stable  = {}
    is_wrapped = {}
    addr_delta = {}   # addr -> {sym: net_amount}
    addr_syms_in  = {}  # addr -> set of symbols received
    addr_syms_out = {}  # addr -> set of symbols sent

    for t in transfers:
        tok  = t.get("token") or {}
        sym  = tok.get("symbol", "").upper()
        if not sym:
            continue
        dec = int((t.get("total") or {}).get("decimals", 18) or 18)
        raw = (t.get("total") or {}).get("value", "0") or "0"
        try:
            amount = int(raw) / (10 ** dec)
        except Exception:
            amount = 0
        from_a = ((t.get("from") or {}).get("hash") or "").lower()
        to_a   = ((t.get("to")   or {}).get("hash") or "").lower()
        is_stable[sym]  = sym in _STABLECOINS
        is_wrapped[sym] = sym in _WRAPPED_NATIVE

        if to_a:
            addr_delta.setdefault(to_a, {})[sym] = addr_delta.get(to_a, {}).get(sym, 0) + amount
            addr_syms_in.setdefault(to_a, set()).add(sym)
        if from_a:
            addr_delta.setdefault(from_a, {})[sym] = addr_delta.get(from_a, {}).get(sym, 0) - amount
            addr_syms_out.setdefault(from_a, set()).add(sym)

    try:
        native_val = int(tx_data.get("value", "0x0") or "0x0", 16) / 1e18
    except Exception:
        try:
            native_val = int(tx_data.get("value", "0") or "0") / 1e18
        except Exception:
            native_val = 0.0

    result = {"network": chain_name, "timestamp": timestamp}

    # --- Step 2: score each address to find the real user ---
    # A router/pool has many distinct tokens flowing IN and OUT → exclude them
    def is_router(addr):
        n_in  = len(addr_syms_in.get(addr, set()))
        n_out = len(addr_syms_out.get(addr, set()))
        return n_in >= 3 and n_out >= 3

    best_buyer       = None   # (score, addr, recv_sym, recv_qty, stable_spent)
    best_seller      = None   # (score, addr, sold_sym, sold_qty, stable_recv)
    best_stable_swap = None   # (score, addr, recv_sym, recv_qty, sent_qty)

    for addr, deltas in addr_delta.items():
        if is_router(addr):
            continue

        pos_stable     = [(s, d) for s, d in deltas.items() if d > 0 and is_stable.get(s)]
        pos_non_stable = [(s, d) for s, d in deltas.items() if d > 0 and not is_stable.get(s) and not is_wrapped.get(s)]
        pos_wrapped    = [(s, d) for s, d in deltas.items() if d > 0 and is_wrapped.get(s)]
        neg_stable     = [(s, -d) for s, d in deltas.items() if d < 0 and is_stable.get(s)]
        neg_non_stable = [(s, -d) for s, d in deltas.items() if d < 0 and not is_stable.get(s) and not is_wrapped.get(s)]

        tiebreak = 1 if addr == tx_from else 0

        # BUY pattern: received non-stable + spent stable (or wrapped native)
        received = pos_non_stable or pos_wrapped
        if received and neg_stable:
            recv_sym, recv_qty = max(received, key=lambda x: x[1])
            stable_spent = sum(v for _, v in neg_stable)
            score = stable_spent + tiebreak * 1e-9
            if best_buyer is None or score > best_buyer[0]:
                best_buyer = (score, addr, recv_sym, recv_qty, stable_spent)

        # SELL pattern: received stable + spent non-stable
        if pos_stable and neg_non_stable:
            stable_recv = sum(v for _, v in pos_stable)
            sold_sym, sold_qty = max(neg_non_stable, key=lambda x: x[1])
            score = stable_recv + tiebreak * 1e-9
            if best_seller is None or score > best_seller[0]:
                best_seller = (score, addr, sold_sym, sold_qty, stable_recv)

        # STABLE-TO-STABLE pattern: spent one stable, received a different stable
        # e.g. USDT → USDC, DAI → USDT
        if pos_stable and neg_stable:
            recv_sym, recv_qty = max(pos_stable, key=lambda x: x[1])
            sent_qty = sum(v for _, v in neg_stable)
            score = sent_qty + tiebreak * 1e-9
            if best_stable_swap is None or score > best_stable_swap[0]:
                best_stable_swap = (score, addr, recv_sym, recv_qty, sent_qty)

    # --- Step 3: build result from the best match ---
    # Priority: buy > sell > stable-swap
    # Exception: if best_buyer is only buying a *wrapped native* token (WHYPE, WETH…)
    # AND tx_from is directly the seller, the "buyer" is a DEX pool counterparty —
    # the user is actually selling, so prefer the seller's perspective.
    buyer_buys_wrapped    = best_buyer  is not None and is_wrapped.get(best_buyer[2],  False)
    tx_from_direct_seller = best_seller is not None and best_seller[1] == tx_from

    use_buyer = (
        best_buyer is not None
        and not (buyer_buys_wrapped and tx_from_direct_seller)
    )

    if use_buyer:
        _, _addr, recv_sym, recv_qty, stable_spent = best_buyer
        result["ticker"]    = recv_sym
        result["qty"]       = round(recv_qty, 10)
        result["total_usd"] = round(stable_spent, 6) if stable_spent > 0 else None
        if result["total_usd"] is None and native_val > 0:
            result["native_sym"]    = native_sym
            result["native_amount"] = round(native_val, 8)
        return result

    if best_seller:
        _, _addr, sold_sym, sold_qty, stable_recv = best_seller
        result["ticker"]    = sold_sym
        result["qty"]       = round(sold_qty, 10)
        result["total_usd"] = round(stable_recv, 6)
        result["is_sell"]   = True
        return result

    if best_stable_swap:
        _, _addr, recv_sym, recv_qty, sent_qty = best_stable_swap
        result["ticker"]    = recv_sym
        result["qty"]       = round(recv_qty, 6)
        result["total_usd"] = round(sent_qty, 6)
        return result

    # --- Step 4: fallbacks ---
    # Check tx_from directly (covers simple transfers, native-only txs, etc.)
    user_delta = addr_delta.get(tx_from, {})
    pos_ns = [(s, d) for s, d in user_delta.items() if d > 0 and not is_stable.get(s)]
    neg_st = [(s, -d) for s, d in user_delta.items() if d < 0 and is_stable.get(s)]
    if pos_ns:
        best_tok, best_qty = max(pos_ns, key=lambda x: x[1])
        result["ticker"]    = best_tok
        result["qty"]       = round(best_qty, 10)
        result["total_usd"] = round(sum(v for _, v in neg_st), 6) if neg_st else None
        if result["total_usd"] is None and native_val > 0:
            result["native_sym"]    = native_sym
            result["native_amount"] = round(native_val, 8)
        return result

    if native_val > 0 and not transfers:
        result["ticker"]    = native_sym
        result["qty"]       = round(native_val, 10)
        result["total_usd"] = None
        return result

    result["error"] = "swap_complex"
    return result

def _lookup_evm(hash_):
    for chain_name, base_url, native_sym in EVM_CHAINS:
        data = _tx_fetch(f"{base_url}/api/v2/transactions/{hash_}")
        if not data or not data.get("hash"):
            continue
        tx_from   = (data.get("from") or {}).get("hash", "")
        transfers = data.get("token_transfers") or []
        ts        = _ts_fmt(data.get("timestamp"))
        parsed    = _parse_evm_result(tx_from, transfers, data, native_sym, chain_name, ts)
        return jsonify(parsed)
    return jsonify({"error": "not_found"}), 404

def _lookup_bitcoin(hash_):
    data = _tx_fetch(f"https://blockstream.info/api/tx/{hash_}")
    if not data or "txid" not in data:
        return jsonify({"error": "not_found"}), 404
    status   = data.get("status", {})
    ts       = None
    if status.get("block_time"):
        from datetime import datetime, timezone
        ts = datetime.fromtimestamp(status["block_time"], tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")
    vout     = data.get("vout", [])
    total_sat = sum(v.get("value", 0) for v in vout if v.get("scriptpubkey_type") != "op_return")
    return jsonify({
        "network":   "Bitcoin",
        "ticker":    "BTC",
        "qty":       round(total_sat / 1e8, 8),
        "total_usd": None,
        "timestamp": ts,
        "note":      "btc_outputs",
    })

def _sol_mint_symbol(mint, timeout=5):
    data = _tx_fetch(f"https://api.jup.ag/tokens/v1/{mint}", timeout=timeout)
    if data and isinstance(data, dict) and data.get("symbol"):
        return data["symbol"].upper()
    return None

def _lookup_solana(hash_):
    resp = _tx_post("https://api.mainnet-beta.solana.com", {
        "jsonrpc": "2.0", "id": 1, "method": "getTransaction",
        "params": [hash_, {"encoding": "jsonParsed", "maxSupportedTransactionVersion": 0}]
    })
    if not resp or not resp.get("result"):
        return jsonify({"error": "not_found"}), 404
    result = resp["result"]
    meta   = result.get("meta") or {}
    ts     = None
    if result.get("blockTime"):
        from datetime import datetime, timezone
        ts = datetime.fromtimestamp(result["blockTime"], tz=timezone.utc).strftime("%Y-%m-%d %H:%M:%S")

    pre_map   = {b["accountIndex"]: b for b in (meta.get("preTokenBalances") or [])}
    post_list = meta.get("postTokenBalances") or []
    changes   = []
    for p in post_list:
        idx      = p["accountIndex"]
        pre_b    = pre_map.get(idx, {})
        pre_amt  = float((pre_b.get("uiTokenAmount") or {}).get("uiAmount") or 0)
        post_amt = float((p.get("uiTokenAmount") or {}).get("uiAmount") or 0)
        delta    = post_amt - pre_amt
        mint     = p.get("mint", "")
        changes.append({"delta": delta, "mint": mint})

    bought = [c for c in changes if c["delta"] > 0]
    if bought:
        best = max(bought, key=lambda x: x["delta"])
        sym  = _sol_mint_symbol(best["mint"])
        return jsonify({
            "network":   "Solana",
            "ticker":    sym or "",
            "qty":       round(best["delta"], 9),
            "total_usd": None,
            "timestamp": ts,
            "mint":      best["mint"],
        })

    pre_sol  = meta.get("preBalances", [])
    post_sol = meta.get("postBalances", [])
    if pre_sol and post_sol:
        gains = [post_sol[i] - pre_sol[i] for i in range(min(len(pre_sol), len(post_sol)))]
        max_g = max(gains) if gains else 0
        if max_g > 0:
            return jsonify({
                "network":   "Solana",
                "ticker":    "SOL",
                "qty":       round(max_g / 1e9, 9),
                "total_usd": None,
                "timestamp": ts,
            })
    return jsonify({"error": "not_found"}), 404

import re as _re
@app.route("/api/tx-lookup")
def tx_lookup():
    hash_   = request.args.get("hash",    "").strip()
    network = request.args.get("network", "").strip().lower()
    if not hash_:
        return jsonify({"error": "no_hash"}), 400

    # Extract hash from full explorer URL (e.g. https://etherscan.io/tx/0xABC...)
    url_match = _re.search(r'/tx/(0x[0-9a-fA-F]+|[0-9a-fA-F]{40,})', hash_)
    if url_match:
        hash_ = url_match.group(1)

    # Manual network selection — bypass auto-detect
    if network == "bitcoin":
        return _lookup_bitcoin(hash_)
    if network == "solana":
        return _lookup_solana(hash_)
    if network == "hyperevm":
        return _lookup_hyperevm_rpc(hash_)
    if network in NETWORK_MAP:
        name, base_url, native = NETWORK_MAP[network]
        return _lookup_evm_single(hash_, name, base_url, native)

    # Auto-detect from hash format (lenient: 60–68 hex chars with or without 0x)
    if _re.match(r'^0x[0-9a-fA-F]{60,68}$', hash_):
        return _lookup_evm(hash_)
    elif _re.match(r'^[0-9a-fA-F]{60,68}$', hash_):
        # Could be BTC or EVM without 0x — try EVM first, then BTC
        evm_res = _lookup_evm(hash_)
        if evm_res[1] == 200 if isinstance(evm_res, tuple) else True:
            return evm_res
        return _lookup_bitcoin(hash_)
    elif _re.match(r'^[1-9A-HJ-NP-Za-km-z]{32,90}$', hash_):
        return _lookup_solana(hash_)
    else:
        return jsonify({"error": "hash_format"}), 400


# ─── Mad AI ───────────────────────────────────────────────────────────────────

OPENROUTER_API_KEY = os.environ.get("OPENROUTER_API_KEY", "")

# Provider map — swap model/url here to change provider
AI_PROVIDERS = {
    "openrouter": {
        "url": "https://openrouter.ai/api/v1/chat/completions",
        "model": "openrouter/auto",
        "auth_header": lambda key: f"Bearer {key}",
        "key": lambda: OPENROUTER_API_KEY,
    }
}
ACTIVE_AI_PROVIDER = "openrouter"

def _build_portfolio_context():
    """Build a rich text summary of the user's portfolio including current prices and full P&L."""
    tokens = load_portfolio()
    if not tokens:
        return "O usuário não possui trades registrados no portfólio."

    # Fetch current prices in parallel (same approach as /api/portfolio)
    def _enrich(tok):
        sym = tok.get("ticker", "").upper()
        r = fetch_price(sym)
        return dict(tok, current_price=r["price"] if r else None)

    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, len(tokens))) as ex:
        enriched = list(ex.map(_enrich, tokens))

    lines = ["=== PORTFÓLIO DO USUÁRIO (com preços atuais) ===\n"]

    grand_invested      = 0.0
    grand_cur_value     = 0.0
    grand_realized_pnl  = 0.0
    grand_unrealized_pnl = 0.0
    positions_in_profit  = 0
    positions_total      = 0

    for tok in enriched:
        ticker        = tok.get("ticker", "")
        trades        = tok.get("trades", [])
        cur_price     = tok.get("current_price")
        if not trades:
            continue

        total_buy_qty   = 0.0
        total_invested  = 0.0
        sell_proceeds   = 0.0
        total_qty       = 0.0
        sell_cost_basis = 0.0
        buys = []
        sells = []

        for tr in trades:
            qty   = tr.get("qty", 0)
            price = tr.get("price_paid", 0)
            date  = tr.get("date", "")
            total_qty += qty
            if qty > 0:
                total_buy_qty  += qty
                total_invested += qty * price
                buys.append({"qty": qty, "price": price, "date": date})
            else:
                sell_proceeds += abs(qty) * price
                sells.append({"qty": abs(qty), "price": price, "date": date})

        avg_buy_price = total_invested / total_buy_qty if total_buy_qty > 0 else 0

        # Realized P&L: sell proceeds minus the cost basis of what was sold
        sell_cost_basis = sum(s["qty"] * avg_buy_price for s in sells)
        realized_pnl    = sell_proceeds - sell_cost_basis

        # Unrealized P&L: current value of remaining position vs. its cost basis
        cost_basis_held  = total_qty * avg_buy_price if total_qty > 0 else 0
        cur_value        = total_qty * cur_price if (cur_price and total_qty > 0) else 0
        unrealized_pnl   = cur_value - cost_basis_held if cur_price else None

        total_pnl = realized_pnl + (unrealized_pnl if unrealized_pnl is not None else 0)

        lines.append(f"Ativo: {ticker}")
        lines.append(f"  Quantidade atual: {total_qty:.6g}")
        lines.append(f"  Preço atual: ${cur_price:.6g}" if cur_price else "  Preço atual: indisponível")
        lines.append(f"  Preço médio de compra: ${avg_buy_price:.6g}" if avg_buy_price else "")
        lines.append(f"  Total investido em compras: ${total_invested:.2f}")
        lines.append(f"  Valor atual da posição: ${cur_value:.2f}" if cur_price else "  Valor atual da posição: indisponível")
        lines.append(f"  P&L não-realizado: ${unrealized_pnl:+.2f}" if unrealized_pnl is not None else "  P&L não-realizado: indisponível")
        if sells:
            lines.append(f"  P&L realizado (vendas fechadas): ${realized_pnl:+.2f}")
        lines.append(f"  P&L total (realizado + não-realizado): ${total_pnl:+.2f}")

        for b in buys:
            lines.append(f"  Compra: {b['qty']:.6g} @ ${b['price']:.6g}" + (f" em {b['date']}" if b['date'] else ""))
        for s in sells:
            lines.append(f"  Venda: {s['qty']:.6g} @ ${s['price']:.6g}" + (f" em {s['date']}" if s['date'] else ""))
        lines.append("")

        grand_invested       += total_invested
        grand_cur_value      += cur_value
        grand_realized_pnl   += realized_pnl
        grand_unrealized_pnl += (unrealized_pnl if unrealized_pnl is not None else 0)

        if total_qty > 0:
            positions_total += 1
            if unrealized_pnl is not None and unrealized_pnl > 0:
                positions_in_profit += 1

    grand_total_pnl = grand_realized_pnl + grand_unrealized_pnl
    grand_total_pct = (grand_total_pnl / grand_invested * 100) if grand_invested > 0 else 0
    win_rate = (positions_in_profit / positions_total * 100) if positions_total > 0 else 0

    lines.append("=== RESUMO GERAL ===")
    lines.append(f"Total investido em compras: ${grand_invested:.2f}")
    lines.append(f"Valor atual total do portfólio: ${grand_cur_value:.2f}")
    lines.append(f"P&L realizado total: ${grand_realized_pnl:+.2f}")
    lines.append(f"P&L não-realizado total: ${grand_unrealized_pnl:+.2f}")
    lines.append(f"P&L total (realizado + não-realizado): ${grand_total_pnl:+.2f} ({grand_total_pct:+.2f}%)")
    lines.append(f"Win rate (posições abertas em lucro): {win_rate:.1f}% ({positions_in_profit}/{positions_total})")

    return "\n".join(lines)

SYSTEM_PROMPT = """Você é o Mad AI, assistente financeiro integrado ao MadTracker.
Seu papel é EXCLUSIVAMENTE analisar os dados de trades e portfólio fornecidos pelo usuário.

REGRAS ABSOLUTAS:
- Analise apenas os dados fornecidos no contexto do portfólio do usuário.
- NUNCA faça recomendações de compra ou venda de ativos.
- NUNCA sugira estratégias de investimento ou alocação.
- Responda APENAS com análises factuais: estatísticas, padrões, insights sobre o histórico.
- Se não houver trades, informe educadamente.
- Responda no mesmo idioma da pergunta do usuário (PT ou EN).
- Seja conciso e direto. Use formatação simples com listas quando útil.
- Nunca invente dados — use apenas o que está no contexto fornecido.
"""

@app.route("/api/ai/chat", methods=["POST"])
def ai_chat():
    if not OPENROUTER_API_KEY:
        return jsonify({"error": "AI não configurada. Adicione OPENROUTER_API_KEY nos Secrets do Replit."}), 503

    data = request.json or {}
    user_message = (data.get("message") or "").strip()
    history = data.get("history") or []

    if not user_message:
        return jsonify({"error": "Mensagem vazia."}), 400

    portfolio_context = _build_portfolio_context()

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "system", "content": f"DADOS DO PORTFÓLIO ATUAL:\n{portfolio_context}"},
    ]

    for h in history[-10:]:
        role = h.get("role")
        content = h.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})

    messages.append({"role": "user", "content": user_message})

    provider = AI_PROVIDERS[ACTIVE_AI_PROVIDER]
    api_key = provider["key"]()
    payload = json.dumps({
        "model": provider["model"],
        "messages": messages,
        "max_tokens": 1024,
        "temperature": 0.3,
    }).encode()

    req = urllib.request.Request(
        provider["url"],
        data=payload,
        headers={
            "Authorization": provider["auth_header"](api_key),
            "Content-Type": "application/json",
            "HTTP-Referer": "https://madtracker.replit.app",
            "X-Title": "MadTracker",
        },
        method="POST"
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            result = json.loads(r.read().decode())
        reply = result["choices"][0]["message"]["content"]
        return jsonify({"reply": reply})
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        return jsonify({"error": f"Erro da API de IA: {e.code} — {body[:200]}"}), 502
    except Exception as ex:
        return jsonify({"error": f"Erro ao chamar IA: {str(ex)}"}), 502


# ─── Dashboard (on-chain wallets) ─────────────────────────────────────────────

DASH_WALLETS_FILE = "dashboard_wallets.json"
DASH_MANUAL_FILE  = "dashboard_manual.json"

def load_dash_wallets():
    if not os.path.exists(DASH_WALLETS_FILE):
        return []
    with open(DASH_WALLETS_FILE) as f:
        return json.load(f)

def save_dash_wallets(data):
    with open(DASH_WALLETS_FILE, "w") as f:
        json.dump(data, f)

def load_dash_manual():
    if not os.path.exists(DASH_MANUAL_FILE):
        return []
    with open(DASH_MANUAL_FILE) as f:
        return json.load(f)

def save_dash_manual(data):
    with open(DASH_MANUAL_FILE, "w") as f:
        json.dump(data, f)

@app.route("/api/dashboard/status", methods=["GET"])
def get_dash_status():
    return jsonify({"ready": True})

@app.route("/api/dashboard/wallets", methods=["GET"])
def get_dash_wallets():
    return jsonify(load_dash_wallets())

@app.route("/api/dashboard/wallets", methods=["POST"])
def add_dash_wallet():
    body    = request.get_json() or {}
    address = body.get("address", "").strip().lower()
    svm     = body.get("svm_address", "").strip()
    label   = body.get("label",   "").strip()
    if not address:
        return jsonify({"error": "Endereço EVM inválido"}), 400
    wallets = load_dash_wallets()
    if any(w["address"] == address for w in wallets):
        return jsonify({"error": "Carteira já adicionada"}), 409
    wallets.append({"address": address, "svm_address": svm, "label": label, "tokens": [], "last_updated": None})
    save_dash_wallets(wallets)
    return jsonify({"ok": True})

@app.route("/api/dashboard/wallets/<address>", methods=["DELETE"])
def delete_dash_wallet(address):
    wallets = [w for w in load_dash_wallets() if w["address"] != address.lower()]
    save_dash_wallets(wallets)
    return jsonify({"ok": True})

def _jumper_get(path, params, timeout=25):
    JUMPER_HDR = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept":     "application/json",
        "Origin":     "https://jumper.exchange",
        "Referer":    "https://jumper.exchange/",
    }
    req = urllib.request.Request(
        f"https://api.jumper.xyz/v1/portfolio/{path}?{params}",
        headers=JUMPER_HDR, method="GET"
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())

def _hl_post(payload, timeout=15):
    req = urllib.request.Request(
        "https://api.hyperliquid.xyz/info",
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode())

@app.route("/api/dashboard/wallets/<address>/refresh", methods=["POST"])
def refresh_dash_wallet(address):
    wallets = load_dash_wallets()
    wallet  = next((w for w in wallets if w["address"] == address.lower()), None)
    if not wallet:
        return jsonify({"error": "Carteira não encontrada"}), 404

    params = f"evm={address}"
    svm = wallet.get("svm_address", "").strip()
    if svm:
        params += f"&svm={svm}"

    errors  = []
    tokens  = []
    defi    = []
    perps   = []

    # ── 1. Tokens (Jumper /tokens) ──────────────────────────────────────────────
    try:
        result = _jumper_get("tokens", params)
        for b in result.get("data", {}).get("balances", []):
            try:
                raw = int(b.get("amount", "0") or "0")
                dec = int(b.get("decimals", 18) or 18)
                bal = raw / (10 ** dec)
            except Exception:
                continue
            if bal < 1e-12:
                continue
            val       = float(b.get("amountUSD", 0) or 0)
            if val < 1.0:
                continue
            price_usd = (val / bal) if bal > 0 else 0
            chain_key = (b.get("chain") or {}).get("chainKey", "")
            tokens.append({
                "symbol":     b.get("symbol", ""),
                "name":       b.get("name", ""),
                "network":    chain_key,
                "chain_type": b.get("chainType", "EVM"),
                "balance":    bal,
                "price_usd":  price_usd,
                "value_usd":  val,
                "thumbnail":  b.get("logo", ""),
                "contract":   b.get("address", ""),
            })
        tokens.sort(key=lambda x: x["value_usd"], reverse=True)
    except Exception as ex:
        errors.append(f"tokens: {ex}")

    # ── 2 & 3. DeFi + Perps from Jumper /positions ─────────────────────────────
    # Trading/exchange protocols go into perps[]; everything else into defi[]
    PERP_PROTOCOLS = {"hyperliquid", "lighter", "polymarket", "dydx", "kwenta",
                      "synthetix", "gains network", "foxify", "pear protocol"}
    try:
        result = _jumper_get("positions", params)

        def _tok_list(p, key):
            out = []
            for t in (p.get(key) or []):
                amt_usd = float(t.get("amountUSD", 0) or 0)
                if amt_usd < 0.0001:
                    continue
                try:
                    raw = int(t.get("amount", "0") or "0")
                    dec = int(t.get("decimals", 18) or 18)
                    bal = raw / (10 ** dec)
                except Exception:
                    bal = 0
                out.append({"symbol": t.get("symbol", ""), "balance": bal,
                            "value_usd": amt_usd, "logo": t.get("logo", "")})
            return out

        for p in result.get("data", []):
            net_usd = float(p.get("netUsd", 0) or 0)
            if abs(net_usd) < 0.01:
                continue
            proto     = p.get("protocol") or {}
            proto_name = proto.get("name", p.get("name", ""))
            chain_key = (p.get("chain") or {}).get("chainKey", "")
            row = {
                "protocol":      proto_name,
                "protocol_logo": proto.get("logo", ""),
                "protocol_url":  proto.get("url", ""),
                "type":          p.get("type", ""),
                "description":   p.get("description", ""),
                "network":       chain_key,
                "asset_usd":     float(p.get("assetUsd", 0) or 0),
                "debt_usd":      float(p.get("debtUsd",  0) or 0),
                "net_usd":       net_usd,
                "supply_tokens": _tok_list(p, "supplyTokens"),
                "reward_tokens": _tok_list(p, "rewardTokens"),
                "borrow_tokens": _tok_list(p, "borrowTokens"),
            }
            if proto_name.lower() in PERP_PROTOCOLS:
                perps.append(row)
            else:
                defi.append(row)

        defi.sort(key=lambda x: x["net_usd"], reverse=True)
        perps.sort(key=lambda x: x["net_usd"], reverse=True)
    except Exception as ex:
        errors.append(f"positions: {ex}")

    # ── 4. Deduplicate receipt tokens ────────────────────────────────────────────
    # Jumper's /tokens returns ALL wallet token balances, including protocol
    # receipt tokens (e.g. kHYPE for Kinetiq staking, UETH for ETH vaults).
    # Those same tokens appear as supply_tokens inside /positions (DeFi/perps),
    # so they get double-counted. Remove any wallet token whose symbol + value
    # closely matches a supply_token already accounted for in a position.
    supply_sym_values: dict = {}
    for pos in defi + perps:
        for t in pos.get("supply_tokens", []) + pos.get("reward_tokens", []):
            sym = t.get("symbol", "").upper()
            supply_sym_values[sym] = supply_sym_values.get(sym, 0) + float(t.get("value_usd", 0) or 0)

    deduped: list = []
    for tok in tokens:
        sym     = tok["symbol"].upper()
        tok_val = tok["value_usd"]
        pos_val = supply_sym_values.get(sym, 0)
        if pos_val > 1.0 and tok_val > 1.0:
            ratio = abs(tok_val - pos_val) / max(tok_val, pos_val)
            if ratio < 0.25:   # within 25% → almost certainly the same asset
                continue
        deduped.append(tok)
    tokens = deduped

    from datetime import datetime
    for w in wallets:
        if w["address"] == address.lower():
            w["tokens"]       = tokens
            w["defi"]         = defi
            w["perps"]        = perps
            w["last_updated"] = datetime.utcnow().isoformat()
            break
    save_dash_wallets(wallets)
    return jsonify({"ok": True, "tokens": len(tokens), "defi": len(defi),
                    "perps": len(perps), "errors": errors})

@app.route("/api/dashboard/manual", methods=["GET"])
def get_dash_manual():
    return jsonify(load_dash_manual())

@app.route("/api/dashboard/manual", methods=["POST"])
def add_dash_manual():
    body   = request.get_json() or {}
    symbol = body.get("symbol", "").strip().upper()
    if not symbol:
        return jsonify({"error": "Símbolo obrigatório"}), 400
    from datetime import datetime
    asset = {
        "id":        str(uuid.uuid4())[:8],
        "symbol":    symbol,
        "name":      body.get("name",      "").strip(),
        "network":   body.get("network",   "").strip().lower(),
        "balance":   float(body.get("balance",   0) or 0),
        "price_usd": float(body.get("price_usd", 0) or 0),
        "added_at":  datetime.utcnow().isoformat(),
    }
    manual = load_dash_manual()
    manual.append(asset)
    save_dash_manual(manual)
    return jsonify({"ok": True})

@app.route("/api/dashboard/manual/<asset_id>", methods=["DELETE"])
def delete_dash_manual(asset_id):
    manual = [a for a in load_dash_manual() if a["id"] != asset_id]
    save_dash_manual(manual)
    return jsonify({"ok": True})


_warmup()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
