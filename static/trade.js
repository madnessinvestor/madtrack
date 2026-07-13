// ─── Trade Tab ────────────────────────────────────────────────────────────────

// ─── TX Hash Lookup ───────────────────────────────────────────────────────────

let _txHashTimer    = null;
let _selectedHashNet = "";

function selectHashNet(btn, net) {
  document.querySelectorAll(".hash-net-chip").forEach(c => c.classList.remove("active"));
  if (btn) btn.classList.add("active");
  _selectedHashNet = net;
  const hash = document.getElementById("trade-hash-input")?.value?.trim();
  if (hash && hash.length >= 20) {
    clearTimeout(_txHashTimer);
    _txHashTimer = setTimeout(() => _lookupTxHash(hash), 300);
  }
}

const _EVM_NETS = ['hyperevm','ethereum','base','arbitrum','optimism','bsc','polygon','avalanche','zksync','linea','scroll','mantle'];

function syncHashCatFromNet(net) {
  let cat = "auto";
  if (net === "solana")        cat = "solana";
  else if (net === "bitcoin")  cat = "bitcoin";
  else if (_EVM_NETS.includes(net)) cat = "evm";
  else if (net)                cat = "other";
  document.querySelectorAll(".hash-cat-btn").forEach(c =>
    c.classList.toggle("active", c.dataset.cat === cat));
  const evmSubrow = document.getElementById("hash-evm-subrow");
  if (cat === "evm") evmSubrow?.classList.remove("hidden");
  else               evmSubrow?.classList.add("hidden");
}

function selectHashCat(btn, cat) {
  document.querySelectorAll(".hash-cat-btn").forEach(c => c.classList.remove("active"));
  btn.classList.add("active");
  const evmSubrow = document.getElementById("hash-evm-subrow");
  document.querySelectorAll(".hash-net-chip").forEach(c => c.classList.remove("active"));
  if (cat === "evm") {
    evmSubrow?.classList.remove("hidden");
    _selectedHashNet = "";          // let user pick a sub-chip
  } else {
    evmSubrow?.classList.add("hidden");
    if      (cat === "auto")    _selectedHashNet = "";
    else if (cat === "solana")  _selectedHashNet = "solana";
    else if (cat === "bitcoin") _selectedHashNet = "bitcoin";
    else if (cat === "other")   _selectedHashNet = "other";
  }
  const hash = document.getElementById("trade-hash-input")?.value?.trim();
  if (hash && hash.length >= 20) {
    clearTimeout(_txHashTimer);
    _txHashTimer = setTimeout(() => _lookupTxHash(hash), 300);
  }
}

// Map of URL hostname patterns → network chip key
const _EXPLORER_DOMAINS = {
  'etherscan.io':             'ethereum',
  'basescan.org':             'base',
  'arbiscan.io':              'arbitrum',
  'optimistic.etherscan.io':  'optimism',
  'bscscan.com':              'bsc',
  'polygonscan.com':          'polygon',
  'snowtrace.io':             'avalanche',
  'avascan.info':             'avalanche',
  'explorer.zksync.io':       'zksync',
  'era.zksync.network':       'zksync',
  'lineascan.build':          'linea',
  'scrollscan.com':           'scroll',
  'explorer.mantle.xyz':      'mantle',
  'hyperevmscan.io':          'hyperevm',
  'mempool.space':            'bitcoin',
  'blockchair.com':           'bitcoin',
  'solscan.io':               'solana',
  'explorer.solana.com':      'solana',
  'solana.fm':                'solana',
};

function _netFromUrl(raw) {
  try {
    const url = raw.includes('://') ? raw : 'https://' + raw;
    const host = new URL(url).hostname.replace(/^www\./, '');
    for (const [domain, net] of Object.entries(_EXPLORER_DOMAINS)) {
      if (host === domain || host.endsWith('.' + domain)) return net;
    }
  } catch (_) {}
  return null;
}

