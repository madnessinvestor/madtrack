// ─── Dashboard (on-chain wallets) ─────────────────────────────────────────────

let dashWallets      = [];
let dashManual       = [];
let dashLoaded       = false;
const dashExpanded      = new Set();
const dashManualExpanded = new Set();
const dashActiveTab  = {};
const tokGroupExpanded = new Set();

// ── Testnet visibility toggle (ON = show testnets / OFF = mainnet only) ────────
let showTestnets = localStorage.getItem("showTestnets") === "true";

function setShowTestnets(val) {
  showTestnets = !!val;
  localStorage.setItem("showTestnets", showTestnets);
  _applyTestnetToggleUI();
  if (dashLoaded) renderDashboard();
}

function _applyTestnetToggleUI() {
  const onBtn  = document.getElementById("testnet-toggle-on");
  const offBtn = document.getElementById("testnet-toggle-off");
  if (onBtn)  onBtn.classList.toggle("active",  showTestnets);
  if (offBtn) offBtn.classList.toggle("active", !showTestnets);
}

// Legacy: migrate old "networkFilter" key to the new boolean
(function _migrateNetworkFilter() {
  const old = localStorage.getItem("networkFilter");
  if (old !== null) {
    showTestnets = (old === "testnet" || old === "both");
    localStorage.setItem("showTestnets", showTestnets);
    localStorage.removeItem("networkFilter");
  }
})();

const CHAIN_META = {
  // Jumper chain keys
  eth:        { name: "Ethereum",   color: "#627eea", id: 1 },
  bsc:        { name: "BNB Chain",  color: "#f0b90b", id: 56 },
  pol:        { name: "Polygon",    color: "#8247e5", id: 137 },
  arb:        { name: "Arbitrum",   color: "#28a0f0", id: 42161 },
  opt:        { name: "Optimism",   color: "#ff0420", id: 10 },
  avax:       { name: "Avalanche",  color: "#e84142", id: 43114 },
  ftm:        { name: "Fantom",     color: "#1969ff", id: 250 },
  base:       { name: "Base",       color: "#0052ff", id: 8453 },
  bas:        { name: "Base",       color: "#0052ff", id: 8453 },
  gnosis:     { name: "Gnosis",     color: "#04795b", id: 100 },
  linea:      { name: "Linea",      color: "#61dfff", id: 59144 },
  scrl:       { name: "Scroll",     color: "#eebb6a", id: 534352 },
  era:        { name: "zkSync Era", color: "#8c8dfc", id: 324 },
  cro:        { name: "Cronos",     color: "#002d74", id: 25 },
  celo:       { name: "Celo",       color: "#35d07f", id: 42220 },
  mnt:        { name: "Mantle",     color: "#50e3c2", id: 5000 },
  blast:      { name: "Blast",      color: "#fcfc03", id: 81457 },
  mode:       { name: "Mode",       color: "#dffe00", id: 34443 },
  sol:        { name: "Solana",     color: "#9945ff", id: null },
  hyp:        { name: "HyperEVM",   color: "#00c27c", id: 999 },
  // legacy / alternate aliases
  polygon:    { name: "Polygon",    color: "#8247e5", id: 137 },
  arbitrum:   { name: "Arbitrum",   color: "#28a0f0", id: 42161 },
  optimism:   { name: "Optimism",   color: "#ff0420", id: 10 },
  avalanche:  { name: "Avalanche",  color: "#e84142", id: 43114 },
  scroll:     { name: "Scroll",     color: "#eebb6a", id: 534352 },
  zksync:     { name: "zkSync",     color: "#8c8dfc", id: 324 },
};

function tokenIconUrl(token) {
  if (token.thumbnail) return token.thumbnail;
  const contract = (token.contract || "").toLowerCase();
  const netKey   = (token.network  || "").toLowerCase();
  const meta     = CHAIN_META[netKey];
  const chainId  = meta ? meta.id : null;
  if (contract && contract !== "0x0000000000000000000000000000000000000000" && chainId) {
    return `https://token-icons.llamao.fi/icons/tokens/${chainId}/${contract}?h=64&w=64`;
  }
  return null;
}

function chainMeta(id) {
  return CHAIN_META[(id || "").toLowerCase()] || { name: (id || "?").toUpperCase(), color: "#888" };
}

function fmtDashUsd(v) {
  if (v == null || isNaN(v) || v === 0) return "—";
  // Use the same currency / rate as the rest of the app
  const rate = (typeof getRate  === "function") ? getRate()  : 1;
  const sym  = (typeof currSym  === "function") ? currSym()  : "$";
  v = v * rate;
  const neg = v < 0;
  const abs = Math.abs(v);
  const sign = neg ? "-" : "";
  let fmt;
  if (abs >= 1e6)   fmt = sym + (abs / 1e6).toFixed(2) + "M";
  else if (abs >= 1000) fmt = sym + abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  else if (abs >= 1)    fmt = sym + abs.toFixed(2);
  else if (abs >= 0.001) fmt = sym + abs.toFixed(4);
  else                  fmt = sym + abs.toPrecision(3);
  return sign + fmt;
}

function fmtUnitPrice(p) {
  if (!p || isNaN(p) || p <= 0) return null;
  const rate = (typeof getRate === "function") ? getRate() : 1;
  const sym  = (typeof currSym === "function") ? currSym()  : "$";
  const v = p * rate;
  if (v >= 1000)    return sym + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 1)       return sym + v.toFixed(2);
  if (v >= 0.0001)  return sym + v.toFixed(6);
  return sym + v.toPrecision(3);
}

function fmtDashBal(b) {
  if (b == null || isNaN(b)) return "—";
  if (b >= 1000)    return b.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (b >= 1)       return b.toFixed(4);
  if (b >= 0.0001)  return b.toFixed(6);
  return b.toPrecision(3);
}

function shortAddr(addr) {
  if (!addr) return "—";
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}

