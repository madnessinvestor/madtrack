// ─── Widget Settings Tab (ws-*) ───────────────────────────────────────────────
// Manages the Widget tab in the main SPA.
// Shares localStorage keys (w_*) with /widget and /widget/settings.

const WS_DEFAULTS = {
  ccy:          "USD",   // USD | BRL | EUR
  chg:          "pct",   // pct | val
  cols:         "2",     // 1 | 2
  fontSize:     "md",    // sm | md | lg
  bold:         false,
  showCcy:      true,
  showHeader:   true,
  autoSort:     false,
  showRefresh:  false,
  showControls: true
};

function wsLoad() {
  const c = {};
  for (const [k, def] of Object.entries(WS_DEFAULTS)) {
    const raw = localStorage.getItem("w_" + k);
    if (raw === null) c[k] = def;
    else if (typeof def === "boolean") c[k] = raw === "1";
    else c[k] = raw;
  }
  return c;
}

function wsSave(cfg) {
  for (const [k, v] of Object.entries(cfg)) {
    localStorage.setItem("w_" + k, typeof v === "boolean" ? (v ? "1" : "0") : v);
  }
}

let wsCfg = Object.assign({}, WS_DEFAULTS);

// Called by pill buttons
function wsSet(key, val) {
  wsCfg[key] = val;
  wsSave(wsCfg);
  wsApplyUI();
  wsUpdatePreview();
}

// Called by toggle switches
function wsToggle(key) {
  wsCfg[key] = !wsCfg[key];
  wsSave(wsCfg);
  wsApplyUI();
  wsUpdatePreview();
}

// ── Sync UI controls to current config ────────────────────────────────────────
function wsApplyUI() {
  // Pill selectors
  [
    ["ws-ccy-sel",  "ccy"],
    ["ws-chg-sel",  "chg"],
    ["ws-cols-sel", "cols"],
    ["ws-fs-sel",   "fontSize"],
  ].forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.querySelectorAll("button").forEach(b =>
      b.classList.toggle("active", b.dataset.v === String(wsCfg[key]))
    );
  });

  // Toggle checkboxes
  [
    ["ws-chk-bold",         "bold"],
    ["ws-chk-showCcy",      "showCcy"],
    ["ws-chk-showHeader",   "showHeader"],
    ["ws-chk-autoSort",     "autoSort"],
    ["ws-chk-showRefresh",  "showRefresh"],
    ["ws-chk-showControls", "showControls"],
  ].forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!wsCfg[key];
  });
}

// ── Live preview ───────────────────────────────────────────────────────────────
const WS_RATES = { USD: 1, BRL: 5.70, EUR: 0.92 };
const WS_SYM   = { USD: "$", BRL: "R$", EUR: "€" };

function wsFmtP(p) {
  const cv  = p * (WS_RATES[wsCfg.ccy] || 1);
  const sym = wsCfg.showCcy ? WS_SYM[wsCfg.ccy] : "";
  if (cv >= 10000) return sym + cv.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (cv >= 1)     return sym + cv.toFixed(2);
  return sym + cv.toFixed(4);
}

function wsFmtC(p, pct) {
  if (wsCfg.chg === "pct") {
    const s = pct >= 0 ? "+" : "";
    return { text: s + pct.toFixed(2) + "%", cls: pct > 0 ? "ws-pos" : "ws-neg" };
  } else {
    const prev = p / (1 + pct / 100);
    const abs  = (p - prev) * (WS_RATES[wsCfg.ccy] || 1);
    const sym  = wsCfg.showCcy ? WS_SYM[wsCfg.ccy] : "";
    const s    = abs >= 0 ? "+" : "-";
    return { text: s + sym + Math.abs(abs).toFixed(2), cls: abs >= 0 ? "ws-pos" : "ws-neg" };
  }
}

function wsUpdatePreview() {
  const fs = wsCfg.fontSize === "sm" ? "11px" : wsCfg.fontSize === "lg" ? "15px" : "13px";
  const fw = wsCfg.bold ? "700" : "400";
  document.querySelectorAll(".ws-preview-row").forEach(r => {
    r.style.fontSize = fs;
    const chgEl = r.querySelector(".ws-pv-chg");
    if (chgEl) chgEl.style.fontWeight = wsCfg.bold ? "700" : "600";
    r.querySelectorAll("span:not(.ws-pv-chg)").forEach(s => s.style.fontWeight = fw);
  });

  const btc = wsFmtC(59960, 1.15);
  const eth = wsFmtC(1576, -0.03);

  const p1 = document.getElementById("ws-pv-price1");
  const p2 = document.getElementById("ws-pv-price2");
  const c1 = document.getElementById("ws-pv-chg1");
  const c2 = document.getElementById("ws-pv-chg2");

  if (p1) p1.textContent = wsFmtP(59960);
  if (p2) p2.textContent = wsFmtP(1576);
  if (c1) { c1.textContent = btc.text; c1.className = "ws-pv-chg " + btc.cls; }
  if (c2) { c2.textContent = eth.text; c2.className = "ws-pv-chg " + eth.cls; }
}

// ── Entry point called by switchTab('widget') ─────────────────────────────────
function widgetOnEnter() {
  wsCfg = wsLoad();
  // Fetch real rates for accurate preview
  fetch("/api/rates").then(r => r.json()).then(d => {
    if (d.BRL) WS_RATES.BRL = d.BRL;
    if (d.EUR) WS_RATES.EUR = d.EUR;
    wsUpdatePreview();
  }).catch(() => {});
  wsApplyUI();
  wsUpdatePreview();
}

// ── Backwards-compat aliases ──────────────────────────────────────────────────
function wSet(key, val)  { wsSet(key, val); }
function wToggle(key)    { wsToggle(key); }
function wSaveConfig()   {}
function wLoadAssets()   {}
function wtApplyUI()     { wsApplyUI(); }
function wtUpdatePreview() { wsUpdatePreview(); }
