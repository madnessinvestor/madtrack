let searchTimeout = null;
let pendingSymbol = null;

// ─── Watchlist ────────────────────────────────────────────────────────────

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
      list.innerHTML = assets.map(a => {
        const hasPrice = a.price !== null && a.price !== undefined;
        const up = (a.change24h || 0) >= 0;
        const changeClass = up ? "up" : "down";
        const changeSign = up ? "▲" : "▼";
        const changeAbs = Math.abs(a.change24h ?? 0).toFixed(2);
        return `<div class="asset-card">
          <div class="asset-left">
            <div class="asset-icon">${a.symbol.slice(0,4)}</div>
            <div>
              <div class="asset-symbol">${a.symbol}</div>
              ${a.source ? `<div class="asset-source">${a.source}</div>` : ""}
            </div>
          </div>
          <div class="asset-right">
            <div class="asset-price">${hasPrice ? formatUSD(a.price) : "—"}</div>
            ${hasPrice ? `<div class="asset-change ${changeClass}">${changeSign} ${changeAbs}%</div>` : ""}
          </div>
          <button class="btn-delete" onclick="deleteAsset('${a.symbol}')">✕</button>
        </div>`;
      }).join("");
    }

    const now = new Date();
    lastUpdate.textContent = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
  } catch {
    list.innerHTML = `<div class="empty-state"><p>Erro ao carregar. Verifique a conexão.</p></div>`;
  }
}

function formatUSD(v) {
  if (v >= 1000) return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v >= 1)    return "$" + v.toFixed(2);
  if (v > 0)     return "$" + v.toFixed(6);
  return "$0.00";
}

async function deleteAsset(symbol) {
  await fetch(`/api/assets/${encodeURIComponent(symbol)}`, { method: "DELETE" });
  loadAssets();
}

// ─── Modal / Search ───────────────────────────────────────────────────────

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
  const result = document.getElementById("price-result");
  const error = document.getElementById("price-error");
  const spinner = document.getElementById("search-spinner");

  result.classList.add("hidden");
  error.classList.add("hidden");
  pendingSymbol = null;

  if (sym.length < 1) { spinner.classList.add("hidden"); return; }

  spinner.classList.remove("hidden");

  searchTimeout = setTimeout(() => fetchTickerPrice(sym), 500);
}

async function fetchTickerPrice(sym) {
  const result = document.getElementById("price-result");
  const error = document.getElementById("price-error");
  const spinner = document.getElementById("search-spinner");

  try {
    const res = await fetch(`/api/price?symbol=${encodeURIComponent(sym)}`);
    spinner.classList.add("hidden");

    if (!res.ok) {
      error.classList.remove("hidden");
      return;
    }

    const data = await res.json();
    pendingSymbol = sym;

    document.getElementById("pr-symbol").textContent = data.symbol;
    document.getElementById("pr-price").textContent = formatUSD(data.price);

    const changeEl = document.getElementById("pr-change");
    if (data.change24h !== null && data.change24h !== undefined) {
      const up = data.change24h >= 0;
      changeEl.textContent = (up ? "▲ " : "▼ ") + Math.abs(data.change24h).toFixed(2) + "%";
      changeEl.className = "pr-change " + (up ? "up" : "down");
    } else {
      changeEl.textContent = "";
    }

    document.getElementById("pr-source").textContent = "via " + (data.source || "—");
    result.classList.remove("hidden");
  } catch {
    spinner.classList.add("hidden");
    error.classList.remove("hidden");
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
