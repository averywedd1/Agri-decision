const FORM_FIELD_IDS = {
  farmName: "farm-name",
  farmType: "farm-type",
  state: "state",
  totalAcres: "total-acres",
  yearsOp: "years-op",
  commodities: "commodities",
  opDescription: "op-description",
  yield: "yield",
  price: "price",
  secondaryRev: "secondary-rev",
  otherIncome: "other-income",
  totalRevenue: "total-revenue",
  seed: "seed",
  fertilizer: "fertilizer",
  chemicals: "chemicals",
  labor: "labor",
  fuel: "fuel",
  equipment: "equipment",
  customHire: "custom-hire",
  water: "water",
  insurance: "insurance",
  maintenance: "maintenance",
  opLoan: "op-loan",
  termLoan: "term-loan",
  interestRate: "interest-rate",
  loanTerm: "loan-term",
  investments: "investments",
  goals: "goals"
};

const AI_PROVIDERS = {
  all: { id: "all", name: "All configured AIs" },
  openai: { id: "openai", name: "OpenAI" },
  openrouter: { id: "openrouter", name: "OpenRouter" },
  groq: { id: "groq", name: "Groq" },
  gemini: { id: "gemini", name: "Google Gemini" },
  mistral: { id: "mistral", name: "Mistral" },
  custom: { id: "custom", name: "Custom AI", endpoint: "", model: "" }
};

const SECTIONS = [
  ["exec", "Executive Summary"],
  ["financials", "Financial Analysis"],
  ["risk", "Risk & Scenarios"],
  ["investment", "Investment Analysis"],
  ["strategy", "Business Strategy"]
];

let allContent = {};
let chatHistory = [];

