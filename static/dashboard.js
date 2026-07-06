// ─── Dashboard (on-chain wallets) ─────────────────────────────────────────────

let dashWallets      = [];
let dashManual       = [];
let dashLoaded       = false;
const dashExpanded   = new Set();
const dashActiveTab  = {};
const tokGroupExpanded = new Set();

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
    <span class="dash-section-title">${t("dash_wallets_title")}</span>
    <button class="dash-add-btn" onclick="openDashWalletModal()">${t("dash_add_wallet")}</button>
  </div>`;

  if (dashWallets.length === 0) {
    html += `<div class="dash-empty">
      <div class="dash-empty-icon">🦊</div>
      <p>${t("dash_wallet_empty")}</p>
    </div>`;
  } else {
    for (const w of dashWallets) {
      html += walletCardHtml(w);
    }
  }

  // ── Manual assets section ──────────────────────────────────────────────────
  html += `<div class="dash-section-header" style="margin-top:18px">
    <span class="dash-section-title">${t("dash_manual_title")}</span>
    <button class="dash-add-btn" onclick="openDashManualModal()">${t("dash_add_manual")}</button>
  </div>`;

  if (dashManual.length === 0) {
    html += `<div class="dash-empty">
      <div class="dash-empty-icon">📋</div>
      <p>${t("dash_manual_empty")}</p>
    </div>`;
  } else {
    html += `<div class="dash-token-list">`;
    for (const a of dashManual) {
      const cm  = chainMeta(a.network);
      const val = (a.balance || 0) * (a.price_usd || 0);
      const img = `<span class="dash-tok-icon-fb">${(a.symbol || "?")[0]}</span>`;
      html += `<div class="dash-token-row">
        <div class="dash-tok-left">
          ${img}
          <div class="dash-tok-info">
            <span class="dash-tok-sym">${escHtml(a.symbol)}</span>
            ${a.name ? `<span class="dash-tok-name">${escHtml(a.name)}</span>` : ""}
          </div>
        </div>
        <div class="dash-tok-mid">
          ${a.network ? `<span class="dash-net-badge" style="--nc:${cm.color}">${cm.name}</span>` : ""}
        </div>
        <div class="dash-tok-right">
          <span class="dash-tok-val">${fmtDashUsd(val)}</span>
          <span class="dash-tok-bal">${fmtDashBal(a.balance)} ${escHtml(a.symbol)}</span>
        </div>
        <button class="dash-del-inline" onclick="deleteManualAsset('${a.id}')" title="${t('dash_remove_title')}">✕</button>
      </div>`;
    }
    html += `</div>`;
  }

  el.innerHTML = html;
}

// ── Wallet card ────────────────────────────────────────────────────────────────

function walletCardHtml(w) {
  const tokens  = w.tokens  || [];
  const defi    = w.defi    || [];
  const perps   = w.perps   || [];

  const tokUsd  = tokens.reduce((s, t) => s + (t.value_usd || 0), 0);
  const defiUsd = defi.reduce((s, d)   => s + (d.net_usd   || 0), 0);
  const perpsUsd= perps.reduce((s, p)  => s + (p.net_usd   || 0), 0);
  const totalUsd= tokUsd + defiUsd + perpsUsd;

  const label    = w.label || shortAddr(w.address);
  const isLoaded = !!w.last_updated;
  const isOpen   = dashExpanded.has(w.address);
  const activeTab= dashActiveTab[w.address] || "tokens";

  const chevron  = isOpen ? "▼" : "▶";

  let html = `<div class="dash-wallet-card" id="dwc-${w.address}">
    <div class="dwc-header" onclick="toggleWalletCard('${w.address}')">
      <div class="dwc-header-left">
        <span class="dwc-chevron" id="dwc-chev-${w.address}">${chevron}</span>
        <div class="dwc-info">
          <span class="dwc-label">${escHtml(label)}</span>
          <span class="dwc-addr" title="${w.address}">${shortAddr(w.address)}</span>
        </div>
      </div>
      <div class="dwc-header-right">
        <span class="dwc-total">${fmtDashUsd(totalUsd)}</span>
        <div class="dwc-btns" onclick="event.stopPropagation()">
          <button class="dash-icon-btn" id="dwc-ref-${w.address}" onclick="refreshWallet('${w.address}')" title="${t('dash_refresh_title')}">↻</button>
          <button class="dash-icon-btn dash-del-btn" onclick="deleteWallet('${w.address}')" title="${t('dash_remove_title')}">✕</button>
        </div>
      </div>
    </div>
    <div class="dwc-body" id="dwc-body-${w.address}" style="${isOpen ? '' : 'display:none'}">`;

  if (!isLoaded) {
    html += `<div class="dash-unloaded">
      <button class="dash-load-btn" id="dwc-load-${w.address}" onclick="refreshWallet('${w.address}')">${t("dash_load_btn")}</button>
    </div>`;
  } else {
    const tabs = [
      { id: "tokens", label: t("dash_tab_tokens"), count: tokens.length, usd: tokUsd },
      { id: "defi",   label: t("dash_tab_defi"),   count: defi.length,   usd: defiUsd },
      { id: "perps",  label: t("dash_tab_perps"),  count: perps.length,  usd: perpsUsd },
    ];

    html += `<div class="dwc-tabbar" id="dwc-tabbar-${w.address}">`;
    for (const tab of tabs) {
      const active = activeTab === tab.id ? " active" : "";
      html += `<button class="dwc-tab${active}" onclick="switchWalletTab('${w.address}','${tab.id}',this)">
        ${tab.label}
        <span class="dwc-tab-badge">${tab.count > 0 ? tab.count + " · " + fmtDashUsd(tab.usd) : "—"}</span>
      </button>`;
    }
    html += `</div>`;

    // Tokens tab
    html += `<div class="dwc-tab-pane" id="dwc-pane-tokens-${w.address}" style="${activeTab === 'tokens' ? '' : 'display:none'}">`;
    if (tokens.length === 0) {
      html += `<div class="dash-token-empty">${t("dash_empty_tokens")}</div>`;
    } else {
      html += tokensGroupedHtml(tokens, w.address);
    }
    html += `</div>`;

    // DeFi tab
    html += `<div class="dwc-tab-pane" id="dwc-pane-defi-${w.address}" style="${activeTab === 'defi' ? '' : 'display:none'}">`;
    if (defi.length === 0) {
      html += `<div class="dash-token-empty">${t("dash_empty_defi")}</div>`;
    } else {
      for (const d of defi) html += defiRowHtml(d);
    }
    html += `</div>`;

    // Perps tab
    html += `<div class="dwc-tab-pane" id="dwc-pane-perps-${w.address}" style="${activeTab === 'perps' ? '' : 'display:none'}">`;
    if (perps.length === 0) {
      html += `<div class="dash-token-empty">${t("dash_empty_perps")}</div>`;
    } else {
      for (const p of perps) html += defiRowHtml(p);
    }
    html += `</div>`;
  }

  html += `</div></div>`;
  return html;
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

function switchWalletTab(address, tab, btn) {
  ["tokens","defi","perps"].forEach(t => {
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

  let html = `<div class="dash-tok-group">
    <div class="dash-token-row dash-tok-group-hdr" ${clickAttr}>
      <div class="dash-tok-left">
        ${imgEl}
        <div class="dash-tok-info">
          <span class="dash-tok-sym">${escHtml(sym)}</span>
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

