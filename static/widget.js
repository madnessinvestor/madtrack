// ─── Widget Settings Tab ───────────────────────────────────────────────────────
// Manages the Widget tab in the main SPA.
// All settings share localStorage keys (w_*) with /widget and /widget/settings.

const WT_DEFAULTS = {
  // Web /widget display settings
  ccy:          "USD",   // USD | BRL | EUR
  chg:          "pct",   // pct | val
  cols:         "2",     // 1 | 2
  fontSize:     "md",    // sm | md | lg
  bold:         false,
  showCcy:      true,
  showHeader:   true,
  autoSort:     false,
  showRefresh:  false,
  showControls: true,
  // Android / home-screen widget settings
  size:         "sm",    // sm | md | lg
  theme:        "dark",  // dark | light | auto
  bgOpacity:    "100",   // 0–100
  refresh:      "15",    // minutes
  showChg:      true,
  showIcon:     true,
  assets:       ""       // comma-separated selected symbols (up to 5)
};

function wtLoad() {
  const c = {};
  for (const [k, def] of Object.entries(WT_DEFAULTS)) {
    const raw = localStorage.getItem("w_" + k);
    if (raw === null) c[k] = def;
    else if (typeof def === "boolean") c[k] = raw === "1";
    else c[k] = raw;
  }
  return c;
}

function wtSave(cfg) {
  for (const [k, v] of Object.entries(cfg)) {
    localStorage.setItem("w_" + k, typeof v === "boolean" ? (v ? "1" : "0") : v);
  }
}

let wtCfg = Object.assign({}, WT_DEFAULTS);

// Called by pill buttons
function wSet(key, val) {
  wtCfg[key] = val;
  wtSave(wtCfg);
  wtApplyUI();
  wltRender();
  if (key === "refresh") wltScheduleRefresh();
}

// Called by toggle switches
function wToggle(key) {
  wtCfg[key] = !wtCfg[key];
  wtSave(wtCfg);
  wtApplyUI();
  wltRender();
}

// Toggle an asset chip on/off (max 5 selected)
function wToggleAsset(sym) {
  const selected = wtCfg.assets ? wtCfg.assets.split(",").filter(Boolean) : [];
  const idx = selected.indexOf(sym);
  if (idx >= 0) {
    selected.splice(idx, 1);
  } else {
    if (selected.length >= 5) return;
    selected.push(sym);
  }
  wtCfg.assets = selected.join(",");
  wtSave(wtCfg);
  document.querySelectorAll(".wgt-asset-chip").forEach(chip => {
    chip.classList.toggle("active", selected.includes(chip.dataset.sym));
  });
  wltRender();
}

// Save button feedback
function wSaveConfig() {
  wtSave(wtCfg);
  const btn = document.querySelector(".wgt-save-btn");
  if (!btn) return;
  const orig = btn.textContent;
  btn.textContent = "Saved ✓";
  btn.style.opacity = "0.8";
  setTimeout(() => { btn.textContent = orig; btn.style.opacity = ""; }, 1500);
}

// ── Sync UI controls to current config ────────────────────────────────────────
function wtApplyUI() {
  // Inline pill groups (wgt-card-row-pills) — new settings
  [
    ["wt-ccy",      "ccy"],
    ["wt-chg",      "chg"],
    ["wt-cols",     "cols"],
    ["wt-fontSize", "fontSize"],
  ].forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelectorAll("button").forEach(b =>
      b.classList.toggle("active", b.dataset.v === String(wtCfg[key]))
    );
  });

  // Standalone pill groups (wgt-pills-group) — legacy settings
  [
    ["wt-size",    "size"],
    ["wt-theme",   "theme"],
    ["wt-refresh", "refresh"],
  ].forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelectorAll(".wgt-pill").forEach(b =>
      b.classList.toggle("active", b.dataset.v === String(wtCfg[key]))
    );
  });

  // Opacity slider
  const opSlider = document.getElementById("wt-bgOpacity");
  if (opSlider) {
    opSlider.value = wtCfg.bgOpacity ?? "100";
    const opVal = document.getElementById("wt-opacity-val");
    if (opVal) opVal.textContent = opSlider.value + "%";
  }

  // Toggle checkboxes
  [
    ["wt-bold",         "bold"],
    ["wt-showCcy",      "showCcy"],
    ["wt-showChg",      "showChg"],
    ["wt-showIcon",     "showIcon"],
    ["wt-showHeader",   "showHeader"],
    ["wt-autoSort",     "autoSort"],
    ["wt-showRefresh",  "showRefresh"],
    ["wt-showControls", "showControls"],
  ].forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!wtCfg[key];
  });

  // Asset chips
  const selected = wtCfg.assets ? wtCfg.assets.split(",").filter(Boolean) : [];
  document.querySelectorAll(".wgt-asset-chip").forEach(chip => {
    chip.classList.toggle("active", selected.includes(chip.dataset.sym));
  });
}

