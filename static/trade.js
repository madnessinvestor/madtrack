// ─── Trade Tab ────────────────────────────────────────────────────────────────

let cachedPortfolio = [];
let tradeSearchTimeout   = null;
let tradeSuggestTimeout  = null;
let tradeSearchSeq       = 0;
let tradeActiveIndex     = -1;
let tradeSuggestions     = [];
let tradeFetchedPrice    = null;
let tradePendingTicker   = null;

// ─── Tab switching ────────────────────────────────────────────────────────────

function switchTab(tab) {
  const isTracker = tab === "tracker";

  document.getElementById("section-tracker").classList.toggle("hidden", !isTracker);
  document.getElementById("section-trade").classList.toggle("hidden",   isTracker);

  document.getElementById("tab-tracker").classList.toggle("active", isTracker);
  document.getElementById("tab-trade").classList.toggle("active",   !isTracker);

  document.getElementById("btn-add-tracker").classList.toggle("hidden", !isTracker);
  document.getElementById("btn-add-trade").classList.toggle("hidden",    isTracker);

  if (!isTracker && !cachedPortfolio.length) {
    loadPortfolio();
  }
}

// ─── Portfolio loading ────────────────────────────────────────────────────────

async function loadPortfolio() {
  const list = document.getElementById("portfolio-list");
  const summary = document.getElementById("portfolio-summary");
  list.innerHTML = `<div class="loading">${t("loading")}</div>`;

  try {
    const res = await fetch("/api/portfolio");
    const tokens = await res.json();
    cachedPortfolio = tokens;
    renderPortfolio(tokens);
  } catch {
    list.innerHTML = `<div class="empty-state"><p>${t("error_load")}</p></div>`;
  }
}

function calcToken(t_) {
  const trades = t_.trades || [];
  let total_qty = 0, total_invested = 0;
  for (const tr of trades) {
    total_qty      += tr.qty;
    total_invested += tr.qty * tr.price_paid;
  }
  const avg_price = total_qty > 0 ? total_invested / total_qty : 0;
  const cur_price = t_.current_price || 0;
  const cur_value = total_qty * cur_price;
  const pnl       = cur_value - total_invested;
  const pnl_pct   = total_invested > 0 ? (pnl / total_invested) * 100 : 0;
  return { total_qty, total_invested, avg_price, cur_value, pnl, pnl_pct };
}

function renderPortfolio(tokens) {
  const list    = document.getElementById("portfolio-list");
  const summary = document.getElementById("portfolio-summary");

  // Update summary labels (language may have changed)
  const sumLabels = document.querySelectorAll(".psum-label");
  if (sumLabels[0]) sumLabels[0].textContent = t("invested");
  if (sumLabels[1]) sumLabels[1].textContent = t("cur_value");
  if (sumLabels[2]) sumLabels[2].textContent = t("pnl");

  let tot_inv = 0, tot_val = 0, tot_pnl = 0;
  for (const tok of tokens) {
    const c = calcToken(tok);
    tot_inv += c.total_invested;
    tot_val += c.cur_value;
    tot_pnl += c.pnl;
  }
  const tot_pnl_pct = tot_inv > 0 ? (tot_pnl / tot_inv) * 100 : 0;
  const pnlSign  = tot_pnl >= 0 ? "+" : "";
  const pnlColor = tot_pnl >= 0 ? "var(--accent)" : "var(--red)";

  document.getElementById("psum-invested").textContent = formatUSD(tot_inv);
  document.getElementById("psum-value").textContent    = formatUSD(tot_val);
  const pnlEl = document.getElementById("psum-pnl");
  pnlEl.textContent = `${pnlSign}${formatUSD(tot_pnl)} (${pnlSign}${tot_pnl_pct.toFixed(2)}%)`;
  pnlEl.style.color = pnlColor;
  summary.classList.remove("hidden");

  if (!tokens.length) {
    list.innerHTML = `<div class="empty-state">
      <div class="empty-icon">💼</div>
      <p>${t("empty_trade")}</p>
    </div>`;
    return;
  }

  const header = `<div class="ptable-header">
    <div class="ptcol ptcol-asset">${t("p_asset")}</div>
    <div class="ptcol ptcol-invested">${t("p_invested")}</div>
    <div class="ptcol ptcol-value">${t("cur_value")}</div>
    <div class="ptcol ptcol-perf">${t("p_performance")}</div>
  </div>`;

  list.innerHTML = header + tokens.map(tok => portfolioCardHTML(tok)).join("");
  loadPortfolioIcons(tokens);
}

