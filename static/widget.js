// ─── Widget Settings Tab ──────────────────────────────────────────────────────
// Uses the same localStorage keys (w_*) as /widget so every change here is
// immediately reflected when the user opens the actual widget.

const WT_DEFAULTS = {
  ccy:          "USD",
  chg:          "pct",
  cols:         "2",
  fontSize:     "md",
  bold:         false,
  showCcy:      true,
  showHeader:   true,
  autoSort:     false,
  showRefresh:  false,
  showControls: true
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

// Called from inline onclick in index.html
function wSet(key, val) {
  wtCfg[key] = val;
  wtSave(wtCfg);
  wtApplyUI();
  wtUpdatePreview();
}

function wToggle(key) {
  wtCfg[key] = !wtCfg[key];
  wtSave(wtCfg);
  wtApplyUI();
  wtUpdatePreview();
}

// ── Sync UI controls to current config ────────────────────────────────────────
function wtApplyUI() {
  // Pill selectors
  [
    ["wt-ccy",  "ccy"],
    ["wt-chg",  "chg"],
    ["wt-cols", "cols"],
    ["wt-fs",   "fontSize"]
  ].forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelectorAll("button").forEach(b =>
      b.classList.toggle("active", b.dataset.v === String(wtCfg[key]))
    );
  });

  // Toggle checkboxes
  [
    ["wt-bold",        "bold"],
    ["wt-showCcy",     "showCcy"],
    ["wt-showHeader",  "showHeader"],
    ["wt-autoSort",    "autoSort"],
    ["wt-showRefresh", "showRefresh"],
    ["wt-showControls","showControls"]
  ].forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!wtCfg[key];
  });
}

// ── Live preview ───────────────────────────────────────────────────────────────
const WT_RATES = { USD: 1, BRL: 5.70, EUR: 0.92 };
const WT_SYM   = { USD: "$", BRL: "R$", EUR: "€" };
const WT_FS    = { sm: "9.5px", md: "11px", lg: "13px" };

function wtFmtPrice(usdP) {
  const p   = usdP * (WT_RATES[wtCfg.ccy] || 1);
  const sym = wtCfg.showCcy ? (WT_SYM[wtCfg.ccy] || "") : "";
  if (p >= 10000) return sym + p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p >= 1)     return sym + p.toFixed(2);
  return sym + p.toFixed(4);
}

function wtFmtChg(usdP, pct) {
  if (wtCfg.chg === "pct") {
    const s = pct >= 0 ? "+" : "";
    return { text: s + pct.toFixed(2) + "%", cls: pct > 0 ? "wpc-up" : "wpc-dn" };
  }
  const prev = usdP / (1 + pct / 100);
  const abs  = (usdP - prev) * (WT_RATES[wtCfg.ccy] || 1);
  const sym  = wtCfg.showCcy ? (WT_SYM[wtCfg.ccy] || "") : "";
  const s    = abs >= 0 ? "+" : "-";
  return { text: s + sym + Math.abs(abs).toFixed(2), cls: abs >= 0 ? "wpc-up" : "wpc-dn" };
}

function wtUpdatePreview() {
  const fs = WT_FS[wtCfg.fontSize] || "11px";
  const fw = wtCfg.bold ? "700" : "400";
  const fwChg = wtCfg.bold ? "700" : "600";

  // Font / weight on preview rows
  const rows = document.getElementById("wpc-rows");
  if (rows) {
    rows.querySelectorAll(".wpc-ticker, .wpc-price").forEach(el => {
      el.style.fontSize = fs;
      el.style.fontWeight = fw;
    });
    rows.querySelectorAll(".wpc-chg").forEach(el => {
      el.style.fontSize = fs;
      el.style.fontWeight = fwChg;
    });
  }

  // Prices & changes
  const p1 = document.getElementById("wpv-p1");
  const p2 = document.getElementById("wpv-p2");
  const c1 = document.getElementById("wpv-c1");
  const c2 = document.getElementById("wpv-c2");
  if (p1) p1.textContent = wtFmtPrice(59960);
  if (p2) p2.textContent = wtFmtPrice(1576);
  if (c1) { const r = wtFmtChg(59960, 1.15);  c1.textContent = r.text; c1.className = "wpc-chg " + r.cls; }
  if (c2) { const r = wtFmtChg(1576, -0.03);  c2.textContent = r.text; c2.className = "wpc-chg " + r.cls; }

  // Header visibility
  const topbar = document.getElementById("wpv-topbar");
  if (topbar) topbar.style.display = (wtCfg.showHeader || wtCfg.showControls) ? "" : "none";

  // Clock
  const timeEl = document.getElementById("wpc-time");
  if (timeEl) {
    const now = new Date();
    timeEl.textContent =
      now.getHours().toString().padStart(2, "0") + ":" +
      now.getMinutes().toString().padStart(2, "0");
  }
}

// ── Backwards-compat aliases (guard against SW-cached old HTML) ───────────────
function widgetUpdatePreview() { wtUpdatePreview(); }
function widgetSaveConfig()    { /* settings are saved immediately on change */ }

// ── Entry point called by switchTab('widget') in trade.js ─────────────────────
function widgetOnEnter() {
  wtCfg = wtLoad();
  wtApplyUI();
  wtUpdatePreview();

  // Fetch real exchange rates so the preview reflects current BRL/EUR values
  fetch("/api/rates")
    .then(r => r.json())
    .then(d => {
      if (d.BRL) WT_RATES.BRL = d.BRL;
      if (d.EUR) WT_RATES.EUR = d.EUR;
      wtUpdatePreview();
    })
    .catch(() => {});
}