// ── Live preview (wpc card) ────────────────────────────────────────────────────
const WT_RATES = { USD: 1, BRL: 5.70, EUR: 0.92 };
const WT_SYM   = { USD: "$", BRL: "R$", EUR: "€" };

function _wFmtP(usd) {
  const p   = usd * (WT_RATES[wtCfg.ccy] || 1);
  const sym = wtCfg.showCcy ? WT_SYM[wtCfg.ccy] : "";
  if (p >= 10000) return sym + p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1)     return sym + p.toFixed(2);
  return sym + p.toFixed(4);
}

function _wFmtC(usd, pct) {
  if (wtCfg.chg === "pct") {
    const s = pct >= 0 ? "+" : "";
    return { text: s + pct.toFixed(2) + "%", up: pct >= 0 };
  } else {
    const prev = usd / (1 + pct / 100);
    const abs  = (usd - prev) * (WT_RATES[wtCfg.ccy] || 1);
    const sym  = wtCfg.showCcy ? WT_SYM[wtCfg.ccy] : "";
    return { text: (abs >= 0 ? "+" : "-") + sym + Math.abs(abs).toFixed(2), up: abs >= 0 };
  }
}

function wtUpdatePreview() {
  const card = document.getElementById("widget-preview-card");
  if (!card) return;

  // Theme
  card.classList.toggle("wpc-light", wtCfg.theme === "light");

  // Clock
  const timeEl = document.getElementById("wpc-time");
  if (timeEl) {
    const now = new Date();
    timeEl.textContent =
      now.getHours().toString().padStart(2, "0") + ":" +
      now.getMinutes().toString().padStart(2, "0");
    timeEl.style.display = wtCfg.showHeader ? "" : "none";
  }

  // Font size & weight on rows
  const fs = { sm: "10.5px", md: "12px", lg: "14px" }[wtCfg.fontSize] || "12px";
  const fw = wtCfg.bold ? "700" : "400";
  document.querySelectorAll(".wpc-row .wpc-price, .wpc-row .wpc-chg").forEach(el => {
    el.style.fontWeight = fw;
  });
  document.querySelectorAll(".wpc-row").forEach(r => r.style.fontSize = fs);

  // Prices
  const p1El = document.getElementById("wpv-p1");
  const c1El = document.getElementById("wpv-c1");
  const p2El = document.getElementById("wpv-p2");
  const c2El = document.getElementById("wpv-c2");

  if (p1El) p1El.textContent = _wFmtP(64000);
  if (p2El) p2El.textContent = _wFmtP(3200);

  if (c1El) {
    const { text, up } = _wFmtC(64000, 1.8);
    c1El.textContent = text;
    c1El.className   = "wpc-chg " + (up ? "wpc-up" : "wpc-dn");
    c1El.style.display = wtCfg.showChg ? "" : "none";
  }
  if (c2El) {
    const { text, up } = _wFmtC(3200, -0.5);
    c2El.textContent = text;
    c2El.className   = "wpc-chg " + (up ? "wpc-up" : "wpc-dn");
    c2El.style.display = wtCfg.showChg ? "" : "none";
  }
}

