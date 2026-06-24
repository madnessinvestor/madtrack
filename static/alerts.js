// ─── Price Alerts ──────────────────────────────────────────────────────────────

let alertsData = [];
const ALERT_INTERVAL = 30000;

// ─── Init ─────────────────────────────────────────────────────────────────────

async function initAlerts() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/static/sw.js").catch(() => {});
  }
  await loadAlerts();
  setInterval(checkAlerts, ALERT_INTERVAL);
}

// ─── Load ─────────────────────────────────────────────────────────────────────

async function loadAlerts() {
  try {
    const r = await fetch("/api/alerts");
    alertsData = await r.json();
  } catch(e) {
    alertsData = [];
  }
  renderAlertsList();
  updateBellBadge();
}

// ─── Submit new alert ─────────────────────────────────────────────────────────

async function submitAlert() {
  const ticker  = document.getElementById("alert-ticker").value.trim().toUpperCase();
  const target  = parseFloat(document.getElementById("alert-target").value);
  const dir     = document.getElementById("alert-direction").value;
  const errEl   = document.getElementById("alert-error");

  errEl.classList.add("hidden");
  if (!ticker)                { errEl.textContent = t("alert_err_ticker"); errEl.classList.remove("hidden"); return; }
  if (!target || target <= 0) { errEl.textContent = t("alert_err_price");  errEl.classList.remove("hidden"); return; }

  await fetch("/api/alerts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ticker, target, direction: dir })
  });

  document.getElementById("alert-ticker").value = "";
  document.getElementById("alert-target").value = "";
  await loadAlerts();

  // Ask permission non-blocking — show soft warning if denied
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission().then(r => {
      if (r === "denied") {
        errEl.textContent = t("alert_err_perm");
        errEl.classList.remove("hidden");
      }
    });
  }
}

// ─── Delete / Reset ───────────────────────────────────────────────────────────

async function deleteAlertById(id) {
  await fetch(`/api/alerts/${id}`, { method: "DELETE" });
  await loadAlerts();
}

async function resetAlertById(id) {
  await fetch(`/api/alerts/${id}/reset`, { method: "POST" });
  await loadAlerts();
}

// ─── Notification permission ──────────────────────────────────────────────────

async function requestNotifPermission() {
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const r = await Notification.requestPermission();
  return r === "granted";
}

// ─── Check alerts (runs every 30 s) ──────────────────────────────────────────

async function checkAlerts() {
  const active = alertsData.filter(a => !a.triggered);
  if (!active.length) return;

  let priceMap = {};
  try {
    const r = await fetch("/api/assets");
    const assets = await r.json();
    for (const a of assets) {
      if (a.price != null) priceMap[a.symbol.toUpperCase()] = a.price;
    }
  } catch(e) { return; }

  for (const alert of active) {
    const price = priceMap[alert.ticker.toUpperCase()];
    if (price == null) continue;
    const fired = alert.direction === "above" ? price >= alert.target : price <= alert.target;
    if (fired) await fireAlert(alert, price);
  }
}

// ─── Alert sound ──────────────────────────────────────────────────────────────

function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [880, 1108, 1318, 1760];
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = "sine";
      osc.frequency.value = freq;
      const t0 = ctx.currentTime + i * 0.12;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.35, t0 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);
      osc.start(t0);
      osc.stop(t0 + 0.22);
    });
  } catch(e) {}
}

// ─── Fire alert ───────────────────────────────────────────────────────────────

async function fireAlert(alert, price) {
  await fetch(`/api/alerts/${alert.id}/trigger`, { method: "POST" });
  alert.triggered = true;
  renderAlertsList();
  updateBellBadge();
  playAlertSound();

  const arrow = alert.direction === "above" ? "🔺" : "🔻";
  const title = `MadTracker ${arrow} ${alert.ticker}`;
  const body  = `${alert.ticker} atingiu ${formatUSD(price, true)}\nAlvo: ${formatUSD(alert.target, true)}`;

  if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({
      type: "SHOW_NOTIFICATION", title, body, tag: `alert-${alert.id}`
    });
  } else if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, { body, icon: "/static/icons/icon-192.png", tag: `alert-${alert.id}` });
  }
}

// ─── Bell badge ───────────────────────────────────────────────────────────────

function updateBellBadge() {
  const badge = document.getElementById("alert-badge");
  if (!badge) return;
  const active = alertsData.filter(a => !a.triggered).length;
  if (active > 0) {
    badge.textContent = active;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }
}

// ─── Render list ──────────────────────────────────────────────────────────────

function renderAlertsList() {
  const el = document.getElementById("alerts-list");
  if (!el) return;

  if (!alertsData.length) {
    el.innerHTML = `<p class="alert-empty">${t("alert_empty")}</p>`;
    return;
  }

  el.innerHTML = alertsData.map(a => {
    const arrow    = a.direction === "above" ? "↑" : "↓";
    const dirLabel = a.direction === "above" ? t("alert_above") : t("alert_below");
    const cls      = a.triggered ? "alert-item triggered" : "alert-item active";
    const statusTxt= a.triggered ? t("alert_triggered") : t("alert_active_label");
    return `<div class="${cls}">
      <div class="alert-item-info">
        <span class="alert-item-ticker">${a.ticker}</span>
        <span class="alert-item-desc">${dirLabel} ${formatUSD(a.target, true)} ${arrow}</span>
      </div>
      <div class="alert-item-actions">
        <span class="alert-item-status">${statusTxt}</span>
        ${a.triggered
          ? `<button class="alert-btn reset" onclick="resetAlertById('${a.id}')" title="${t('alert_reset')}">↺</button>`
          : ""}
        <button class="alert-btn del" onclick="deleteAlertById('${a.id}')" title="${t('alert_delete')}">✕</button>
      </div>
    </div>`;
  }).join("");
}

// ─── Modal open / close ───────────────────────────────────────────────────────

function openAlertsModal() {
  loadAlerts();
  document.getElementById("alert-error").classList.add("hidden");

  // Populate ticker datalist from tracked assets
  if (typeof cachedAssets !== "undefined") {
    const dl = document.getElementById("alert-tickers-list");
    if (dl) {
      dl.innerHTML = cachedAssets.map(a => `<option value="${a.symbol}">`).join("");
    }
  }

  document.getElementById("alerts-modal").classList.remove("hidden");
}

function closeAlertsModal() {
  document.getElementById("alerts-modal").classList.add("hidden");
}

// ─── Kick off on load ─────────────────────────────────────────────────────────

document.addEventListener("DOMContentLoaded", initAlerts);
