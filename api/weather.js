function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(JSON.stringify(payload));
}

const STATE_POINTS = {
  alabama: [32.8067, -86.7911], alaska: [61.3707, -152.4044], arizona: [33.7298, -111.4312],
  arkansas: [34.9697, -92.3731], california: [36.1162, -119.6816], colorado: [39.0598, -105.3111],
  connecticut: [41.5978, -72.7554], delaware: [39.3185, -75.5071], florida: [27.7663, -81.6868],
  georgia: [33.0406, -83.6431], idaho: [44.2405, -114.4788], illinois: [40.3495, -88.9861],
  indiana: [39.8494, -86.2583], iowa: [42.0115, -93.2105], kansas: [38.5266, -96.7265],
  kentucky: [37.6681, -84.6701], louisiana: [31.1695, -91.8678], maine: [44.6939, -69.3819],
  maryland: [39.0639, -76.8021], massachusetts: [42.2302, -71.5301], michigan: [43.3266, -84.5361],
  minnesota: [45.6945, -93.9002], mississippi: [32.7416, -89.6787], missouri: [38.4561, -92.2884],
  montana: [46.9219, -110.4544], nebraska: [41.1254, -98.2681], nevada: [38.3135, -117.0554],
  newhampshire: [43.4525, -71.5639], newjersey: [40.2989, -74.521], newmexico: [34.8405, -106.2485],
  newyork: [42.1657, -74.9481], northcarolina: [35.6301, -79.8064], northdakota: [47.5289, -99.784],
  ohio: [40.3888, -82.7649], oklahoma: [35.5653, -96.9289], oregon: [44.572, -122.0709],
  pennsylvania: [40.5908, -77.2098], southcarolina: [33.8569, -80.945], southdakota: [44.2998, -99.4388],
  tennessee: [35.7478, -86.6923], texas: [31.0545, -97.5635], utah: [40.15, -111.8624],
  vermont: [44.0459, -72.7107], virginia: [37.7693, -78.17], washington: [47.4009, -121.4905],
  westvirginia: [38.4912, -80.9545], wisconsin: [44.2685, -89.6165], wyoming: [42.756, -107.3025]
};

const ABBREVIATIONS = {
  al: "alabama", ar: "arkansas", az: "arizona", ca: "california", co: "colorado", ga: "georgia",
  ia: "iowa", id: "idaho", il: "illinois", in: "indiana", ks: "kansas", ky: "kentucky",
  la: "louisiana", mi: "michigan", mn: "minnesota", mo: "missouri", ms: "mississippi",
  mt: "montana", nd: "northdakota", ne: "nebraska", oh: "ohio", ok: "oklahoma", or: "oregon",
  sd: "southdakota", tn: "tennessee", tx: "texas", wa: "washington", wi: "wisconsin"
};

function stateKey(region = "") {
  const lower = String(region).toLowerCase();
  const abbreviation = lower.match(/\b[a-z]{2}\b/)?.[0];
  if (abbreviation && ABBREVIATIONS[abbreviation]) return ABBREVIATIONS[abbreviation];
  return Object.keys(STATE_POINTS).find(key => lower.includes(key.replace(/([a-z])([A-Z])/g, "$1 $2")) || lower.replace(/[^a-z]/g, "").includes(key));
}

function nearestStateKey(lat, lon) {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return "";
  let bestKey = "";
  let bestDistance = Infinity;
  Object.entries(STATE_POINTS).forEach(([key, point]) => {
    const [stateLat, stateLon] = point;
    const latDistance = lat - stateLat;
    const lonDistance = (lon - stateLon) * Math.max(0.2, Math.cos(lat * Math.PI / 180));
    const distance = latDistance * latDistance + lonDistance * lonDistance;
    if (distance < bestDistance) {
      bestDistance = distance;
      bestKey = key;
    }
  });
  return bestKey;
}

function plantingWindow(key, commodities = "") {
  const crop = commodities.toLowerCase();
  if (/wheat/.test(crop) && /kansas|oklahoma|texas|nebraska|southdakota|northdakota/.test(key)) return "Wheat window: fall planting / early-summer harvest";
  if (/corn|soy|bean/.test(crop) && /texas|arkansas|mississippi|louisiana|georgia|alabama|florida/.test(key)) return "Row-crop window: early spring planting";
  if (/corn|soy|bean/.test(crop) && /minnesota|northdakota|wisconsin|michigan/.test(key)) return "Row-crop window: late April to May";
  if (/corn|soy|bean/.test(crop)) return "Row-crop window: April to early May";
  return "Use local extension dates for final field timing";
}

async function getJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/geo+json, application/json",
      "User-Agent": "AgriDecisionAI/1.0 (farm decision support)"
    }
  });
  if (!response.ok) throw new Error(`NWS returned ${response.status}`);
  return response.json();
}

module.exports = async function handler(req, res) {
  if (req.method !== "GET") return sendJson(res, 405, { ok: false, error: "Use GET for /api/weather." });

  const region = req.query?.region || "";
  const commodities = req.query?.commodities || "";
  const requestedLat = Number(req.query?.lat);
  const requestedLon = Number(req.query?.lon);
  const hasCoordinates = Number.isFinite(requestedLat) && Number.isFinite(requestedLon);
  const key = stateKey(region) || (hasCoordinates ? nearestStateKey(requestedLat, requestedLon) : "");
  if ((!key || !STATE_POINTS[key]) && !hasCoordinates) return sendJson(res, 200, {
    ok: false,
    error: "Enter a U.S. state or draw a field map boundary to load weather context."
  });

  const [lat, lon] = hasCoordinates ? [requestedLat, requestedLon] : STATE_POINTS[key];
  try {
    const point = await getJson(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`);
    const forecastUrl = point?.properties?.forecast;
    const place = point?.properties?.relativeLocation?.properties;
    if (!forecastUrl) throw new Error("NWS did not return a forecast link.");
    const forecast = await getJson(forecastUrl);
    const periods = (forecast?.properties?.periods || []).slice(0, 5).map(period => ({
      name: period.name,
      forecast: period.detailedForecast || period.shortForecast
    }));
    const text = periods.map(period => period.forecast).join(" ").toLowerCase();
    const riskLevel = /thunder|heavy|flood|freeze|frost|snow|wind/.test(text) ? "Weather risk: watch field timing" : "Weather risk: normal planning";
    return sendJson(res, 200, {
      ok: true,
      region,
      location: place?.city ? `${place.city}, ${place.state}` : region,
      source: req.query?.source === "field map" ? "National Weather Service forecast from field map" : "National Weather Service forecast",
      sourceUrl: "https://api.weather.gov",
      plantingWindow: plantingWindow(key, commodities),
      coordinates: { lat, lon },
      riskLevel,
      summary: periods[0]?.forecast || "Local forecast loaded.",
      periods,
    });
  } catch (error) {
    return sendJson(res, 200, {
      ok: true,
      region,
      source: req.query?.source === "field map" ? "Regional planning fallback from field map" : "Regional planning fallback",
      plantingWindow: plantingWindow(key, commodities),
      coordinates: { lat, lon },
      riskLevel: "Weather feed unavailable",
      summary: `NWS forecast could not be loaded (${error.message}). Use local NWS/extension guidance before field operations.`,
      periods: []
    });
  }
};
