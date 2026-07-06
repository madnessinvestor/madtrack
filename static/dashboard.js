// ─── Dashboard (on-chain wallets) ─────────────────────────────────────────────

let dashWallets      = [];
let dashManual       = [];
let dashLoaded       = false;
const dashExpanded   = new Set();
const dashActiveTab  = {};

const CHAIN_META = {
  // Jumper chain keys
  eth:        { name: "Ethereum",   color: "#627eea" },
  bsc:        { name: "BNB Chain",  color: "#f0b90b" },
  pol:        { name: "Polygon",    color: "#8247e5" },
  arb:        { name: "Arbitrum",   color: "#28a0f0" },
  opt:        { name: "Optimism",   color: "#ff0420" },
  avax:       { name: "Avalanche",  color: "#e84142" },
  ftm:        { name: "Fantom",     color: "#1969ff" },
  base:       { name: "Base",       color: "#0052ff" },
  gnosis:     { name: "Gnosis",     color: "#04795b" },
  linea:      { name: "Linea",      color: "#61dfff" },
  scrl:       { name: "Scroll",     color: "#eebb6a" },
  era:        { name: "zkSync Era", color: "#8c8dfc" },
  cro:        { name: "Cronos",     color: "#002d74" },
  celo:       { name: "Celo",       color: "#35d07f" },
  mnt:        { name: "Mantle",     color: "#50e3c2" },
  blast:      { name: "Blast",      color: "#fcfc03" },
  mode:       { name: "Mode",       color: "#dffe00" },
  sol:        { name: "Solana",     color: "#9945ff" },
  // legacy / alternate aliases
  polygon:    { name: "Polygon",    color: "#8247e5" },
  arbitrum:   { name: "Arbitrum",   color: "#28a0f0" },
  optimism:   { name: "Optimism",   color: "#ff0420" },
  avalanche:  { name: "Avalanche",  color: "#e84142" },
  scroll:     { name: "Scroll",     color: "#eebb6a" },
  zksync:     { name: "zkSync",     color: "#8c8dfc" },
};

function chainMeta(id) {
  return CHAIN_META[(id || "").toLowerCase()] || { name: (id || "?").toUpperCase(), color: "#888" };
}