function _extractHash(raw) {
  // Accept full explorer URLs like https://etherscan.io/tx/0xABC... or hyperevmscan.io/tx/...
  const m = raw.match(/(?:\/tx\/|[?&]tx=)(0x[0-9a-fA-F]+|[0-9a-fA-F]{40,})/i);
  if (m) return m[1];
  // Or just a raw hex / base58 string
  return raw.trim();
}

function onTxHashInput(val) {
  clearTimeout(_txHashTimer);
  const result  = document.getElementById("trade-hash-result");
  const raw = val || "";

  // Auto-select network chip when a known explorer URL is pasted
  const detectedNet = _netFromUrl(raw);
  if (detectedNet) {
    const chips = document.querySelectorAll(".hash-net-chip");
    chips.forEach(c => {
      const onclick = c.getAttribute("onclick") || "";
      const m = onclick.match(/'([^']*)'\)/);
      const chipNet = m ? m[1] : "";
      const active = chipNet === detectedNet;
      c.classList.toggle("active", active);
      if (active) _selectedHashNet = chipNet;
    });
    syncHashCatFromNet(detectedNet);
  }

  const extracted = _extractHash(raw);
  if (!extracted || extracted.length < 20) {
    result?.classList.add("hidden");
    return;
  }
  _txHashTimer = setTimeout(() => _lookupTxHash(extracted), 700);
}

async function _lookupTxHash(hash) {
  const spinner = document.getElementById("trade-hash-spinner");
  const result  = document.getElementById("trade-hash-result");
  spinner?.classList.remove("hidden");
  result?.classList.add("hidden");
  try {
    const netParam = _selectedHashNet ? `&network=${encodeURIComponent(_selectedHashNet)}` : "";
    const res  = await fetch(`/api/tx-lookup?hash=${encodeURIComponent(hash)}${netParam}`);
    const data = await res.json();
    spinner?.classList.add("hidden");
    if (!res.ok || data.error) {
      _showHashError(data.error);
      return;
    }
    _applyTxResult(data);
  } catch (e) {
    spinner?.classList.add("hidden");
  }
}

function _showHashError(errKey) {
  const result = document.getElementById("trade-hash-result");
  if (!result) return;
  const msgs = {
    not_found:   t("hash_not_found"),
    hash_format: t("hash_format_err"),
    swap_complex:t("hash_complex"),
    no_hash:     t("hash_format_err"),
  };
  result.className = "hash-result hash-error-box";
  result.innerHTML = `<span class="hash-err-msg">${msgs[errKey] || t("hash_not_found")}</span>`;
  result.classList.remove("hidden");
}