function portfolioCardHTML(tok) {
  const { total_qty, total_invested, avg_price, cur_value, pnl, pnl_pct } = calcToken(tok);
  const sym      = tok.ticker;
  const hasPrice = tok.current_price != null;
  const pnlSign  = pnl >= 0 ? "+" : "";
  const pnlCls   = pnl >= 0 ? "up" : "down";
  const pnlArrow = pnl >= 0 ? "▲" : "▼";

  const be_dist     = hasPrice && avg_price > 0 ? ((tok.current_price / avg_price) - 1) * 100 : null;
  const beCls       = be_dist === null ? "" : (be_dist >= 0 ? "up" : "down");
  const beSign      = be_dist !== null && be_dist >= 0 ? "+" : "";
  const beDistHTML  = be_dist !== null
    ? `<span class="pdetail-val ${beCls}">${beSign}${be_dist.toFixed(2)}%</span>`
    : `<span class="pdetail-val">—</span>`;

  const tradesHTML = (tok.trades || []).map((tr, idx) => `
    <div class="trade-row">
      <div class="trade-row-left">
        <span class="trade-row-date">${tr.date || "—"}</span>
        <span class="trade-row-qty">${fmtQty(tr.qty)} × ${formatUSD(tr.price_paid)}</span>
      </div>
      <div class="trade-row-right">
        <span class="trade-row-total">${formatUSD(tr.qty * tr.price_paid)}</span>
        <button class="trade-row-del" onclick="deletePortfolioTrade('${sym}',${idx},event)" title="Remover">✕</button>
      </div>
    </div>`).join("");

  return `<div class="asset-card expandable portfolio-card" data-pticker="${sym}" onclick="togglePortfolioCard(this,event)">
    <div class="ptrow">
      <div class="ptcol ptcol-asset">
        <div class="asset-icon portfolio-icon" data-pticker="${sym}">
          <img class="icon-img" alt="" />
          <span class="icon-text">${sym.slice(0,4)}</span>
        </div>
        <div class="ptcol-asset-info">
          <span class="asset-symbol">${sym}</span>
          <span class="ptcol-asset-price">${hasPrice ? formatUSD(tok.current_price) : "—"}</span>
        </div>
      </div>
      <div class="ptcol ptcol-invested">${formatUSD(total_invested)}</div>
      <div class="ptcol ptcol-value">${hasPrice ? formatUSD(cur_value) : "—"}</div>
      <div class="ptcol ptcol-perf">
        ${hasPrice
          ? `<span class="change ${pnlCls}">${pnlSign}${formatUSD(pnl)} (${pnlSign}${Math.abs(pnl_pct).toFixed(2)}%) ${pnlArrow}</span>`
          : "<span>—</span>"}
        <span class="card-chevron">›</span>
      </div>
    </div>

    <div class="card-details portfolio-details">
      <div class="pdetail-stats">
        <div class="pdetail-item">
          <span class="pdetail-label">${t("p_breakeven")}</span>
          ${beDistHTML}
        </div>
        <div class="pdetail-item">
          <span class="pdetail-label">${t("p_qty")}</span>
          <span class="pdetail-val">${fmtQty(total_qty)}</span>
        </div>
        <div class="pdetail-item">
          <span class="pdetail-label">${t("p_avg")}</span>
          <span class="pdetail-val">${formatUSD(avg_price)}</span>
        </div>
      </div>

      <div class="trade-history-wrap">
        <div class="trade-history-title">${t("p_history")}</div>
        ${tradesHTML || `<div class="trade-empty">${t("p_no_trades")}</div>`}
      </div>

      <div class="portfolio-actions">
        <button class="btn-portfolio-add" onclick="openTradeModalFor('${sym}',event)">${t("p_add_trade")}</button>
        <button class="btn-portfolio-del" onclick="deletePortfolioToken('${sym}',event)">${t("p_remove")}</button>
      </div>
    </div>
  </div>`;
}

function fmtQty(v) {
  if (v === null || v === undefined) return "—";
  if (v >= 1000) return v.toLocaleString("en-US", { maximumFractionDigits: 4 });
  if (v >= 1)    return v.toFixed(4).replace(/\.?0+$/, "");
  return v.toPrecision(6).replace(/\.?0+$/, "");
}