async function loadDashboard() {
  const [wr, mr] = await Promise.all([
    fetch("/api/dashboard/wallets"),
    fetch("/api/dashboard/manual")
  ]);
  dashWallets = await wr.json();
  dashManual  = await mr.json();
  dashLoaded  = true;
  renderDashboard();
}

function renderDashboard() {
  const el = document.getElementById("dash-content");
  if (!el) return;

  // Sync open/closed state from the live DOM before wiping innerHTML.
  for (const w of dashWallets) {
    const body = document.getElementById(`dwc-body-${w.address}`);
    if (!body) continue;
    if (body.style.display === "none") dashExpanded.delete(w.address);
    else dashExpanded.add(w.address);
  }
  for (const a of dashManual) {
    const body = document.getElementById(`dmc-body-${a.id}`);
    if (!body) continue;
    if (body.style.display === "none") dashManualExpanded.delete(a.id);
    else dashManualExpanded.add(a.id);
  }

  const totalWalletUsd = dashWallets.reduce((s, w) => {
    const tok   = (w.tokens || []).reduce((ts, t) => ts + (t.value_usd || 0), 0);
    const dfi   = (w.defi   || []).reduce((ts, d) => ts + (d.net_usd   || 0), 0);
    const prps  = (w.perps  || []).reduce((ts, p) => ts + (p.net_usd   || 0), 0);
    return s + tok + dfi + prps;
  }, 0);
  const totalManualUsd = dashManual.reduce((s, a) =>
    s + (a.balance || 0) * (a.price_usd || 0), 0);
  const grandTotal = totalWalletUsd + totalManualUsd;

  let html = "";

  if (grandTotal > 0) {
    html += `<div class="dash-total-bar">
      <span class="dash-total-label">${t("dash_total_label")}</span>
      <span class="dash-total-val">${fmtDashUsd(grandTotal)}</span>
    </div>`;
  }

  // ── Wallets section ────────────────────────────────────────────────────────
  html += `<div class="dash-section-header">
    <span class="dash-section-title">
      <span class="dash-section-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      </span>
      ${t("dash_wallets_title")}
    </span>
    <button class="dash-add-btn" onclick="openDashWalletModal()">${t("dash_add_wallet")}</button>
  </div>`;

  if (dashWallets.length === 0) {
    html += `<div class="dash-empty">
      <div class="dash-empty-icon">🦊</div>
      <p>${t("dash_wallet_empty")}</p>
    </div>`;
  } else {
    html += `<div id="dash-wallets-list">`;
    for (const w of dashWallets) {
      html += walletCardHtml(w);
    }
    html += `</div>`;
  }

  // ── Manual assets section ──────────────────────────────────────────────────
  html += `<div class="dash-section-header" style="margin-top:18px">
    <span class="dash-section-title">
      <span class="dash-section-icon">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
      </span>
      ${t("dash_manual_title")}
    </span>
    <button class="dash-add-btn" onclick="openDashManualModal()">${t("dash_add_manual")}</button>
  </div>`;

  if (dashManual.length === 0) {
    html += `<div class="dash-empty">
      <div class="dash-empty-icon">📋</div>
      <p>${t("dash_manual_empty")}</p>
    </div>`;
  } else {
    html += `<div id="dash-manual-list">`;
    for (const a of dashManual) html += manualCardHtml(a);
    html += `</div>`;
  }

  el.innerHTML = html;
  initDashSortable();
  initManualSortable();
}

// ── Drag-and-drop reorder ──────────────────────────────────────────────────────

let _dashSortable   = null;
let _manualSortable = null;

function initDashSortable() {
  const list = document.getElementById("dash-wallets-list");
  if (_dashSortable) { _dashSortable.destroy(); _dashSortable = null; }
  if (!list || typeof Sortable === "undefined") return;
  _dashSortable = new Sortable(list, {
    handle: ".dwc-drag-handle",
    animation: 150,
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    onEnd: async () => {
      const cards     = list.querySelectorAll(".dash-wallet-card[data-addr]");
      const addresses = [...cards].map(c => c.dataset.addr);
      const addrMap   = Object.fromEntries(dashWallets.map(w => [w.address, w]));
      dashWallets     = addresses.map(a => addrMap[a]).filter(Boolean);
      await fetch("/api/dashboard/wallets/order", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ addresses }),
      });
    },
  });
}

function initManualSortable() {
  const list = document.getElementById("dash-manual-list");
  if (_manualSortable) { _manualSortable.destroy(); _manualSortable = null; }
  if (!list || typeof Sortable === "undefined") return;
  _manualSortable = new Sortable(list, {
    handle: ".dwc-drag-handle",
    animation: 150,
    ghostClass: "sortable-ghost",
    chosenClass: "sortable-chosen",
    onEnd: async () => {
      const cards = list.querySelectorAll(".dash-wallet-card[data-mid]");
      const ids   = [...cards].map(c => c.dataset.mid);
      const idMap = Object.fromEntries(dashManual.map(a => [a.id, a]));
      dashManual  = ids.map(id => idMap[id]).filter(Boolean);
      await fetch("/api/dashboard/manual/order", {
        method:  "PUT",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ids }),
      });
    },
  });
}

// ── Network type helpers ───────────────────────────────────────────────────────

const NET_TYPE_META = {
  evm:     { label: "EVM",     color: "#627eea", icon: "⬡" },
  solana:  { label: "SOL",     color: "#9945ff", icon: "◎" },
  bitcoin: { label: "BTC",     color: "#f7931a", icon: "₿" },
  other:   { label: "L1",      color: "#888",    icon: "◈" },
};

function netTypeBadge(w) {
  const nt  = w.network_type || "evm";
  const meta = NET_TYPE_META[nt] || NET_TYPE_META.other;
  const label = nt === "other" && w.sub_network
    ? w.sub_network.toUpperCase()
    : meta.label;
  return `<span class="dwc-net-badge" style="background:${meta.color}20;color:${meta.color};border:1px solid ${meta.color}40">${label}</span>`;
}

