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
    category: "Grains",
    productId: "300",
    yahooSymbol: "ZC=F",
    contractHint: "Corn front month",
    quotePage: "https://www.cmegroup.com/markets/agriculture/grains/corn.quotes.html"
  },
  {
    commodity: "Soybeans",
    category: "Oilseeds",
    productId: "320",
    yahooSymbol: "ZS=F",
    contractHint: "Soybeans front month",
    quotePage: "https://www.cmegroup.com/markets/agriculture/oilseeds/soybean.quotes.html"
  },
  {
    commodity: "Chicago SRW Wheat",
    category: "Grains",
    productId: "323",
    yahooSymbol: "ZW=F",
    contractHint: "Wheat front month",
    quotePage: "https://www.cmegroup.com/markets/agriculture/grains/wheat.quotes.html"
  },
  {
    commodity: "KC HRW Wheat",
    category: "Grains",
    yahooSymbol: "KE=F",
    contractHint: "KC wheat front month",
    quotePage: "https://www.cmegroup.com/markets/agriculture/grains/kc-wheat.quotes.html"
  },
  {
    commodity: "Oats",
    category: "Grains",
    yahooSymbol: "ZO=F",
    contractHint: "Oats front month",
    quotePage: "https://www.cmegroup.com/markets/agriculture/grains/oats.quotes.html"
  },
  {
    commodity: "Soybean Meal",
    category: "Oilseeds",
    yahooSymbol: "ZM=F",
    contractHint: "Soybean meal front month",
    quotePage: "https://www.cmegroup.com/markets/agriculture/oilseeds/soybean-meal.quotes.html"
  },
  {
    commodity: "Soybean Oil",
    category: "Oilseeds",
    yahooSymbol: "ZL=F",
    contractHint: "Soybean oil front month",
    quotePage: "https://www.cmegroup.com/markets/agriculture/oilseeds/soybean-oil.quotes.html"
  },
  {
    commodity: "Live Cattle",
    category: "Livestock",
    yahooSymbol: "LE=F",
    contractHint: "Live cattle front month",
    quotePage: "https://www.cmegroup.com/markets/agriculture/livestock/live-cattle.quotes.html"
  },
  {
    commodity: "Feeder Cattle",
    category: "Livestock",
    yahooSymbol: "GF=F",
    contractHint: "Feeder cattle front month",
    quotePage: "https://www.cmegroup.com/markets/agriculture/livestock/feeder-cattle.quotes.html"
  },
  {
    commodity: "Lean Hogs",
    category: "Livestock",
    yahooSymbol: "HE=F",
    contractHint: "Lean hogs front month",
    quotePage: "https://www.cmegroup.com/markets/agriculture/livestock/lean-hogs.quotes.html"
  },
  {
    commodity: "Cotton",
    category: "Softs",
    yahooSymbol: "CT=F",
    contractHint: "Cotton front month",
    quotePage: "https://www.cmegroup.com/markets/agriculture.html"
  },
  {
    commodity: "Sugar",
    category: "Softs",
    yahooSymbol: "SB=F",
    contractHint: "Sugar front month",
    quotePage: "https://www.cmegroup.com/markets/agriculture.html"
  },
  {
    commodity: "Coffee",
    category: "Softs",
    yahooSymbol: "KC=F",
    contractHint: "Coffee front month",
    quotePage: "https://www.cmegroup.com/markets/agriculture.html"
  },
  {
    commodity: "Cocoa",
    category: "Softs",
    yahooSymbol: "CC=F",
    contractHint: "Cocoa front month",
    quotePage: "https://www.cmegroup.com/markets/agriculture.html"
  },
  {
    commodity: "Class III Milk",
    category: "Dairy",
    yahooSymbol: "DC=F",
    contractHint: "Class III milk front month",
    quotePage: "https://www.cmegroup.com/markets/agriculture/dairy/class-iii-milk.quotes.html"
  }
];

function pickFirst(...values) {
  return values.find(value => value !== undefined && value !== null && value !== "" && value !== "-") || "";
}

function formatNumber(value, digits = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  return number.toLocaleString("en-US", {
    minimumFractionDigits: number % 1 === 0 ? 0 : digits,
    maximumFractionDigits: digits
  });
}