// ── Sanitise a symbol ─────────────────────────────────────────────────────────
const WT_SYM_RE = /[^A-Z0-9._\-]/g;
function wtSanitiseSym(raw) {
  return String(raw).toUpperCase().replace(WT_SYM_RE, "").slice(0, 20);
}

// ── Load watchlist assets as selectable chips ─────────────────────────────────
function wLoadAssets() {
  const container = document.getElementById("wgt-asset-chips");
  if (!container) return;

  fetch("/api/assets")
    .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
    .then(data => {
      const assets   = Array.isArray(data) ? data : (data.assets || []);
      const selected = wtCfg.assets ? wtCfg.assets.split(",").filter(Boolean) : [];

      while (container.firstChild) container.removeChild(container.firstChild);

      if (!assets.length) {
        const msg = document.createElement("span");
        msg.className   = "wgt-asset-empty";
        msg.textContent = "No assets in Watchlist yet";
        container.appendChild(msg);
        return;
      }

      assets.forEach(a => {
        const sym = wtSanitiseSym(a.symbol || a.ticker || a.id || String(a));
        if (!sym) return;
        const btn = document.createElement("button");
        btn.className  = "wgt-asset-chip" + (selected.includes(sym) ? " active" : "");
        btn.dataset.sym = sym;
        btn.textContent = sym;
        btn.addEventListener("click", () => wToggleAsset(sym));
        container.appendChild(btn);
      });
    })
    .catch(() => {
      while (container.firstChild) container.removeChild(container.firstChild);
      const msg = document.createElement("span");
      msg.className   = "wgt-asset-empty";
      msg.textContent = "Could not load assets";
      container.appendChild(msg);
    });
}

// ── Entry point called by switchTab('widget') ─────────────────────────────────
function widgetOnEnter() {
  wtCfg = wtLoad();
  wtApplyUI();
  wLoadAssets();
  wltLoad();
  wltScheduleRefresh();
}

function wltScheduleRefresh() {
  if (wltTimer) clearInterval(wltTimer);
  const mins = parseInt(wtCfg.refresh, 10) || 15;
  wltTimer = setInterval(wltLoad, mins * 60 * 1000);
}

// ─── Live Widget (Widget tab inline display) ──────────────────────────────────
// Mirrors /widget rendering but operates on #wlt-* elements inside the SPA.

const WLT_FS_MAP  = { sm: "10.5px", md: "12px", lg: "14px" };
const WLT_CCY_SYM = { USD: "$", BRL: "R$", EUR: "€" };
let wltRates    = { BRL: 5.70, EUR: 0.92 };
let wltLastData = [];
let wltAlertMap = {};
let wltTimer    = null;

function wltCcyRate() {
  return { USD: 1, BRL: wltRates.BRL, EUR: wltRates.EUR }[wtCfg.ccy] || 1;
}

function wltFmtPrice(usdP) {
  if (usdP == null) return "—";
  const p   = usdP * wltCcyRate();
  const sym = wtCfg.showCcy ? WLT_CCY_SYM[wtCfg.ccy] : "";
  const a   = Math.abs(p);
  if (a >= 10000) return sym + p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (a >= 1)     return sym + p.toFixed(2);
  if (a >= 0.01)  return sym + p.toFixed(4);
  return sym + p.toPrecision(3);
}

function _wltPct(pct) {
  if (pct == null) return { text: "—", cls: "wlt-neu" };
  const s   = pct >= 0 ? "+" : "";
  const cls = pct > 0.005 ? "wlt-pos" : pct < -0.005 ? "wlt-neg" : "wlt-neu";
  return { text: s + pct.toFixed(2) + "%", cls };
}

function _wltVal(usdP, pct) {
  if (usdP == null || pct == null) return { text: "—", cls: "wlt-neu" };
  const prev = usdP / (1 + pct / 100);
  const abs  = (usdP - prev) * wltCcyRate();
  const sym  = wtCfg.showCcy ? WLT_CCY_SYM[wtCfg.ccy] : "";
  const s    = abs >= 0 ? "+" : "-";
  const cls  = abs > 0.000005 ? "wlt-pos" : abs < -0.000005 ? "wlt-neg" : "wlt-neu";
  const a    = Math.abs(abs);
  let num;
  if (a >= 100)       num = a.toFixed(2);
  else if (a >= 1)    num = a.toFixed(2);
  else if (a >= 0.01) num = a.toFixed(4);
  else                num = a.toPrecision(2);
  return { text: s + sym + num, cls };
}

