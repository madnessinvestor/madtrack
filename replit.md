# CryptoAIO

Privacy-first asset tracker PWA for Cryptocurrencies, Brazilian Stocks (B3), US Stocks, and Forex pairs.

## Stack
- **Backend**: Python 3.12 + Flask
- **Frontend**: Vanilla JavaScript (PWA)
- **Data storage**: JSON files (`assets.json`, `alerts.json`)

## How to run
```
python3 app.py
```
Runs on port 5000.

## Environment variables
| Variable | Required | Description |
|---|---|---|
| `SESSION_SECRET` | Yes (set) | Flask session secret |
| `GROQ_API_KEY` | Optional | Mad AI voice + LLaMA chat |
| `GOOGLE_AI_API_KEY` | Optional | Gemini fallback for Mad AI |
| `OPENROUTER_API_KEY` | Optional | OpenRouter fallback for Mad AI |

Mad AI features (voice input, AI chat) are disabled without the optional keys. All other features (watchlist, portfolio, alerts, forex, stocks) work without any keys.

## User preferences