function _applyTxResult(data) {
  const result = document.getElementById("trade-hash-result");

  // Use native token as ticker/qty fallback when token swap info isn't available
  const effectiveTicker = data.ticker || data.native_sym || "";
  const effectiveQty    = (data.qty != null) ? data.qty : (data.native_amount != null ? data.native_amount : null);

  // Fill ticker
  if (effectiveTicker) {
    const tickerEl = document.getElementById("trade-ticker-input");
    if (tickerEl && !tickerEl.disabled) {
      tickerEl.value = effectiveTicker;
      onTradeTickerInput(effectiveTicker);
    }
  }

  // Fill qty
  if (effectiveQty != null) {
    const qtyEl = document.getElementById("trade-qty");
    if (qtyEl) qtyEl.value = effectiveQty;
  }

  // Fill price per token + total investment
  if (data.total_usd && effectiveQty) {
    // Price per token = total paid / quantity received
    const pricePerToken = data.total_usd / effectiveQty;
    const priceEl = document.getElementById("trade-price");
    if (priceEl) priceEl.value = pricePerToken.toPrecision(8).replace(/\.?0+$/, "");

    const invEl = document.getElementById("trade-investment");
    if (invEl) invEl.value = data.total_usd;

    tradeLastEdited = "price";
    updateTradePreview();
  } else if (effectiveQty != null) {
    tradeLastEdited = "qty";
    updateTradePreview();
  }

  // Fill date
  if (data.timestamp) {
    const dateEl = document.getElementById("trade-date");
    if (dateEl) dateEl.value = data.timestamp;
  }

  // Store full result for counterpart-trade logic in submitTrade
  _currentHashData   = data;
  _currentHashIsSell = !!data.is_sell;
  _updateConfirmBtn();

  // Show result card
  if (!result) return;
  const isSwap = !!data.is_swap && data.from_ticker;
  const tradeTypeLabel = isSwap ? "🔄 TROCA" : (data.is_sell ? "🔴 VENDA" : "🟢 COMPRA");
  let html = `<span class="hash-network-badge">🔗 ${data.network || "?"}</span>`;
  html += `<span class="hash-trade-type ${isSwap ? "swap" : (data.is_sell ? "sell" : "buy")}">${tradeTypeLabel}</span>`;
  const details = [];
  if (isSwap && data.from_qty) {
    // Token-for-token swap: show both legs
    details.push(`<span class="hash-detail-item">${fmtQty(data.from_qty)} ${data.from_ticker} → <strong>${fmtQty(data.qty)} ${data.ticker}</strong></span>`);
  } else if (data.is_sell && data.received_ticker && data.received_qty) {
    // Sell: show "sold → received stablecoin" on a single line
    details.push(`<span class="hash-detail-item">${fmtQty(data.qty)} ${data.ticker} → <strong>${fmtQty(data.received_qty)} ${data.received_ticker}</strong></span>`);
  } else if (data.ticker && data.qty) {
    details.push(`<span class="hash-detail-item">${t("qty_label")}: <strong>${fmtQty(data.qty)} ${data.ticker}</strong></span>`);
  }
  if (data.total_usd) {
    const usdLabel = isSwap ? "Valor (USD)" : (data.is_sell ? "Recebido" : t("investment_label"));
    const estTag = data.total_usd_estimated ? " ~" : "";
    details.push(`<span class="hash-detail-item">${usdLabel}${estTag}: <strong>${formatUSD(data.total_usd, true)}</strong></span>`);
  } else if (data.native_sym && data.native_amount) {
    details.push(`<span class="hash-detail-item">Pago: <strong>${data.native_amount} ${data.native_sym}</strong></span>`);
  }
  if (data.timestamp) {
    details.push(`<span class="hash-detail-item">📅 <strong>${data.timestamp}</strong></span>`);
  }
  if (details.length) html += `<div class="hash-detail-row">${details.join("")}</div>`;
  if (data.note === "btc_outputs") {
    html += `<div class="hash-note">⚠️ ${t("hash_btc_note")}</div>`;
  } else if (!data.total_usd && (data.native_sym || !data.qty)) {
    html += `<div class="hash-note">⚠️ ${t("hash_native_note")}</div>`;
  } else if (data.total_usd_estimated) {
    html += `<div class="hash-note">ℹ️ Valor em USD estimado pelo preço atual do token.</div>`;
  }
  result.className = "hash-result";
  result.innerHTML = html;
  result.classList.remove("hidden");
}

function _updateConfirmBtn() {
  const btn = document.querySelector("#trade-modal .btn-confirm");
  if (!btn) return;
  const key = _currentHashIsSell ? "confirm_sell" : "confirm_trade";
  btn.innerHTML = `✓ ${t(key)}`;
}

// ─── Portfolio vars ───────────────────────────────────────────────────────────

let cachedPortfolio = [];
let tradeSearchTimeout   = null;
let tradeSuggestTimeout  = null;
let tradeSearchSeq       = 0;
let tradeActiveIndex     = -1;
let tradeSuggestions     = [];
let tradeFetchedPrice    = null;
let tradePendingTicker   = null;
let tradeMode            = "unit"; // "unit" | "total"
let tradeLastEdited      = "price"; // "price" | "investment" — for bidirectional sync
let _currentHashIsSell   = false;  // true when tx lookup detected a sell
let _currentHashData     = null;   // full tx-lookup response, used to auto-add counterpart leg

