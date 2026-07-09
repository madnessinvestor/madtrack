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
  wtUpdatePreview();
}

// Called by toggle switches
function wToggle(key) {
  wtCfg[key] = !wtCfg[key];
  wtSave(wtCfg);
  wtApplyUI();
  wtUpdatePreview();
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
  // Fetch real rates for accurate preview
  fetch("/api/rates").then(r => r.json()).then(d => {
    if (d.BRL) WT_RATES.BRL = d.BRL;
    if (d.EUR) WT_RATES.EUR = d.EUR;
    wtUpdatePreview();
  }).catch(() => {});
  wtApplyUI();
  wtUpdatePreview();
  wLoadAssets();
}

// ── Backwards-compat aliases ──────────────────────────────────────────────────
function wsSet(key, val)      { wSet(key, val); }
function wsToggle(key)        { wToggle(key); }
function wsApplyUI()          { wtApplyUI(); }
function wsUpdatePreview()    { wtUpdatePreview(); }
function widgetUpdatePreview(){ wtUpdatePreview(); }
function widgetSaveConfig()   { wSaveConfig(); }