function wltFmtChg(usdP, pct) {
  if (!wtCfg.showChg) return { text: "", cls: "wlt-neu" };
  if (wtCfg.chg === "pct")  return _wltPct(pct);
  if (wtCfg.chg === "val")  return _wltVal(usdP, pct);
  if (wtCfg.chg === "both") {
    const p = _wltPct(pct);
    const v = _wltVal(usdP, pct);
    return { text: v.text + " (" + p.text + ")", cls: p.cls };
  }
  return _wltPct(pct);
}

function wltEsc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function wltCellsHtml(a, fs) {
  if (!a) return `<span class="wlt-ticker"></span><span class="wlt-price"></span><span class="wlt-chg"></span>`;
  const { text: chg, cls } = wltFmtChg(a.price, a.change24h);
  const fw  = wtCfg.bold ? "font-weight:700;" : "";
  const fss = `font-size:${fs};`;
  const tickerAlerts = wltAlertMap[(a.symbol || "").toUpperCase()] || [];
  const activeAlerts = tickerAlerts.filter(al => !al.triggered);
  const bellTitle = activeAlerts.map(al =>
    (al.direction === "above" ? "↑" : "↓") + " $" + Number(al.target).toLocaleString("en-US")
  ).join(" • ");
  const bell = activeAlerts.length
    ? `<span class="wlt-bell" title="${wltEsc(bellTitle)}">🔔</span>`
    : "";
  const rawSym = a.symbol || "";
  const symTrunc = rawSym.length > 12 ? rawSym.slice(0, 9) + "…" : rawSym;
  const sym   = wltEsc(symTrunc);
  const price = wltEsc(wltFmtPrice(a.price));
  const _FOREX_FLAG = { USD:'us', EUR:'eu', BRL:'br', GBP:'gb', JPY:'jp', CHF:'ch', AUD:'au', CAD:'ca' };
  function _forexIconUrl(s) {
    if (s.length !== 6) return null;
    const cc = _FOREX_FLAG[s.slice(0,3).toUpperCase()];
    return cc ? `https://flagcdn.com/48x36/${cc}.png` : null;
  }
  const _symUp = rawSym.toUpperCase();
  const _forexUrl = _forexIconUrl(_symUp);
  const iconHtml = wtCfg.showIcon
    ? (_forexUrl
        ? `<img class="wlt-icon" src="${_forexUrl}" alt="" onerror="this.style.visibility='hidden';this.style.width='0'">`
        : `<img class="wlt-icon" src="/static/icons/tokens/${wltEsc(_symUp)}.png" alt="" onerror="this.style.visibility='hidden';this.style.width='0'">`)
    : "";
  return iconHtml +
         `<span class="wlt-ticker" style="${fss}${fw}">${sym}${bell}</span>` +
         `<span class="wlt-price"  style="${fss}${fw}">${price}</span>` +
         `<span class="wlt-chg ${cls}" style="${fss}${fw}">${wltEsc(chg)}</span>`;
}