// Encode address for safe use in HTML attributes / JS strings
function safeAddr(addr) { return (addr || "").replace(/'/g, "\\'"); }

// ── Wallet card ────────────────────────────────────────────────────────────────

function walletCardHtml(w) {
  // Mainnet assets — always shown, always counted in totals
  const tokens   = w.tokens || [];
  const defi     = w.defi   || [];
  const perps    = w.perps  || [];
  // Testnet assets — NEVER counted in totals; shown in separate section only when enabled
  const allTestnetTokens = w.testnet_tokens || [];
  const testnetTokens    = showTestnets ? allTestnetTokens : [];

  const netType    = w.network_type || "evm";
  const hasDeFiTabs = (netType === "evm" || netType === "solana");

  const tokUsd   = tokens.reduce((s, tk) => s + (tk.value_usd || 0), 0);
  const defiUsd  = defi.reduce((s, d)    => s + (d.net_usd    || 0), 0);
  const perpsUsd = perps.reduce((s, p)   => s + (p.net_usd    || 0), 0);
  // Testnet intentionally excluded from totalUsd — never counts as real wealth
  const totalUsd = tokUsd + defiUsd + perpsUsd;

  const label    = w.label || shortAddr(w.address);
  const isLoaded = !!w.last_updated;
  const isOpen   = dashExpanded.has(w.address);
  const activeTab= dashActiveTab[w.address] || "tokens";
  const chevron  = isOpen ? "▼" : "▶";
  const addrSafe = safeAddr(w.address);

  let html = `<div class="dash-wallet-card" id="dwc-${w.address}" data-addr="${escHtml(w.address)}">
    <div class="dwc-header" onclick="toggleWalletCard('${addrSafe}')">
      <div class="dwc-header-left">
        <span class="dwc-drag-handle drag-handle" title="Arrastar para reordenar">⠿</span>
        <span class="dwc-chevron" id="dwc-chev-${w.address}">${chevron}</span>
        <div class="dwc-info">
          <div class="dwc-label-row">
            <span class="dwc-label">${escHtml(label)}</span>
            ${netTypeBadge(w)}
          </div>
          <span class="dwc-addr" title="${escHtml(w.address)}">${shortAddr(w.address)}</span>
        </div>
      </div>
      <div class="dwc-header-right">
        <span class="dwc-total">${fmtDashUsd(totalUsd)}</span>
        <div class="dwc-btns" onclick="event.stopPropagation()">
          <button class="dash-icon-btn" onclick="openEditWalletModal('${addrSafe}')" title="${t('dash_edit_title')}">✎</button>
          <button class="dash-icon-btn dash-del-btn" onclick="deleteWallet('${addrSafe}')" title="${t('dash_remove_title')}">✕</button>
        </div>
      </div>
    </div>
    <div class="dwc-body" id="dwc-body-${w.address}" style="${isOpen ? '' : 'display:none'}">`;

  if (!isLoaded) {
    html += `<div class="dash-unloaded">
      <button class="dash-load-btn" id="dwc-load-${w.address}" onclick="refreshWallet('${addrSafe}')">${t("dash_load_btn")}</button>
    </div>`;
  } else {
    // ── Mainnet tabs ──────────────────────────────────────────────────────────
    const tabs = hasDeFiTabs ? [
      { id: "tokens", label: t("dash_tab_tokens"), count: tokens.length, usd: tokUsd },
      { id: "defi",   label: t("dash_tab_defi"),   count: defi.length,   usd: defiUsd },
      { id: "perps",  label: t("dash_tab_perps"),  count: perps.length,  usd: perpsUsd },
    ] : [
      { id: "tokens", label: t("dash_tab_tokens"), count: tokens.length, usd: tokUsd },
    ];

    html += `<div class="dwc-tabbar" id="dwc-tabbar-${w.address}">`;
    for (const tab of tabs) {
      const active = activeTab === tab.id ? " active" : "";
      const badge  = `<span class="dwc-tab-badge">${tab.count > 0 ? tab.count + " · " + fmtDashUsd(tab.usd) : "—"}</span>`;
      html += `<button class="dwc-tab${active}" onclick="switchWalletTab('${addrSafe}','${tab.id}',this)">
        ${tab.label}${badge}
      </button>`;
    }
    html += `</div>`;

    // Tokens tab
    html += `<div class="dwc-tab-pane" id="dwc-pane-tokens-${w.address}" style="${activeTab === 'tokens' ? '' : 'display:none'}">`;
    html += tokens.length === 0
      ? `<div class="dash-token-empty">${t("dash_empty_tokens")}</div>`
      : tokensGroupedHtml(tokens, w.address);
    html += `</div>`;

    if (hasDeFiTabs) {
      // DeFi tab
      html += `<div class="dwc-tab-pane" id="dwc-pane-defi-${w.address}" style="${activeTab === 'defi' ? '' : 'display:none'}">`;
      html += defi.length === 0
        ? `<div class="dash-token-empty">${t("dash_empty_defi")}</div>`
        : defi.map(d => defiRowHtml(d)).join("");
      html += `</div>`;

      // Perps tab
      html += `<div class="dwc-tab-pane" id="dwc-pane-perps-${w.address}" style="${activeTab === 'perps' ? '' : 'display:none'}">`;
      html += perps.length === 0
        ? `<div class="dash-token-empty">${t("dash_empty_perps")}</div>`
        : perps.map(p => defiRowHtml(p)).join("");
      html += `</div>`;
    }

    // ── Testnet section — separate from mainnet, never in totals ─────────────
    if (testnetTokens.length > 0) {
      html += `<div class="dwc-testnet-section">
        <div class="dwc-testnet-header">
          <span class="testnet-badge">TESTNET</span>
          <span class="dwc-testnet-sub">${t("dash_testnet_notice")}</span>
        </div>`;
      html += tokensGroupedHtml(testnetTokens, w.address + "-testnet");
      html += `</div>`;
    }
  }

  html += `</div></div>`;
  return html;
}

// ── Manual asset card ──────────────────────────────────────────────────────────

function manualCardHtml(a) {
  const sym    = a.symbol || "?";
  const bal    = a.balance    || 0;
  const price  = a.price_usd  || 0;
  const invest = a.investment || 0;
  const curVal = bal * price;
  const ppt    = (bal > 0 && invest > 0) ? invest / bal : 0;
  const pnl    = invest > 0 ? curVal - invest : null;
  const pnlPct = (pnl !== null && invest > 0) ? (pnl / invest * 100) : null;
  const isOpen = dashManualExpanded.has(a.id);
  const idSafe = escHtml(a.id);

  const sourceBadge = a.source
    ? `<span class="dmc-source-badge">${escHtml(a.source)}</span>`
    : "";

  let pnlHtml;
  if (pnl !== null) {
    const cls  = pnl >= 0 ? "dmc-pnl-pos" : "dmc-pnl-neg";
    const sign = pnl >= 0 ? "+" : "";
    pnlHtml = `<span class="${cls}">${sign}${fmtDashUsd(pnl)} (${sign}${pnlPct.toFixed(2)}%)</span>`;
  } else {
    pnlHtml = "—";
  }

  const rows = [
    [t("dmc_cur_price"),  price  > 0 ? fmtDashUsd(price)  : "—"],
    [t("dmc_quantity"),   `${fmtDashBal(bal)} ${escHtml(sym)}`],
    [t("dmc_investment"), invest > 0 ? fmtDashUsd(invest) : "—"],
    [t("dmc_ppt"),        ppt    > 0 ? fmtDashUsd(ppt)   : "—"],
    [t("dmc_cur_value"),  fmtDashUsd(curVal)],
    [t("dmc_pnl"),        pnlHtml],
  ];
  if (a.purchase_date) {
    rows.push([t("dmc_purchase_date"), escHtml(a.purchase_date.replace("T", " ").slice(0, 16))]);
  }

  let bodyHtml = `<div class="dmc-stats">`;
  for (const [lbl, val] of rows) {
    bodyHtml += `<div class="dmc-stat-row"><span class="dmc-stat-label">${lbl}</span><span class="dmc-stat-val">${val}</span></div>`;
  }
  bodyHtml += `</div>`;

  return `<div class="dash-wallet-card" id="dmc-${idSafe}" data-mid="${idSafe}">
    <div class="dwc-header" onclick="toggleManualCard('${idSafe}')">
      <div class="dwc-header-left">
        <span class="dwc-drag-handle drag-handle" title="${t("dmm_drag_title")}">⠿</span>
        <span class="dwc-chevron" id="dmc-chev-${idSafe}">${isOpen ? "▼" : "▶"}</span>
        <div class="dwc-info">
          <div class="dwc-label-row">
            <span class="dwc-label">${escHtml(sym)}</span>
            ${sourceBadge}
          </div>
          <span class="dwc-addr">${fmtDashBal(bal)} ${escHtml(sym)} · ${fmtDashUsd(curVal)}</span>
        </div>
      </div>
      <div class="dwc-header-right">
        <span class="dwc-total">${fmtDashUsd(curVal)}</span>
        <div class="dwc-btns" onclick="event.stopPropagation()">
          <button class="dash-icon-btn" onclick="openEditManualModal('${idSafe}')" title="${t("dash_edit_title")}">✎</button>
          <button class="dash-icon-btn dash-del-btn" onclick="deleteManualAsset('${idSafe}')" title="${t("dash_remove_title")}">✕</button>
        </div>
      </div>
    </div>
    <div class="dwc-body" id="dmc-body-${idSafe}" style="${isOpen ? "" : "display:none"}">
      ${bodyHtml}
    </div>
  </div>`;
}

function toggleManualCard(id) {
  const body = document.getElementById(`dmc-body-${id}`);
  const chev = document.getElementById(`dmc-chev-${id}`);
  if (!body) return;
  const opening = body.style.display === "none";
  body.style.display = opening ? "" : "none";
  if (chev) chev.textContent = opening ? "▼" : "▶";
  if (opening) dashManualExpanded.add(id); else dashManualExpanded.delete(id);
}

function toggleWalletCard(address) {
  const body   = document.getElementById(`dwc-body-${address}`);
  const chev   = document.getElementById(`dwc-chev-${address}`);
  if (!body) return;
  const opening = body.style.display === "none";
  body.style.display = opening ? "" : "none";
  if (chev) chev.textContent = opening ? "▼" : "▶";
  if (opening) dashExpanded.add(address); else dashExpanded.delete(address);
}

// Prevent drag handle from triggering card toggle
document.addEventListener("click", e => {
  if (e.target.closest(".dwc-drag-handle")) e.stopImmediatePropagation();
}, true);

function switchWalletTab(address, tab, btn) {
  ["tokens","defi","perps","testnet"].forEach(t => {
    const pane = document.getElementById(`dwc-pane-${t}-${address}`);
    if (pane) pane.style.display = (t === tab) ? "" : "none";
  });
  const bar = document.getElementById(`dwc-tabbar-${address}`);
  if (bar) bar.querySelectorAll(".dwc-tab").forEach(b => b.classList.toggle("active", b === btn));
  dashActiveTab[address] = tab;
}

// ── Row renderers ──────────────────────────────────────────────────────────────

function tokensGroupedHtml(tokens, walletAddr) {
  const groups = {};
  for (const t of tokens) {
    const key = t.symbol;
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  }
  const sorted = Object.entries(groups).sort((a, b) => {
    const ta = a[1].reduce((s, t) => s + (t.value_usd || 0), 0);
    const tb = b[1].reduce((s, t) => s + (t.value_usd || 0), 0);
    return tb - ta;
  });
  let html = `<div class="dash-token-list">`;
  for (const [sym, items] of sorted) {
    html += tokenGroupHtml(sym, items, walletAddr);
  }
  html += `</div>`;
  return html;
}

function groupKeyToId(groupKey) {
  return "tgb-" + groupKey.replace(/[^a-zA-Z0-9]/g, "_");
}

function tokenGroupHtml(sym, items, walletAddr) {
  const groupKey  = `${walletAddr}::${sym}`;
  const elemId    = groupKeyToId(groupKey);
  const isOpen    = tokGroupExpanded.has(groupKey);
  const isMulti   = items.length > 1;
  const totalVal  = items.reduce((s, t) => s + (t.value_usd || 0), 0);
  const totalBal  = items.reduce((s, t) => s + (t.balance   || 0), 0);

  const icon = tokenIconUrl(items[0]);
  const imgEl = icon
    ? `<img class="dash-tok-icon" src="${escHtml(icon)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><span class="dash-tok-icon-fb" style="display:none">${(sym||"?")[0]}</span>`
    : `<span class="dash-tok-icon-fb">${(sym||"?")[0]}</span>`;

  const netDots = items.map(t => {
    const cm = chainMeta(t.network);
    return `<span class="dash-chain-dot" style="background:${cm.color}" title="${cm.name}"></span>`;
  }).join("");

  const chevron   = isMulti ? `<span class="dash-tok-chev">${isOpen ? "▼" : "▶"}</span>` : "";
  const clickAttr = isMulti
    ? `onclick="toggleTokGroup('${escHtml(groupKey)}')" style="cursor:pointer"`
    : "";

  const unitPrice = fmtUnitPrice(items[0].price_usd);

  let html = `<div class="dash-tok-group">
    <div class="dash-token-row dash-tok-group-hdr" ${clickAttr}>
      <div class="dash-tok-left">
        ${imgEl}
        <div class="dash-tok-info">
          <span class="dash-tok-sym">${escHtml(sym)}</span>
          ${unitPrice ? `<span class="dash-tok-price">${unitPrice}</span>` : ""}
          <div class="dash-chain-dots">${netDots}</div>
        </div>
      </div>
      <div class="dash-tok-right">
        <span class="dash-tok-val">${fmtDashUsd(totalVal)}</span>
        <span class="dash-tok-bal">${fmtDashBal(totalBal)} ${escHtml(sym)}</span>
      </div>
      ${chevron}
    </div>`;

  if (isMulti) {
    html += `<div class="dash-tok-group-body" id="${elemId}" style="${isOpen ? "" : "display:none"}">`;
    for (const t of items) html += tokenRowHtml(t, true);
    html += `</div>`;
  }

  html += `</div>`;
  return html;
}

function toggleTokGroup(groupKey) {
  const elemId = groupKeyToId(groupKey);
  const body   = document.getElementById(elemId);
  const hdr    = body ? body.previousElementSibling : null;
  const chev   = hdr  ? hdr.querySelector(".dash-tok-chev") : null;
  if (!body) return;
  const opening = body.style.display === "none";
  body.style.display = opening ? "" : "none";
  if (chev) chev.textContent = opening ? "▼" : "▶";
  if (opening) tokGroupExpanded.add(groupKey);
  else         tokGroupExpanded.delete(groupKey);
}

function tokenRowHtml(t, subRow = false) {
  const cm   = chainMeta(t.network);
  const icon = subRow ? null : tokenIconUrl(t);
  const img  = !subRow ? (icon
    ? `<img class="dash-tok-icon" src="${escHtml(icon)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><span class="dash-tok-icon-fb" style="display:none">${(t.symbol||"?")[0]}</span>`
    : `<span class="dash-tok-icon-fb">${(t.symbol||"?")[0]}</span>`)
    : `<span class="dash-chain-dot dash-chain-dot-lg" style="background:${cm.color}" title="${cm.name}"></span>`;
  return `<div class="dash-token-row${subRow ? " dash-tok-sub" : ""}" data-net="${t.network}">
    <div class="dash-tok-left">
      ${img}
      <div class="dash-tok-info">
        ${subRow
          ? `<span class="dash-tok-sym dash-tok-sym-sub">${cm.name}</span>`
          : `<span class="dash-tok-sym">${escHtml(t.symbol)}</span>${t.name ? `<span class="dash-tok-name">${escHtml(t.name)}</span>` : ""}`
        }
      </div>
    </div>
    <div class="dash-tok-mid">
      ${!subRow ? `<span class="dash-net-badge" style="--nc:${cm.color}">${cm.name}</span>` : ""}
    </div>
    <div class="dash-tok-right">
      <span class="dash-tok-val">${fmtDashUsd(t.value_usd)}</span>
      <span class="dash-tok-bal">${fmtDashBal(t.balance)} ${escHtml(t.symbol)}</span>
      ${fmtUnitPrice(t.price_usd) ? `<span class="dash-tok-price">@ ${fmtUnitPrice(t.price_usd)}</span>` : ""}
    </div>
  </div>`;
}

function defiRowHtml(d) {
  const cm      = chainMeta(d.network);
  const logoEl  = d.protocol_logo
    ? `<img class="defi-proto-logo" src="${escHtml(d.protocol_logo)}" onerror="this.style.display='none'" />`
    : `<span class="dash-tok-icon-fb">${(d.protocol||"?")[0]}</span>`;
  const typeBadge = d.type ? `<span class="defi-type-badge">${escHtml(d.type)}</span>` : "";
  const netBadge  = d.network ? `<span class="dash-net-badge" style="--nc:${cm.color}">${cm.name}</span>` : "";

  let supplyHtml = "";
  const allToks = [...(d.supply_tokens||[]), ...(d.reward_tokens||[])];
  if (allToks.length) {
    supplyHtml = `<div class="defi-tok-list">` +
      allToks.map(t => `<span class="defi-tok-chip">
        ${t.logo ? `<img class="defi-tok-chip-img" src="${escHtml(t.logo)}" onerror="this.style.display='none'" />` : ""}
        ${fmtDashBal(t.balance)} ${escHtml(t.symbol)}
        ${fmtUnitPrice(t.price_usd) ? `<span class="defi-tok-chip-price">@ ${fmtUnitPrice(t.price_usd)}</span>` : ""}
        <span class="defi-tok-chip-usd">${fmtDashUsd(t.value_usd)}</span>
      </span>`).join("") +
    `</div>`;
  }

  const debtHtml = d.debt_usd > 0
    ? `<span class="defi-debt-line">${t("dash_debt")} ${fmtDashUsd(d.debt_usd)}</span>` : "";

  return `<div class="defi-row">
    <div class="dash-tok-left">
      ${logoEl}
      <div class="dash-tok-info">
        <span class="dash-tok-sym">${escHtml(d.protocol)}</span>
        <span class="dash-tok-name">${escHtml(d.description || d.type || "")}</span>
        ${supplyHtml}
      </div>
    </div>
    <div class="dash-tok-mid">${typeBadge}${netBadge}</div>
    <div class="dash-tok-right">
      <span class="dash-tok-val">${fmtDashUsd(d.net_usd)}</span>
      ${debtHtml}
    </div>
  </div>`;
}


function escHtml(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Wallet modal ───────────────────────────────────────────────────────────────

let _dwmNetType = "evm";

function openDashWalletModal() {
  document.getElementById("dash-wallet-modal").classList.remove("hidden");
  // Reset all fields
  ["dwm-address","dwm-sol-address","dwm-btc-address","dwm-other-address","dwm-label"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = "";
  });
  document.getElementById("dwm-err").textContent = "";
  // Reset to EVM tab
  setWalletNetworkType("evm", document.querySelector(".dwm-net-btn[data-net='evm']"));
  setTimeout(() => document.getElementById("dwm-address").focus(), 50);
}

function closeDashWalletModal() {
  document.getElementById("dash-wallet-modal").classList.add("hidden");
}

function setWalletNetworkType(type, btn) {
  _dwmNetType = type;
  // Update button active state
  document.querySelectorAll(".dwm-net-btn").forEach(b => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
  // Show/hide fields
  const allFields = ["evm","solana","bitcoin","other"];
  allFields.forEach(f => {
    const el = document.getElementById(`dwm-field-${f}`);
    if (el) el.style.display = (f === type) ? "" : "none";
  });
  // Focus appropriate input
  const focusMap = { evm: "dwm-address", solana: "dwm-sol-address",
                     bitcoin: "dwm-btc-address", other: "dwm-other-address" };
  setTimeout(() => {
    const el = document.getElementById(focusMap[type]);
    if (el) el.focus();
  }, 50);
}

async function submitDashWallet() {
  const errEl = document.getElementById("dwm-err");
  const label = document.getElementById("dwm-label").value.trim();
  errEl.textContent = "";

  let address = "", sub_network = "";

  if (_dwmNetType === "evm") {
    address = document.getElementById("dwm-address").value.trim();
    if (!address) { errEl.textContent = t("dash_err_evm_required"); return; }
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      errEl.textContent = t("dash_err_evm_invalid"); return;
    }
  } else if (_dwmNetType === "solana") {
    address = document.getElementById("dwm-sol-address").value.trim();
    if (!address) { errEl.textContent = t("dash_err_addr_required"); return; }
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      errEl.textContent = t("dash_err_sol_invalid"); return;
    }
  } else if (_dwmNetType === "bitcoin") {
    address = document.getElementById("dwm-btc-address").value.trim();
    if (!address) { errEl.textContent = t("dash_err_addr_required"); return; }
    if (!/^(1|3)[a-zA-Z0-9]{24,33}$|^bc1[a-zA-Z0-9]{6,87}$/.test(address)) {
      errEl.textContent = t("dash_err_btc_invalid"); return;
    }
  } else if (_dwmNetType === "other") {
    address     = document.getElementById("dwm-other-address").value.trim();
    sub_network = document.getElementById("dwm-other-net").value;
    if (!address) { errEl.textContent = t("dash_err_addr_required"); return; }
  }

  const btn = document.getElementById("dwm-submit");
  btn.disabled = true; btn.textContent = t("dash_adding");
  try {
    const r = await fetch("/api/dashboard/wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, network_type: _dwmNetType, sub_network, label })
    });
    const d = await r.json();
    if (!r.ok) { errEl.textContent = d.error || t("dash_err_add"); return; }
    closeDashWalletModal();
    // For EVM, address is stored lowercase; others as-is
    const storedAddr = _dwmNetType === "evm" ? address.toLowerCase() : address;
    await refreshWallet(storedAddr);
  } finally {
    btn.disabled = false; btn.textContent = t("dash_add_btn");
  }
}

