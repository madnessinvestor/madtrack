let searchTimeout = null;
let pendingSymbol = null;

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatUSD(v) {
  if (v === null || v === undefined) return "—";
  if (v >= 1_000_000_000) return "$" + (v / 1_000_000_000).toFixed(2) + "B";
  if (v >= 1_000_000)     return "$" + (v / 1_000_000).toFixed(2) + "M";
  if (v >= 1000)          return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 1)             return "$" + v.toFixed(2);
  if (v > 0)              return "$" + v.toFixed(6);
  return "$0.00";
}

function formatPrice(v) {
  if (v === null || v === undefined) return "—";
  if (v >= 1000) return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 1)    return "$" + v.toFixed(2);
  if (v > 0)     return "$" + v.toFixed(6);
  return "$0.00";
}

function changeHTML(change, size = "") {
  if (change === null || change === undefined) return "";
  const up = change >= 0;
  const cls = up ? "up" : "down";
  const sign = up ? "▲" : "▼";
  return `<span class="change ${cls} ${size}">${sign} ${Math.abs(change).toFixed(2)}%</span>`;
}

// ─── Watchlist ────────────────────────────────────────────────────────────────

async function loadAssets() {
  const list = document.getElementById("asset-list");
  const lastUpdate = document.getElementById("last-update");

  try {
    const res = await fetch("/api/assets");
    const assets = await res.json();

    if (!assets.length) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📊</div>
        <p>Nenhum ativo adicionado.<br>Clique em <b>+ Adicionar</b> e digite o ticker.</p>
      </div>`;
    } else {
      list.innerHTML = assets.map(a => cardHTML(a)).join("");
    }

    const now = new Date();
    lastUpdate.textContent = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
  } catch {
    list.innerHTML = `<div class="empty-state"><p>Erro ao carregar. Verifique a conexão.</p></div>`;
  }
}

function cardHTML(a) {
  const hasPrice = a.price !== null && a.price !== undefined;
  const hasHigh  = a.high24h !== null && a.high24h !== undefined;
  const hasLow   = a.low24h  !== null && a.low24h  !== undefined;
  const hasVol   = a.volume24h !== null && a.volume24h !== undefined;
  const hasCap   = a.market_cap !== null && a.market_cap !== undefined;

  return `<div class="asset-card">
    <button class="btn-delete" onclick="deleteAsset('${a.symbol}')">✕</button>

    <div class="card-top">
      <div class="asset-left">
        <div class="asset-icon">${a.symbol.slice(0,4)}</div>
        <div>
          <div class="asset-symbol">${a.symbol}</div>
          ${a.source ? `<div class="asset-source">${a.source}</div>` : ""}
        </div>
      </div>
      <div class="asset-right">
        <div class="asset-price">${hasPrice ? formatPrice(a.price) : "—"}</div>
        ${changeHTML(a.change24h)}
      </div>
    </div>

    ${(hasHigh || hasLow || hasVol || hasCap) ? `
    <div class="card-stats">
      ${hasHigh ? `<div class="stat"><span class="stat-label">MÁX 24H</span><span class="stat-val">${formatPrice(a.high24h)}</span></div>` : ""}
      ${hasLow  ? `<div class="stat"><span class="stat-label">MÍN 24H</span><span class="stat-val">${formatPrice(a.low24h)}</span></div>` : ""}
      ${hasVol  ? `<div class="stat"><span class="stat-label">VOLUME 24H</span><span class="stat-val">${formatUSD(a.volume24h)}</span></div>` : ""}
      ${hasCap  ? `<div class="stat"><span class="stat-label">MARKET CAP</span><span class="stat-val">${formatUSD(a.market_cap)}</span></div>` : ""}
    </div>` : ""}
  </div>`;
}

async function deleteAsset(symbol) {
  await fetch(`/api/assets/${encodeURIComponent(symbol)}`, { method: "DELETE" });
  loadAssets();
}

// ─── Modal / Search ───────────────────────────────────────────────────────────

function openModal() {
  pendingSymbol = null;
  document.getElementById("ticker-input").value = "";
  document.getElementById("price-result").classList.add("hidden");
  document.getElementById("price-error").classList.add("hidden");
  document.getElementById("search-spinner").classList.add("hidden");
  document.getElementById("modal").classList.remove("hidden");
  setTimeout(() => document.getElementById("ticker-input").focus(), 80);
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

function onTickerInput(val) {
  clearTimeout(searchTimeout);
  const sym = val.trim().toUpperCase();
  document.getElementById("price-result").classList.add("hidden");
  document.getElementById("price-error").classList.add("hidden");
  pendingSymbol = null;

  if (!sym) {
    document.getElementById("search-spinner").classList.add("hidden");
    return;
  }
  document.getElementById("search-spinner").classList.remove("hidden");
  searchTimeout = setTimeout(() => fetchTickerPrice(sym), 500);
}

async function fetchTickerPrice(sym) {
  const resultEl = document.getElementById("price-result");
  const errorEl  = document.getElementById("price-error");
  const spinner  = document.getElementById("search-spinner");

  try {
    const res = await fetch(`/api/price?symbol=${encodeURIComponent(sym)}`);
    spinner.classList.add("hidden");

    if (!res.ok) { errorEl.classList.remove("hidden"); return; }

    const d = await res.json();
    pendingSymbol = sym;

    document.getElementById("pr-symbol").textContent = d.symbol;
    document.getElementById("pr-price").textContent  = formatPrice(d.price);
    document.getElementById("pr-change").innerHTML   = changeHTML(d.change24h, "lg");
    document.getElementById("pr-source").textContent = "via " + (d.source || "—");

    // Extra stats
    const statsEl = document.getElementById("pr-stats");
    const rows = [];
    if (d.high24h)    rows.push(`<div class="stat"><span class="stat-label">MÁX 24H</span><span class="stat-val">${formatPrice(d.high24h)}</span></div>`);
    if (d.low24h)     rows.push(`<div class="stat"><span class="stat-label">MÍN 24H</span><span class="stat-val">${formatPrice(d.low24h)}</span></div>`);
    if (d.volume24h)  rows.push(`<div class="stat"><span class="stat-label">VOLUME 24H</span><span class="stat-val">${formatUSD(d.volume24h)}</span></div>`);
    if (d.market_cap) rows.push(`<div class="stat"><span class="stat-label">MARKET CAP</span><span class="stat-val">${formatUSD(d.market_cap)}</span></div>`);
    statsEl.innerHTML = rows.join("");
    statsEl.style.display = rows.length ? "grid" : "none";

    resultEl.classList.remove("hidden");
  } catch {
    spinner.classList.add("hidden");
    errorEl.classList.remove("hidden");
  }
}

async function confirmAdd() {
  if (!pendingSymbol) return;
  await fetch("/api/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ symbol: pendingSymbol })
  });
  closeModal();
  loadAssets();
}

document.addEventListener("keydown", e => { if (e.key === "Escape") closeModal(); });

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/static/sw.js").catch(() => {});
}

loadAssets();
setInterval(loadAssets, 60000);
