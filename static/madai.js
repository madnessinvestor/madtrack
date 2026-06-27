// ─── Mad AI Tab ───────────────────────────────────────────────────────────────

let _aiHistory = [];
let _aiLoading = false;

// ─── Preset chips ─────────────────────────────────────────────────────────────

function aiAskPreset(btn) {
  const text = btn.textContent.trim();
  if (text) aiSendMessage(text);
}

// ─── Analyze button ───────────────────────────────────────────────────────────

function aiAnalyzeTrades() {
  const lang = typeof currentLang !== "undefined" ? currentLang : "pt";
  const msg = lang === "pt"
    ? "Faça uma análise completa do meu portfólio: total investido, P&L realizado, ativos com melhor e pior desempenho, e qualquer padrão interessante que você identificar nos meus trades."
    : "Please give me a complete analysis of my portfolio: total invested, realized P&L, best and worst performing assets, and any interesting patterns you notice in my trades.";
  aiSendMessage(msg);
}

// ─── Input key handler ────────────────────────────────────────────────────────

function aiInputKey(e) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    aiSend();
  }
}

// ─── Send from input field ────────────────────────────────────────────────────

function aiSend() {
  const input = document.getElementById("ai-input");
  const text = (input?.value || "").trim();
  if (!text) return;
  input.value = "";
  aiSendMessage(text);
}

// ─── Core send logic ──────────────────────────────────────────────────────────

async function aiSendMessage(text) {
  if (_aiLoading) return;
  _aiLoading = true;

  _hideAiEmpty();
  _hideNoKeyWarn();
  _aiAppendBubble("user", text);
  _aiSetSendLoading(true);

  const thinkingId = _aiAppendThinking();

  try {
    const res = await fetch("/api/ai/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: _aiHistory })
    });

    const data = await res.json();

    _aiRemoveThinking(thinkingId);

    if (!res.ok || data.error) {
      const errMsg = data.error || "Erro desconhecido ao contactar a IA.";
      _aiAppendBubble("error", errMsg);
      if (errMsg.includes("OPENROUTER_API_KEY") || errMsg.includes("não configurada")) {
        _showNoKeyWarn();
      }
    } else {
      const reply = data.reply || "";
      _aiAppendBubble("assistant", reply);
      _aiHistory.push({ role: "user", content: text });
      _aiHistory.push({ role: "assistant", content: reply });
      if (_aiHistory.length > 20) _aiHistory = _aiHistory.slice(-20);
    }
  } catch (err) {
    _aiRemoveThinking(thinkingId);
    _aiAppendBubble("error", "Erro de conexão. Verifique sua rede.");
  }

  _aiSetSendLoading(false);
  _aiLoading = false;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function _hideAiEmpty() {
  const el = document.getElementById("ai-empty");
  if (el) el.style.display = "none";
}

function _hideNoKeyWarn() {
  document.getElementById("ai-no-key-warn")?.classList.add("hidden");
}

function _showNoKeyWarn() {
  document.getElementById("ai-no-key-warn")?.classList.remove("hidden");
}

function _aiSetSendLoading(loading) {
  const btn     = document.getElementById("ai-send-btn");
  const analyze = document.getElementById("ai-analyze-btn");
  const input   = document.getElementById("ai-input");
  if (btn)     { btn.disabled = loading; btn.textContent = loading ? "…" : "➤"; }
  if (analyze) { analyze.disabled = loading; }
  if (input)   { input.disabled = loading; }
}

let _thinkingCounter = 0;

function _aiAppendThinking() {
  const id = "ai-thinking-" + (++_thinkingCounter);
  const chat = document.getElementById("ai-chat");
  const div = document.createElement("div");
  div.id = id;
  div.className = "ai-bubble ai-bubble-thinking";
  div.innerHTML = `<span class="ai-thinking-dot"></span><span class="ai-thinking-dot"></span><span class="ai-thinking-dot"></span>`;
  chat.appendChild(div);
  div.scrollIntoView({ behavior: "smooth", block: "end" });
  return id;
}

function _aiRemoveThinking(id) {
  document.getElementById(id)?.remove();
}

function _aiAppendBubble(role, text) {
  const chat = document.getElementById("ai-chat");
  const div = document.createElement("div");

  if (role === "user") {
    div.className = "ai-bubble ai-bubble-user";
    div.textContent = text;
  } else if (role === "assistant") {
    div.className = "ai-bubble ai-bubble-assistant";
    div.innerHTML = _aiMarkdownToHtml(text);
  } else {
    div.className = "ai-bubble ai-bubble-error";
    div.textContent = text;
  }

  chat.appendChild(div);
  div.scrollIntoView({ behavior: "smooth", block: "end" });
  return div;
}

function _aiMarkdownToHtml(text) {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^#{1,3}\s+(.+)$/gm, "<strong>$1</strong>")
    .replace(/^[-•]\s+(.+)$/gm, "• $1")
    .replace(/\n{2,}/g, "\n\n")
    .replace(/\n/g, "<br>");
}