// ── Manual modal ───────────────────────────────────────────────────────────────

let _dmmFetchedPrice = null;   // price from ticker lookup
let _dmmFetchedSrc   = null;   // source label
let _dmmLookupTimer  = null;
let _dmmReqSeq       = 0;      // monotonic counter for race-safe responses
let _dmmEditingId    = null;   // id when editing existing asset, null when adding

function _dmmLocalNow() {
  const now = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

function _dmmResetForm() {
  ["dmm-qty","dmm-invest","dmm-date"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("dmm-sym").value    = "";
  document.getElementById("dmm-sym").disabled = false;
  document.getElementById("dmm-err").textContent = "";
  document.getElementById("dmm-ppt").textContent = "--";
  const info = document.getElementById("dmm-price-info");
  info.textContent = "";
  info.classList.add("hidden");
  _dmmFetchedPrice = null;
  _dmmFetchedSrc   = null;
  _dmmEditingId    = null;
}

function openDashManualModal() {
  _dmmResetForm();
  document.getElementById("dmm-date").value = _dmmLocalNow();
  const titleEl = document.querySelector("#dash-manual-modal .dash-modal-title");
  if (titleEl) titleEl.setAttribute("data-i18n", "dmm_title");
  const submitEl = document.getElementById("dmm-submit");
  if (submitEl) submitEl.setAttribute("data-i18n", "dash_add_btn");
  applyLang();
  document.getElementById("dash-manual-modal").classList.remove("hidden");
  setTimeout(() => document.getElementById("dmm-sym").focus(), 50);
}

function openEditManualModal(id) {
  const asset = dashManual.find(a => a.id === id);
  if (!asset) return;
  _dmmResetForm();
  _dmmEditingId = id;

  const symEl = document.getElementById("dmm-sym");
  symEl.value    = asset.symbol || "";
  symEl.disabled = true;   // symbol cannot change on edit

  document.getElementById("dmm-qty").value    = asset.balance    > 0 ? asset.balance    : "";
  document.getElementById("dmm-invest").value = asset.investment > 0 ? asset.investment : "";
  document.getElementById("dmm-date").value   = (asset.purchase_date || "").slice(0, 16) || _dmmLocalNow();
  document.getElementById("dmm-err").textContent = "";

  _dmmFetchedPrice = asset.price_usd || null;
  _dmmFetchedSrc   = asset.source    || null;

  if (_dmmFetchedPrice) {
    const fmt  = new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", minimumFractionDigits:2, maximumFractionDigits:8 });
    const info = document.getElementById("dmm-price-info");
    const parts = [{ css: "dmm-price-val", text: `${t("dmm_cur_price")} ${fmt.format(_dmmFetchedPrice)}` }];
    if (_dmmFetchedSrc) parts.push({ css: "dmm-source-val", text: `${t("dmm_data_source")} ${_dmmFetchedSrc}` });
    _dmmSetInfo(info, null, ...parts);
    info.classList.remove("hidden");
  }

  onDmmCalc();

  const titleEl = document.querySelector("#dash-manual-modal .dash-modal-title");
  if (titleEl) titleEl.setAttribute("data-i18n", "dmm_title_edit");
  const submitEl = document.getElementById("dmm-submit");
  if (submitEl) submitEl.setAttribute("data-i18n", "dash_save_btn");
  applyLang();

  document.getElementById("dash-manual-modal").classList.remove("hidden");
  setTimeout(() => document.getElementById("dmm-qty").focus(), 50);
}

function closeDashManualModal() {
  document.getElementById("dash-manual-modal").classList.add("hidden");
  document.getElementById("dmm-sym").disabled = false;
  clearTimeout(_dmmLookupTimer);
  _dmmEditingId = null;
}

function onDmmSymInput() {
  clearTimeout(_dmmLookupTimer);
  _dmmFetchedPrice = null;
  _dmmFetchedSrc   = null;
  _dmmReqSeq++;                           // invalidate any in-flight request
  const info = document.getElementById("dmm-price-info");
  info.classList.add("hidden");
  info.textContent = "";
  onDmmCalc();
  const sym = document.getElementById("dmm-sym").value.trim();
  if (!sym) return;
  info.textContent = "…";
  info.classList.remove("hidden");
  const seq = _dmmReqSeq;
  _dmmLookupTimer = setTimeout(() => _dmmLookup(sym, seq), 500);
}

function _dmmSetInfo(info, cls, ...texts) {
  info.textContent = "";
  texts.forEach(({ css, text }) => {
    const sp = document.createElement("span");
    sp.className = css;
    sp.textContent = text;
    info.appendChild(sp);
  });
}

async function _dmmLookup(sym, seq) {
  const info = document.getElementById("dmm-price-info");
  try {
    const r = await fetch(`/api/price-lookup?symbol=${encodeURIComponent(sym)}`);
    if (seq !== _dmmReqSeq) return;       // stale — a newer request is in flight
    const d = await r.json();
    if (d.price) {
      _dmmFetchedPrice = d.price;
      _dmmFetchedSrc   = d.source || "";
      const fmt = new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", minimumFractionDigits:2, maximumFractionDigits:8 });
      const parts = [{ css: "dmm-price-val", text: `${t("dmm_cur_price")} ${fmt.format(d.price)}` }];
      if (d.source) parts.push({ css: "dmm-source-val", text: `${t("dmm_data_source")} ${d.source}` });
      _dmmSetInfo(info, null, ...parts);
      info.classList.remove("hidden");
    } else {
      _dmmFetchedPrice = null;
      _dmmSetInfo(info, null, { css: "dmm-price-notfound", text: t("dmm_not_found") });
    }
  } catch {
    if (seq !== _dmmReqSeq) return;
    _dmmFetchedPrice = null;
    _dmmSetInfo(info, null, { css: "dmm-price-notfound", text: t("dmm_err_lookup") });
  }
  onDmmCalc();
}

function onDmmCalc() {
  const qty    = parseFloat(document.getElementById("dmm-qty").value)    || 0;
  const invest = parseFloat(document.getElementById("dmm-invest").value) || 0;
  const pptEl  = document.getElementById("dmm-ppt");
  if (qty > 0 && invest > 0) {
    const ppt = invest / qty;
    const fmt = new Intl.NumberFormat("en-US", { style:"currency", currency:"USD", minimumFractionDigits:2, maximumFractionDigits:8 });
    pptEl.textContent = fmt.format(ppt);
  } else {
    pptEl.textContent = "--";
  }
}

async function submitDashManual() {
  const symbol  = document.getElementById("dmm-sym").value.trim().toUpperCase();
  const qty     = parseFloat(document.getElementById("dmm-qty").value)    || 0;
  const invest  = parseFloat(document.getElementById("dmm-invest").value) || 0;
  const dateVal = document.getElementById("dmm-date").value.trim();
  const errEl   = document.getElementById("dmm-err");
  if (!symbol) { errEl.textContent = t("dash_err_symbol"); return; }
  errEl.textContent = "";
  const btn = document.getElementById("dmm-submit");
  btn.disabled = true;
  try {
    const body = {
      symbol,
      balance:       qty,
      price_usd:     _dmmFetchedPrice || 0,
      investment:    invest,
      source:        _dmmFetchedSrc || "",
      purchase_date: dateVal || null,
    };
    const url    = _dmmEditingId ? `/api/dashboard/manual/${_dmmEditingId}` : "/api/dashboard/manual";
    const method = _dmmEditingId ? "PATCH" : "POST";
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) { errEl.textContent = d.error || t("dash_err_generic"); return; }
    closeDashManualModal();
    await loadDashboard();
  } finally {
    btn.disabled = false;
  }
}

// ── Actions ────────────────────────────────────────────────────────────────────

async function refreshWallet(address) {
  const loadBtn = document.getElementById(`dwc-load-${address}`);
  if (loadBtn) { loadBtn.textContent = t("dash_loading"); loadBtn.disabled = true; }
  try {
    const r = await fetch(`/api/dashboard/wallets/${address}/refresh`, { method: "POST" });
    const d = await r.json();
    if (!r.ok) {
      showDashError(address, d.error || t("dash_err_load"));
      return;
    }
  } catch (e) {
    showDashError(address, t("dash_err_network"));
    return;
  }
  await loadDashboard();
}

// ── Staggered wallet refresh: 50 ms between each wallet to avoid API rate-limiting ──
// EVM and Solana share the same Jumper API endpoint; firing them all at once
// triggers 403 responses. Manual assets use a different endpoint and are always
// fired immediately alongside the staggered chain.
async function _staggeredWalletRefresh(wallets, { silent = false } = {}) {
  const STAGGER_MS = 50;
  const promises = wallets.map((w, i) =>
    new Promise(resolve => setTimeout(resolve, i * STAGGER_MS))
      .then(() =>
        fetch(`/api/dashboard/wallets/${w.address}/refresh`, { method: "POST" })
          .catch(() => {})
      )
  );
  // Manual asset prices don't hit the chain APIs — fire immediately in parallel
  promises.push(fetch("/api/dashboard/manual/refresh", { method: "POST" }).catch(() => {}));
  return Promise.allSettled(promises);
}

async function refreshAllWallets() {
  const btn = document.getElementById("btn-refresh-all-wallets");
  if (btn) { btn.disabled = true; btn.style.opacity = "0.5"; }
  try {
    const listRes = await fetch("/api/dashboard/wallets");
    if (!listRes.ok) return;
    const wallets = await listRes.json();
    // Treat any wallet without an explicit network_type as EVM (legacy records),
    // matching the backend's own default — never drop a wallet from bulk refresh.
    const onChain = wallets.filter(w => w.address);
    await _staggeredWalletRefresh(onChain);
    await loadDashboard();
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = ""; }
  }
}

