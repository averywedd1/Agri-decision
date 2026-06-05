function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(payload));
}

const REGIONAL_BASIS = [
  { match: /iowa|\bia\b|illinois|\bil\b|indiana|\bin\b|corn belt/i, label: "Corn Belt", corn: "-35 to -15 cents", soybeans: "-75 to -45 cents", wheat: "-55 to -25 cents" },
  { match: /minnesota|\bmn\b|wisconsin|\bwi\b|michigan|\bmi\b|upper midwest/i, label: "Upper Midwest", corn: "-45 to -20 cents", soybeans: "-85 to -55 cents", wheat: "-65 to -35 cents" },
  { match: /kansas|\bks\b|nebraska|\bne\b|south dakota|\bsd\b|north dakota|\bnd\b|plains/i, label: "Great Plains", corn: "-50 to -20 cents", soybeans: "-95 to -60 cents", wheat: "-25 to +15 cents" },
  { match: /texas|\btx\b|oklahoma|\bok\b|southern plains/i, label: "Southern Plains", corn: "-25 to +15 cents", soybeans: "-80 to -45 cents", wheat: "-20 to +25 cents" },
  { match: /arkansas|\bar\b|mississippi|\bms\b|louisiana|\bla\b|delta|mid-south/i, label: "Delta / Mid-South", corn: "-20 to +25 cents", soybeans: "-35 to +15 cents", wheat: "-35 to +10 cents" }
];

function commodityList(input = "") {
  const lower = String(input).toLowerCase();
  const crops = [];
  if (/corn/.test(lower)) crops.push("Corn");
  if (/soy|bean/.test(lower)) crops.push("Soybeans");
  if (/wheat/.test(lower)) crops.push("Wheat");
  if (!crops.length) crops.push("Corn", "Soybeans", "Wheat");
  return crops;
}

function basisFor(row, commodity) {
  const key = commodity.toLowerCase();
  return row[key] || "Check local bid sheet";
}

function cashContext(commodity, basis) {
  if (/check/i.test(basis)) return "Needs local elevator quote";
  return `${basis} vs nearby futures`;
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "Use GET for /api/basis." });

  const region = String(req.query?.region || "");
  const commodities = String(req.query?.commodities || "");
  const basisRegion = REGIONAL_BASIS.find(item => item.match.test(region)) || {
    label: region || "National starter range",
    corn: "-45 to -15 cents",
    soybeans: "-85 to -45 cents",
    wheat: "-55 to -15 cents"
  };

  const rows = commodityList(commodities).map(commodity => {
    const basis = basisFor(basisRegion, commodity);
    return {
      commodity,
      basis,
      cashPrice: cashContext(commodity, basis),
      note: "Verify with local elevator bids."
    };
  });

  return sendJson(res, 200, {
    ok: true,
    region,
    rows,
    source: `Regional basis guide for ${basisRegion.label}`,
    sourceUrl: "https://www.ams.usda.gov/market-news",
    note: "Planning ranges are a starting point. Local elevator bids, freight, delivery period, and grain quality determine actual cash price."
  });
};
