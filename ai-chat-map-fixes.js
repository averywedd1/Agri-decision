(function () {
  const FIELD_KEY = "agriFieldBoundary";
  const POLYGON_KEY = "agridecisionFieldPolygons";
  const $ = id => document.getElementById(id);

  function installStyles() {
    if ($("ai-chat-map-fixes-style")) return;
    const style = document.createElement("style");
    style.id = "ai-chat-map-fixes-style";
    style.textContent = `
      .privacy-note,#privacy-note{
        width:min(100%,1040px)!important;
        box-sizing:border-box!important;
        margin:0 auto 24px!important;
        text-align:left!important;
      }
    `;
    document.head.appendChild(style);
  }

  function cleanText(value) {
    return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;");
  }

  function addMessage(role, html) {
    const container = $("ai-combo-messages");
    if (!container) return null;
    const msg = document.createElement("div");
    msg.className = `chat-msg ${role === "user" ? "user" : "ai"}`;
    msg.innerHTML = role === "user" ? escapeHtml(html) : html;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
    return msg;
  }

  function chatHistory() {
    if (typeof comboChat !== "undefined" && Array.isArray(comboChat) && comboChat.length) {
      return comboChat.slice(-16).map(message => {
        const role = message.role === "assistant" ? "Assistant" : "User";
        return `${role}: ${cleanText(message.content)}`;
      }).join("\n");
    }
    return Array.from($("ai-combo-messages")?.querySelectorAll(".chat-msg") || [])
      .filter(message => !/Asking AgriDecision AI/i.test(message.textContent || ""))
      .slice(-16)
      .map(message => `${message.classList.contains("user") ? "User" : "Assistant"}: ${cleanText(message.textContent || message.innerHTML)}`)
      .join("\n");
  }

  function quickDateAnswer(question) {
    const q = String(question || "").toLowerCase();
    if (!/\b(year|date|day|time|today|now)\b/.test(q)) return "";
    const now = new Date();
    if (/\byear\b/.test(q)) return `<p>It is ${now.getFullYear()}.</p>`;
    if (/\btime\b|\bnow\b/.test(q)) return `<p>It is ${now.toLocaleString()}.</p>`;
    return `<p>Today is ${now.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}.</p>`;
  }

  async function sendAiChat() {
    const input = $("ai-combo-input");
    const button = $("ai-combo-send");
    const question = input?.value.trim() || "";
    if (!question || !button) return;

    addMessage("user", question);
    input.value = "";
    button.disabled = true;
    const loading = addMessage("ai", "<em>Asking AgriDecision AI...</em>");
    const localAnswer = quickDateAnswer(question);

    try {
      let safe = localAnswer;
      if (!safe) {
        const provider = typeof getProvider === "function" ? getProvider() : { id: "all", name: "AgriDecision AI" };
        const farmContext = typeof buildContext === "function" && typeof getFormData === "function"
          ? buildContext(getFormData())
          : "No farm workspace data entered yet.";
        const now = new Date();
        const prompt = `Answer as AgriDecision AI. Current local date/time from the user's browser is ${now.toLocaleString()} (${now.getFullYear()}).

If the user asks a simple general question, current date/time/year question, or asks about this conversation, answer directly.
Do not force every answer into farm recommendations.
Use farm workspace data only when it helps answer the question.
Use the previous messages below as chat memory.

Farm workspace:
${farmContext}

Previous AI-page chat:
${chatHistory() || "No previous messages in this chat yet."}

Latest question: ${question}`;
        const raw = await callAI({ ...provider, id: provider.id || "all", name: provider.name || "AgriDecision AI" }, prompt, 2200, 0.45);
        safe = typeof cleanAI === "function" ? cleanAI(raw) : raw;
      }
      if (loading) loading.innerHTML = safe;
      if (typeof comboChat !== "undefined" && Array.isArray(comboChat)) {
        comboChat.push({ role: "user", content: question }, { role: "assistant", content: cleanText(safe) });
      }
      if (typeof hasProfile === "function" && hasProfile() && typeof saveProject === "function") {
        saveProject({ silent: true, skipPrompt: true });
      }
    } catch (error) {
      if (loading) loading.innerHTML = `<span style="color:#f09595;">AgriDecision AI error: ${escapeHtml(error.message || error)}</span>`;
    } finally {
      button.disabled = false;
    }
  }

  function replaceChatControls() {
    const button = $("ai-combo-send");
    const input = $("ai-combo-input");
    if (!button || !input || button.dataset.aiChatMapFixed === "true") return;

    const nextButton = button.cloneNode(true);
    nextButton.dataset.aiChatMapFixed = "true";
    button.replaceWith(nextButton);

    const nextInput = input.cloneNode(true);
    nextInput.value = input.value;
    input.replaceWith(nextInput);

    nextButton.addEventListener("click", event => {
      event.preventDefault();
      sendAiChat();
    });
    nextInput.addEventListener("keydown", event => {
      if (event.key !== "Enter" || event.shiftKey) return;
      event.preventDefault();
      sendAiChat();
    });

    document.querySelectorAll("[data-ai-question]").forEach(button => {
      if (button.dataset.aiChatMapQuickFixed === "true") return;
      button.dataset.aiChatMapQuickFixed = "true";
      button.addEventListener("click", event => {
        event.preventDefault();
        event.stopImmediatePropagation();
        const target = $("ai-combo-input");
        if (target) target.value = button.dataset.aiQuestion || "";
        sendAiChat();
      }, true);
    });
  }

  function readSavedFields() {
    try {
      const fields = JSON.parse(localStorage.getItem(POLYGON_KEY) || "[]");
      return Array.isArray(fields) ? fields.filter(field => field.id !== "primary-field-boundary") : [];
    } catch {
      return [];
    }
  }

  function resetDraftField() {
    const savedFields = readSavedFields();
    localStorage.setItem(FIELD_KEY, "[]");
    if (savedFields.length) localStorage.setItem(POLYGON_KEY, JSON.stringify(savedFields));
    else localStorage.setItem(POLYGON_KEY, "[]");
    const name = $("field-area-name");
    if (name) name.value = "";
    window.dispatchEvent(new CustomEvent("agri-field-boundary-updated", { detail: { points: [], acres: 0, fields: savedFields } }));
    const clear = $("clear-field-points");
    if (clear && clear.dataset.aiChatMapClearing !== "true") {
      clear.dataset.aiChatMapClearing = "true";
      clear.click();
      delete clear.dataset.aiChatMapClearing;
      if (savedFields.length) localStorage.setItem(POLYGON_KEY, JSON.stringify(savedFields));
    }
  }

  function bindFieldReset() {
    const button = $("new-field-area");
    if (!button || button.dataset.aiChatMapResetFixed === "true") return;
    button.dataset.aiChatMapResetFixed = "true";
    button.addEventListener("click", () => setTimeout(resetDraftField, 0));
  }

  function run() {
    installStyles();
    replaceChatControls();
    bindFieldReset();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();
  setTimeout(run, 800);
  setTimeout(run, 2200);
  setInterval(run, 5000);
}());
