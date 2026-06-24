let searchTimeout   = null;
let suggestTimeout  = null;
let pendingSymbol   = null;
let activeIndex     = -1;
let currentSuggestions = [];

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
      loadIcons(assets.map(a => a.symbol));
    }

    const now = new Date();
    lastUpdate.textContent = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
  } catch {
    list.innerHTML = `<div class="empty-state"><p>Erro ao carregar. Verifique a conexão.</p></div>`;
  }
}

function cardHTML(a) {
  const hasPrice = a.price !== null && a.price !== undefined;
  const hasHigh  = a.high24h   != null;
  const hasLow   = a.low24h    != null;
  const hasVol   = a.volume24h != null;
  const hasCap   = a.market_cap != null;
  const hasExtra = hasHigh || hasLow || hasVol || hasCap;

  const statsRows = [
    hasHigh ? `<div class="stat"><span class="stat-label">MÁX 24H</span><span class="stat-val">${formatPrice(a.high24h)}</span></div>` : "",
    hasLow  ? `<div class="stat"><span class="stat-label">MÍN 24H</span><span class="stat-val">${formatPrice(a.low24h)}</span></div>` : "",
    hasVol  ? `<div class="stat"><span class="stat-label">VOLUME 24H</span><span class="stat-val">${formatUSD(a.volume24h)}</span></div>` : "",
    hasCap  ? `<div class="stat"><span class="stat-label">MARKET CAP</span><span class="stat-val">${formatUSD(a.market_cap)}</span></div>` : "",
  ].join("");

  return `<div class="asset-card${hasExtra ? " expandable" : ""}" onclick="toggleCard(this, event)">
    <div class="card-top">
      <div class="asset-left">
        <div class="asset-icon" data-sym="${a.symbol}">
          <img class="icon-img" alt="" />
          <span class="icon-text">${a.symbol.slice(0,4)}</span>
        </div>
        <div class="asset-name-wrap">
          <div class="asset-symbol">${a.symbol}</div>
          <div class="asset-source">${a.source || ""}</div>
        </div>
      </div>
      <div class="asset-right">
        <div class="asset-price">${hasPrice ? formatPrice(a.price) : "—"}</div>
        ${changeHTML(a.change24h)}
        ${hasCap ? `<div class="asset-mcap">MC ${formatUSD(a.market_cap)}</div>` : ""}
      </div>
      <span class="card-chevron${hasExtra ? "" : " hidden"}">›</span>
    </div>

    <div class="card-details">
      ${statsRows}
      <button class="btn-delete-inline" onclick="deleteAsset('${a.symbol}')">Remover</button>
    </div>
  </div>`;
}

function toggleCard(card, e) {
  if (e.target.classList.contains("btn-delete-inline")) return;
  if (!card.classList.contains("expandable")) return;
  card.classList.toggle("open");
}

const CDN = sym =>
  `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${sym.toLowerCase()}.svg`;

function loadIcons(symbols) {
  symbols.forEach(sym => {
    const wrap = document.querySelector(`.asset-icon[data-sym="${sym}"]`);
    if (!wrap) return;
    const img  = wrap.querySelector(".icon-img");
    const text = wrap.querySelector(".icon-text");

    img.onload  = () => { img.classList.add("loaded"); text.style.display = "none"; };
    img.onerror = () => {
      fetch(`/api/icon?symbol=${encodeURIComponent(sym)}`)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
          img.onerror = () => {};
          img.src = data.url;
        })
        .catch(() => {});
    };
    img.src = CDN(sym);
  });
}

