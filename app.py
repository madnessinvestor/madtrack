from flask import Flask, render_template, jsonify, request, send_file
import json, os, urllib.request

app = Flask(__name__)
DATA_FILE = "assets.json"

def load_assets():
    if os.path.exists(DATA_FILE):
        with open(DATA_FILE) as f:
            return json.load(f)
    return []

def save_assets(assets):
    with open(DATA_FILE, "w") as f:
        json.dump(assets, f)

def fetch_prices(ids):
    if not ids:
        return {}
    url = f"https://api.coingecko.com/api/v3/simple/price?ids={','.join(ids)}&vs_currencies=usd&include_24hr_change=true"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "MadTracker/1.0"})
        with urllib.request.urlopen(req, timeout=8) as r:
            return json.loads(r.read().decode())
    except Exception:
        return {}

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/favicon.ico")
def favicon():
    return send_file("static/icons/icon-192.png", mimetype="image/png")

@app.route("/api/assets", methods=["GET"])
def get_assets():
    assets = load_assets()
    prices = fetch_prices([a["id"] for a in assets])
    result = []
    for a in assets:
        p = prices.get(a["id"], {})
        price = p.get("usd", None)
        change = p.get("usd_24h_change", None)
        result.append({
            "id": a["id"],
            "symbol": a.get("symbol", a["id"]).upper(),
            "name": a.get("name", a["id"].title()),
            "price": price,
            "change24h": round(change, 2) if change is not None else None
        })
    return jsonify(result)

@app.route("/api/assets", methods=["POST"])
def add_asset():
    data = request.json
    assets = load_assets()
    coin_id = data.get("id", "").strip().lower()
    for a in assets:
        if a["id"] == coin_id:
            return jsonify({"ok": True})
    assets.append({
        "id": coin_id,
        "symbol": data.get("symbol", "").strip(),
        "name": data.get("name", "").strip()
    })
    save_assets(assets)
    return jsonify({"ok": True})

@app.route("/api/assets/<asset_id>", methods=["DELETE"])
def delete_asset(asset_id):
    assets = [a for a in load_assets() if a["id"] != asset_id]
    save_assets(assets)
    return jsonify({"ok": True})

@app.route("/api/search")
def search_coin():
    q = request.args.get("q", "").strip()
    if not q:
        return jsonify([])
    url = f"https://api.coingecko.com/api/v3/search?query={urllib.request.quote(q)}"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "MadTracker/1.0"})
        with urllib.request.urlopen(req, timeout=8) as r:
            coins = json.loads(r.read().decode()).get("coins", [])[:8]
            return jsonify([{"id": c["id"], "symbol": c["symbol"], "name": c["name"]} for c in coins])
    except Exception:
        return jsonify([])

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
