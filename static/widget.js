// ─── Widget Config ────────────────────────────────────────────────────────────

const WIDGET_KEY = "madtracker_widget_config";

let widgetConfig = {
  assets:  [],          // tickers selecionados
  size:    "small",
  theme:   "dark",
  refresh: 15,
  showChg:  true,
  showLogo: true,
};

/* Carrega config salva */
function widgetLoadConfig() {
  try {
    const saved = localStorage.getItem(WIDGET_KEY);
    if (saved) Object.assign(widgetConfig, JSON.parse(saved));
  } catch (_) {}
}

/* Chamado ao entrar na aba */
function widgetOnEnter() {
  widgetLoadConfig();
  widgetBuildAssetChips();
  widgetRestoreChips();
  widgetRestoreToggles();
  widgetUpdatePreview();
  widgetTickClock();
}

/* Constrói os chips de ativos a partir da watchlist carregada */
function widgetBuildAssetChips() {
  const wrap = document.getElementById("widget-asset-chips");
  if (!wrap) return;
  // usa a lista global de assets se disponível
  const assets = (typeof cachedAssets !== "undefined" && cachedAssets.length)
    ? cachedAssets
    : [];
  wrap.innerHTML = "";
  if (!assets.length) {
    wrap.innerHTML = `<span style="font-size:0.72rem;color:var(--muted)">Adicione ativos na Watchlist primeiro</span>`;
    return;
  }
  assets.forEach(a => {
    const btn = document.createElement("button");
    btn.className = "widget-chip" + (widgetConfig.assets.includes(a.symbol) ? " active" : "");
    btn.textContent = a.symbol;
    btn.dataset.ticker = a.symbol;
    btn.onclick = () => widgetToggleAsset(btn, a);
    wrap.appendChild(btn);
  });
}

function widgetToggleAsset(btn, asset) {
  const ticker = asset.symbol;
  const idx = widgetConfig.assets.indexOf(ticker);
  if (idx === -1) {
    if (widgetConfig.assets.length >= 5) return; // max 5
    widgetConfig.assets.push(ticker);
    btn.classList.add("active");
  } else {
    widgetConfig.assets.splice(idx, 1);
    btn.classList.remove("active");
  }
  widgetUpdatePreview();
}

/* Restaura seleção de chips de size/theme/refresh */
function widgetRestoreChips() {
  document.querySelectorAll("[data-wgt-size]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.wgtSize === widgetConfig.size);
    btn.onclick = () => {
      document.querySelectorAll("[data-wgt-size]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      widgetConfig.size = btn.dataset.wgtSize;
      widgetUpdatePreview();
    };
  });
  document.querySelectorAll("[data-wgt-theme]").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.wgtTheme === widgetConfig.theme);
    btn.onclick = () => {
      document.querySelectorAll("[data-wgt-theme]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      widgetConfig.theme = btn.dataset.wgtTheme;
      widgetUpdatePreview();
    };
  });
  document.querySelectorAll("[data-wgt-refresh]").forEach(btn => {
    btn.classList.toggle("active", Number(btn.dataset.wgtRefresh) === widgetConfig.refresh);
    btn.onclick = () => {
      document.querySelectorAll("[data-wgt-refresh]").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      widgetConfig.refresh = Number(btn.dataset.wgtRefresh);
    };
  });
}

function widgetRestoreToggles() {
  const chg  = document.getElementById("wgt-toggle-chg");
  const logo = document.getElementById("wgt-toggle-logo");
  if (chg)  chg.checked  = widgetConfig.showChg;
  if (logo) logo.checked = widgetConfig.showLogo;
}

/* Atualiza o card de preview */
function widgetUpdatePreview() {
  const card = document.getElementById("widget-preview-card");
  if (!card) return;

  const chg  = document.getElementById("wgt-toggle-chg");
  const logo = document.getElementById("wgt-toggle-logo");
  widgetConfig.showChg  = chg  ? chg.checked  : true;
  widgetConfig.showLogo = logo ? logo.checked : true;

  // tema do card
  const effectiveTheme = widgetConfig.theme === "auto"
    ? (document.body.dataset.theme === "light" ? "light" : "dark")
    : widgetConfig.theme;
  card.classList.toggle("wpc-light", effectiveTheme === "light");

  // linhas de assets
  const rowsWrap = document.getElementById("wpc-rows");
  if (!rowsWrap) return;

  const selectedTickers = widgetConfig.assets.length
    ? widgetConfig.assets
    : (typeof cachedAssets !== "undefined" && cachedAssets.length)
      ? cachedAssets.slice(0, 2).map(a => a.symbol)
      : ["BTC", "ETH"];

  const assetsMap = {};
  if (typeof cachedAssets !== "undefined") {
    cachedAssets.forEach(a => { assetsMap[a.symbol] = a; });
  }

  rowsWrap.innerHTML = selectedTickers.map(ticker => {
    const a = assetsMap[ticker];
    const price = a ? formatPrice(a.price) : "—";
    const chgVal = a ? (a.change_24h || 0) : 0;
    const chgStr = (chgVal >= 0 ? "+" : "") + chgVal.toFixed(2) + "%";
    const cls = chgVal >= 0 ? "wpc-up" : "wpc-dn";
    const chgHtml = widgetConfig.showChg ? `<span class="wpc-chg ${cls}">${chgStr}</span>` : "";
    return `<div class="wpc-row">
      <span class="wpc-ticker">${ticker}</span>
      <span class="wpc-price">${price}</span>
      ${chgHtml}
    </div>`;
  }).join("");
}

function widgetTickClock() {
  const el = document.getElementById("wpc-time");
  if (!el) return;
  const now = new Date();
  el.textContent = now.getHours().toString().padStart(2, "0") + ":" +
                   now.getMinutes().toString().padStart(2, "0");
}

/* Formata preço resumido para o preview */
function formatPrice(v) {
  if (!v) return "—";
  if (v >= 1000) return "$" + v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (v >= 1)    return "$" + v.toFixed(2);
  return "$" + v.toPrecision(4);
}

/* Salva */
function widgetSaveConfig() {
  try {
    localStorage.setItem(WIDGET_KEY, JSON.stringify(widgetConfig));
  } catch (_) {}

  // feedback visual no botão
  const btn = document.querySelector(".widget-save-btn span");
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = "✓ Salvo!";
    setTimeout(() => { btn.textContent = orig; }, 1800);
  }
}
