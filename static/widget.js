// ─── Widget Settings Tab ──────────────────────────────────────────────────────
// Uses the same localStorage keys (w_*) as /widget.
// Changes here are reflected immediately when the user opens the actual widget.

const WT_DEFAULTS = {
  size:     "sm",    // sm | md | lg
  theme:    "dark",  // dark | light | auto
  refresh:  "15",    // minutes: 5 | 15 | 30 | 60
  showChg:  true,    // show % change
  showIcon: true,    // show asset icon
  assets:   ""       // comma-separated selected symbols (up to 5)
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
    if (selected.length >= 5) return; // limit reached, do nothing
    selected.push(sym);
  }
  wtCfg.assets = selected.join(",");
  wtSave(wtCfg);
  // Refresh chip visuals only (no full UI rebuild)
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
  // Pill groups
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
    ["wt-showChg",  "showChg"],
    ["wt-showIcon", "showIcon"],
  ].forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!wtCfg[key];
  });

  // Asset chips (if already rendered)
  const selected = wtCfg.assets ? wtCfg.assets.split(",").filter(Boolean) : [];
  document.querySelectorAll(".wgt-asset-chip").forEach(chip => {
    chip.classList.toggle("active", selected.includes(chip.dataset.sym));
  });
}

// ── Live preview ───────────────────────────────────────────────────────────────
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
  }

  // Show / hide % change column
  document.querySelectorAll("#wpc-rows .wpc-chg").forEach(el => {
    el.style.display = wtCfg.showChg ? "" : "none";
  });
}

// ── Sanitise a symbol to safe alphanumeric chars only ─────────────────────────
const WT_SYM_RE = /[^A-Z0-9._\-]/g;
function wtSanitiseSym(raw) {
  return String(raw).toUpperCase().replace(WT_SYM_RE, "").slice(0, 20);
}

// ── Load watchlist assets as selectable chips (DOM-safe, no innerHTML inject) ──
function wLoadAssets() {
  const container = document.getElementById("wgt-asset-chips");
  if (!container) return;

  fetch("/api/assets")
    .then(r => {
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    })
    .then(data => {
      const assets = Array.isArray(data) ? data : (data.assets || []);
      const selected = wtCfg.assets ? wtCfg.assets.split(",").filter(Boolean) : [];

      // Clear container safely
      while (container.firstChild) container.removeChild(container.firstChild);

      if (!assets.length) {
        const msg = document.createElement("span");
        msg.className = "wgt-asset-empty";
        msg.textContent = "No assets in Watchlist yet";
        container.appendChild(msg);
        return;
      }

      assets.forEach(a => {
        const sym = wtSanitiseSym(a.symbol || a.ticker || a.id || String(a));
        if (!sym) return;
        const btn = document.createElement("button");
        btn.className = "wgt-asset-chip" + (selected.includes(sym) ? " active" : "");
        btn.dataset.sym = sym;
        btn.textContent = sym;
        btn.addEventListener("click", () => wToggleAsset(sym));
        container.appendChild(btn);
      });
    })
    .catch(() => {
      while (container.firstChild) container.removeChild(container.firstChild);
      const msg = document.createElement("span");
      msg.className = "wgt-asset-empty";
      msg.textContent = "Could not load assets";
      container.appendChild(msg);
    });
}

// ── Backwards-compat aliases (guard against SW-cached old HTML) ───────────────
function widgetUpdatePreview() { wtUpdatePreview(); }
function widgetSaveConfig()    { wSaveConfig(); }

// ── Entry point called by switchTab('widget') in trade.js ─────────────────────
function widgetOnEnter() {
  wtCfg = wtLoad();
  wtApplyUI();
  wtUpdatePreview();
  wLoadAssets();
}
