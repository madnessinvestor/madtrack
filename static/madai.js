// ─── Mad AI Tab ───────────────────────────────────────────────────────────────

let _aiHistory = [];
let _aiLoading = false;

// ─── Voice: Speech Recognition ────────────────────────────────────────────────

let _aiRecognition = null;
let _aiListening   = false;

function aiToggleMic() {
  if (_aiListening) { _aiStopMic(); return; }

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Seu navegador não suporta reconhecimento de voz. Use Chrome ou Edge.");
    return;
  }

  _aiRecognition = new SpeechRecognition();
  _aiRecognition.lang = document.documentElement.lang === "en" ? "en-US" : "pt-BR";
  _aiRecognition.interimResults = true;
  _aiRecognition.maxAlternatives = 1;

  const input = document.getElementById("ai-input");

  _aiRecognition.onstart = () => {
    _aiListening = true;
    document.getElementById("ai-mic-btn")?.classList.add("listening");
    if (input) { input.placeholder = "Ouvindo..."; input.disabled = true; }
  };

  _aiRecognition.onresult = (e) => {
    const transcript = Array.from(e.results)
      .map(r => r[0].transcript).join("");
    if (input) input.value = transcript;
  };

  _aiRecognition.onerror = (e) => {
    if (e.error !== "no-speech") console.warn("Mic error:", e.error);
    _aiMicReset();
  };

  _aiRecognition.onend = () => {
    const text = (input?.value || "").trim();
    _aiMicReset();
    if (text) { input.value = ""; aiSendMessage(text); }
  };

  _aiRecognition.start();
}

function _aiStopMic() {
  _aiRecognition?.stop();
  _aiMicReset();
}

function _aiMicReset() {
  _aiListening = false;
  const btn   = document.getElementById("ai-mic-btn");
  const input = document.getElementById("ai-input");
  btn?.classList.remove("listening");
  if (input) {
    input.disabled   = _aiLoading;
    input.placeholder = input.getAttribute("placeholder") || "Pergunte sobre seu portfólio...";
  }
}

// ─── Voice: Text-to-Speech ────────────────────────────────────────────────────

let _aiSpeaking = false;
let _aiCurrentUtterance = null;

function aiSpeak(text, btn) {
  if (!window.speechSynthesis) return;

  // Stop if already speaking
  if (_aiSpeaking) {
    window.speechSynthesis.cancel();
    _aiSpeaking = false;
    document.querySelectorAll(".ai-speak-btn.speaking").forEach(b => {
      b.classList.remove("speaking");
      b.title = "Ouvir resposta";
      b.innerHTML = _aiSpeakerIcon();
    });
    if (btn?.dataset.target === _aiCurrentUtterance?.text?.slice(0,20)) return;
  }

  // Strip markdown/html tags for clean speech
  const clean = text
    .replace(/<[^>]+>/g, "")
    .replace(/[*_`#•]/g, "")
    .replace(/\s+/g, " ").trim();

  const utter = new SpeechSynthesisUtterance(clean);
  utter.lang  = document.documentElement.lang === "en" ? "en-US" : "pt-BR";
  utter.rate  = 1.05;
  _aiCurrentUtterance = utter;

  utter.onstart = () => {
    _aiSpeaking = true;
    if (btn) { btn.classList.add("speaking"); btn.title = "Parar"; btn.innerHTML = _aiStopIcon(); }
  };
  utter.onend = utter.onerror = () => {
    _aiSpeaking = false;
    if (btn) { btn.classList.remove("speaking"); btn.title = "Ouvir resposta"; btn.innerHTML = _aiSpeakerIcon(); }
  };

  window.speechSynthesis.speak(utter);
}

function _aiSpeakerIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>`;
}
function _aiStopIcon() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>`;
}

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
    const speakBtn = document.createElement("button");
    speakBtn.className = "ai-speak-btn";
    speakBtn.title = "Ouvir resposta";
    speakBtn.innerHTML = _aiSpeakerIcon();
    speakBtn.onclick = () => aiSpeak(text, speakBtn);
    div.innerHTML = _aiMarkdownToHtml(text);
    div.appendChild(speakBtn);
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
