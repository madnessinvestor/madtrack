from flask import Flask, render_template, jsonify, request, send_file
import json, os, urllib.request, concurrent.futures

app = Flask(__name__)
DATA_FILE = "assets.json"

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

def http_post(url, data, timeout=5):
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

# ─── API fetchers ────────────────────────────────────────────────────────────

def api_hyperliquid(sym):
    sym = sym.upper()
    mids = http_post("https://api.hyperliquid.xyz/info", {"type": "allMids"})
    if not mids or sym not in mids:
        return None
    price = float(mids[sym])
    change = None
    meta = http_post("https://api.hyperliquid.xyz/info", {"type": "metaAndAssetCtxs"})
    if meta and len(meta) >= 2:
        for i, asset in enumerate(meta[0].get("universe", [])):
            if asset.get("name") == sym and i < len(meta[1]):
                prev = float(meta[1][i].get("prevDayPx", 0) or 0)
                if prev:
                    change = round((price - prev) / prev * 100, 2)
                break
    return {"price": price, "change24h": change, "source": "Hyperliquid"}

def api_binance(sym):
    s = sym.upper() + "USDT"
    d = http_get(f"https://api.binance.com/api/v3/ticker/24hr?symbol={s}")
    if d and "lastPrice" in d and float(d["lastPrice"]) > 0:
        return {"price": float(d["lastPrice"]), "change24h": round(float(d.get("priceChangePercent", 0)), 2), "source": "Binance"}

def api_okx(sym):
    s = sym.upper() + "-USDT"
    d = http_get(f"https://www.okx.com/api/v5/market/ticker?instId={s}")
    if d and d.get("data"):
        row = d["data"][0]
        price = float(row.get("last", 0))
        open24 = float(row.get("open24h", 0) or 0)
        change = round((price - open24) / open24 * 100, 2) if open24 else None
        if price > 0:
            return {"price": price, "change24h": change, "source": "OKX"}

def api_bybit(sym):
    s = sym.upper() + "USDT"
    d = http_get(f"https://api.bybit.com/v5/market/tickers?category=spot&symbol={s}")
    if d and d.get("result", {}).get("list"):
        row = d["result"]["list"][0]
        price = float(row.get("lastPrice", 0))
        if price > 0:
            return {"price": price, "change24h": round(float(row.get("price24hPcnt", 0)) * 100, 2), "source": "Bybit"}

def api_kucoin(sym):
    s = sym.upper() + "-USDT"
    d = http_get(f"https://api.kucoin.com/api/v1/market/stats?symbol={s}")
    if d and d.get("data", {}).get("last"):
        row = d["data"]
        price = float(row["last"])
        if price > 0:
            return {"price": price, "change24h": round(float(row.get("changeRate", 0)) * 100, 2), "source": "KuCoin"}

def api_gateio(sym):
    s = sym.upper() + "_USDT"
    d = http_get(f"https://api.gateio.ws/api/v4/spot/tickers?currency_pair={s}")
    if d and isinstance(d, list) and d:
        price = float(d[0].get("last", 0))
        if price > 0:
            return {"price": price, "change24h": round(float(d[0].get("change_percentage", 0)), 2), "source": "Gate.io"}

def api_kraken(sym):
    s = sym.upper()
    pair = ("XBT" if s == "BTC" else s) + "USD"
    d = http_get(f"https://api.kraken.com/0/public/Ticker?pair={pair}")
    if d and not d.get("error") and d.get("result"):
        key = list(d["result"].keys())[0]
        row = d["result"][key]
        price = float(row["c"][0])
        open_p = float(row["o"])
        if price > 0:
            change = round((price - open_p) / open_p * 100, 2) if open_p else None
            return {"price": price, "change24h": change, "source": "Kraken"}

def api_cryptocompare(sym):
    s = sym.upper()
    d = http_get(f"https://min-api.cryptocompare.com/data/pricemultifull?fsyms={s}&tsyms=USD")
    if d and d.get("RAW", {}).get(s, {}).get("USD"):
        row = d["RAW"][s]["USD"]
        price = float(row.get("PRICE", 0))
        if price > 0:
            return {"price": price, "change24h": round(float(row.get("CHANGEPCT24HOUR", 0)), 2), "source": "CryptoCompare"}

def api_mexc(sym):
    s = sym.upper() + "USDT"
    d = http_get(f"https://api.mexc.com/api/v3/ticker/24hr?symbol={s}")
    if d and "lastPrice" in d:
        price = float(d["lastPrice"])
        if price > 0:
            return {"price": price, "change24h": round(float(d.get("priceChangePercent", 0)), 2), "source": "MEXC"}

def api_bitfinex(sym):
    s = sym.upper()
    ticker = f"t{s}USD"
    d = http_get(f"https://api-pub.bitfinex.com/v2/ticker/{ticker}")
    if d and isinstance(d, list) and len(d) >= 7:
        price = float(d[6])
        if price > 0:
            return {"price": price, "change24h": round(float(d[5]) * 100, 2), "source": "Bitfinex"}

def api_coincap(sym):
    s = sym.lower()
    d = http_get(f"https://api.coincap.io/v2/assets?search={s}&limit=5")
    if d and d.get("data"):
        for asset in d["data"]:
            if asset.get("symbol", "").lower() == s:
                price = float(asset.get("priceUsd", 0) or 0)
                if price > 0:
                    return {"price": price, "change24h": round(float(asset.get("changePercent24Hr", 0) or 0), 2), "source": "CoinCap"}

def api_coingecko(sym):
    s = sym.lower()
    search = http_get(f"https://api.coingecko.com/api/v3/search?query={s}")
    if not search or not search.get("coins"):
        return None
    coin_id = None
    for c in search["coins"]:
        if c.get("symbol", "").lower() == s:
            coin_id = c["id"]
            break
    if not coin_id:
        coin_id = search["coins"][0]["id"]
    d = http_get(f"https://api.coingecko.com/api/v3/simple/price?ids={coin_id}&vs_currencies=usd&include_24hr_change=true")
    if d and coin_id in d:
        price = float(d[coin_id].get("usd", 0) or 0)
        if price > 0:
            return {"price": price, "change24h": round(float(d[coin_id].get("usd_24h_change", 0) or 0), 2), "source": "CoinGecko", "name": coin_id}

# Priority order: exchanges first, aggregators last
APIS = [
    api_hyperliquid, api_binance, api_okx, api_bybit, api_kucoin,
    api_gateio, api_kraken, api_cryptocompare, api_mexc, api_bitfinex,
    api_coincap, api_coingecko
]

def fetch_price(symbol):
    """Run all APIs in parallel, return best result by priority order."""
    results = {}
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(APIS)) as ex:
        futures = {ex.submit(fn, symbol): fn for fn in APIS}
        for future in concurrent.futures.as_completed(futures):
            fn = futures[future]
            try:
                r = future.result()
                if r:
                    results[fn] = r
            except Exception:
                pass
    for fn in APIS:
        if fn in results:
            return results[fn]
    return None

# ─── Routes ──────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/favicon.ico")
def favicon():
    return send_file("static/icons/icon-192.png", mimetype="image/png")

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
    out = []
    def fetch_one(a):
        sym = a.get("symbol", "").upper()
        r = fetch_price(sym)
        if r:
            return {**r, "symbol": sym, "id": sym}
        return {"symbol": sym, "id": sym, "price": None, "change24h": None, "source": None}
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

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