function $(id) {
  return document.getElementById(id);
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeAIHtml(rawHtml) {
  let html = String(rawHtml || "").trim()
    .replace(/^\s*```(?:html)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/^#{1,6}\s+(.+)$/gm, "<h3>$1</h3>");
  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  if (bodyMatch) html = bodyMatch[1].trim();
  return html;
}

function sanitizeAIHtml(html) {
  const template = document.createElement("template");
  template.innerHTML = normalizeAIHtml(html);
  const allowedTags = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "strong", "b", "em", "i", "u", "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "blockquote", "small", "div", "section", "span", "a"]);
  const dropTags = new Set(["script", "style", "head", "title", "meta", "link", "iframe", "object", "embed", "svg", "canvas"]);

  function clean(parent) {
    Array.from(parent.children).forEach(child => {
      const tag = child.tagName.toLowerCase();
      if (dropTags.has(tag)) {
        child.remove();
        return;
      }
      if (!allowedTags.has(tag)) {
        const replacement = document.createElement("span");
        replacement.textContent = child.textContent || "";
        child.replaceWith(replacement);
        return;
      }
      Array.from(child.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        const value = attr.value || "";
        const safeHref = name === "href" && /^https?:\/\//i.test(value);
        const safeSpan = (name === "colspan" || name === "rowspan") && /^\d{1,2}$/.test(value);
        if (name.startsWith("on") || /^\s*javascript:/i.test(value) || (!safeHref && !safeSpan)) child.removeAttribute(attr.name);
      });
      clean(child);
    });
  }

  clean(template.content);
  return template.innerHTML;
}

function getFormData() {
  const data = {};
  Object.entries(FORM_FIELD_IDS).forEach(([key, id]) => {
    data[key] = $(id)?.value || "";
  });
  data.farmName = data.farmName || "Your Farm";
  return data;
}

function setFormData(data = {}) {
  Object.entries(FORM_FIELD_IDS).forEach(([key, id]) => {
    const el = $(id);
    if (el) el.value = data[key] || "";
  });
}

function clearFormData(projectName = "") {
  setFormData({});
  if ($("farm-name")) $("farm-name").value = projectName;
}

function buildDataContext(data) {
  const costKeys = ["seed", "fertilizer", "chemicals", "labor", "fuel", "equipment", "customHire", "water", "insurance", "maintenance"];
  const costPerAcre = costKeys.reduce((sum, key) => sum + (Number.parseFloat(data[key]) || 0), 0);
  const totalCosts = costPerAcre && data.totalAcres ? costPerAcre * Number(data.totalAcres) : 0;
  const netProfit = data.totalRevenue ? Number(data.totalRevenue) - totalCosts : 0;
  return `
Farm: ${data.farmName}
Type: ${data.farmType}
Region: ${data.state}
Size: ${data.totalAcres}
Commodities: ${data.commodities}
Description: ${data.opDescription}
Yield: ${data.yield}
Price: ${data.price}
Total revenue: ${data.totalRevenue}
Estimated cost per acre: ${costPerAcre.toFixed(2)}
Estimated total operating cost: ${totalCosts.toFixed(0)}
Estimated net profit: ${netProfit.toFixed(0)}
Debt: operating ${data.opLoan}, term ${data.termLoan}, interest ${data.interestRate}%, term ${data.loanTerm}
Investments: ${data.investments || "None specified"}
Goals: ${data.goals || "None specified"}
`.trim();
}

function buildSystemPrompt() {
  return `You are AgriDecision AI, a practical agricultural business advisor. Use clean HTML only. Do not use markdown asterisks. Give direct, lender-grade recommendations, tables when helpful, clear assumptions, and specific next steps.`;
}

function sectionPrompt(sectionLabel, ctx) {
  const prompts = {
    "Executive Summary": "Write an executive farm business summary with strengths, risks, financial highlights, and a 30/90/365 day action plan.",
    "Financial Analysis": "Analyze revenue, costs, gross margin, break-even, DSCR, debt pressure, and cash-flow risk. Include tables and formulas.",
    "Risk & Scenarios": "Stress test price, yield, input costs, interest rate, and debt. Include best/base/stress/worst scenarios and hedging ideas.",
    "Investment Analysis": "Analyze likely capital investments, payback, NPV-style reasoning, ROI assumptions, and buy/hold/pass recommendations.",
    "Business Strategy": "Create a business strategy with SWOT, growth options, management priorities, and a 12 month implementation roadmap."
  };
  return `${prompts[sectionLabel]}\n\nFarm data:\n${ctx}`;
}

function getProviderConfig() {
  const providerId = $("ai-provider").value;
  const provider = { ...(AI_PROVIDERS[providerId] || AI_PROVIDERS.gemini) };
  if (providerId === "custom") {
    provider.endpoint = $("custom-endpoint").value.trim();
    provider.model = $("custom-model").value.trim();
  }
  return provider;
}

function updateProviderFields() {
  const providerId = $("ai-provider").value;
  $("custom-provider-fields").classList.toggle("visible", providerId === "custom");
  $("provider-help").textContent = providerId === "all"
    ? "Uses every AI provider with an API key configured in Vercel. This can be slower and may cost more per report."
    : providerId === "custom"
      ? "Custom mode uses CUSTOM_API_KEY from Vercel plus this OpenAI-compatible endpoint and model."
      : "API keys are read from Vercel environment variables. No key is typed into or stored in the browser.";
}

async function loadProviderOptions() {
  try {
    const response = await fetch("/api/providers");
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Could not load provider settings.");
    const select = $("ai-provider");
    const current = select.value;
    select.innerHTML = "";
    if (data.canUseAll) select.append(new Option("All configured AIs", "all"));
    (data.providers || []).forEach(provider => {
      const option = new Option(`${provider.name}${provider.configured ? " - configured" : " - not configured"}`, provider.id);
      option.disabled = !provider.configured && provider.id !== "custom";
      select.append(option);
    });
    const configured = (data.providers || []).filter(provider => provider.configured);
    select.value = data.canUseAll && current === "all" ? "all" : (configured.find(provider => provider.id === current)?.id || configured.find(provider => provider.id === "gemini")?.id || configured[0]?.id || "custom");
  } catch {
    // Static previews still show the built-in provider list.
  }
  updateProviderFields();
}

async function callAI(provider, systemPrompt, userPrompt, maxTokens = 1600, temperature = 0.5) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      providerId: provider.id,
      endpoint: provider.endpoint,
      model: provider.model,
      systemPrompt,
      userPrompt,
      maxTokens,
      temperature
    })
  });
  const raw = await response.text();
  let data = {};
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { answer: raw }; }
  if (!response.ok) throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
  return data.answer || "<p>No content returned.</p>";
}

function renderAnalysisShell() {
  $("analysis-tabs").innerHTML = "";
  $("analysis-panels").innerHTML = "";
  SECTIONS.forEach(([id, label], index) => {
    const tab = document.createElement("button");
    tab.className = `tab-btn ${index === 0 ? "active" : ""}`;
    tab.type = "button";
    tab.textContent = label;
    tab.addEventListener("click", () => switchTab(id));
    $("analysis-tabs").append(tab);

    const panel = document.createElement("div");
    panel.id = `panel-${id}`;
    panel.className = `tab-panel ${index === 0 ? "active" : ""}`;
    panel.innerHTML = `<div class="analysis-content" id="content-${id}"><p>Waiting to generate ${label.toLowerCase()}...</p></div>`;
    $("analysis-panels").append(panel);
  });
}

function switchTab(id) {
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.id === `panel-${id}`));
  document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.toggle("active", btn.textContent === SECTIONS.find(([sid]) => sid === id)?.[1]));
}

async function runAnalysis() {
  const provider = getProviderConfig();
  if (provider.id === "custom" && (!provider.endpoint || !provider.model)) {
    alert("Please enter both a custom endpoint and custom model name.");
    return;
  }
  const data = getFormData();
  if (!data.totalAcres || !data.totalRevenue) {
    alert("Please enter at least farm size and total annual revenue.");
    return;
  }
  $("analyze-btn").disabled = true;
  $("analysis-section").classList.add("visible");
  $("report-farm-name").textContent = `${data.farmName} - Full Business Analysis`;
  renderAnalysisShell();
  $("analysis-section").scrollIntoView({ behavior: "smooth" });

  const ctx = buildDataContext(data);
  const systemPrompt = buildSystemPrompt();
  allContent = {};
  for (const [id, label] of SECTIONS) {
    const el = $(`content-${id}`);
    el.innerHTML = `<p>Generating ${label.toLowerCase()} with ${escapeHtml(provider.name)}...</p>`;
    try {
      const html = await callAI(provider, systemPrompt, sectionPrompt(label, ctx), 2800, 0.55);
      allContent[id] = sanitizeAIHtml(html);
      el.innerHTML = allContent[id];
    } catch (error) {
      el.innerHTML = `<p style="color:#f09595;">Error generating ${escapeHtml(label)}: ${escapeHtml(error.message)}</p>`;
    }
  }
  $("analyze-btn").disabled = false;
  $("analyze-btn").textContent = "Regenerate Analysis";
  saveCurrentProject({ silent: true });
}

function openAccountModal() {
  const profile = getAccountProfile();
  $("account-name").value = profile.name || "";
  $("account-email").value = profile.email || "";
  $("account-farm").value = profile.farmName || $("farm-name").value || "";
  $("account-modal").classList.add("visible");
}

function closeAccountModal() {
  $("account-modal").classList.remove("visible");
}

function getAccountProfile() {
  try { return JSON.parse(localStorage.getItem("agridecisionProfile") || "{}") || {}; } catch { return {}; }
}

function saveAccountProfile() {
  const existing = getAccountProfile();
  const profile = {
    name: $("account-name").value.trim(),
    email: $("account-email").value.trim(),
    farmName: $("account-farm").value.trim(),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!profile.name || !profile.email) {
    alert("Please enter your name and email.");
    return;
  }
  localStorage.setItem("agridecisionProfile", JSON.stringify(profile));
  applyAccountProfile();
  ensureStarterProject(profile.farmName);
  renderProjectList();
  closeAccountModal();
}

function applyAccountProfile() {
  const profile = getAccountProfile();
  $("account-nav-btn").textContent = profile.name ? `Hi, ${profile.name.split(" ")[0]}` : "Create Account";
  if (profile.farmName && !$("farm-name").value) $("farm-name").value = profile.farmName;
}

function hasAccountProfile() {
  const profile = getAccountProfile();
  return Boolean(profile.name && profile.email);
}

function requireAccountProfile() {
  if (hasAccountProfile()) return true;
  openAccountModal();
  setProjectStatus("Create an account profile first, then your projects can save under it.");
  return false;
}

function getProjectStorageKey() {
  const email = (getAccountProfile().email || "guest").trim().toLowerCase();
  return `agridecisionProjects:${email}`;
}

function getProjectStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(getProjectStorageKey()) || "{}") || {};
    return { activeProjectId: parsed.activeProjectId || "", projects: Array.isArray(parsed.projects) ? parsed.projects : [] };
  } catch {
    return { activeProjectId: "", projects: [] };
  }
}

function saveProjectStore(store) {
  localStorage.setItem(getProjectStorageKey(), JSON.stringify({ activeProjectId: store.activeProjectId || "", projects: store.projects || [] }));
}

function setProjectStatus(message) {
  $("project-status").textContent = message;
}

function makeProjectId() {
  return `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getProjectNameFromForm(fallback = "Untitled Project") {
  const data = getFormData();
  return (data.farmName && data.farmName !== "Your Farm") || data.commodities || fallback;
}

function getActiveProject(store = getProjectStore()) {
  return store.projects.find(project => project.id === store.activeProjectId) || null;
}

function buildProjectSnapshot(existing = {}) {
  const now = new Date().toISOString();
  return {
    ...existing,
    id: existing.id || makeProjectId(),
    name: getProjectNameFromForm(existing.name || "Untitled Project"),
    farmData: getFormData(),
    reportContent: { ...allContent },
    chatHistory: [...chatHistory],
    createdAt: existing.createdAt || now,
    updatedAt: now
  };
}

function renderProjectList() {
  const store = getProjectStore();
  $("project-select").innerHTML = "";
  if (!store.projects.length) {
    $("project-select").append(new Option("No saved projects yet", ""));
    setProjectStatus(hasAccountProfile() ? "Create your first project or fill out the form and click Save Project." : "Create an account profile, then save separate farms, scenarios, or lender packages as projects.");
    return;
  }
  store.projects.slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))).forEach(project => {
    $("project-select").append(new Option(project.name || "Untitled Project", project.id));
  });
  $("project-select").value = store.activeProjectId || store.projects[0].id;
  const active = getActiveProject(store);
  setProjectStatus(active ? `Loaded ${active.name} - last saved ${new Date(active.updatedAt || active.createdAt).toLocaleString()}` : `${store.projects.length} projects saved.`);
}

