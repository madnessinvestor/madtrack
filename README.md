# 🟢 CryptoAIO

**CryptoAIO** é um tracker de ativos *privacy-first* para **Criptomoedas, Ações Brasileiras (B3), Ações Americanas e Pares de Câmbio**, construído com **Flask + Vanilla JavaScript** como **Progressive Web App (PWA)**.

Monitore seus ativos favoritos de forma rápida, leve e sem abrir mão da privacidade — sem conta, sem assinatura, sem rastreamento.

---

## ✨ Funcionalidades

### 🤖 Mad AI — Assistente Financeiro com IA
Converse com uma IA especializada no seu portfólio, com suporte a **voz**.

- Análise completa de trades (P&L, win rate, melhor/pior ativo)
- Perguntas livres sobre o portfólio em linguagem natural
- **Entrada por voz**: grave sua pergunta com o microfone; o áudio é transcrito via **Groq Whisper**
- **Leitura em voz alta**: ouça as respostas da IA com síntese de fala nativa
- Gateway com fallback automático entre provedores: **Groq → Gemini → OpenRouter**

---

### 🚀 Agregação de Preços Multi-Exchange
Preços buscados em múltiplas exchanges simultaneamente com seleção automática da melhor fonte disponível.

| Exchange | Exchange | Exchange |
|----------|----------|----------|
| Hyperliquid | MEXC | KuCoin |
| Gate.io | OKX | Kraken |
| Bitfinex | CoinGecko | CoinCap |
| CryptoCompare | — | — |

---

### 📊 Ações

#### 🇧🇷 Bolsa Brasileira (B3)
PETR4, VALE3, ITUB4, BBAS3, WEGE3, BBDC4 e muito mais — via **brapi.dev**.

#### 🇺🇸 Bolsa Americana
AAPL, MSFT, NVDA, TSLA, GOOGL e qualquer ticker americano suportado.

---

### 💱 Câmbio (Forex)
Pares em tempo real com ícones de bandeira automáticos:
`USDBRL` · `EURBRL` · `GBPBRL` · `USDEUR` · `USDJPY`

---

### 🌎 Multi-Moeda
Visualize todos os ativos em **BRL (R$)**, **USD ($)** ou **EUR (€)** com conversão em tempo real e troca instantânea sem recarregar a página.

---

### ⭐ Watchlist
Adicione e remova ativos com persistência automática — sem login.

---

### 💼 Aba Trade (Portfólio)
- Registro de entradas e saídas por ativo
- Cálculo de P&L realizado e não realizado
- Win rate e estatísticas agregadas
- Suporte a múltiplos trades por ativo

---

### 🏦 Dashboard de Wallets
- Acompanhe saldos de carteiras on-chain
- Agrupamento por rede e tipo de ativo
- Ativos manuais para posições off-chain

---

### 🔔 Alertas de Preço
Configure alertas de alta/baixa para qualquer ativo da watchlist. Notificação imediata no navegador.

---

### 📱 Progressive Web App (PWA)
Instale o CryptoAIO direto na tela inicial em Android, iPhone, Windows, macOS ou Linux.
- Shell offline
- Carregamento rápido
- Experiência nativa

---

### 🔒 Privacy First

| ✅ Não exige conta | ✅ Não coleta dados pessoais |
|---|---|
| ✅ Sem analytics ou rastreamento | ✅ Sem chaves privadas |
| ✅ Sem integração com corretoras | ✅ Sem venda de informações |

---

## 🪙 Tipos de Ativo Suportados

| Tipo | Exemplos |
|------|----------|
| Criptomoedas | BTC, ETH, SOL, HYPE, XRP, DOGE |
| Ações BR (B3) | PETR4, VALE3, ITUB4, WEGE3 |
| Ações EUA | AAPL, NVDA, TSLA, GOOGL |
| Câmbio | USDBRL, EURBRL, GBPBRL |

---

## 🛠 Stack

| Camada | Tecnologia |
|--------|-----------|
| Backend | Python 3.12 + Flask 3 |
| Frontend | HTML5 · CSS3 · Vanilla JS (ES6+) |
| IA | Groq (Whisper + LLaMA) · Gemini · OpenRouter |
| Dados de Mercado | Hyperliquid, MEXC, KuCoin, Gate.io, OKX, Kraken, Bitfinex, CoinGecko, CoinCap, CryptoCompare, brapi.dev, Frankfurter |
| Armazenamento | JSON local + localStorage |

---

## 📂 Estrutura do Projeto

```
cryptoaio/
├── app.py                  # Backend Flask — rotas, agregação de preços, Mad AI gateway
├── assets.json             # Watchlist e portfólio persistidos
├── alerts.json             # Alertas de preço
├── dashboard_wallets.json  # Wallets on-chain
├── requirements.txt
│
├── static/
│   ├── style.css           # Estilos globais
│   ├── app.js              # Lógica principal (watchlist, preços, câmbio)
│   ├── madai.js            # Mad AI — chat, voz, TTS
│   ├── trade.js            # Aba Trade / portfólio
│   ├── dashboard.js        # Dashboard de wallets
│   ├── alerts.js           # Alertas de preço
│   ├── widget.js           # Widget configurável
│   ├── i18n.js             # Internacionalização (pt/en)
│   ├── manifest.json       # PWA manifest
│   ├── sw.js               # Service Worker
│   └── icons/              # Ícones de tokens (cache local)
│
└── templates/
    ├── index.html          # App principal
    ├── widget.html         # Widget standalone
    └── widget_settings.html
```

---

## 🚀 Como Rodar

### Pré-requisitos
- Python 3.10+

### Instalação

```bash
git clone https://github.com/madnessinvestor/madtrack.git
cd madtrack
pip install -r requirements.txt
python app.py
```

Acesse em: `http://localhost:5000`

### Variáveis de Ambiente (opcionais — para o Mad AI)

| Variável | Descrição |
|----------|-----------|
| `GROQ_API_KEY` | Groq (transcrição Whisper + LLaMA) |
| `GOOGLE_AI_API_KEY` | Google Gemini (fallback) |
| `OPENROUTER_API_KEY` | OpenRouter (fallback) |

> Sem essas chaves, o Mad AI fica indisponível. Os demais módulos funcionam normalmente.

---

## 🎯 Roadmap

- [x] Watchlist multi-ativo
- [x] Portfólio com P&L
- [x] Dashboard de wallets on-chain
- [x] Alertas de preço
- [x] Multi-moeda (BRL / USD / EUR)
- [x] Mad AI — assistente com análise de portfólio
- [x] Entrada por voz (Groq Whisper)
- [x] Leitura em voz alta (TTS nativo)
- [x] PWA instalável
- [ ] Gráficos históricos de preço
- [ ] Múltiplas watchlists
- [ ] Export/Import de dados

---

## 📄 Licença

Distribuído sob a licença **MIT**.

---

<div align="center">
  <strong>CryptoAIO</strong> — Simples. Rápido. Privado.
</div>