function setTradeMode(mode) {
  tradeMode = mode;
  tradeLastEdited = "price";
  document.getElementById("trade-mode-unit").classList.toggle("active",  mode === "unit");
  document.getElementById("trade-mode-total").classList.toggle("active", mode === "total");
  document.getElementById("trade-col-price").classList.toggle("hidden",    mode === "total");
  document.getElementById("trade-col-totalpaid").classList.toggle("hidden", mode === "unit");
  document.getElementById("trade-row-investment").classList.toggle("hidden", mode === "total");
  document.getElementById("trade-total-preview").classList.add("hidden");
  document.getElementById("trade-derived-preview").classList.add("hidden");
  document.getElementById("trade-pnl-preview")?.classList.add("hidden");
  const sym = typeof currSym === "function" ? currSym() : "$";
  document.getElementById("trade-totalpaid-label").textContent =
    t("totalpaid_label") + " (" + sym + ")";
  updateTradePreview();
}

function onTradeQtyInput() {
  if (tradeMode !== "unit") { updateTradePreview(); return; }
  const qty   = parseFloat(document.getElementById("trade-qty").value);
  if (tradeLastEdited === "investment") {
    const inv = parseFloat(document.getElementById("trade-investment").value);
    if (!isNaN(qty) && !isNaN(inv) && qty > 0 && inv > 0) {
      document.getElementById("trade-price").value = (inv / qty).toPrecision(8).replace(/\.?0+$/, "");
    }
  } else {
    const price = parseFloat(document.getElementById("trade-price").value);
    if (!isNaN(qty) && !isNaN(price) && qty > 0 && price > 0) {
      document.getElementById("trade-investment").value = (qty * price).toFixed(2);
    }
  }
  updateTradePreview();
}

function onTradePriceInput() {
  tradeLastEdited = "price";
  const qty   = parseFloat(document.getElementById("trade-qty").value);
  const price = parseFloat(document.getElementById("trade-price").value);
  if (!isNaN(qty) && !isNaN(price) && qty > 0 && price > 0) {
    document.getElementById("trade-investment").value = (qty * price).toFixed(2);
  } else {
    document.getElementById("trade-investment").value = "";
  }
  updateTradePreview();
}

function onTradeInvestmentInput() {
  tradeLastEdited = "investment";
  const qty = parseFloat(document.getElementById("trade-qty").value);
  const inv = parseFloat(document.getElementById("trade-investment").value);
  if (!isNaN(qty) && !isNaN(inv) && qty > 0 && inv > 0) {
    document.getElementById("trade-price").value = (inv / qty).toPrecision(8).replace(/\.?0+$/, "");
  } else {
    document.getElementById("trade-price").value = "";
  }
  updateTradePreview();
}

// ─── Tab switching ────────────────────────────────────────────────────────────