function openDashWalletModal() {
  document.getElementById("dash-wallet-modal").classList.remove("hidden");
  document.getElementById("dwm-address").value  = "";
  document.getElementById("dwm-svm").value      = "";
  document.getElementById("dwm-label").value    = "";
  document.getElementById("dwm-err").textContent = "";
  setTimeout(() => document.getElementById("dwm-address").focus(), 50);
}

function closeDashWalletModal() {
  document.getElementById("dash-wallet-modal").classList.add("hidden");
}

async function submitDashWallet() {
  const address = document.getElementById("dwm-address").value.trim();
  const svm     = document.getElementById("dwm-svm").value.trim();
  const label   = document.getElementById("dwm-label").value.trim();
  const errEl   = document.getElementById("dwm-err");
  if (!address) { errEl.textContent = t("dash_err_evm_required"); return; }
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    errEl.textContent = t("dash_err_evm_invalid");
    return;
  }
  if (svm && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(svm)) {
    errEl.textContent = t("dash_err_sol_invalid");
    return;
  }
  errEl.textContent = "";
  const btn = document.getElementById("dwm-submit");
  btn.disabled = true; btn.textContent = t("dash_adding");
  try {
    const r = await fetch("/api/dashboard/wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, svm_address: svm, label })
    });
    const d = await r.json();
    if (!r.ok) { errEl.textContent = d.error || t("dash_err_add"); return; }
    closeDashWalletModal();
    await refreshWallet(address.toLowerCase());
  } finally {
    btn.disabled = false; btn.textContent = t("dash_add_btn");
  }
}