function getQuotes(data) {
  if (Array.isArray(data)) return data;
  const candidates = [
    data?.quotes,
    data?.quoteData,
    data?.quote,
    data?.results,
    data?.payload?.quotes,
    data?.data?.quotes
  ];
  return candidates.find(Array.isArray) || [];
}

function normalizeQuote(product, quote) {
  const contract = pickFirst(
    quote.expirationMonth,
    quote.expirationMonthName,
    quote.contractMonth,
    quote.month,
    quote.monthCode,
    quote.contract,
    quote.expirationCode
  );
  const last = pickFirst(
    quote.last,
    quote.lastPrice,
    quote.lastTradePrice,
    quote.tradePrice,
    quote.price,
    quote.formattedLast
  );
  const settle = pickFirst(quote.settle, quote.settlement, quote.lastSettle, quote.settlePrice);
  const priorSettle = pickFirst(quote.priorSettle, quote.previousSettle, quote.previousSettlement);

  return {
    commodity: product.commodity,
    category: product.category,
    contract,
    last,
    settle,
    priorSettle,
    change: pickFirst(quote.change, quote.netChange, quote.changeValue, quote.priceChange),
    volume: pickFirst(quote.volume, quote.totalVolume, quote.trades),
    sourceLabel: "CME",
    sourceUrl: product.quotePage,
    updated: pickFirst(quote.updated, quote.lastUpdate, quote.tradeTime)
  };
}

async function fetchJson(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return JSON.parse(text);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchProduct(product) {
  if (!product.productId) {
    throw new Error(`CME product id is not configured for ${product.commodity}.`);
  }

  const headers = {
    "Accept": "application/json, text/plain, */*",
    "Referer": product.quotePage,
    "User-Agent": "Mozilla/5.0 AgriDecisionAI/1.0"
  };
  const urls = [
    `https://www.cmegroup.com/CmeWS/mvc/Quotes/Future/${product.productId}/G?isProtected&_t=${Date.now()}`,
    `https://www.cmegroup.com/CmeWS/mvc/Quotes/Future/${product.productId}/G?_t=${Date.now()}`,
    `https://www.cmegroup.com/CmeWS/mvc/Quotes/Future/${product.productId}/G`
  ];
  const errors = [];

  for (const url of urls) {
    try {
      const data = await fetchJson(url, { headers });
      const quotes = getQuotes(data)
        .map(quote => normalizeQuote(product, quote))
        .filter(row => row.contract && (row.last || row.settle || row.priorSettle));
      if (quotes.length) return quotes.slice(0, 4);
    } catch (error) {
      errors.push(error.message);
    }
  }

  throw new Error(`CME did not return usable ${product.commodity} quotes. ${errors.join("; ")}`);
}

function normalizeYahooQuote(product, quote) {
  const last = formatNumber(quote.regularMarketPrice);
  const change = quote.regularMarketChange === undefined ? "" : formatNumber(quote.regularMarketChange);
  const updatedAt = quote.regularMarketTime
    ? new Date(quote.regularMarketTime * 1000).toISOString()
    : "";

  return {
    commodity: product.commodity,
    category: product.category,
    contract: pickFirst(quote.shortName, quote.displayName, product.contractHint),
    last,
    settle: "",
    priorSettle: "",
    change,
    volume: quote.regularMarketVolume ? Number(quote.regularMarketVolume).toLocaleString("en-US") : "",
    sourceLabel: "Backup",
    sourceUrl: product.quotePage,
    updated: updatedAt
  };
}

async function fetchYahooQuoteApi() {
  const symbols = PRODUCTS.map(product => product.yahooSymbol).join(",");
  const headers = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 AgriDecisionAI/1.0"
  };
  const urls = [
    `https://query1.finance.yahoo.com/v6/finance/quote?symbols=${encodeURIComponent(symbols)}`,
    `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`
  ];
  const errors = [];

  for (const url of urls) {
    try {
      const data = await fetchJson(url, { headers });
      const results = data?.quoteResponse?.result || [];
      const quotes = PRODUCTS.map(product => {
        const quote = results.find(item => item.symbol === product.yahooSymbol);
        return quote ? normalizeYahooQuote(product, quote) : null;
      }).filter(Boolean);
      if (quotes.length) return quotes;
    } catch (error) {
      errors.push(error.message);
    }
  }

  throw new Error(`Yahoo quote API failed. ${errors.join("; ")}`);
}

