let selectedCoin = null;
let searchTimeout = null;

async function loadAssets() {
  const list = document.getElementById("asset-list");
  const totalEl = document.getElementById("total-value");
  const lastUpdate = document.getElementById("last-update");

  try {
    const res = await fetch("/api/assets");
    const assets = await res.json();

    let total = 0;
    assets.forEach(a => total += a.value);

    totalEl.textContent = formatUSD(total);

    if (assets.length === 0) {
      list.innerHTML = `<div class="empty-state">
        <div style="font-size:2.5rem">📊</div>
        <p>Nenhum ativo adicionado.<br>Clique em + Adicionar para começar.</p>
      </div>`;
    } else {
      list.innerHTML = assets.map(a => {
        const changeClass = a.change24h >= 0 ? "up" : "down";
        const changeSign = a.change24h >= 0 ? "+" : "";
        const icon = a.symbol.slice(0, 4);
        return `<div class="asset-card">
          <button class="btn-delete" onclick="deleteAsset('${a.id}')" title="Remover">✕</button>
          <div class="asset-icon">${icon}</div>
          <div class="asset-info">
            <div class="asset-symbol">${a.symbol}</div>
            <div class="asset-qty">${formatQty(a.qty)} unid.</div>
          </div>
          <div class="asset-right">
            <div class="asset-price">${formatUSD(a.price)}</div>
            <div class="asset-value">${formatUSD(a.value)}</div>
            <div class="asset-change ${changeClass}">${changeSign}${a.change24h.toFixed(2)}%</div>
          </div>
        </div>`;
      }).join("");
    }

    const now = new Date();
    lastUpdate.textContent = `Atualizado às ${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
  } catch (e) {
    list.innerHTML = `<div class="empty-state"><p>Erro ao carregar. Verifique sua conexão.</p></div>`;
  }
}

function formatUSD(v) {
  if (v >= 1000) return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
  if (v >= 1) return "$" + v.toFixed(2);
  if (v > 0) return "$" + v.toFixed(6);
  return "$0.00";
}

function formatQty(q) {
  if (q === 0) return "0";
  if (q >= 1000) return q.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (q >= 1) return q.toFixed(4).replace(/\.?0+$/, "");
  return q.toFixed(6).replace(/\.?0+$/, "");
}

async function deleteAsset(id) {
  await fetch(`/api/assets/${id}`, { method: "DELETE" });
  loadAssets();
}

function openModal() {
  selectedCoin = null;
  document.getElementById("search-input").value = "";
  document.getElementById("search-results").innerHTML = "";
  document.getElementById("selected-coin").classList.add("hidden");
  document.getElementById("qty-input").value = "";
  document.getElementById("modal").classList.remove("hidden");
  setTimeout(() => document.getElementById("search-input").focus(), 100);
}

function closeModal() {
  document.getElementById("modal").classList.add("hidden");
}

async function searchCoin(q) {
  clearTimeout(searchTimeout);
  const results = document.getElementById("search-results");
  const selected = document.getElementById("selected-coin");

  if (!q.trim()) {
    results.innerHTML = "";
    selected.classList.add("hidden");
    selectedCoin = null;
    return;
  }

  searchTimeout = setTimeout(async () => {
    results.innerHTML = `<li style="color:#888;border:none;background:none">Buscando...</li>`;
    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
    const coins = await res.json();
    if (coins.length === 0) {
      results.innerHTML = `<li style="color:#888;border:none;background:none">Nenhum resultado</li>`;
      return;
    }
    results.innerHTML = coins.map(c =>
      `<li onclick="selectCoin('${c.id}','${c.symbol}','${c.name.replace(/'/g,"\\'")}')">
        <span class="result-symbol">${c.symbol.toUpperCase()}</span>
        <span class="result-name">${c.name}</span>
      </li>`
    ).join("");
  }, 400);
}

function selectCoin(id, symbol, name) {
  selectedCoin = { id, symbol };
  document.getElementById("search-input").value = name;
  document.getElementById("search-results").innerHTML = "";
  document.getElementById("selected-name").textContent = `${name} (${symbol.toUpperCase()})`;
  document.getElementById("selected-coin").classList.remove("hidden");
  document.getElementById("qty-input").focus();
}

async function addAsset() {
  if (!selectedCoin) return;
  const qty = parseFloat(document.getElementById("qty-input").value);
  if (isNaN(qty) || qty <= 0) {
    document.getElementById("qty-input").focus();
    return;
  }
  await fetch("/api/assets", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: selectedCoin.id, symbol: selectedCoin.symbol, qty })
  });
  closeModal();
  loadAssets();
}

document.getElementById("modal").addEventListener("click", function(e) {
  if (e.target === this) closeModal();
});

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/static/sw.js").catch(() => {});
}

loadAssets();
setInterval(loadAssets, 60000);
