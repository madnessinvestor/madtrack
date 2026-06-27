// ─── Tema ─────────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("btn-theme");
  if (btn) btn.textContent = theme === "light" ? "🌙" : "☀️";
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "dark" ? "light" : "dark";
  localStorage.setItem("theme", next);
  applyTheme(next);
}

applyTheme(localStorage.getItem("theme") || "dark");

let searchTimeout      = null;
let suggestTimeout     = null;
let pendingSymbol      = null;
let searchingFor       = null;
let activeIndex        = -1;
let currentSuggestions = [];
let searchSeq          = 0;
let cachedAssets       = [];

const WHITE_BG_ICONS = new Set(["ETH", "SOL"]);

// ─── Moeda ────────────────────────────────────────────────────────────────────

let currentCurrency = localStorage.getItem("currency") || "USD";
let exchangeRates   = { EUR: 0.92, BRL: 5.70 };

const CURRENCY_LABELS  = { USD: "$",   EUR: "€",  BRL: "R$" };
const CURRENCY_CYCLE   = ["USD", "EUR", "BRL"];
const FOREX_CURRENCIES = new Set(["USD","EUR","BRL","GBP","JPY","CHF","AUD","CAD"]);

function isForexPair(sym) {
  if (!sym || sym.length !== 6) return false;
  return FOREX_CURRENCIES.has(sym.slice(0,3)) && FOREX_CURRENCIES.has(sym.slice(3,6));
}

function getRate() {
  if (currentCurrency === "USD") return 1;
  return exchangeRates[currentCurrency] || 1;
}

function currSym() {
  return CURRENCY_LABELS[currentCurrency] || "$";
}

async function fetchRates() {
  try {
    const res = await fetch("/api/rates");
    if (res.ok) exchangeRates = await res.json();
  } catch {}
}

function updateCurrencyBtn() {
  const btn = document.getElementById("btn-currency");
  if (btn) btn.textContent = currSym();
}

