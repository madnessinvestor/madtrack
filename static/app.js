let searchTimeout = null;

async function loadAssets() {
  const list = document.getElementById("asset-list");
  const lastUpdate = document.getElementById("last-update");

  try {
    const res = await fetch("/api/assets");
    const assets = await res.json();

    if (assets.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <div class="empty-icon">📊</div>
        <p>Nenhum ativo adicionado.<br>Clique em + Adicionar para começar.</p>
      </div>`;
    } else {
      list.innerHTML = assets.map(a => {
        const hasPrice = a.price !== null;
        const changeClass = (a.change24h || 0) >= 0 ? "up" : "down";
        const changeSign = (a.change24h || 0) >= 0 ? "▲" : "▼";
        const changeAbs = Math.abs(a.change24h || 0).toFixed(2);
        return `<div class="asset-card">
          <div class="asset-left">
            <div class="asset-icon">${a.symbol.slice(0,4)}</div>
            <div>
              <div class="asset-symbol">${a.symbol}</div>
              <div class="asset-name">${a.name}</div>
            </div>
          </div>
          <div class="asset-right">
            <div class="asset-price">${hasPrice ? formatUSD(a.price) : "—"}</div>
            ${hasPrice ? `<div class="asset-change ${changeClass}">${changeSign} ${changeAbs}%</div>` : ""}
          </div>
          <button class="btn-delete" onclick="deleteAsset('${a.id}')">✕</button>
        </div>`;
      }).join("");
    }

    const now = new Date();
    lastUpdate.textContent = `Atualizado às ${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
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

async function deleteAsset(id) {
  await fetch(`/api/assets/${id}`, { method: "DELETE" });
  loadAssets();
}

function openModal() {
  document.getElementById("search-input").value = "";
  document.getElementById("search-results").innerHTML = "";
  document.getElementById("modal").classList.remove("hidden");
  setTimeout(() => document.getElementById("search-input").focus(), 100);
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

async function searchCoin(q) {
  clearTimeout(searchTimeout);
  const results = document.getElementById("search-results");
  if (!q.trim()) { results.innerHTML = ""; return; }

  searchTimeout = setTimeout(async () => {
    results.innerHTML = `<li class="result-loading">Buscando...</li>`;
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const coins = await res.json();
      if (!coins.length) {
        results.innerHTML = `<li class="result-loading">Nenhum resultado</li>`;
        return;
      }
      results.innerHTML = coins.map(c =>
        `<li onclick="addAsset('${c.id}','${c.symbol}','${c.name.replace(/'/g,"\\'")}')">
          <span class="result-symbol">${c.symbol.toUpperCase()}</span>
          <span class="result-name">${c.name}</span>
        </li>`
      ).join("");
    } catch {
      results.innerHTML = `<li class="result-loading">Erro na busca</li>`;
    }
  }, 400);
}

async function addAsset(id, symbol, name) {
  await fetch("/api/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, symbol, name })
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
