function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.end(JSON.stringify(payload));
}

const PROVIDERS = [
  {
    id: "openai",
    name: "OpenAI",
    configured: () => Boolean(process.env.OPENAI_API_KEY),
    model: () => process.env.OPENAI_MODEL || "gpt-4o-mini"
  },
  {
    id: "openrouter",
    name: "OpenRouter",
    configured: () => Boolean(process.env.OPENROUTER_API_KEY),
    model: () => process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini"
  },
  {
    id: "groq",
    name: "Groq",
    configured: () => Boolean(process.env.GROQ_API_KEY),
    model: () => process.env.GROQ_MODEL || "llama-3.3-70b-versatile"
  },
  {
    id: "gemini",
    name: "Google Gemini",
    configured: () => Boolean(process.env.GEMINI_API_KEY),
    model: () => process.env.GEMINI_MODEL || "gemini-2.5-flash"
  },
  {
    id: "mistral",
    name: "Mistral",
    configured: () => Boolean(process.env.MISTRAL_API_KEY),
    model: () => process.env.MISTRAL_MODEL || "mistral-large-latest"
  },
  {
    id: "custom",
    name: "Custom AI",
    configured: () => Boolean(process.env.CUSTOM_API_KEY && process.env.CUSTOM_ENDPOINT && process.env.CUSTOM_MODEL),
    model: () => process.env.CUSTOM_MODEL || ""
  }
];

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Use GET for /api/providers." });
  }

  const providers = PROVIDERS.map(provider => ({
    id: provider.id,
    name: provider.name,
    configured: provider.configured(),
    model: provider.model()
  }));

  const configured = providers.filter(provider => provider.configured);
  return sendJson(res, 200, {
    providers,
    configured,
    canUseAll: configured.length > 1
  });
};
