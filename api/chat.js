async function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(payload));
}

function getEnvKeyForProvider(providerId) {
  const map = {
    openai: process.env.OPENAI_API_KEY || "",
    openrouter: process.env.OPENROUTER_API_KEY || "",
    groq: process.env.GROQ_API_KEY || "",
    gemini: process.env.GEMINI_API_KEY || "",
    mistral: process.env.MISTRAL_API_KEY || "",
    custom: process.env.CUSTOM_API_KEY || ""
  };
  return map[providerId] || "";
}

async function callOpenAiLike({ endpoint, model, apiKey, systemPrompt, userPrompt, maxTokens, temperature, providerId }) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (providerId === "openrouter") {
    headers["HTTP-Referer"] = "https://agridecision.local";
    headers["X-Title"] = "AgriDecision Farmer Hub";
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `Provider error HTTP ${response.status}`);
  }

  return (
    data?.choices?.[0]?.message?.content ||
    data?.choices?.[0]?.text ||
    data?.output ||
    data?.answer ||
    "No response text was returned."
  );
}

async function callGemini({ model, apiKey, systemPrompt, userPrompt, maxTokens, temperature }) {
  const selected = (model || "gemini-2.5-flash").replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${selected}:generateContent?key=${encodeURIComponent(apiKey || "")}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userPrompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens
      }
    })
  });

  const raw = await response.text();
  let data = {};
  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = { raw };
  }

  if (!response.ok) {
    throw new Error(data?.error?.message || `Gemini error HTTP ${response.status}`);
  }

  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts.map(part => part.text || "").join("\n").trim() || "No response text was returned.";
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Use POST for /api/chat." });
  }

  try {
    const body = await parseBody(req);
    const provider = body.provider || {};
    const providerId = (Object.keys({
      openai: 1,
      openrouter: 1,
      groq: 1,
      gemini: 1,
      mistral: 1,
      custom: 1
    }).includes(provider.id) && provider.id) || body.providerId || "";

    const effectiveProviderId = providerId || (
      provider.endpoint && provider.model ? "custom" :
      provider.mode === "gemini" ? "gemini" :
      "openai"
    );

    const mode = provider.mode || (effectiveProviderId === "gemini" ? "gemini" : "openai");
    const endpoint = provider.endpoint;
    const model = provider.model;
    const apiKey = body.apiKey || getEnvKeyForProvider(effectiveProviderId);
    const userPrompt = String(body.userPrompt || "").trim();
    const systemPrompt = String(body.systemPrompt || "").trim();
    const maxTokens = Number(body.maxTokens) || 1200;
    const temperature = Number(body.temperature) || 0.5;

    if (!userPrompt) {
      return sendJson(res, 400, { error: "Missing userPrompt." });
    }

    if (!model) {
      return sendJson(res, 400, { error: "Missing provider model." });
    }

    let answer = "";
    if (mode === "gemini") {
      if (!apiKey) return sendJson(res, 400, { error: "Missing Gemini API key." });
      answer = await callGemini({ model, apiKey, systemPrompt, userPrompt, maxTokens, temperature });
    } else {
      if (!endpoint) return sendJson(res, 400, { error: "Missing provider endpoint." });
      answer = await callOpenAiLike({
        endpoint,
        model,
        apiKey,
        systemPrompt,
        userPrompt,
        maxTokens,
        temperature,
        providerId: effectiveProviderId
      });
    }

    return sendJson(res, 200, { answer });
  } catch (error) {
    return sendJson(res, 500, {
      error: error && error.message ? error.message : "Unexpected server error."
    });
  }
};
