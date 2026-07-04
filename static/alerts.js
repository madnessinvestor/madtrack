// ─── Price Alerts ──────────────────────────────────────────────────────────────

let alertsData = [];
const ALERT_INTERVAL = 30000;
let _selectedRepeat = 0;

// ─── Repeat chip selector ─────────────────────────────────────────────────────
function selectRepeat(btn) {
  document.querySelectorAll(".alert-repeat-chip").forEach(c => c.classList.remove("active"));
  btn.classList.add("active");
  _selectedRepeat = parseInt(btn.dataset.val, 10) || 0;
}

// ─── Audio unlock (browsers block AudioContext until first user gesture) ───────
let _audioCtx = null;
function _getAudioCtx() {
  if (!_audioCtx) {
    try { _audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}
  }
  if (_audioCtx && _audioCtx.state === "suspended") {
    _audioCtx.resume().catch(() => {});
  }
  return _audioCtx;
}
// Unlock on first user gesture so the sound works immediately when alert fires
["click","touchstart","keydown"].forEach(ev =>
  document.addEventListener(ev, () => _getAudioCtx(), { once: false, passive: true })
);

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
  if (typeof renderDetailAlerts === "function") renderDetailAlerts();
  if (typeof updateCardAlertBadges === "function") updateCardAlertBadges();
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
    body: JSON.stringify({ ticker, target, direction: dir, repeat_interval: _selectedRepeat })
  });

  document.getElementById("alert-ticker").value = "";
  document.getElementById("alert-target").value = "";
  // Reset repeat chip to "1x"
  document.querySelectorAll(".alert-repeat-chip").forEach(c => c.classList.remove("active"));
  const firstChip = document.querySelector(".alert-repeat-chip");
  if (firstChip) firstChip.classList.add("active");
  _selectedRepeat = 0;

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

function _alertIsReadyToCheck(a) {
  // One-time alerts already triggered: skip
  if (a.triggered) return false;
  const interval = a.repeat_interval || 0;
  // Never fired yet: always check
  if (!a.last_fired_at) return true;
  // Repeating: only check after enough time has passed since last fire
  const nowSec = Date.now() / 1000;
  return nowSec - a.last_fired_at >= interval;
}

async function checkAlerts() {
  const toCheck = alertsData.filter(_alertIsReadyToCheck);
  if (!toCheck.length) return;

  let priceMap = {};
  try {
    const r = await fetch("/api/assets");
    const assets = await r.json();
    for (const a of assets) {
      if (a.price != null) priceMap[a.symbol.toUpperCase()] = a.price;
    }
  } catch(e) { return; }

  for (const alert of toCheck) {
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

// ─── In-app toast ─────────────────────────────────────────────────────────────

function showAlertToast(ticker, price, target, direction) {
  const arrow    = direction === "above" ? "🔺" : "🔻";
  const dirLabel = direction === "above" ? "subiu acima de" : "caiu abaixo de";

  const toast = document.createElement("div");
  toast.className = "alert-toast alert-toast-enter";
  toast.innerHTML = `
    <div class="alert-toast-icon">${arrow}</div>
    <div class="alert-toast-body">
      <div class="alert-toast-title">${ticker} ${dirLabel} ${formatUSD(target, true)}</div>
      <div class="alert-toast-sub">Preço atual: <strong>${formatUSD(price, true)}</strong></div>
    </div>
    <button class="alert-toast-close" onclick="this.closest('.alert-toast').remove()">✕</button>
  `;

  let container = document.getElementById("alert-toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "alert-toast-container";
    document.body.appendChild(container);
  }
  container.appendChild(toast);

  // Animate in
  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add("alert-toast-visible"));
  });

  // Auto-dismiss after 8 s
  setTimeout(() => {
    toast.classList.remove("alert-toast-visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 8000);
}

// ─── System notification (desktop + Android PWA) ──────────────────────────────

async function _sendSystemNotification(title, body, tag) {
  // 1. Try via Service Worker (works on Android PWA + desktop)
  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      if (Notification.permission === "granted") {
        await reg.showNotification(title, {
          body,
          icon:     "/static/icons/icon-192.png",
          badge:    "/static/icons/icon-72.png",
          vibrate:  [200, 100, 200, 100, 200],
          tag,
          renotify: true,
          requireInteraction: false,
        });
        return;
      }
    } catch (e) {}
  }
  // 2. Fallback: direct Notification API (desktop browsers without SW)
  if ("Notification" in window && Notification.permission === "granted") {
    try {
      new Notification(title, {
        body,
        icon: "/static/icons/icon-192.png",
        tag,
      });
    } catch (e) {}
  }
}

