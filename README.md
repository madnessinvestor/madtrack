# 🟢 CryptoAIO

**CryptoAIO** is a *privacy-first* asset tracker for **Cryptocurrencies, Brazilian Stocks (B3), US Stocks, and Forex Pairs**, built with **Flask + Vanilla JavaScript** as a **Progressive Web App (PWA)**.

Monitor your favourite assets quickly and lightly — no account, no subscription, no tracking.

---

## ✨ Features

### 🤖 Mad AI — AI-Powered Financial Assistant
Chat with an AI specialized in your portfolio, with **voice** support.

- Full trade analysis (P&L, win rate, best/worst asset)
- Natural-language questions about your portfolio
- **Voice input**: record your question with the microphone; audio is transcribed via **Groq Whisper**
- **Text-to-speech**: listen to AI responses with native speech synthesis
- Gateway with automatic fallback across providers: **Groq → Gemini → OpenRouter**

---

### 🚀 Multi-Exchange Price Aggregation
Prices fetched from multiple exchanges simultaneously with automatic best-source selection.

| Exchange | Exchange | Exchange |
|----------|----------|----------|
| Hyperliquid | MEXC | KuCoin |
| Gate.io | OKX | Kraken |
| Bitfinex | CoinGecko | CoinCap |
| CryptoCompare | — | — |

---

### 📊 Stocks

#### 🇧🇷 Brazilian Stock Exchange (B3)
PETR4, VALE3, ITUB4, BBAS3, WEGE3, BBDC4 and many more — via **brapi.dev**.

#### 🇺🇸 US Stock Market
AAPL, MSFT, NVDA, TSLA, GOOGL and any supported American ticker.

---

### 💱 Forex
Real-time pairs with automatic flag icons:
`USDBRL` · `EURBRL` · `GBPBRL` · `USDEUR` · `USDJPY`

---

### 🌎 Multi-Currency
View all assets in **BRL (R$)**, **USD ($)** or **EUR (€)** with real-time conversion and instant switching without reloading the page.

---

### ⭐ Watchlist
Add and remove assets with automatic persistence — no login required.

---

### 💼 Trade Tab (Portfolio)
- Record entries and exits per asset
- Realised and unrealised P&L calculation
- Win rate and aggregated statistics
- Multiple trades per asset supported

---

### 🏦 Wallet Dashboard
- Track on-chain wallet balances
- Group by network and asset type
- Manual assets for off-chain positions

---

### 🔔 Price Alerts
Set high/low alerts for any watchlist asset. Instant browser notification.

---

### 📱 Embeddable Widget
A standalone ticker widget (`/widget`) that can be embedded in any page.
- Configurable columns (1 or 2) and rows (1 or 2 per asset)
- Adjustable font size, theme, currency, and refresh rate
- Separate settings page at `/widget/settings`

---

### 📱 Progressive Web App (PWA)
Install CryptoAIO directly on your home screen on Android, iPhone, Windows, macOS or Linux.
- Offline shell
- Fast loading
- Native-like experience

---

### 🔒 Privacy First

| ✅ No account required | ✅ No personal data collected |
|---|---|
| ✅ No analytics or tracking | ✅ No private keys |
| ✅ No broker integration | ✅ No data selling |

---

## 🪙 Supported Asset Types

| Type | Examples |
|------|----------|
| Cryptocurrencies | BTC, ETH, SOL, HYPE, XRP, DOGE |
| Brazilian Stocks (B3) | PETR4, VALE3, ITUB4, WEGE3 |
| US Stocks | AAPL, NVDA, TSLA, GOOGL |
| Forex | USDBRL, EURBRL, GBPBRL |

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12 + Flask 3 |
| Frontend | HTML5 · CSS3 · Vanilla JS (ES6+) |
| AI | Groq (Whisper + LLaMA) · Gemini · OpenRouter |
| Market Data | Hyperliquid, MEXC, KuCoin, Gate.io, OKX, Kraken, Bitfinex, CoinGecko, CoinCap, CryptoCompare, brapi.dev, Frankfurter |
| Storage | Local JSON + localStorage |

---

## 📂 Project Structure

```
cryptoaio/
├── app.py                  # Flask backend — routes, price aggregation, Mad AI gateway
├── assets.json             # Persisted watchlist and portfolio
├── alerts.json             # Price alerts
├── dashboard_wallets.json  # On-chain wallets
├── requirements.txt
│
├── static/
│   ├── style.css           # Global styles (dark/light themes)
│   ├── app.js              # Core logic (watchlist, prices, currency)
│   ├── madai.js            # Mad AI — chat, voice input, TTS
│   ├── trade.js            # Trade tab / portfolio
│   ├── dashboard.js        # Wallet dashboard
│   ├── alerts.js           # Price alerts
│   ├── widget.js           # Configurable SPA widget
│   ├── i18n.js             # Internationalisation (pt / en)
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service Worker
│   └── icons/              # Local token icon cache
│
└── templates/
    ├── index.html          # Main SPA
    ├── widget.html         # Standalone widget page
    └── widget_settings.html
```

---

## 🚀 Getting Started

### Prerequisites
- Python 3.10+

### Installation

```bash
git clone https://github.com/madnessinvestor/madtrack.git
cd madtrack
pip install -r requirements.txt
python app.py
```

Open in your browser: `http://localhost:5000`

### Environment Variables (optional — required for Mad AI)

| Variable | Description |
|----------|-------------|
| `GROQ_API_KEY` | Groq (Whisper transcription + LLaMA chat) |
| `GOOGLE_AI_API_KEY` | Google Gemini (fallback) |
| `OPENROUTER_API_KEY` | OpenRouter (fallback) |

> Without these keys Mad AI is unavailable. All other modules work normally.

---

## 🎯 Roadmap

- [x] Multi-asset watchlist
- [x] Portfolio with P&L
- [x] On-chain wallet dashboard
- [x] Price alerts
- [x] Multi-currency (BRL / USD / EUR)
- [x] Mad AI — AI assistant with portfolio analysis
- [x] Voice input (Groq Whisper)
- [x] Text-to-speech (native TTS)
- [x] Installable PWA
- [x] Embeddable widget with 2-column / 2-row layouts
- [ ] Historical price charts
- [ ] Multiple watchlists
- [ ] Data export / import

---

## 📄 License

Distributed under the **MIT** license.

---

<div align="center">
  <strong>CryptoAIO</strong> — Simple. Fast. Private.
</div>