// ── Auto-refresh all wallets every 3 minutes when dashboard is visible ─────────
let _dashRefreshTimer = null;

function startDashAutoRefresh() {
  if (_dashRefreshTimer) return;
  _dashRefreshTimer = setInterval(async () => {
    const dashSection = document.getElementById("section-dashboard");
    if (!dashSection || dashSection.classList.contains("hidden")) return;
    const toRefresh = dashWallets.filter(w => w.last_updated && w.address);
    await _staggeredWalletRefresh(toRefresh, { silent: true });
    await loadDashboard();
  }, 3 * 60 * 1000); // every 3 minutes
}

startDashAutoRefresh();
_applyTestnetToggleUI();

function showDashError(address, msg) {
  const card = document.getElementById(`dwc-${address}`);
  if (!card) return;
  let errEl = card.querySelector(".dash-wallet-err");
  if (!errEl) {
    errEl = document.createElement("div");
    errEl.className = "dash-wallet-err";
    card.appendChild(errEl);
  }
  errEl.textContent = "⚠️ " + msg;
}

async function deleteWallet(address) {
  if (!confirm(t("dash_confirm_remove"))) return;
  await fetch(`/api/dashboard/wallets/${address}`, { method: "DELETE" });
  await loadDashboard();
}

// ── Edit wallet label ──────────────────────────────────────────────────────────

