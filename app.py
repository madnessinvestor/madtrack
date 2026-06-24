from flask import Flask, render_template, jsonify, request, send_file
import json, os, urllib.request, concurrent.futures, time, threading

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

def safe_float(v):
    try:
        f = float(v)
        return f if f > 0 else None
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
                "change24h": safe_float(r.get("regularMarketChangePercent")),
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
                "change24h": safe_float(r.get("regularMarketChangePercent")),
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
    sym = symbol.upper()
    if sym in _icon_cache:
        return _icon_cache[sym]
    _, d = _coingecko_coin_data(sym)
    url = None
    if d:
        url = d.get("image", {}).get("small") or d.get("image", {}).get("large")
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

# ─── Routes ───────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

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
    data = request.json
    sym = data.get("symbol", "").strip().upper()
    if not sym:
        return jsonify({"ok": False}), 400
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
    symbols = request.json.get("symbols", [])
    current = {a["symbol"].upper(): a for a in load_assets()}
    ordered = [current[s.upper()] for s in symbols if s.upper() in current]
    save_assets(ordered)
    return jsonify({"ok": True})

@app.route("/api/rates")
def get_rates():
    d = http_get("https://api.frankfurter.app/latest?from=USD&to=EUR,BRL", timeout=5)
    if d and d.get("rates"):
        return jsonify(d["rates"])
    return jsonify({"EUR": 0.92, "BRL": 5.70})

# ─── Background warmup ────────────────────────────────────────────────────────

_coinlore_cache = {}

def _warmup():
    """Background: warm up symbol list and market caps."""
    def run():
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

    threading.Thread(target=run, daemon=True).start()

_warmup()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
