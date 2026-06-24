# MadTracker

A privacy-first asset tracker for cryptocurrencies, Brazilian stocks (B3), and forex pairs — built with Flask and Vanilla JavaScript as a Progressive Web App (PWA).

---

## Features

- **Multi-source price aggregation** — fetches data in parallel from 10+ exchanges (Hyperliquid, MEXC, KuCoin, Gate.io, OKX, Kraken, CryptoCompare, CoinCap, CoinGecko, Bitfinex) and picks the best available price
- **Brazilian & US stocks** — supports B3 tickers (PETR4, VALE3, ITUB4…) and US equities via brapi.dev
- **Forex pairs** — track exchange rates such as USDBRL and EURBRL with country flag icons
- **Currency toggle** — view all prices in USD ($), EUR (€), or BRL (R$) with real-time conversion; preference is saved across sessions
- **Watchlist** — add and remove assets; list persists between sessions
- **24h stats** — price change %, high/low, volume, and market cap per asset
- **PWA support** — installable on mobile and desktop, works offline for the UI shell
- **Privacy by design** — no accounts, no tracking, no external analytics

---

## Supported Asset Types

| Type | Examples |
|---|---|
| Crypto (perp / spot) | BTC, ETH, SOL, DOGE, XRP… |
| Brazilian stocks (B3) | PETR4, VALE3, ITUB4, BBAS3… |
| Forex pairs | USDBRL, EURBRL, GBPBRL… |

---

## Tech Stack

- **Backend:** Python 3.12 · Flask 3
- **Frontend:** HTML5 · CSS3 · Vanilla JavaScript (ES6+)
- **Data sources:** Hyperliquid, MEXC, KuCoin, Gate.io, OKX, Kraken, CryptoCompare, CoinCap, CoinGecko, Bitfinex, brapi.dev, Frankfurter
- **Icons:** cryptocurrency-icons CDN (crypto) · flagcdn.com (forex)
- **Storage:** `assets.json` (local watchlist) · `localStorage` (currency preference)

---

## Project Structure

```
├── app.py              # Flask server — price aggregation, caching, API routes
├── assets.json         # Persisted watchlist
├── requirements.txt    # Python dependencies
├── static/
│   ├── app.js          # Frontend logic (search, watchlist, currency toggle)
│   ├── style.css       # Dark-themed UI
│   ├── sw.js           # Service worker (PWA)
│   └── manifest.json   # PWA metadata
└── templates/
    └── index.html      # Single-page interface
```

---

## Running Locally

```bash
pip install flask
python app.py
```

App runs at `http://localhost:5000`.

---

## Privacy

All data is stored locally on the user's machine. The app:

- Does not require a login
- Does not send personal information to any server
- Does not store private keys
- Does not require integration with any exchange account

---

---

# MadTracker — Português

Rastreador de ativos com foco em privacidade para criptomoedas, ações brasileiras (B3) e pares de câmbio — construído com Flask e Vanilla JavaScript como Progressive Web App (PWA).

---

## Funcionalidades

- **Agregação de preços de múltiplas fontes** — busca dados em paralelo de mais de 10 exchanges (Hyperliquid, MEXC, KuCoin, Gate.io, OKX, Kraken, CryptoCompare, CoinCap, CoinGecko, Bitfinex) e escolhe o melhor preço disponível
- **Ações brasileiras e americanas** — suporte a tickers da B3 (PETR4, VALE3, ITUB4…) e bolsa americana via brapi.dev
- **Pares de câmbio** — acompanhe cotações como USDBRL e EURBRL com ícones de bandeiras dos países
- **Alternador de moeda** — visualize todos os preços em USD ($), EUR (€) ou BRL (R$) com conversão em tempo real; preferência salva entre sessões
- **Lista de acompanhamento** — adicione e remova ativos; lista persiste entre sessões
- **Estatísticas 24h** — variação de preço, máxima/mínima, volume e market cap por ativo
- **Suporte a PWA** — instalável no celular e desktop, funciona offline para a interface
- **Privacidade por padrão** — sem contas, sem rastreamento, sem analytics externos

---

## Tipos de Ativos Suportados

| Tipo | Exemplos |
|---|---|
| Cripto (perp / spot) | BTC, ETH, SOL, DOGE, XRP… |
| Ações brasileiras (B3) | PETR4, VALE3, ITUB4, BBAS3… |
| Pares de câmbio | USDBRL, EURBRL, GBPBRL… |

---

## Stack Tecnológica

- **Backend:** Python 3.12 · Flask 3
- **Frontend:** HTML5 · CSS3 · Vanilla JavaScript (ES6+)
- **Fontes de dados:** Hyperliquid, MEXC, KuCoin, Gate.io, OKX, Kraken, CryptoCompare, CoinCap, CoinGecko, Bitfinex, brapi.dev, Frankfurter
- **Ícones:** cryptocurrency-icons CDN (cripto) · flagcdn.com (câmbio)
- **Armazenamento:** `assets.json` (lista local) · `localStorage` (preferência de moeda)

---

## Estrutura do Projeto

```
├── app.py              # Servidor Flask — agregação de preços, cache, rotas da API
├── assets.json         # Lista de acompanhamento persistida
├── requirements.txt    # Dependências Python
├── static/
│   ├── app.js          # Lógica do frontend (busca, watchlist, alternador de moeda)
│   ├── style.css       # Interface com tema escuro
│   ├── sw.js           # Service worker (PWA)
│   └── manifest.json   # Metadados do PWA
└── templates/
    └── index.html      # Interface de página única
```

---

## Executar Localmente

```bash
pip install flask
python app.py
```

App disponível em `http://localhost:5000`.

---

## Privacidade

Todos os dados são armazenados localmente na máquina do usuário. O app:

- Não exige login
- Não envia informações pessoais para nenhum servidor
- Não armazena chaves privadas
- Não requer integração com conta em corretora