let _editWalletAddress = null;

function openEditWalletModal(address) {
  _editWalletAddress = address;
  const wallet  = dashWallets.find(w => w.address === address);
  const labelEl = document.getElementById("dwm-edit-label");
  const errEl   = document.getElementById("dwm-edit-err");
  const modal   = document.getElementById("dash-edit-wallet-modal");
  if (!labelEl || !errEl || !modal) {
    // Modal elements missing — likely stale service-worker cache.
    // Hard-reload to pick up the latest HTML.
    location.reload(true);
    return;
  }
  labelEl.value     = (wallet && wallet.label) ? wallet.label : "";
  errEl.textContent = "";
  modal.classList.remove("hidden");
  setTimeout(() => labelEl.select(), 50);
}

function closeEditWalletModal() {
  document.getElementById("dash-edit-wallet-modal").classList.add("hidden");
  _editWalletAddress = null;
}

async function submitEditWallet() {
  const label  = document.getElementById("dwm-edit-label").value.trim();
  const errEl  = document.getElementById("dwm-edit-err");
  const btn    = document.getElementById("dwm-edit-submit");
  errEl.textContent = "";
  btn.disabled = true; btn.textContent = t("dash_saving");
  try {
    const r = await fetch(`/api/dashboard/wallets/${_editWalletAddress}`, {
      method:  "PATCH",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ label }),
    });
    const d = await r.json();
    if (!r.ok) { errEl.textContent = d.error || t("dash_err_generic"); return; }
    closeEditWalletModal();
    await loadDashboard();
  } catch {
    errEl.textContent = t("dash_err_network");
  } finally {
    btn.disabled = false; btn.textContent = t("dash_save_btn");
  }
}

async function deleteManualAsset(id) {
  if (!confirm(t("dash_confirm_del_manual"))) return;
  await fetch(`/api/dashboard/manual/${id}`, { method: "DELETE" });
  await loadDashboard();
}