function togglePortfolioCard(card, e) {
  if (e.target.closest(".btn-portfolio-add") || e.target.closest(".btn-portfolio-del") || e.target.closest(".trade-row-del")) return;
  card.classList.toggle("open");
}

function loadPortfolioIcons(tokens) {
  tokens.forEach(tok => {
    const sym  = tok.ticker;
    const wrap = document.querySelector(`.portfolio-icon[data-pticker="${sym}"]`);
    if (!wrap) return;
    const img  = wrap.querySelector(".icon-img");
    const text = wrap.querySelector(".icon-text");
    applyAvatar(wrap, sym);
    if (tok.icon_url) {
      tryLoadImage(img, text, tok.icon_url, () => tryCryptoIcon(img, text, sym));
    } else {
      tryCryptoIcon(img, text, sym);
    }
  });
}

// ─── Delete actions ───────────────────────────────────────────────────────────

async function deletePortfolioToken(ticker, e) {
  e.stopPropagation();
  if (!confirm(t("confirm_remove_token", ticker))) return;
  await fetch(`/api/portfolio/${encodeURIComponent(ticker)}`, { method: "DELETE" });
  loadPortfolio();
}

async function deletePortfolioTrade(ticker, idx, e) {
  e.stopPropagation();
  if (!confirm(t("confirm_remove_trade"))) return;
  await fetch(`/api/portfolio/${encodeURIComponent(ticker)}/trade/${idx}`, { method: "DELETE" });
  loadPortfolio();
}

// ─── Trade modal ──────────────────────────────────────────────────────────────

function openTradeModal(prefillTicker) {
  tradePendingTicker  = null;
  tradeFetchedPrice   = null;
  tradeActiveIndex    = -1;
  tradeSuggestions    = [];

  const tickerInput = document.getElementById("trade-ticker-input");
  tickerInput.value    = prefillTicker || "";
  tickerInput.disabled = !!prefillTicker;
  tickerInput.placeholder = t("trade_ticker_ph");

  document.getElementById("trade-qty").value   = "";
  document.getElementById("trade-price").value = "";
  document.getElementById("trade-date").value  = nowStr();
  document.getElementById("trade-error").classList.add("hidden");
  document.getElementById("trade-suggestions").classList.add("hidden");
  document.getElementById("trade-price-preview").classList.add("hidden");
  document.getElementById("trade-total-preview").classList.add("hidden");
  document.getElementById("trade-modal").classList.remove("hidden");

  if (prefillTicker) {
    tradePendingTicker = prefillTicker.toUpperCase();
    fetchTradePrice(tradePendingTicker);
  } else {
    setTimeout(() => tickerInput.focus(), 80);
  }
}

function openTradeModalFor(ticker, e) {
  e.stopPropagation();
  openTradeModal(ticker);
}

function closeTradeModal() {
  document.getElementById("trade-modal").classList.add("hidden");
  clearTimeout(tradeSearchTimeout);
  clearTimeout(tradeSuggestTimeout);
  document.getElementById("trade-suggestions").classList.add("hidden");
}

function nowStr() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// ─── Trade ticker search ──────────────────────────────────────────────────────

function onTradeTickerInput(val) {
  clearTimeout(tradeSearchTimeout);
  clearTimeout(tradeSuggestTimeout);
  const sym = val.trim().toUpperCase();
  tradePendingTicker = null;
  tradeFetchedPrice  = null;
  document.getElementById("trade-price-preview").classList.add("hidden");
  document.getElementById("trade-suggestions").classList.add("hidden");
  if (!sym) return;

  tradeSuggestTimeout = setTimeout(() => fetchTradeSuggestions(sym), 150);
  const seq = ++tradeSearchSeq;
  document.getElementById("trade-search-spinner").classList.remove("hidden");
  tradeSearchTimeout = setTimeout(() => fetchTradePrice(sym, seq), 700);
}