// ── Manual modal ───────────────────────────────────────────────────────────────

function openDashManualModal() {
  document.getElementById("dash-manual-modal").classList.remove("hidden");
  ["dmm-sym","dmm-name","dmm-net","dmm-bal","dmm-price"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("dmm-err").textContent = "";
  setTimeout(() => document.getElementById("dmm-sym").focus(), 50);
}

function closeDashManualModal() {
  document.getElementById("dash-manual-modal").classList.add("hidden");
}

async function submitDashManual() {
  const symbol    = document.getElementById("dmm-sym").value.trim();
  const name      = document.getElementById("dmm-name").value.trim();
  const network   = document.getElementById("dmm-net").value.trim();
  const balance   = parseFloat(document.getElementById("dmm-bal").value)   || 0;
  const price_usd = parseFloat(document.getElementById("dmm-price").value) || 0;
  const errEl = document.getElementById("dmm-err");
  if (!symbol) { errEl.textContent = t("dash_err_symbol"); return; }
  errEl.textContent = "";
  const btn = document.getElementById("dmm-submit");
  btn.disabled = true;
  try {
    const r = await fetch("/api/dashboard/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol, name, network, balance, price_usd })
    });
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
  const refBtn  = document.getElementById(`dwc-ref-${address}`);
  const loadBtn = document.getElementById(`dwc-load-${address}`);
  if (refBtn)  { refBtn.style.opacity = "0.4"; refBtn.style.pointerEvents = "none"; }
  if (loadBtn) { loadBtn.textContent = t("dash_loading"); loadBtn.disabled = true; }
  try {
    const r = await fetch(`/api/dashboard/wallets/${address}/refresh`, { method: "POST" });
    const d = await r.json();
    if (!r.ok) {
      showDashError(address, d.error || t("dash_err_load"));
      if (refBtn) { refBtn.style.opacity = ""; refBtn.style.pointerEvents = ""; }
      return;
    }
  } catch (e) {
    showDashError(address, t("dash_err_network"));
    if (refBtn) { refBtn.style.opacity = ""; refBtn.style.pointerEvents = ""; }
    return;
  }
  // Auto-expand the card so data is visible immediately after refresh
  dashExpanded.add(address);
  await loadDashboard();
}

// ── Auto-refresh all wallets every 3 minutes when dashboard is visible ─────────
let _dashRefreshTimer = null;

function startDashAutoRefresh() {
  if (_dashRefreshTimer) return;
  _dashRefreshTimer = setInterval(async () => {
    const dashSection = document.getElementById("section-dashboard");
    if (!dashSection || dashSection.classList.contains("hidden")) return;
    for (const w of dashWallets) {
      if (w.last_updated) {
        // fire-and-forget; refreshWallet already calls loadDashboard when done
        refreshWallet(w.address).catch(() => {});
      }
    }
  }, 3 * 60 * 1000); // every 3 minutes
}

startDashAutoRefresh();

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

async function deleteManualAsset(id) {
  await fetch(`/api/dashboard/manual/${id}`, { method: "DELETE" });
  await loadDashboard();
}
