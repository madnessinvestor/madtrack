// ─── Dashboard (on-chain wallets) ─────────────────────────────────────────────

let dashWallets      = [];
let dashManual       = [];
let dashLoaded       = false;
let dashAnkrOk       = false;

const CHAIN_META = {
  eth:        { name: "Ethereum",   color: "#627eea" },
  bsc:        { name: "BNB Chain",  color: "#f0b90b" },
  polygon:    { name: "Polygon",    color: "#8247e5" },
  arbitrum:   { name: "Arbitrum",   color: "#28a0f0" },
  optimism:   { name: "Optimism",   color: "#ff0420" },
  avalanche:  { name: "Avalanche",  color: "#e84142" },
  fantom:     { name: "Fantom",     color: "#1969ff" },
  base:       { name: "Base",       color: "#0052ff" },
  gnosis:     { name: "Gnosis",     color: "#04795b" },
  linea:      { name: "Linea",      color: "#61dfff" },
  scroll:     { name: "Scroll",     color: "#eebb6a" },
  zksync:     { name: "zkSync",     color: "#8c8dfc" },
  cronos:     { name: "Cronos",     color: "#002d74" },
  celo:       { name: "Celo",       color: "#35d07f" },
  moonbeam:   { name: "Moonbeam",   color: "#53cbc9" },
  harmony:    { name: "Harmony",    color: "#00aee9" },
  klaytn:     { name: "Klaytn",     color: "#ff6b37" },
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
  const [sr, wr, mr] = await Promise.all([
    fetch("/api/dashboard/status"),
    fetch("/api/dashboard/wallets"),
    fetch("/api/dashboard/manual")
  ]);
  const status = await sr.json();
  dashAnkrOk   = status.ankr_configured;
  dashWallets  = await wr.json();
  dashManual   = await mr.json();
  dashLoaded   = true;
  renderDashboard();
}