function fmtDashUsd(v) {
  if (v == null || isNaN(v) || v === 0) return "—";
  if (v >= 1e6)  return "$" + (v / 1e6).toFixed(2) + "M";
  if (v >= 1000) return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 1)    return "$" + v.toFixed(2);
  if (v >= 0.001) return "$" + v.toFixed(4);
  return "$" + v.toPrecision(3);
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
    const prps  = (w.perps  || []).reduce((ts, p) => ts + (p.value_usd || 0), 0);
    return s + tok + dfi + prps;
  }, 0);
  const totalManualUsd = dashManual.reduce((s, a) =>
    s + (a.balance || 0) * (a.price_usd || 0), 0);
  const grandTotal = totalWalletUsd + totalManualUsd;

  let html = "";

  if (grandTotal > 0) {
    html += `<div class="dash-total-bar">
      <span class="dash-total-label">Total On-Chain</span>
      <span class="dash-total-val">${fmtDashUsd(grandTotal)}</span>
    </div>`;
  }

  // ── Wallets section ────────────────────────────────────────────────────────
  html += `<div class="dash-section-header">
    <span class="dash-section-title">🔗 Carteiras On-Chain</span>
    <button class="dash-add-btn" onclick="openDashWalletModal()">+ Carteira</button>
  </div>`;

  if (dashWallets.length === 0) {
    html += `<div class="dash-empty">
      <div class="dash-empty-icon">🦊</div>
      <p>Adicione o endereço público de uma carteira EVM (e opcionalmente Solana).<br>Serão listados todos os ativos em cada rede.</p>
    </div>`;
  } else {
    for (const w of dashWallets) {
      html += walletCardHtml(w);
    }
  }

  // ── Manual assets section ──────────────────────────────────────────────────
  html += `<div class="dash-section-header" style="margin-top:18px">
    <span class="dash-section-title">📝 Ativos Manuais</span>
    <button class="dash-add-btn" onclick="openDashManualModal()">+ Ativo</button>
  </div>`;

  if (dashManual.length === 0) {
    html += `<div class="dash-empty">
      <div class="dash-empty-icon">📋</div>
      <p>Adicione ativos on-chain manualmente com rede, saldo e preço.</p>
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
        <button class="dash-del-inline" onclick="deleteManualAsset('${a.id}')" title="Remover">✕</button>
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
  const perpsUsd= perps.reduce((s, p)  => s + (p.value_usd || 0), 0);
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
          <button class="dash-icon-btn" id="dwc-ref-${w.address}" onclick="refreshWallet('${w.address}')" title="Atualizar">↻</button>
          <button class="dash-icon-btn dash-del-btn" onclick="deleteWallet('${w.address}')" title="Remover">✕</button>
        </div>
      </div>
    </div>
    <div class="dwc-body" id="dwc-body-${w.address}" style="${isOpen ? '' : 'display:none'}">`;

  if (!isLoaded) {
    html += `<div class="dash-unloaded">
      <button class="dash-load-btn" id="dwc-load-${w.address}" onclick="refreshWallet('${w.address}')">Carregar ativos desta carteira</button>
    </div>`;
  } else {
    const tabs = [
      { id: "tokens", label: "Tokens", count: tokens.length, usd: tokUsd },
      { id: "defi",   label: "DeFi",   count: defi.length,   usd: defiUsd },
      { id: "perps",  label: "Perps",  count: perps.length,  usd: perpsUsd },
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
      html += `<div class="dash-token-empty">Nenhum token on-chain encontrado.</div>`;
    } else {
      for (const t of tokens) html += tokenRowHtml(t);
    }
    html += `</div>`;

    // DeFi tab
    html += `<div class="dwc-tab-pane" id="dwc-pane-defi-${w.address}" style="${activeTab === 'defi' ? '' : 'display:none'}">`;
    if (defi.length === 0) {
      html += `<div class="dash-token-empty">Nenhuma posição DeFi encontrada.</div>`;
    } else {
      for (const d of defi) html += defiRowHtml(d);
    }
    html += `</div>`;

    // Perps tab
    html += `<div class="dwc-tab-pane" id="dwc-pane-perps-${w.address}" style="${activeTab === 'perps' ? '' : 'display:none'}">`;
    if (perps.length === 0) {
      html += `<div class="dash-token-empty">Nenhuma posição Hyperliquid encontrada.</div>`;
    } else {
      for (const p of perps) html += perpRowHtml(p);
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

function tokenRowHtml(t) {
  const cm  = chainMeta(t.network);
  const img = t.thumbnail
    ? `<img class="dash-tok-icon" src="${escHtml(t.thumbnail)}" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><span class="dash-tok-icon-fb" style="display:none">${(t.symbol||"?")[0]}</span>`
    : `<span class="dash-tok-icon-fb">${(t.symbol||"?")[0]}</span>`;
  return `<div class="dash-token-row" data-net="${t.network}">
    <div class="dash-tok-left">
      ${img}
      <div class="dash-tok-info">
        <span class="dash-tok-sym">${escHtml(t.symbol)}</span>
        ${t.name ? `<span class="dash-tok-name">${escHtml(t.name)}</span>` : ""}
      </div>
    </div>
    <div class="dash-tok-mid">
      <span class="dash-net-badge" style="--nc:${cm.color}">${cm.name}</span>
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
    ? `<span class="defi-debt-line">Dívida: ${fmtDashUsd(d.debt_usd)}</span>` : "";

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

function perpRowHtml(p) {
  const isPerp  = p.kind === "perp";
  const sideEl  = isPerp
    ? `<span class="perp-side-badge ${p.side === 'LONG' ? 'perp-long' : 'perp-short'}">${p.side}</span>`
    : `<span class="perp-side-badge perp-spot">SPOT</span>`;
  const pnlEl   = (isPerp && p.pnl != null)
    ? `<span class="perp-pnl ${p.pnl >= 0 ? 'perp-pnl-pos' : 'perp-pnl-neg'}">${p.pnl >= 0 ? "+" : ""}${fmtDashUsd(p.pnl)}</span>`
    : "";
  return `<div class="perp-row">
    <div class="dash-tok-left">
      <span class="dash-tok-icon-fb">${(p.symbol||"?")[0]}</span>
      <div class="dash-tok-info">
        <span class="dash-tok-sym">${escHtml(p.symbol)}</span>
        ${sideEl}
      </div>
    </div>
    <div class="dash-tok-mid"></div>
    <div class="dash-tok-right">
      <span class="dash-tok-val">${fmtDashUsd(p.value_usd)}</span>
      <span class="dash-tok-bal">${fmtDashBal(p.balance)} ${escHtml(p.symbol)}</span>
      ${pnlEl}
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
  if (!address) { errEl.textContent = "Informe o endereço EVM da carteira."; return; }
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    errEl.textContent = "Endereço EVM inválido (0x + 40 caracteres hex).";
    return;
  }
  if (svm && !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(svm)) {
    errEl.textContent = "Endereço Solana inválido (base58, 32-44 chars).";
    return;
  }
  errEl.textContent = "";
  const btn = document.getElementById("dwm-submit");
  btn.disabled = true; btn.textContent = "Adicionando…";
  try {
    const r = await fetch("/api/dashboard/wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, svm_address: svm, label })
    });
    const d = await r.json();
    if (!r.ok) { errEl.textContent = d.error || "Erro ao adicionar."; return; }
    closeDashWalletModal();
    await loadDashboard();
    refreshWallet(address.toLowerCase());
  } finally {
    btn.disabled = false; btn.textContent = "Adicionar";
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
  if (!symbol) { errEl.textContent = "Símbolo obrigatório."; return; }
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
    if (!r.ok) { errEl.textContent = d.error || "Erro."; return; }
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
  if (loadBtn) { loadBtn.textContent = "Carregando…"; loadBtn.disabled = true; }
  try {
    const r = await fetch(`/api/dashboard/wallets/${address}/refresh`, { method: "POST" });
    const d = await r.json();
    if (!r.ok) {
      showDashError(address, d.error || "Erro ao carregar carteira.");
      if (refBtn) { refBtn.style.opacity = ""; refBtn.style.pointerEvents = ""; }
      return;
    }
  } catch (e) {
    showDashError(address, "Erro de rede ao carregar carteira.");
    if (refBtn) { refBtn.style.opacity = ""; refBtn.style.pointerEvents = ""; }
    return;
  }
  await loadDashboard();
}

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
  if (!confirm("Remover esta carteira do Dashboard?")) return;
  await fetch(`/api/dashboard/wallets/${address}`, { method: "DELETE" });
  await loadDashboard();
}

async function deleteManualAsset(id) {
  await fetch(`/api/dashboard/manual/${id}`, { method: "DELETE" });
  await loadDashboard();
}
