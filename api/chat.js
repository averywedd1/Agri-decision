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
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.end(JSON.stringify(payload));
}

const PROVIDERS = {
  openai: {
    mode: "openai",
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    endpoint: "https://api.openai.com/v1/chat/completions",
    key: () => process.env.OPENAI_API_KEY || ""
  },
  openrouter: {
    mode: "openai",
    model: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    key: () => process.env.OPENROUTER_API_KEY || ""
  },
  groq: {
    mode: "openai",
    model: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    key: () => process.env.GROQ_API_KEY || ""
  },
  gemini: {
    mode: "gemini",
    model: process.env.GEMINI_MODEL || "gemini-2.5-flash",
    key: () => process.env.GEMINI_API_KEY || ""
  },
  mistral: {
    mode: "openai",
    model: process.env.MISTRAL_MODEL || "mistral-large-latest",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    key: () => process.env.MISTRAL_API_KEY || ""
  },
  custom: {
    mode: "openai",
    model: process.env.CUSTOM_MODEL || "",
    endpoint: process.env.CUSTOM_ENDPOINT || "",
    key: () => process.env.CUSTOM_API_KEY || ""
  }
};

const PROVIDER_LABELS = {
  openai: "OpenAI",
  openrouter: "OpenRouter",
  groq: "Groq",
  gemini: "Google Gemini",
  mistral: "Mistral",
  custom: "Custom AI"
};

function getProvider(body) {
  const id = String(body.providerId || "gemini").toLowerCase();
  const base = PROVIDERS[id] || PROVIDERS.gemini;

  if (id === "custom") {
    return {
      id,
      ...base,
      endpoint: body.endpoint || base.endpoint,
      model: body.model || base.model
    };
  }

  return { id, ...base };
}

function hasConfiguredAccess(provider) {
  return Boolean(provider?.key?.() && provider.model && (provider.mode === "gemini" || provider.endpoint));
}

function getConfiguredProviders(body = {}) {
  return Object.keys(PROVIDERS)
    .map(id => getProvider({ ...body, providerId: id }))
    .filter(hasConfiguredAccess);
}

function cleanAnswer(answer) {
  return String(answer || "")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s>])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .trim();
}

async function callOpenAiLike({ provider, apiKey, systemPrompt, userPrompt, history, maxTokens, temperature }) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (provider.id === "openrouter") {
    headers["HTTP-Referer"] = "https://agri-decision.vercel.app";
    headers["X-Title"] = "AgriDecision AI";
  }

  const historyMessages = Array.isArray(history)
    ? history.map(m => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "") }))
    : [];

  const response = await fetch(provider.endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: provider.model,
      max_tokens: maxTokens,
      temperature,
      messages: [
        { role: "system", content: `${systemPrompt}\n\nDo not use markdown asterisks. Return clean HTML when formatting is helpful.` },
        ...historyMessages,
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
    data?.raw ||
    "No response text was returned."
  );
}

async function callGemini({ provider, apiKey, systemPrompt, userPrompt, history, maxTokens, temperature }) {
  const model = String(provider.model || "gemini-2.5-flash").replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const historyContents = Array.isArray(history)
    ? history.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: String(m.content || "") }] }))
    : [];

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: `${systemPrompt}\n\nDo not use markdown asterisks. Return clean HTML when formatting is helpful.` }]
      },
      contents: [
        ...historyContents,
        { role: "user", parts: [{ text: userPrompt }] }
      ],
      generationConfig: { temperature, maxOutputTokens: maxTokens }
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

async function callProvider({ provider, systemPrompt, userPrompt, history, maxTokens, temperature }) {
  const apiKey = provider.key();
  if (!provider.model) throw new Error(`Missing model for ${provider.id}.`);
  if (!apiKey) throw new Error(`Missing ${provider.id.toUpperCase()} API key in Vercel environment variables.`);

  if (provider.mode === "gemini") {
    return callGemini({ provider, apiKey, systemPrompt, userPrompt, history, maxTokens, temperature });
  }

  if (!provider.endpoint) throw new Error(`Missing endpoint for ${provider.id}.`);
  return callOpenAiLike({ provider, apiKey, systemPrompt, userPrompt, history, maxTokens, temperature });
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
    const provider = getProvider(body);
    const userPrompt = String(body.userPrompt || "").trim();
    const systemPrompt = String(body.systemPrompt || "").trim();
    const history = Array.isArray(body.history) ? body.history : [];
    const maxTokens = Math.min(Number(body.maxTokens) || 1200, 6000);
    const temperature = Number(body.temperature) || 0.5;

    if (!userPrompt) return sendJson(res, 400, { error: "Missing userPrompt." });

    if (String(body.providerId || "").toLowerCase() === "all") {
      const configuredProviders = getConfiguredProviders(body);
      if (!configuredProviders.length) {
        return sendJson(res, 400, { error: "No AI provider API keys are configured in Vercel environment variables." });
      }

      const perProviderMaxTokens = Math.min(maxTokens, 3000);
      const results = await Promise.allSettled(configuredProviders.map(async configuredProvider => ({
        provider: configuredProvider,
        answer: await callProvider({
          provider: configuredProvider,
          systemPrompt,
          userPrompt,
          history,
          maxTokens: perProviderMaxTokens,
          temperature
        })
      })));

      const successful = results
        .filter(result => result.status === "fulfilled")
        .map(result => result.value);
      const failed = results
        .filter(result => result.status === "rejected")
        .map(result => result.reason?.message || String(result.reason));

      if (!successful.length) {
        return sendJson(res, 500, { error: failed.join(" | ") || "All configured AI providers failed." });
      }

      const answer = successful.map(result => {
        const label = PROVIDER_LABELS[result.provider.id] || result.provider.id;
        return `<section><h2>${label}</h2>${cleanAnswer(result.answer)}</section>`;
      }).join("\n");

      return sendJson(res, 200, {
        answer,
        providersUsed: successful.map(result => result.provider.id),
        providerErrors: failed
      });
    }

    const answer = await callProvider({ provider, systemPrompt, userPrompt, history, maxTokens, temperature });
    return sendJson(res, 200, { answer: cleanAnswer(answer) });
  } catch (error) {
    return sendJson(res, 500, {
      error: error && error.message ? error.message : "Unexpected server error."
    });
  }
};