function ensureStarterProject(projectName) {
  if (!hasAccountProfile() || !projectName) return;
  const store = getProjectStore();
  if (store.projects.length) return;
  clearFormData(projectName);
  const project = buildProjectSnapshot({ name: projectName });
  store.projects.unshift(project);
  store.activeProjectId = project.id;
  saveProjectStore(store);
}

function createNewProject() {
  if (!requireAccountProfile()) return;
  const name = prompt("Name this project", getProjectNameFromForm("New Farm Project"));
  if (!name) return;
  const now = new Date().toISOString();
  const store = getProjectStore();
  const project = { id: makeProjectId(), name: name.trim(), farmData: { farmName: name.trim() }, reportContent: {}, chatHistory: [], createdAt: now, updatedAt: now };
  store.projects.unshift(project);
  store.activeProjectId = project.id;
  saveProjectStore(store);
  clearFormData(project.name);
  allContent = {};
  chatHistory = [];
  $("analysis-section").classList.remove("visible");
  renderProjectList();
}

function saveCurrentProject(options = {}) {
  if (!requireAccountProfile()) return false;
  const store = getProjectStore();
  let active = getActiveProject(store);
  if (!active) {
    active = { id: makeProjectId(), name: getProjectNameFromForm("New Farm Project") };
    store.projects.unshift(active);
    store.activeProjectId = active.id;
  }
  const saved = buildProjectSnapshot(active);
  store.projects = store.projects.map(project => project.id === saved.id ? saved : project);
  if (!store.projects.some(project => project.id === saved.id)) store.projects.unshift(saved);
  store.activeProjectId = saved.id;
  saveProjectStore(store);
  renderProjectList();
  if (!options.silent) setProjectStatus(`${saved.name} saved under your account.`);
  return true;
}