function renderDashboard() {
  const el = document.getElementById("dash-content");
  if (!el) return;

  const totalWalletUsd = dashWallets.reduce((s, w) =>
    s + (w.tokens || []).reduce((ts, t) => ts + (t.value_usd || 0), 0), 0);
  const totalManualUsd = dashManual.reduce((s, a) =>
    s + (a.balance || 0) * (a.price_usd || 0), 0);
  const grandTotal = totalWalletUsd + totalManualUsd;

  let html = "";

  if (!dashAnkrOk) {
    html += `<div class="dash-ankr-warn">
      <div class="dash-ankr-warn-icon">🔑</div>
      <div class="dash-ankr-warn-body">
        <b>Chave Ankr não configurada</b> — necessária para buscar saldos on-chain.<br>
        1. Crie uma conta gratuita em <a href="https://www.ankr.com/rpc/" target="_blank">ankr.com/rpc</a><br>
        2. Gere uma API key (Free tier) e adicione como secret <code>ANKR_API_KEY</code> no Replit.<br>
        <span style="opacity:0.7">Ativos manuais funcionam sem a chave.</span>
      </div>
    </div>`;
  }

  if (grandTotal > 0) {
    html += `<div class="dash-total-bar">
      <span class="dash-total-label">Total On-Chain</span>
      <span class="dash-total-val">${fmtDashUsd(grandTotal)}</span>
    </div>`;
  }

  // ── Wallets section ────────────────────────────────────────────────────────
  html += `<div class="dash-section-header">
    <span class="dash-section-title">🔗 Carteiras EVM</span>
    <button class="dash-add-btn" onclick="openDashWalletModal()">+ Carteira</button>
  </div>`;

  if (dashWallets.length === 0) {
    html += `<div class="dash-empty">
      <div class="dash-empty-icon">🦊</div>
      <p>Adicione o endereço público de uma carteira EVM.<br>Serão listados todos os ativos em cada rede.</p>
    </div>`;
  } else {
    for (const w of dashWallets) {
      const totalUsd  = (w.tokens || []).reduce((s, t) => s + (t.value_usd || 0), 0);
      const label     = w.label || shortAddr(w.address);
      const updatedAt = w.last_updated
        ? new Date(w.last_updated + "Z").toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : null;
      const tokenCount = (w.tokens || []).length;

      html += `<div class="dash-wallet-card" id="dwc-${w.address}">
        <div class="dash-wallet-header">
          <div class="dash-wallet-info">
            <span class="dash-wallet-label">${escHtml(label)}</span>
            <span class="dash-wallet-addr" title="${w.address}">${shortAddr(w.address)}</span>
          </div>
          <div class="dash-wallet-meta">
            <span class="dash-wallet-total">${fmtDashUsd(totalUsd)}</span>
            ${updatedAt ? `<span class="dash-wallet-time">${tokenCount} ativos · ${updatedAt}</span>` : `<span class="dash-wallet-time">não carregado</span>`}
          </div>
          <div class="dash-wallet-btns">
            <button class="dash-icon-btn" id="dwc-ref-${w.address}" onclick="refreshWallet('${w.address}')" title="Atualizar">↻</button>
            <button class="dash-icon-btn dash-del-btn" onclick="deleteWallet('${w.address}')" title="Remover">✕</button>
          </div>
        </div>`;

      if (!w.last_updated) {
        html += `<div class="dash-unloaded">
          ${dashAnkrOk
            ? `<button class="dash-load-btn" id="dwc-load-${w.address}" onclick="refreshWallet('${w.address}')">Carregar ativos desta carteira</button>`
            : `<span class="dash-load-hint">Configure ANKR_API_KEY para carregar</span>`}
        </div>`;
      } else if (!w.tokens || w.tokens.length === 0) {
        html += `<div class="dash-token-empty">Nenhum ativo encontrado nesta carteira.</div>`;
      } else {
        const networks = [...new Set(w.tokens.map(t => t.network))];
        html += `<div class="dash-net-filter" id="dnf-${w.address}">`;
        html += `<button class="dash-net-pill active" data-net="all" onclick="filterDashNet('${w.address}','all',this)">Todas</button>`;
        for (const net of networks) {
          const cm = chainMeta(net);
          html += `<button class="dash-net-pill" data-net="${net}" onclick="filterDashNet('${w.address}','${net}',this)" style="--nc:${cm.color}">${cm.name}</button>`;
        }
        html += `</div>`;
        html += `<div class="dash-token-list" id="dtl-${w.address}">`;
        for (const t of w.tokens) {
          html += tokenRowHtml(t);
        }
        html += `</div>`;
      }
      html += `</div>`;
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

function filterDashNet(address, net, btn) {
  const list = document.getElementById(`dtl-${address}`);
  if (!list) return;
  list.querySelectorAll(".dash-token-row").forEach(row => {
    row.style.display = (net === "all" || row.dataset.net === net) ? "" : "none";
  });
  const bar = document.getElementById(`dnf-${address}`);
  if (bar) bar.querySelectorAll(".dash-net-pill").forEach(p => p.classList.toggle("active", p === btn));
}

function escHtml(s) {
  return String(s || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
}

// ── Wallet modal ───────────────────────────────────────────────────────────────

function openDashWalletModal() {
  document.getElementById("dash-wallet-modal").classList.remove("hidden");
  document.getElementById("dwm-address").value = "";
  document.getElementById("dwm-label").value   = "";
  document.getElementById("dwm-err").textContent = "";
  setTimeout(() => document.getElementById("dwm-address").focus(), 50);
}

function closeDashWalletModal() {
  document.getElementById("dash-wallet-modal").classList.add("hidden");
}

async function submitDashWallet() {
  const address = document.getElementById("dwm-address").value.trim();
  const label   = document.getElementById("dwm-label").value.trim();
  const errEl   = document.getElementById("dwm-err");
  if (!address) { errEl.textContent = "Informe o endereço da carteira."; return; }
  if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
    errEl.textContent = "Endereço EVM inválido (0x + 40 caracteres hex).";
    return;
  }
  errEl.textContent = "";
  const btn = document.getElementById("dwm-submit");
  btn.disabled = true; btn.textContent = "Adicionando…";
  try {
    const r = await fetch("/api/dashboard/wallets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address, label })
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
