# 📈 MadTracker

**MadTracker** is a privacy-first asset tracker for **Cryptocurrencies, Brazilian Stocks (B3), US Stocks, and Forex Pairs**, built with **Flask** and **Vanilla JavaScript** as a **Progressive Web App (PWA)**.
Track your favorite assets in a lightweight, fast, and privacy-focused application — without accounts, subscriptions, or invasive tracking.

---

## ✨ Features

### 🚀 Multi-Source Crypto Price Aggregation
MadTracker fetches prices from multiple exchanges simultaneously and automatically selects the best available market data.

Supported sources:

* Hyperliquid
* MEXC
* KuCoin
* Gate.io
* OKX
* Kraken
* Bitfinex
* CoinGecko
* CoinCap
* CryptoCompare

This approach improves reliability and reduces dependency on a single provider.

---

### 📊 Stocks Support

#### 🇧🇷 Brazilian Stocks (B3)

Track popular B3 tickers such as:

* PETR4
* VALE3
* ITUB4
* BBAS3
* WEGE3
* BBDC4

#### 🇺🇸 US Stocks

Support for US equities through market data providers.

Examples:

* AAPL
* MSFT
* NVDA
* TSLA
* GOOGL

---

### 💱 Forex Tracking

Monitor currency pairs in real time:

* USDBRL
* EURBRL
* GBPBRL
* USDEUR
* USDJPY

Includes automatic country flag icons for improved visualization.

---

### 🌎 Multi-Currency Display

View all assets in:

* 🇧🇷 BRL (R$)
* 🇺🇸 USD ($)
* 🇪🇺 EUR (€)

Features:

* Real-time exchange conversion
* Persistent preference storage
* Instant switching without page reload

---

### ⭐ Watchlist

Create a personalized portfolio watchlist.

Features:

* Add assets instantly
* Remove assets anytime
* Automatic persistence
* No login required

---

### 📈 Market Statistics

For supported assets:

* Current Price
* 24h Change (%)
* 24h High
* 24h Low
* Trading Volume
* Market Capitalization

---

### 📱 Progressive Web App (PWA)

Install MadTracker directly on:

* Android
* iPhone
* Windows
* macOS
* Linux

Benefits:

* Home screen installation
* Offline UI shell
* Fast loading
* Native-app-like experience

---

### 🔒 Privacy First

MadTracker is designed with privacy as a core principle.

The application:

✅ Does not require an account

✅ Does not collect personal data

✅ Does not use analytics or tracking scripts

✅ Does not store private keys

✅ Does not require exchange connections

✅ Does not sell or share user information

---

## 🪙 Supported Asset Types

| Type                  | Examples                 |
| --------------------- | ------------------------ |
| Cryptocurrencies      | BTC, ETH, SOL, XRP, DOGE |
| Brazilian Stocks (B3) | PETR4, VALE3, ITUB4      |
| US Stocks             | AAPL, NVDA, TSLA         |
| Forex                 | USDBRL, EURBRL, GBPBRL   |

---

## 🛠 Tech Stack

### Backend

* Python 3.12
* Flask 3

### Frontend

* HTML5
* CSS3
* Vanilla JavaScript (ES6+)

### Market Data Providers

* Hyperliquid
* MEXC
* KuCoin
* Gate.io
* OKX
* Kraken
* Bitfinex
* CoinGecko
* CoinCap
* CryptoCompare
* brapi.dev
* Frankfurter

### Storage

* assets.json
* Browser localStorage

### Assets & Icons

* cryptocurrency-icons
* flagcdn

---

## 📂 Project Structure

```text
MadTracker/
│
├── app.py
├── assets.json
├── requirements.txt
│
├── static/
│   ├── app.js
│   ├── style.css
│   ├── sw.js
│   └── manifest.json
│
└── templates/
    └── index.html
```

---

## 🚀 Installation

### Clone Repository

```bash
git clone https://github.com/yourusername/madtracker.git

cd madtracker
```

### Create Virtual Environment

```bash
python -m venv venv
```

Windows:

```bash
venv\Scripts\activate
```

Linux/macOS:

```bash
source venv/bin/activate
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Run Application

```bash
python app.py
```

Open:

```text
http://localhost:5000
```

---

## 📸 Screenshots

Add screenshots here:

```markdown
![Dashboard](screenshots/dashboard.png)

![Watchlist](screenshots/watchlist.png)

![Mobile](screenshots/mobile.png)
```

---

## 🎯 Roadmap

* [ ] Portfolio tracking
* [ ] Profit/Loss calculations
* [ ] Asset allocation charts
* [ ] Historical price charts
* [ ] Multiple watchlists
* [ ] Dark/Light themes
* [ ] Export & Import settings
* [ ] Price alerts
* [ ] Offline asset cache

---

## 🤝 Contributing

Contributions, bug reports, and feature requests are welcome.

Feel free to open an issue or submit a pull request.

---

## 📄 License

This project is released under the MIT License.

---

## ⭐ Why MadTracker?

Unlike traditional portfolio trackers, MadTracker focuses on:

* Privacy
* Simplicity
* Speed
* No accounts
* No subscriptions
* No tracking

A lightweight asset tracker built for users who want complete control over their financial data.

- Não envia informações pessoais para nenhum servidor
- Não armazena chaves privadas
- Não requer integração com conta em corretora