function normalizeYahooChartQuote(product, chart) {
  const meta = chart?.chart?.result?.[0]?.meta || {};
  const last = formatNumber(meta.regularMarketPrice);
  const previous = Number(meta.chartPreviousClose || meta.previousClose);
  const current = Number(meta.regularMarketPrice);
  const change = Number.isFinite(current) && Number.isFinite(previous)
    ? formatNumber(current - previous)
    : "";

  return {
    commodity: product.commodity,
    category: product.category,
    contract: pickFirst(meta.longName, meta.shortName, product.contractHint),
    last,
    settle: "",
    priorSettle: Number.isFinite(previous) ? formatNumber(previous) : "",
    change,
    volume: meta.regularMarketVolume ? Number(meta.regularMarketVolume).toLocaleString("en-US") : "",
    sourceLabel: "Backup",
    sourceUrl: product.quotePage,
    updated: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : ""
  };
}

async function fetchYahooChartQuotes() {
  const headers = {
    "Accept": "application/json",
    "User-Agent": "Mozilla/5.0 AgriDecisionAI/1.0"
  };
  const responses = await Promise.allSettled(PRODUCTS.map(async product => {
    const symbol = encodeURIComponent(product.yahooSymbol);
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=1d&range=5d`;
    const data = await fetchJson(url, { headers });
    const quote = normalizeYahooChartQuote(product, data);
    return quote.last ? quote : null;
  }));
  const quotes = responses
    .filter(result => result.status === "fulfilled" && result.value)
    .map(result => result.value);
  const errors = responses
    .filter(result => result.status === "rejected")
    .map(result => result.reason?.message || String(result.reason));

  if (quotes.length) return quotes;
  throw new Error(`Yahoo chart API failed. ${errors.join("; ")}`);
}

async function fetchBackupQuotes() {
  const errors = [];
  const quotes = [];
  const commodities = new Set();

  for (const fetcher of [fetchYahooQuoteApi, fetchYahooChartQuotes]) {
    try {
      const nextQuotes = await fetcher();
      nextQuotes.forEach(row => {
        if (!commodities.has(row.commodity)) {
          commodities.add(row.commodity);
          quotes.push(row);
        }
      });
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (quotes.length) return quotes;
  throw new Error(errors.join(" "));
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Use GET for /api/commodities." });
  }

  const responses = await Promise.allSettled(PRODUCTS.map(fetchProduct));
  let quotes = responses.flatMap(result => result.status === "fulfilled" ? result.value : []);
  const errors = responses
    .filter(result => result.status === "rejected")
    .map(result => result.reason?.message || String(result.reason));

  let fallbackUsed = false;
  try {
    const backupQuotes = await fetchBackupQuotes();
    const cmeCommodities = new Set(quotes.map(row => row.commodity));
    const missingBackupQuotes = backupQuotes.filter(row => !cmeCommodities.has(row.commodity));
    if (missingBackupQuotes.length) {
      quotes = [...quotes, ...missingBackupQuotes];
      fallbackUsed = true;
    }
  } catch (error) {
    errors.push(`Backup quote feed failed: ${error.message}`);
  }

  quotes.sort((a, b) => {
    const aProduct = PRODUCTS.findIndex(product => product.commodity === a.commodity);
    const bProduct = PRODUCTS.findIndex(product => product.commodity === b.commodity);
    return aProduct - bProduct;
  });

  return sendJson(res, 200, {
    quotes,
    errors,
    fallbackUsed,
    note: fallbackUsed
      ? "CME delayed quotes were unavailable, so a backup delayed futures feed is shown with links back to CME Group. Verify directly with CME Group before trading, hedging, or contract decisions."
      : "Delayed CME Group futures snapshot. Verify directly with CME Group before trading, hedging, or contract decisions.",
    source: fallbackUsed ? "Backup delayed futures feed" : "CME Group",
    sourceUrl: "https://www.cmegroup.com/markets/agriculture.html"
  });
};
