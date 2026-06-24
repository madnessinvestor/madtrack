// ─── i18n — PT / EN ───────────────────────────────────────────────────────────

const TRANSLATIONS = {
  pt: {
    btn_add:          "Adicionar",
    btn_trade:        "Trade",
    btn_refresh:      "Atualizar",
    tab_tracker:      "Tracker",
    tab_trade:        "Trade",
    loading:          "Carregando...",
    invested:         "INVESTIDO",
    cur_value:        "VALOR ATUAL",
    pnl:              "P&L",
    modal_search_title:"Buscar Ativo",
    ticker_placeholder:"Digite o ticker: BTC, ETH, SOL...",
    btn_add_list:     "Adicionar à lista",
    not_found:        "Ativo não encontrado em nenhuma exchange.",
    close:            "Fechar",
    trade_modal_title:"Registrar Compra",
    trade_ticker_ph:  "Ticker: BTC, ETH, SOL...",
    cur_price_label:  "Preço atual:",
    qty_label:        "Quantidade",
    price_label:      "Preço pago (USD)",
    total_label:      "Total investido:",
    date_label:       "Data (opcional)",
    confirm_trade:    "Confirmar Compra",
    // portfolio card
    p_invested:       "INVESTIDO",
    p_qty:            "QUANTIDADE",
    p_avg:            "PREÇO MÉDIO",
    p_pnl:            "P&L",
    p_history:        "Histórico de Compras",
    p_no_trades:      "Nenhuma compra registrada.",
    p_add_trade:      "+ Compra",
    p_remove:         "Remover ativo",
    // tracker empty / error
    empty_tracker:    "Nenhum ativo adicionado.<br>Clique em <b>+ Adicionar</b> e digite o ticker.",
    empty_trade:      "Nenhum ativo no portfólio.<br>Clique em <b>+ Trade</b> para registrar uma compra.",
    error_load:       "Erro ao carregar. Verifique a conexão.",
    // errors
    err_ticker:       "Informe o ticker.",
    err_qty:          "Quantidade inválida.",
    err_price:        "Preço inválido.",
    err_save:         "Erro ao salvar.",
    // confirm dialogs
    confirm_remove_token: ticker => `Remover ${ticker} do portfólio?`,
    confirm_remove_trade: "Remover esta compra?",
    // source prefix
    via:              "via",
    // stats labels
    max24h:   "MÁX 24H",
    min24h:   "MÍN 24H",
    vol24h:   "VOLUME 24H",
    mcap:     "MARKET CAP",
  },
  en: {
    btn_add:          "Add",
    btn_trade:        "Trade",
    btn_refresh:      "Refresh",
    tab_tracker:      "Tracker",
    tab_trade:        "Trade",
    loading:          "Loading...",
    invested:         "INVESTED",
    cur_value:        "CURRENT VALUE",
    pnl:              "P&L",
    modal_search_title:"Search Asset",
    ticker_placeholder:"Enter ticker: BTC, ETH, SOL...",
    btn_add_list:     "Add to list",
    not_found:        "Asset not found on any exchange.",
    close:            "Close",
    trade_modal_title:"Record Purchase",
    trade_ticker_ph:  "Ticker: BTC, ETH, SOL...",
    cur_price_label:  "Current price:",
    qty_label:        "Quantity",
    price_label:      "Price paid (USD)",
    total_label:      "Total invested:",
    date_label:       "Date (optional)",
    confirm_trade:    "Confirm Purchase",
    // portfolio card
    p_invested:       "INVESTED",
    p_qty:            "QUANTITY",
    p_avg:            "AVG PRICE",
    p_pnl:            "P&L",
    p_history:        "Purchase History",
    p_no_trades:      "No purchases recorded.",
    p_add_trade:      "+ Buy",
    p_remove:         "Remove asset",
    // tracker empty / error
    empty_tracker:    "No assets added.<br>Click <b>+ Add</b> and type a ticker.",
    empty_trade:      "No assets in portfolio.<br>Click <b>+ Trade</b> to record a purchase.",
    error_load:       "Failed to load. Check your connection.",
    // errors
    err_ticker:       "Enter the ticker.",
    err_qty:          "Invalid quantity.",
    err_price:        "Invalid price.",
    err_save:         "Failed to save.",
    // confirm dialogs
    confirm_remove_token: ticker => `Remove ${ticker} from portfolio?`,
    confirm_remove_trade: "Remove this purchase?",
    // source prefix
    via:              "via",
    // stats labels
    max24h:   "MAX 24H",
    min24h:   "MIN 24H",
    vol24h:   "VOLUME 24H",
    mcap:     "MARKET CAP",
  }
};

let currentLang = localStorage.getItem("lang") || "pt";

function t(key, ...args) {
  const val = TRANSLATIONS[currentLang]?.[key] ?? TRANSLATIONS.pt[key] ?? key;
  return typeof val === "function" ? val(...args) : val;
}

function applyLang() {
  // Update button label
  const btn = document.getElementById("btn-lang");
  if (btn) btn.textContent = currentLang.toUpperCase();

  // Update all [data-i18n] elements
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const val = t(key);
    if (el.tagName === "INPUT") {
      el.placeholder = val;
    } else {
      el.innerHTML = val;
    }
  });

  // Update input placeholders explicitly
  const tickerInput = document.getElementById("ticker-input");
  if (tickerInput) tickerInput.placeholder = t("ticker_placeholder");
  const tradeInput = document.getElementById("trade-ticker-input");
  if (tradeInput) tradeInput.placeholder = t("trade_ticker_ph");

  // Re-render lists to pick up translated strings
  if (typeof rerenderAssets === "function") rerenderAssets();
  if (typeof cachedPortfolio !== "undefined" && cachedPortfolio.length) {
    if (typeof renderPortfolio === "function") renderPortfolio(cachedPortfolio);
  }
}

function toggleLang() {
  currentLang = currentLang === "pt" ? "en" : "pt";
  localStorage.setItem("lang", currentLang);
  applyLang();
}

// Run on load
document.addEventListener("DOMContentLoaded", applyLang);