function switchTab(tab) {
  const isTracker   = tab === "tracker";
  const isTrade     = tab === "trade";
  const isAi        = tab === "ai";
  const isDashboard = tab === "dashboard";
  const isWidget    = tab === "widget";

  document.getElementById("section-tracker").classList.toggle("hidden", !isTracker);
  document.getElementById("section-trade").classList.toggle("hidden",   !isTrade);
  const aiSection     = document.getElementById("section-ai");
  if (aiSection) aiSection.classList.toggle("hidden", !isAi);
  const dashSection   = document.getElementById("section-dashboard");
  if (dashSection) dashSection.classList.toggle("hidden", !isDashboard);
  const widgetSection = document.getElementById("section-widget");
  if (widgetSection) widgetSection.classList.toggle("hidden", !isWidget);

  document.getElementById("tab-tracker").classList.toggle("active", isTracker);
  document.getElementById("tab-trade").classList.toggle("active",   isTrade);
  const aiTab     = document.getElementById("tab-ai");
  if (aiTab) aiTab.classList.toggle("active", isAi);
  const dashTab   = document.getElementById("tab-dashboard");
  if (dashTab) dashTab.classList.toggle("active", isDashboard);
  const widgetTab = document.getElementById("tab-widget");
  if (widgetTab) widgetTab.classList.toggle("active", isWidget);

  if (isWidget) widgetOnEnter();
  else if (typeof wltTimer !== "undefined" && wltTimer) { clearInterval(wltTimer); wltTimer = null; }

  document.getElementById("btn-add-tracker").classList.toggle("hidden", !isTracker);
  document.getElementById("btn-add-trade").classList.toggle("hidden",    !isTrade);
  document.getElementById("btn-export-trades")?.classList.toggle("hidden", !isTrade);

  if (isTrade && !cachedPortfolio.length) loadPortfolio();
  if (isDashboard) {
    if (!dashLoaded) {
      loadDashboard();
    } else {
      // Re-render from cache immediately for instant feedback, then refresh
      // prices in background so the user always sees up-to-date data on entry.
      if (typeof renderDashboard    === "function") renderDashboard();
      if (typeof refreshAllWallets  === "function") refreshAllWallets();
    }
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

  list.innerHTML = tokens.map(tok => portfolioCardHTML(tok)).join("");
  loadPortfolioIcons(tokens);
  if (typeof updateCardAlertBadges === "function") updateCardAlertBadges();
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

  const tradesHTML = (tok.trades || []).map((tr, idx) => {
    const isSell  = tr.qty < 0;
    const absQty  = Math.abs(tr.qty);
    const total   = absQty * tr.price_paid;
    const badge   = isSell
      ? `<span class="trade-row-badge sell">${t("p_sell_badge")}</span>`
      : "";
    const confirmKey = isSell ? "confirm_remove_trade_sell" : "confirm_remove_trade";
    return `
    <div class="trade-row${isSell ? " trade-row-sell" : ""}">
      <div class="trade-row-left">
        <span class="trade-row-date">${tr.date || "—"}${badge}</span>
        <span class="trade-row-qty">${fmtQty(absQty)} × ${formatUSD(tr.price_paid)}</span>
      </div>
      <div class="trade-row-right">
        <span class="trade-row-total${isSell ? " sell-total" : ""}">${isSell ? "+" : ""}${formatUSD(total)}</span>
        <button class="trade-row-del" onclick="deletePortfolioTrade('${sym}',${idx},event,'${confirmKey}')" title="Remover">✕</button>
      </div>
    </div>`;
  }).join("");

  return `<div class="asset-card expandable portfolio-card" data-pticker="${sym}" onclick="togglePortfolioCard(this,event)">
    <div class="card-top">
      <div class="asset-left">
        <div class="asset-icon portfolio-icon" data-pticker="${sym}">
          <img class="icon-img" alt="" />
          <span class="icon-text">${sym.slice(0,4)}</span>
        </div>
        <div class="asset-name-wrap">
          <div class="asset-symbol">${sym}</div>
          <div class="asset-source asset-cur-price">${hasPrice ? formatUSD(tok.current_price) : "—"}</div>
          <div class="asset-source">${fmtQty(total_qty)} ${sym}</div>
          <div class="card-alert-badges" data-sym="${sym}"></div>
        </div>
      </div>
      <div class="asset-right">
        <div class="asset-price">${hasPrice ? formatUSD(cur_value) : "—"}</div>
        ${hasPrice
          ? `<span class="change ${pnlCls}">${pnlSign}${formatUSD(pnl)} (${pnlSign}${pnl_pct.toFixed(2)}%)</span>`
          : ""}
      </div>
      <span class="card-chevron">›</span>
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
        <div class="pdetail-item">
          <span class="pdetail-label">${t("p_cur_price")}</span>
          <span class="pdetail-val">${hasPrice ? formatUSD(tok.current_price) : "—"}</span>
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

// ─── Export trades (CSV) ─────────────────────────────────────────────────────

function exportTrades() {
  const tokens = cachedPortfolio;
  if (!tokens || !tokens.length) {
    alert("Nenhum trade para exportar.");
    return;
  }

  const rows = [];
  // Header
  rows.push([
    "Ticker",
    "Data",
    "Tipo",
    "Quantidade",
    "Preço Pago (USD)",
    "Total (USD)",
    "Preço Médio (USD)",
    "Preço Atual (USD)",
    "Valor Atual (USD)",
    "P&L (USD)",
    "P&L (%)"
  ]);

  for (const tok of tokens) {
    const { total_qty, total_invested, avg_price, cur_value, pnl, pnl_pct } = calcToken(tok);
    const curPrice = tok.current_price != null ? tok.current_price : "";
    const trades   = tok.trades || [];

    for (const tr of trades) {
      const isSell  = tr.qty < 0;
      const absQty  = Math.abs(tr.qty);
      const total   = absQty * tr.price_paid;
      rows.push([
        tok.ticker,
        tr.date || "",
        isSell ? "Venda" : "Compra",
        absQty,
        tr.price_paid,
        isSell ? -total : total,
        avg_price.toFixed(8),
        curPrice !== "" ? curPrice.toFixed(8) : "",
        curPrice !== "" ? cur_value.toFixed(2) : "",
        curPrice !== "" ? pnl.toFixed(2) : "",
        curPrice !== "" ? pnl_pct.toFixed(2) : ""
      ]);
    }
  }

  const csvContent = rows.map(r =>
    r.map(v => {
      const s = String(v ?? "");
      return s.includes(",") || s.includes('"') || s.includes("\n")
        ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(",")
  ).join("\r\n");

  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  const now  = new Date();
  const pad  = n => String(n).padStart(2, "0");
  const ts   = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  a.href     = url;
  a.download = `cryptoaio_trades_${ts}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Delete actions ───────────────────────────────────────────────────────────

async function deletePortfolioToken(ticker, e) {
  e.stopPropagation();
  if (!confirm(t("confirm_remove_token", ticker))) return;
  await fetch(`/api/portfolio/${encodeURIComponent(ticker)}`, { method: "DELETE" });
  loadPortfolio();
}

async function deletePortfolioTrade(ticker, idx, e, confirmKey) {
  e.stopPropagation();
  const msgKey = confirmKey || "confirm_remove_trade";
  if (!confirm(t(msgKey))) return;
  await fetch(`/api/portfolio/${encodeURIComponent(ticker)}/trade/${idx}`, { method: "DELETE" });
  loadPortfolio();
}

// ─── Trade modal ──────────────────────────────────────────────────────────────

function openTradeModal(prefillTicker) {
  tradePendingTicker  = null;
  tradeFetchedPrice   = null;
  tradeActiveIndex    = -1;
  tradeSuggestions    = [];
  tradeMode           = "unit";

  const tickerInput = document.getElementById("trade-ticker-input");
  if (tickerInput) {
    tickerInput.value       = prefillTicker || "";
    tickerInput.disabled    = !!prefillTicker;
    tickerInput.placeholder = t("trade_ticker_ph");
  }

  tradeLastEdited    = "price";
  _currentHashIsSell = false;
  _currentHashData   = null;
  _selectedHashNet   = "";
  clearTimeout(_txHashTimer);
  const _v  = (id, val)  => { const el = document.getElementById(id); if (el) el.value = val; };
  const _add = (id, cls) => document.getElementById(id)?.classList.add(cls);
  const _rm  = (id, cls) => document.getElementById(id)?.classList.remove(cls);
  // reset network selector to Auto
  document.querySelectorAll(".hash-net-chip").forEach(c => c.classList.remove("active"));
  document.querySelectorAll(".hash-cat-btn").forEach((c, i) => c.classList.toggle("active", i === 0));
  document.getElementById("hash-evm-subrow")?.classList.add("hidden");
  _v("trade-hash-input", "");
  _v("trade-qty", "");
  _v("trade-price", "");
  _v("trade-total-paid", "");
  _v("trade-investment", "");
  _v("trade-date", nowStr());
  _add("trade-hash-result", "hidden");
  _add("trade-error",          "hidden");
  _add("trade-suggestions",    "hidden");
  _add("trade-price-preview",  "hidden");
  _add("trade-total-preview",  "hidden");
  _add("trade-derived-preview","hidden");
  _add("trade-pnl-preview",   "hidden");
  _rm ("trade-col-price",      "hidden");
  _add("trade-col-totalpaid",  "hidden");
  _rm ("trade-row-investment", "hidden");
  _add("trade-mode-unit",      "active");
  _rm ("trade-mode-total",     "active");
  _rm ("trade-modal",          "hidden");
  _updateConfirmBtn();

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
  document.getElementById("trade-modal")?.classList.add("hidden");
  clearTimeout(tradeSearchTimeout);
  clearTimeout(tradeSuggestTimeout);
  document.getElementById("trade-suggestions")?.classList.add("hidden");
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
      document.getElementById("trade-cur-price").textContent = formatUSD(d.price, true);
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
  const qty = parseFloat(document.getElementById("trade-qty").value);

  if (tradeMode === "unit") {
    const price = parseFloat(document.getElementById("trade-price").value);
    const inv   = parseFloat(document.getElementById("trade-investment").value);
    const totalPrev   = document.getElementById("trade-total-preview");
    const derivedPrev = document.getElementById("trade-derived-preview");

    if (tradeLastEdited === "investment" && !isNaN(qty) && !isNaN(inv) && qty > 0 && inv > 0) {
      // show "Preço por token" derived from investment
      const pricePerToken = inv / qty;
      document.getElementById("trade-derived-val").textContent = formatUSD(pricePerToken, true);
      derivedPrev.classList.remove("hidden");
      totalPrev.classList.add("hidden");
    } else if (!isNaN(qty) && !isNaN(price) && qty > 0 && price > 0) {
      // show "Total investido" derived from price
      document.getElementById("trade-total-val").textContent = formatUSD(qty * price, true);
      totalPrev.classList.remove("hidden");
      derivedPrev.classList.add("hidden");
    } else {
      totalPrev.classList.add("hidden");
      derivedPrev.classList.add("hidden");
    }
  } else {
    const totalPaid = parseFloat(document.getElementById("trade-total-paid").value);
    document.getElementById("trade-total-preview").classList.add("hidden");
    const derived   = document.getElementById("trade-derived-preview");
    const pnlPrev   = document.getElementById("trade-pnl-preview");
    if (!isNaN(qty) && !isNaN(totalPaid) && qty > 0 && totalPaid > 0) {
      const rate      = typeof getRate === "function" ? getRate() : 1;
      const costUsd   = totalPaid / rate;
      const priceUsd  = costUsd / qty;
      document.getElementById("trade-derived-val").textContent = formatUSD(priceUsd, true);
      derived.classList.remove("hidden");

      // P&L vs current market price
      if (tradeFetchedPrice) {
        const curValue = qty * tradeFetchedPrice;
        const pnl      = curValue - costUsd;
        const pnlPct   = (pnl / costUsd) * 100;
        const sign     = pnl >= 0 ? "+" : "";
        const cls      = pnl >= 0 ? "pnl-up" : "pnl-down";
        const arrow    = pnl >= 0 ? "▲" : "▼";
        const pnlValEl = document.getElementById("trade-pnl-val");
        if (pnlValEl) pnlValEl.innerHTML = `<span class="${cls}">${arrow} ${sign}${formatUSD(pnl)} (${sign}${pnlPct.toFixed(2)}%)</span>`;
        if (pnlPrev) pnlPrev.classList.remove("hidden");
      } else {
        if (pnlPrev) pnlPrev.classList.add("hidden");
      }

    } else {
      if (derived) derived.classList.add("hidden");
      if (pnlPrev) pnlPrev.classList.add("hidden");
    }
  }
}

async function submitTrade() {
  const errEl  = document.getElementById("trade-error");
  const ticker = (document.getElementById("trade-ticker-input").value || tradePendingTicker || "").trim().toUpperCase();
  const absQty = parseFloat(document.getElementById("trade-qty").value);
  const date   = document.getElementById("trade-date").value.trim();

  errEl.classList.add("hidden");

  if (!ticker) { errEl.textContent = t("err_ticker"); errEl.classList.remove("hidden"); return; }
  if (isNaN(absQty) || absQty <= 0) { errEl.textContent = t("err_qty"); errEl.classList.remove("hidden"); return; }

  let price;
  if (tradeMode === "unit") {
    price = parseFloat(document.getElementById("trade-price").value);
    if (isNaN(price) || price <= 0) { errEl.textContent = t("err_price"); errEl.classList.remove("hidden"); return; }
  } else {
    const totalPaid = parseFloat(document.getElementById("trade-total-paid").value);
    if (isNaN(totalPaid) || totalPaid <= 0) { errEl.textContent = t("err_total"); errEl.classList.remove("hidden"); return; }
    const rate = typeof getRate === "function" ? getRate() : 1;
    price = (totalPaid / rate) / absQty;
    if (!isFinite(price) || price <= 0) { errEl.textContent = t("err_price"); errEl.classList.remove("hidden"); return; }
  }

  // Sells are stored as negative qty so the portfolio math works naturally
  const qty = _currentHashIsSell ? -absQty : absQty;

  const res = await fetch("/api/portfolio", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, qty, price_paid: price, date })
  });
  const data = await res.json();
  if (!data.ok) {
    errEl.textContent = data.error || t("err_save");
    errEl.classList.remove("hidden");
    return;
  }

  // ── Auto-add the counterpart leg so both sides of a swap/sell appear ────────
  // SELL (token → stablecoin): also record the received stablecoin as a BUY.
  // SWAP (token → token): also record the sent token as a SELL (the received
  //   token BUY was already submitted as the primary trade above).
  const hd = _currentHashData;
  if (hd) {
    let counterTicker = null, counterQty = null, counterPrice = null, counterIsSell = false;

    if (hd.is_sell && hd.received_ticker && hd.received_qty) {
      // Record the stablecoin received: BUY, price ≈ $1
      counterTicker  = hd.received_ticker;
      counterQty     = hd.received_qty;
      counterPrice   = 1.0;
      counterIsSell  = false;
    } else if (hd.is_swap && hd.from_ticker && hd.from_qty && hd.total_usd) {
      // Record the token given up: SELL, price estimated from total_usd / from_qty
      counterTicker  = hd.from_ticker;
      counterQty     = hd.from_qty;
      counterPrice   = hd.total_usd / hd.from_qty;
      counterIsSell  = true;
    }

    if (counterTicker && counterQty > 0 && counterPrice > 0) {
      const counterQtyFinal = counterIsSell ? -counterQty : counterQty;
      await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker: counterTicker,
          qty: counterQtyFinal,
          price_paid: counterPrice,
          date
        })
      });
    }
  }
  // ────────────────────────────────────────────────────────────────────────────

  closeTradeModal();
  loadPortfolio();
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeTradeModal();
});

setInterval(() => {
  const tradeSection = document.getElementById("section-trade");
  if (!tradeSection.classList.contains("hidden")) loadPortfolio();
}, 60000);