function selectProject(projectId) {
  const store = getProjectStore();
  const project = store.projects.find(item => item.id === projectId);
  if (!project) return;
  store.activeProjectId = project.id;
  saveProjectStore(store);
  setFormData(project.farmData || {});
  allContent = { ...(project.reportContent || {}) };
  chatHistory = Array.isArray(project.chatHistory) ? [...project.chatHistory] : [];
  if (Object.keys(allContent).length) {
    $("analysis-section").classList.add("visible");
    renderAnalysisShell();
    SECTIONS.forEach(([id]) => { if (allContent[id]) $(`content-${id}`).innerHTML = allContent[id]; });
    $("report-farm-name").textContent = `${project.farmData?.farmName || project.name} - Full Business Analysis`;
  } else {
    $("analysis-section").classList.remove("visible");
  }
  renderProjectList();
}

function deleteCurrentProject() {
  const store = getProjectStore();
  const active = getActiveProject(store);
  if (!active) return setProjectStatus("No saved project is selected.");
  if (!confirm(`Delete ${active.name}? This only removes the local saved project from this browser.`)) return;
  store.projects = store.projects.filter(project => project.id !== active.id);
  store.activeProjectId = store.projects[0]?.id || "";
  saveProjectStore(store);
  if (store.activeProjectId) selectProject(store.activeProjectId);
  else {
    clearFormData();
    allContent = {};
    chatHistory = [];
    $("analysis-section").classList.remove("visible");
    renderProjectList();
  }
}