function toggleCurrency() {
  const idx = CURRENCY_CYCLE.indexOf(currentCurrency);
  currentCurrency = CURRENCY_CYCLE[(idx + 1) % CURRENCY_CYCLE.length];
  localStorage.setItem("currency", currentCurrency);
  updateCurrencyBtn();
  rerenderAssets();
  if (typeof loadPortfolio === "function") loadPortfolio();
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatUSD(v, skip = false) {
  if (v === null || v === undefined) return "—";
  const rate = skip ? 1 : getRate();
  const sym  = skip ? "$" : currSym();
  v = v * rate;
  const neg = v < 0;
  const abs = Math.abs(v);
  const sign = neg ? "-" : "";
  let fmt;
  if (abs >= 1_000_000_000) fmt = sym + (abs / 1_000_000_000).toFixed(2) + "B";
  else if (abs >= 1_000_000) fmt = sym + (abs / 1_000_000).toFixed(2) + "M";
  else if (abs >= 1000)      fmt = sym + abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  else if (abs >= 1)         fmt = sym + abs.toFixed(2);
  else if (abs > 0)          fmt = sym + abs.toFixed(6);
  else                       fmt = sym + "0.00";
  return sign + fmt;
}

function formatPrice(v, skip = false) {
  if (v === null || v === undefined) return "—";
  const rate = skip ? 1 : getRate();
  const sym  = skip ? "$" : currSym();
  v = v * rate;
  const neg = v < 0;
  const abs = Math.abs(v);
  const sign = neg ? "-" : "";
  let fmt;
  if (abs >= 1000) fmt = sym + abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  else if (abs >= 1) fmt = sym + abs.toFixed(2);
  else if (abs > 0)  fmt = sym + abs.toFixed(6);
  else               fmt = sym + "0.00";
  return sign + fmt;
}

function changeHTML(change, size = "") {
  if (change === null || change === undefined) return "";
  const up  = change >= 0;
  const cls = up ? "up" : "down";
  const sign = up ? "▲" : "▼";
  return `<span class="change ${cls} ${size}">${sign} ${Math.abs(change).toFixed(2)}%</span>`;
}

// ─── Watchlist ────────────────────────────────────────────────────────────────

function refreshCurrent() {
  const tradeSection = document.getElementById("section-trade");
  if (!tradeSection.classList.contains("hidden")) {
    if (typeof loadPortfolio === "function") loadPortfolio();
  } else {
    loadAssets();
  }
}

async function loadAssets() {
  const list       = document.getElementById("asset-list");
  const lastUpdate = document.getElementById("last-update");

  try {
    const res    = await fetch("/api/assets");
    const assets = await res.json();
    cachedAssets = assets;

    if (!assets.length) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📊</div>
        <p>${t("empty_tracker")}</p>
      </div>`;
    } else {
      list.innerHTML = assets.map(a => cardHTML(a)).join("");
      loadIcons(assets);
      initSortable();
    }

    const now = new Date();
    lastUpdate.textContent = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
  } catch {
    list.innerHTML = `<div class="empty-state"><p>${t("error_load")}</p></div>`;
  }
}

function rerenderAssets() {
  if (!cachedAssets.length) return;
  const list = document.getElementById("asset-list");
  list.innerHTML = cachedAssets.map(a => cardHTML(a)).join("");
  loadIcons(cachedAssets);
  initSortable();
}

let _sortable = null;
function initSortable() {
  const list = document.getElementById("asset-list");
  if (_sortable) { _sortable.destroy(); _sortable = null; }
  if (typeof Sortable === "undefined") return;
  _sortable = new Sortable(list, {
    handle: ".drag-handle",
    animation: 150,
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    onEnd: async () => {
      const cards   = list.querySelectorAll(".asset-card[data-sym]");
      const symbols = [...cards].map(c => c.dataset.sym);
      const symMap  = Object.fromEntries(cachedAssets.map(a => [a.symbol, a]));
      cachedAssets  = symbols.map(s => symMap[s]).filter(Boolean);
      await fetch("/api/assets/order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols })
      });
    }
  });
}

function cardHTML(a) {
  const skip     = isForexPair(a.symbol);
  const hasPrice = a.price !== null && a.price !== undefined;

  return `<div class="asset-card" data-sym="${a.symbol}" onclick="handleCardClick(this,event)">
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
        <div class="asset-price">${hasPrice ? formatPrice(a.price, skip) : "—"}</div>
        ${changeHTML(a.change24h)}
      </div>
      <span class="drag-handle" title="Reordenar">⠿</span>
    </div>
  </div>`;
}

function handleCardClick(card, e) {
  if (e.target.closest(".drag-handle")) return;
  const sym = card.dataset.sym;
  if (sym) openDetailSheet(sym);
}

const CDN1 = sym =>
  `https://cdn.jsdelivr.net/npm/cryptocurrency-icons@0.18.1/svg/color/${sym.toLowerCase()}.svg`;
const CDN2 = sym =>
  `https://cdn.jsdelivr.net/gh/ErikThiart/cryptocurrency-icons@master/icons/${sym.toLowerCase()}.png`;

const FOREX_FLAG = {
  USD: 'us', EUR: 'eu', BRL: 'br', GBP: 'gb',
  JPY: 'jp', CHF: 'ch', AUD: 'au', CAD: 'ca'
};

function forexIconUrl(sym) {
  const base = sym.slice(0, 3).toUpperCase();
  const cc   = FOREX_FLAG[base];
  return cc ? `https://flagcdn.com/48x36/${cc}.png` : null;
}

const AVATAR_PALETTE = [
  '#e74c3c','#c0392b','#e67e22','#d35400','#f39c12',
  '#27ae60','#16a085','#2980b9','#1a6fa8','#8e44ad',
  '#6c3483','#e91e63','#00838f','#e53935','#3949ab'
];

function avatarBg(sym) {
  let h = 0;
  for (let i = 0; i < sym.length; i++) h = sym.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function applyAvatar(wrap, sym) {
  wrap.style.background = avatarBg(sym);
  const text = wrap.querySelector(".icon-text");
  if (text) text.textContent = sym.slice(0, 2).toUpperCase();
}

function tryLoadImage(img, text, src, fallbackFn) {
  img.onload  = () => {
    img.classList.add("loaded");
    text.style.display = "none";
    const wrap = img.closest(".asset-icon");
    if (wrap) {
      const sym = (wrap.dataset.sym || wrap.dataset.pticker || "").toUpperCase();
      if (WHITE_BG_ICONS.has(sym)) wrap.style.background = "#fff";
    }
  };
  img.onerror = () => { img.onerror = () => {}; if (fallbackFn) fallbackFn(); };
  img.src = src;
}

function tryCryptoIcon(img, text, sym) {
  tryLoadImage(img, text, CDN1(sym), () =>
    tryLoadImage(img, text, CDN2(sym), () =>
      fetch(`/api/icon?symbol=${encodeURIComponent(sym)}`)
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => tryLoadImage(img, text, data.url, null))
        .catch(() => {})
    )
  );
}

function loadIcons(assets) {
  assets.forEach(a => {
    const sym  = a.symbol || a;
    const wrap = document.querySelector(`.asset-icon[data-sym="${sym}"]`);
    if (!wrap) return;
    const img  = wrap.querySelector(".icon-img");
    const text = wrap.querySelector(".icon-text");

    applyAvatar(wrap, sym);

    if (isForexPair(sym)) {
      const url = forexIconUrl(sym);
      if (url) tryLoadImage(img, text, url, null);
      return;
    }

    // If backend already returned a cached icon URL, try it first
    const backendUrl = a.icon_url;
    if (backendUrl) {
      tryLoadImage(img, text, backendUrl, () => tryCryptoIcon(img, text, sym));
    } else {
      tryCryptoIcon(img, text, sym);
    }
  });
}

function loadModalIcon(sym) {
  const wrap = document.getElementById("pr-icon");
  if (!wrap) return;
  const img  = wrap.querySelector(".icon-img");
  const text = wrap.querySelector(".icon-text");
  text.style.display = "";
  img.classList.remove("loaded");
  img.src = "";

  applyAvatar(wrap, sym);

  if (isForexPair(sym)) {
    const url = forexIconUrl(sym);
    if (url) tryLoadImage(img, text, url, null);
    return;
  }

  tryCryptoIcon(img, text, sym);
}

async function deleteAsset(symbol) {
  await fetch(`/api/assets/${encodeURIComponent(symbol)}`, { method: "DELETE" });
  loadAssets();
}

// ─── Modal / Search ───────────────────────────────────────────────────────────

function openModal() {
  pendingSymbol = null;
  searchingFor  = null;
  activeIndex   = -1;
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

  if (sym && (sym === pendingSymbol || sym === searchingFor)) return;

  document.getElementById("price-result").classList.add("hidden");
  document.getElementById("price-error").classList.add("hidden");
  pendingSymbol = null;
  searchingFor  = null;
  activeIndex   = -1;

  if (!sym) {
    document.getElementById("search-spinner").classList.add("hidden");
    hideSuggestions();
    return;
  }

  searchingFor = sym;

  suggestTimeout = setTimeout(() => fetchSuggestions(sym), 150);

  document.getElementById("search-spinner").classList.remove("hidden");
  const seq = ++searchSeq;
  searchTimeout = setTimeout(() => fetchTickerPrice(sym, seq), 700);
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
  pendingSymbol = null;
  searchingFor  = sym;
  document.getElementById("search-spinner").classList.remove("hidden");
  const seq = ++searchSeq;
  fetchTickerPrice(sym, seq);
}

function onTickerKey(e) {
  const el    = document.getElementById("suggestions");
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

async function fetchTickerPrice(sym, seq) {
  const resultEl = document.getElementById("price-result");
  const errorEl  = document.getElementById("price-error");
  const spinner  = document.getElementById("search-spinner");

  hideSuggestions();

  try {
    const res = await fetch(`/api/price?symbol=${encodeURIComponent(sym)}`);

    if (seq !== searchSeq) return;

    spinner.classList.add("hidden");

    if (!res.ok) { errorEl.classList.remove("hidden"); return; }

    const d = await res.json();

    if (seq !== searchSeq) return;

    const skip = isForexPair(sym);

    pendingSymbol = sym;
    searchingFor  = null;

    document.getElementById("pr-symbol").textContent = sym.slice(0, 4);
    const lblEl = document.getElementById("pr-symbol-label");
    if (lblEl) lblEl.textContent = d.symbol;
    document.getElementById("pr-price").textContent  = formatPrice(d.price, skip);
    document.getElementById("pr-change").innerHTML   = changeHTML(d.change24h, "lg");
    document.getElementById("pr-source").textContent = t("via") + " " + (d.source || "—");
    loadModalIcon(sym);

    const statsEl = document.getElementById("pr-stats");
    const rows = [];
    if (d.high24h)    rows.push(`<div class="stat"><span class="stat-label">${t("max24h")}</span><span class="stat-val">${formatPrice(d.high24h, skip)}</span></div>`);
    if (d.low24h)     rows.push(`<div class="stat"><span class="stat-label">${t("min24h")}</span><span class="stat-val">${formatPrice(d.low24h, skip)}</span></div>`);
    if (d.volume24h)  rows.push(`<div class="stat"><span class="stat-label">${t("vol24h")}</span><span class="stat-val">${formatUSD(d.volume24h, skip)}</span></div>`);
    if (d.market_cap) rows.push(`<div class="stat"><span class="stat-label">${t("mcap")}</span><span class="stat-val">${formatUSD(d.market_cap, skip)}</span></div>`);
    statsEl.innerHTML = rows.join("");
    statsEl.style.display = rows.length ? "grid" : "none";

    resultEl.classList.remove("hidden");
  } catch {
    if (seq !== searchSeq) return;
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

document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeModal(); closeDetailSheet(); }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/static/sw.js").catch(() => {});
}

// ─── Column layout ────────────────────────────────────────────────────────────

let trackerColumns = parseInt(localStorage.getItem("trackerColumns") || "1");

function applyColumns(n) {
  trackerColumns = n;
  localStorage.setItem("trackerColumns", n);
  const list = document.getElementById("asset-list");
  if (list) {
    list.classList.remove("cols-2", "cols-3");
    if (n === 2) list.classList.add("cols-2");
    if (n === 3) list.classList.add("cols-3");
  }
  document.querySelectorAll(".col-btn").forEach(b => {
    b.classList.toggle("active", parseInt(b.dataset.cols) === n);
  });
}

// ─── Detail sheet ─────────────────────────────────────────────────────────────

let _detailSym    = null;
let _detailPeriod = "1D";

function openDetailSheet(sym) {
  _detailSym    = sym;
  _detailPeriod = "1D";

  const sheet = document.getElementById("detail-sheet");
  sheet.classList.remove("hidden");
  requestAnimationFrame(() => sheet.classList.add("open"));
  document.body.style.overflow = "hidden";

  document.querySelectorAll(".detail-period").forEach(b => {
    b.classList.toggle("active", b.dataset.p === "1D");
  });

  const asset = cachedAssets.find(a => a.symbol === sym);
  const skip  = isForexPair(sym);

  document.getElementById("detail-sym").textContent       = sym;
  document.getElementById("detail-icon-text").textContent = sym.slice(0, 4);
  document.getElementById("detail-source").textContent    = asset?.source || "";
  document.getElementById("detail-price").textContent     = asset?.price != null ? formatPrice(asset.price, skip) : "—";
  document.getElementById("detail-change").innerHTML      = changeHTML(asset?.change24h, "lg");

  renderDetailStats(asset);

  const iconWrap = document.getElementById("detail-icon");
  iconWrap.dataset.sym = sym;
  const img  = iconWrap.querySelector(".icon-img");
  const text = iconWrap.querySelector(".icon-text");
  img.classList.remove("loaded");
  img.src = "";
  text.style.display = "";
  applyAvatar(iconWrap, sym);
  if (asset?.icon_url) {
    tryLoadImage(img, text, asset.icon_url, () => tryCryptoIcon(img, text, sym));
  } else if (isForexPair(sym)) {
    const url = forexIconUrl(sym);
    if (url) tryLoadImage(img, text, url, null);
  } else {
    tryCryptoIcon(img, text, sym);
  }

  loadDetailChart(sym, _detailPeriod);
}

function closeDetailSheet() {
  const sheet = document.getElementById("detail-sheet");
  if (!sheet || sheet.classList.contains("hidden")) return;
  sheet.classList.remove("open");
  document.body.style.overflow = "";
  setTimeout(() => sheet.classList.add("hidden"), 300);
  _detailSym = null;
}

function renderDetailStats(asset) {
  const el   = document.getElementById("detail-stats");
  const skip = isForexPair(_detailSym);
  if (!asset) { el.innerHTML = ""; return; }
  const rows = [
    asset.high24h != null && asset.low24h != null
      ? `<div class="stat"><span class="stat-label">${t("max24h")} / ${t("min24h")}</span><span class="stat-val">${formatPrice(asset.low24h, skip)} – ${formatPrice(asset.high24h, skip)}</span></div>` : "",
    asset.high24h   != null ? `<div class="stat"><span class="stat-label">${t("max24h")}</span><span class="stat-val">${formatPrice(asset.high24h, skip)}</span></div>` : "",
    asset.low24h    != null ? `<div class="stat"><span class="stat-label">${t("min24h")}</span><span class="stat-val">${formatPrice(asset.low24h, skip)}</span></div>` : "",
    asset.volume24h  != null ? `<div class="stat"><span class="stat-label">${t("vol24h")}</span><span class="stat-val">${formatUSD(asset.volume24h, skip)}</span></div>` : "",
    asset.market_cap != null ? `<div class="stat"><span class="stat-label">${t("mcap")}</span><span class="stat-val">${formatUSD(asset.market_cap, skip)}</span></div>` : "",
  ].filter(Boolean);
  el.innerHTML = rows.join("");
}

function selectDetailPeriod(btn) {
  document.querySelectorAll(".detail-period").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  _detailPeriod = btn.dataset.p;
  if (_detailSym) loadDetailChart(_detailSym, _detailPeriod);
}

async function loadDetailChart(sym, period) {
  const canvas  = document.getElementById("detail-chart");
  const loading = document.getElementById("detail-chart-loading");
  const empty   = document.getElementById("detail-chart-empty");
  const ctx     = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  loading.classList.remove("hidden");
  empty.classList.add("hidden");

  try {
    const res = await fetch(`/api/history?symbol=${encodeURIComponent(sym)}&period=${period}`);
    loading.classList.add("hidden");
    if (_detailSym !== sym) return;
    if (!res.ok) throw new Error("no data");
    const data = await res.json();
    if (!data.candles || !data.candles.length) throw new Error("empty");
    drawSparkline(canvas, data.candles);
  } catch {
    loading.classList.add("hidden");
    if (_detailSym === sym) empty.classList.remove("hidden");
  }
}

function drawSparkline(canvas, candles) {
  if (!candles || candles.length < 2) return;

  const dpr = window.devicePixelRatio || 1;
  const W   = canvas.offsetWidth;
  const H   = canvas.offsetHeight;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;

  const ctx = canvas.getContext("2d");
  ctx.scale(dpr, dpr);

  const closes = candles.map(c => c.c).filter(v => v != null);
  if (closes.length < 2) return;

  const minV  = Math.min(...closes);
  const maxV  = Math.max(...closes);
  const range = maxV - minV || 1;
  const isUp  = closes[closes.length - 1] >= closes[0];

  const pad    = { top: 12, bottom: 8, left: 2, right: 2 };
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  const pts = closes.map((v, i) => ({
    x: pad.left + (i / (closes.length - 1)) * chartW,
    y: pad.top  + (1 - (v - minV) / range) * chartH
  }));

  const grad = ctx.createLinearGradient(0, pad.top, 0, H - pad.bottom);
  grad.addColorStop(0, isUp ? "rgba(0,230,118,0.32)" : "rgba(255,77,77,0.32)");
  grad.addColorStop(1, isUp ? "rgba(0,230,118,0.02)" : "rgba(255,77,77,0.02)");

  ctx.beginPath();
  ctx.moveTo(pts[0].x, H - pad.bottom);
  ctx.lineTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.lineTo(pts[pts.length - 1].x, H - pad.bottom);
  ctx.closePath();
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.strokeStyle = isUp ? "#00e676" : "#ff4d4d";
  ctx.lineWidth   = 2;
  ctx.lineJoin    = "round";
  ctx.lineCap     = "round";
  ctx.stroke();
}

function detailAddToPortfolio() {
  const sym = _detailSym;
  closeDetailSheet();
  setTimeout(() => {
    if (typeof openTradeModal === "function") {
      openTradeModal();
      const inp = document.getElementById("trade-ticker-input");
      if (inp && sym) {
        inp.value = sym;
        if (typeof onTradeTickerInput === "function") onTradeTickerInput(sym);
      }
    }
  }, 350);
}

function detailRemove() {
  if (!_detailSym) return;
  const sym = _detailSym;
  closeDetailSheet();
  setTimeout(() => deleteAsset(sym), 310);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

fetchRates();
updateCurrencyBtn();
applyColumns(trackerColumns);
loadAssets();
setInterval(loadAssets, 60000);