function wltApplyLayout() {
  const topbar     = document.getElementById("wlt-topbar");
  const header     = document.getElementById("wlt-header");
  const controls   = document.getElementById("wlt-controls");
  const refreshBtn = document.getElementById("wlt-refresh-btn");
  const c2         = document.getElementById("wlt-c2");
  const valBtn     = document.getElementById("wlt-chg-val-btn");
  if (!topbar) return;

  topbar.style.display    = (wtCfg.showHeader || wtCfg.showControls) ? "" : "none";
  if (header)     header.style.display     = wtCfg.showHeader   ? "" : "none";
  if (refreshBtn) refreshBtn.style.display = wtCfg.showRefresh  ? "" : "none";
  if (controls)   controls.style.display   = wtCfg.showControls ? "" : "none";
  if (c2)         c2.style.display         = wtCfg.cols === "1" ? "none" : "";

  // Icon column: toggle grid and icon visibility
  const gridCols = wtCfg.showIcon
    ? "max-content 1fr max-content max-content"
    : "1fr max-content max-content";
  document.querySelectorAll(".wgt-live-col").forEach(col => {
    col.style.gridTemplateColumns = gridCols;
  });

  document.querySelectorAll("#wlt-ccy-group .wgt-live-pill").forEach(b =>
    b.classList.toggle("active", b.dataset.ccy === wtCfg.ccy));
  document.querySelectorAll("#wlt-chg-group .wgt-live-pill").forEach(b =>
    b.classList.toggle("active", b.dataset.chg === wtCfg.chg));
  if (valBtn) valBtn.textContent = "±" + (wtCfg.showCcy ? WLT_CCY_SYM[wtCfg.ccy] : "$");
}

function wltRender() {
  wltApplyLayout();
  let data = [...wltLastData];

  // Filter to selected assets (chips), preserving chip order
  const selected = wtCfg.assets ? wtCfg.assets.split(",").filter(Boolean) : [];
  if (selected.length) {
    data = data.filter(a => selected.includes((a.symbol || "").toUpperCase()));
    data.sort((a, b) =>
      selected.indexOf((a.symbol || "").toUpperCase()) -
      selected.indexOf((b.symbol || "").toUpperCase())
    );
  }

  if (wtCfg.autoSort) data.sort((a, b) => (b.change24h || 0) - (a.change24h || 0));

  const fs   = WLT_FS_MAP[wtCfg.fontSize] || "12px";
  const half = wtCfg.cols === "1" ? data.length : Math.ceil(data.length / 2);
  const col1 = data.slice(0, half);
  const col2 = wtCfg.cols === "1" ? [] : data.slice(half);

  const c1 = document.getElementById("wlt-c1");
  const c2 = document.getElementById("wlt-c2");
  if (c1) c1.innerHTML = col1.map(a => wltCellsHtml(a, fs)).join("");
  if (c2) c2.innerHTML = col2.map(a => wltCellsHtml(a, fs)).join("");
}

async function wltLoad() {
  try {
    const [ra, rr, ral] = await Promise.all([
      fetch("/api/assets"),
      fetch("/api/rates"),
      fetch("/api/alerts")
    ]);
    const data   = await ra.json();
    const rdata  = await rr.json();
    const alData = await ral.json().catch(() => []);

    if (rdata.BRL) wltRates.BRL = rdata.BRL;
    if (rdata.EUR) wltRates.EUR = rdata.EUR;
    wltLastData = Array.isArray(data) ? data : [];
    wltAlertMap = {};
    for (const al of (Array.isArray(alData) ? alData : [])) {
      const k = (al.ticker || "").toUpperCase();
      if (!wltAlertMap[k]) wltAlertMap[k] = [];
      wltAlertMap[k].push(al);
    }

    const now = new Date();
    const hh  = now.getHours().toString().padStart(2, "0");
    const mm  = now.getMinutes().toString().padStart(2, "0");
    const txt = document.getElementById("wlt-text");
    if (txt) txt.textContent = "Atualizado às " + hh + ":" + mm;

    wltRender();
  } catch(e) {
    const txt = document.getElementById("wlt-text");
    if (txt) txt.textContent = "Erro ao carregar";
  }
}

// Quick-control handlers — sync both the live widget AND the settings pills below
function wltSetCcy(v) { wSet("ccy", v); }
function wltSetChg(v) { wSet("chg", v); }

// ── Backwards-compat aliases ──────────────────────────────────────────────────
function wsSet(key, val)      { wSet(key, val); }
function wsToggle(key)        { wToggle(key); }
function wsApplyUI()          { wtApplyUI(); }
function wsUpdatePreview()    { wtUpdatePreview(); }
function widgetUpdatePreview(){ wtUpdatePreview(); }
function widgetSaveConfig()   { wSaveConfig(); }