async function loadFutures() {
  try {
    const response = await fetch("/api/commodities");
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Unable to load futures data.");
    const rows = (data.quotes || []).slice(0, 12);
    $("futures-body").innerHTML = rows.length ? rows.map(row => `
      <tr><td>${escapeHtml(row.commodity)}</td><td>${escapeHtml(row.contract || "-")}</td><td>${escapeHtml(row.last || row.settle || row.priorSettle || "-")}</td><td>${escapeHtml(row.change || "-")}</td><td>${escapeHtml(row.volume || "-")}</td><td><a href="${escapeHtml(row.sourceUrl)}" target="_blank" rel="noopener">CME</a></td></tr>
    `).join("") : '<tr><td colspan="6">No futures quotes returned right now.</td></tr>';
    $("futures-note").textContent = data.note || $("futures-note").textContent;
  } catch (error) {
    $("futures-body").innerHTML = '<tr><td colspan="6">Could not load CME futures right now.</td></tr>';
    $("futures-note").textContent = error.message;
  }
}

function appendChatMessage(role, text) {
  const msg = document.createElement("div");
  msg.className = `chat-msg ${role === "user" ? "user" : "ai"}`;
  msg.innerHTML = role === "user" ? escapeHtml(text) : sanitizeAIHtml(text);
  $("chatbot-messages").append(msg);
  $("chatbot-messages").scrollTop = $("chatbot-messages").scrollHeight;
}

function getReportTextForChat() {
  return SECTIONS.map(([id, label]) => `[${label}]\n${$(`content-${id}`)?.innerText || ""}`).join("\n\n").slice(0, 18000);
}

async function sendChatMessage() {
  const question = $("chatbot-input").value.trim();
  if (!question) return;
  const provider = getProviderConfig();
  appendChatMessage("user", question);
  $("chatbot-input").value = "";
  $("chatbot-send").disabled = true;
  appendChatMessage("ai", "<em>Thinking...</em>");
  const loadingMsg = $("chatbot-messages").lastElementChild;
  const userPrompt = `Farm data:\n${buildDataContext(getFormData())}\n\nReport context:\n${getReportTextForChat()}\n\nChat history:\n${chatHistory.map(m => `${m.role}: ${m.content}`).join("\n")}\n\nQuestion: ${question}`;
  try {
    const answer = await callAI(provider, buildSystemPrompt(), userPrompt, 1600, 0.45);
    const safeAnswer = sanitizeAIHtml(answer);
    loadingMsg.innerHTML = safeAnswer;
    chatHistory.push({ role: "user", content: question }, { role: "assistant", content: safeAnswer.replace(/<[^>]*>/g, " ") });
    saveCurrentProject({ silent: true });
  } catch (error) {
    loadingMsg.innerHTML = `<span style="color:#f09595;">Chat error: ${escapeHtml(error.message)}</span>`;
  } finally {
    $("chatbot-send").disabled = false;
  }
}

function downloadReport() {
  const title = $("report-farm-name").textContent || "Farm Analysis";
  const body = SECTIONS.map(([id, label]) => `<section><h2>${label}</h2>${allContent[id] || "<p>Not generated.</p>"}</section>`).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title><style>body{font-family:Georgia,serif;max-width:860px;margin:40px auto;line-height:1.7;padding:0 36px;color:#1a1a18}h1{border-bottom:3px solid #3a8035;padding-bottom:12px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #dde8db;text-align:left}</style></head><body><h1>${escapeHtml(title)}</h1>${body}</body></html>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  a.download = `${title.replace(/[^a-z0-9]/gi, "_")}.html`;
  a.click();
}

function bindEvents() {
  $("account-nav-btn").addEventListener("click", openAccountModal);
  $("cancel-account").addEventListener("click", closeAccountModal);
  $("save-account").addEventListener("click", saveAccountProfile);
  $("account-modal").addEventListener("click", event => { if (event.target.id === "account-modal") closeAccountModal(); });
  $("ai-provider").addEventListener("change", updateProviderFields);
  $("new-project").addEventListener("click", createNewProject);
  $("save-project").addEventListener("click", () => saveCurrentProject());
  $("delete-project").addEventListener("click", deleteCurrentProject);
  $("project-select").addEventListener("change", event => selectProject(event.target.value));
  $("analyze-btn").addEventListener("click", runAnalysis);
  $("download-report").addEventListener("click", downloadReport);
  $("chatbot-send").addEventListener("click", sendChatMessage);
  $("chatbot-input").addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendChatMessage();
    }
  });
  document.querySelectorAll("[data-question]").forEach(button => {
    button.addEventListener("click", () => {
      $("chatbot-input").value = button.dataset.question || "";
      sendChatMessage();
    });
  });
}

document.addEventListener("DOMContentLoaded", () => {
  renderAnalysisShell();
  bindEvents();
  loadProviderOptions();
  applyAccountProfile();
  renderProjectList();
  const activeProjectId = getProjectStore().activeProjectId;
  if (activeProjectId) selectProject(activeProjectId);
  loadFutures();
});
