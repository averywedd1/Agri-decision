function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.end(JSON.stringify(payload));
}

const PRODUCTS = [
  {
    commodity: "Corn",
    productId: "300",
    quotePage: "https://www.cmegroup.com/markets/agriculture/grains/corn.quotes.html"
  },
  {
    commodity: "Soybeans",
    productId: "320",
    quotePage: "https://www.cmegroup.com/markets/agriculture/oilseeds/soybean.quotes.html"
  },
  {
    commodity: "Chicago SRW Wheat",
    productId: "323",
    quotePage: "https://www.cmegroup.com/markets/agriculture/grains/wheat.quotes.html"
  }
];

function pickFirst(...values) {
  return values.find(value => value !== undefined && value !== null && value !== "") || "";
}

function normalizeQuote(product, quote) {
  return {
    commodity: product.commodity,
    contract: pickFirst(quote.expirationMonth, quote.contractMonth, quote.month, quote.monthCode),
    last: pickFirst(quote.last, quote.price, quote.tradePrice),
    settle: pickFirst(quote.settle, quote.settlement, quote.lastSettle),
    priorSettle: pickFirst(quote.priorSettle, quote.previousSettle),
    change: pickFirst(quote.change, quote.netChange, quote.changeValue),
    volume: pickFirst(quote.volume, quote.totalVolume),
    sourceUrl: product.quotePage
  };
}

async function fetchProduct(product) {
  const url = `https://www.cmegroup.com/CmeWS/mvc/Quotes/Future/${product.productId}/G?isProtected&_t=${Date.now()}`;
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "AgriDecisionAI/1.0"
    }
  });

  if (!response.ok) {
    throw new Error(`CME returned HTTP ${response.status} for ${product.commodity}.`);
  }

  const data = await response.json();
  const quotes = Array.isArray(data?.quotes) ? data.quotes : [];
  return quotes.slice(0, 4).map(quote => normalizeQuote(product, quote));
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Use GET for /api/commodities." });
  }

  const responses = await Promise.allSettled(PRODUCTS.map(fetchProduct));
  const quotes = responses.flatMap(result => result.status === "fulfilled" ? result.value : []);
  const errors = responses
    .filter(result => result.status === "rejected")
    .map(result => result.reason?.message || String(result.reason));

  return sendJson(res, 200, {
    quotes,
    errors,
    note: "Delayed CME Group futures snapshot. Verify directly with CME Group before trading, hedging, or contract decisions.",
    source: "CME Group",
    sourceUrl: "https://www.cmegroup.com/markets/agriculture.html"
  });
};