async function fetchTradeSuggestions(sym) {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(sym)}`);
    if (!res.ok) return;
    tradeSuggestions = await res.json();
    renderTradeSuggestions(tradeSuggestions);
  } catch {}
}

function renderTradeSuggestions(items) {
  const el = document.getElementById("trade-suggestions");
  if (!items.length) { el.classList.add("hidden"); return; }
  el.innerHTML = items.map((item, i) =>
    `<div class="suggestion-item" data-i="${i}" onclick="selectTradeSuggestion('${item.symbol}')">
      <span class="suggestion-sym">${item.symbol}</span>
      <span class="suggestion-ex">${item.exchange || ""}</span>
    </div>`).join("");
  el.classList.remove("hidden");
}

function selectTradeSuggestion(sym) {
  document.getElementById("trade-ticker-input").value = sym;
  document.getElementById("trade-suggestions").classList.add("hidden");
  clearTimeout(tradeSearchTimeout);
  clearTimeout(tradeSuggestTimeout);
  const seq = ++tradeSearchSeq;
  document.getElementById("trade-search-spinner").classList.remove("hidden");
  fetchTradePrice(sym, seq);
}

function onTradeTickerKey(e) {
  const el    = document.getElementById("trade-suggestions");
  const items = el.querySelectorAll(".suggestion-item");
  if (!items.length) return;
  if (e.key === "ArrowDown") {
    e.preventDefault();
    tradeActiveIndex = Math.min(tradeActiveIndex + 1, items.length - 1);
  } else if (e.key === "ArrowUp") {
    e.preventDefault();
    tradeActiveIndex = Math.max(tradeActiveIndex - 1, -1);
  } else if (e.key === "Enter" && tradeActiveIndex >= 0) {
    e.preventDefault();
    const sym = tradeSuggestions[tradeActiveIndex]?.symbol;
    if (sym) selectTradeSuggestion(sym);
    return;
  } else if (e.key === "Escape") {
    el.classList.add("hidden"); return;
  } else return;
  items.forEach((item, i) => item.classList.toggle("active", i === tradeActiveIndex));
}

async function fetchTradePrice(sym, seq) {
  try {
    const res = await fetch(`/api/price?symbol=${encodeURIComponent(sym)}`);
    if (seq !== undefined && seq !== tradeSearchSeq) return;
    document.getElementById("trade-search-spinner").classList.add("hidden");
    if (res.ok) {
      const d = await res.json();
      tradeFetchedPrice  = d.price;
      tradePendingTicker = sym;
      document.getElementById("trade-cur-price").textContent = formatUSD(d.price);
      document.getElementById("trade-price-preview").classList.remove("hidden");
      const priceInput = document.getElementById("trade-price");
      if (!priceInput.value) priceInput.value = d.price;
      updateTradePreview();
    }
  } catch {
    document.getElementById("trade-search-spinner").classList.add("hidden");
  }
}

function updateTradePreview() {
  const qty   = parseFloat(document.getElementById("trade-qty").value);
  const price = parseFloat(document.getElementById("trade-price").value);
  const prev  = document.getElementById("trade-total-preview");
  if (!isNaN(qty) && !isNaN(price) && qty > 0 && price > 0) {
    document.getElementById("trade-total-val").textContent = formatUSD(qty * price);
    prev.classList.remove("hidden");
  } else {
    prev.classList.add("hidden");
  }
}

async function submitTrade() {
  const errEl  = document.getElementById("trade-error");
  const ticker = (document.getElementById("trade-ticker-input").value || tradePendingTicker || "").trim().toUpperCase();
  const qty    = parseFloat(document.getElementById("trade-qty").value);
  const price  = parseFloat(document.getElementById("trade-price").value);
  const date   = document.getElementById("trade-date").value.trim();

  errEl.classList.add("hidden");

  if (!ticker) { errEl.textContent = t("err_ticker"); errEl.classList.remove("hidden"); return; }
  if (isNaN(qty) || qty <= 0) { errEl.textContent = t("err_qty"); errEl.classList.remove("hidden"); return; }
  if (isNaN(price) || price <= 0) { errEl.textContent = t("err_price"); errEl.classList.remove("hidden"); return; }

  const res = await fetch("/api/portfolio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, qty, price_paid: price, date })
  });
  const data = await res.json();
  if (data.ok) {
    closeTradeModal();
    loadPortfolio();
  } else {
    errEl.textContent = data.error || t("err_save");
    errEl.classList.remove("hidden");
  }
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeTradeModal();
});

setInterval(() => {
  const tradeSection = document.getElementById("section-trade");
  if (!tradeSection.classList.contains("hidden")) loadPortfolio();
}, 60000);