// ─── Fire alert ───────────────────────────────────────────────────────────────

async function fireAlert(alert, price) {
  await fetch(`/api/alerts/${alert.id}/trigger`, { method: "POST" });
  // One-time alerts become triggered; repeating alerts update last_fired_at locally
  if ((alert.repeat_interval || 0) === 0) {
    alert.triggered = true;
  } else {
    alert.last_fired_at = Date.now() / 1000;
  }
  renderAlertsList();
  updateBellBadge();
  playAlertSound();

  // Always show in-app toast (works in any context)
  showAlertToast(alert.ticker, price, alert.target, alert.direction);

  // Also send system notification (desktop / Android PWA)
  const arrow = alert.direction === "above" ? "🔺" : "🔻";
  const title = `MadTracker ${arrow} ${alert.ticker}`;
  const body  = `${alert.ticker} atingiu ${formatUSD(price, true)} — Alvo: ${formatUSD(alert.target, true)}`;
  await _sendSystemNotification(title, body, `alert-${alert.id}`);
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

function _repeatLabel(interval) {
  if (!interval) return "";
  if (interval === 60)   return "↻ 1 min";
  if (interval === 300)  return "↻ 5 min";
  if (interval === 900)  return "↻ 15 min";
  if (interval === 3600) return "↻ 60 min";
  return `↻ ${interval}s`;
}

function _nextFireLabel(a) {
  const interval = a.repeat_interval || 0;
  if (!interval || !a.last_fired_at) return "";
  const nextAt = a.last_fired_at + interval;
  const diffSec = Math.max(0, Math.round(nextAt - Date.now() / 1000));
  if (diffSec <= 0) return "";
  const m = Math.floor(diffSec / 60);
  const s = diffSec % 60;
  return m > 0 ? `próx. em ${m}m${s > 0 ? s + "s" : ""}` : `próx. em ${s}s`;
}

function renderAlertsList() {
  const el = document.getElementById("alerts-list");
  if (!el) return;

  if (!alertsData.length) {
    el.innerHTML = `<p class="alert-empty">${t("alert_empty")}</p>`;
    return;
  }

  el.innerHTML = alertsData.map(a => {
    const arrow     = a.direction === "above" ? "↑" : "↓";
    const dirLabel  = a.direction === "above" ? t("alert_above") : t("alert_below");
    const isRepeat  = (a.repeat_interval || 0) > 0;
    const cls       = a.triggered ? "alert-item triggered" : "alert-item active";
    const statusTxt = a.triggered ? t("alert_triggered") : t("alert_active_label");
    const repeatBadge = isRepeat
      ? `<span class="alert-repeat-badge">${_repeatLabel(a.repeat_interval)}</span>` : "";
    const nextLabel = isRepeat && !a.triggered ? _nextFireLabel(a) : "";
    const nextBadge = nextLabel
      ? `<span class="alert-next-label">${nextLabel}</span>` : "";

    return `<div class="${cls}">
      <div class="alert-item-info">
        <div class="alert-item-top">
          <span class="alert-item-ticker">${a.ticker}</span>
          ${repeatBadge}
        </div>
        <span class="alert-item-desc">${dirLabel} ${formatUSD(a.target, true)} ${arrow}</span>
        ${nextBadge}
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