function loadModalIcon(sym) {
  const wrap = document.getElementById("pr-icon");
  if (!wrap) return;
  const img  = wrap.querySelector(".icon-img");
  const text = wrap.querySelector(".icon-text");
  img.onload  = () => { img.classList.add("loaded"); text.style.display = "none"; };
  img.onerror = () => {
    fetch(`/api/icon?symbol=${encodeURIComponent(sym)}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(data => { img.onerror = () => {}; img.src = data.url; })
      .catch(() => {});
  };
  img.src = CDN(sym);
  text.style.display = "";
  img.classList.remove("loaded");
}

async function deleteAsset(symbol) {
  await fetch(`/api/assets/${encodeURIComponent(symbol)}`, { method: "DELETE" });
  loadAssets();
}

// ─── Modal / Search ───────────────────────────────────────────────────────────

function openModal() {
  pendingSymbol = null;
  activeIndex = -1;
  currentSuggestions = [];
  document.getElementById("ticker-input").value = "";
  document.getElementById("price-result").classList.add("hidden");
  document.getElementById("price-error").classList.add("hidden");
  document.getElementById("search-spinner").classList.add("hidden");
  document.getElementById("suggestions").classList.add("hidden");
  document.getElementById("suggestions").innerHTML = "";
  document.getElementById("modal").classList.remove("hidden");
  setTimeout(() => document.getElementById("ticker-input").focus(), 80);
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
  hideSuggestions();
}

function hideSuggestions() {
  document.getElementById("suggestions").classList.add("hidden");
  activeIndex = -1;
}

function onTickerInput(val) {
  clearTimeout(searchTimeout);
  clearTimeout(suggestTimeout);
  const sym = val.trim().toUpperCase();
  document.getElementById("price-result").classList.add("hidden");
  document.getElementById("price-error").classList.add("hidden");
  pendingSymbol = null;
  activeIndex = -1;

  if (!sym) {
    document.getElementById("search-spinner").classList.add("hidden");
    hideSuggestions();
    return;
  }

  // Fetch suggestions quickly
  suggestTimeout = setTimeout(() => fetchSuggestions(sym), 150);

  // Fetch price after slight delay
  document.getElementById("search-spinner").classList.remove("hidden");
  searchTimeout = setTimeout(() => fetchTickerPrice(sym), 700);
}

async function fetchSuggestions(sym) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(sym)}`);
    if (!res.ok) return;
    const items = await res.json();
    currentSuggestions = items;
    renderSuggestions(items);
  } catch { /* silent */ }
}

function renderSuggestions(items) {
  const el = document.getElementById("suggestions");
  if (!items.length) {
    el.classList.add("hidden");
    return;
  }
  el.innerHTML = items.map((item, i) =>
    `<div class="suggestion-item" data-i="${i}" onclick="selectSuggestion('${item.symbol}')">
      <span class="suggestion-sym">${item.symbol}</span>
      <span class="suggestion-ex">${item.exchange || ""}</span>
    </div>`
  ).join("");
  el.classList.remove("hidden");
}

function selectSuggestion(sym) {
  const input = document.getElementById("ticker-input");
  input.value = sym;
  hideSuggestions();
  clearTimeout(searchTimeout);
  clearTimeout(suggestTimeout);
  document.getElementById("search-spinner").classList.remove("hidden");
  fetchTickerPrice(sym);
}

function onTickerKey(e) {
  const el = document.getElementById("suggestions");
  const items = el.querySelectorAll(".suggestion-item");
  if (!items.length) return;

  if (e.key === "ArrowDown") {
    e.preventDefault();
    activeIndex = Math.min(activeIndex + 1, items.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    activeIndex = Math.max(activeIndex - 1, -1);
  } else if (e.key === "Enter" && activeIndex >= 0) {
    e.preventDefault();
    const sym = currentSuggestions[activeIndex]?.symbol;
    if (sym) selectSuggestion(sym);
    return;
  } else if (e.key === "Escape") {
    hideSuggestions();
    return;
  } else {
    return;
  }

  items.forEach((item, i) => item.classList.toggle("active", i === activeIndex));
}

async function fetchTickerPrice(sym) {
  const resultEl = document.getElementById("price-result");
  const errorEl  = document.getElementById("price-error");
  const spinner  = document.getElementById("search-spinner");

  hideSuggestions();

  try {
    const res = await fetch(`/api/price?symbol=${encodeURIComponent(sym)}`);
    spinner.classList.add("hidden");

    if (!res.ok) { errorEl.classList.remove("hidden"); return; }

    const d = await res.json();
    pendingSymbol = sym;

    document.getElementById("pr-symbol").textContent = sym.slice(0, 4);
    const lblEl = document.getElementById("pr-symbol-label");
    if (lblEl) lblEl.textContent = d.symbol;
    document.getElementById("pr-price").textContent  = formatPrice(d.price);
    document.getElementById("pr-change").innerHTML   = changeHTML(d.change24h, "lg");
    document.getElementById("pr-source").textContent = "via " + (d.source || "—");
    loadModalIcon(sym);

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
