const FIELDS = {
  farmName: "farm-name", farmType: "farm-type", state: "state", totalAcres: "total-acres", yearsOp: "years-op",
  commodities: "commodities", opDescription: "op-description", yield: "yield", price: "price",
  secondaryRev: "secondary-rev", otherIncome: "other-income", totalRevenue: "total-revenue", seed: "seed",
  fertilizer: "fertilizer", chemicals: "chemicals", labor: "labor", fuel: "fuel", equipment: "equipment",
  customHire: "custom-hire", water: "water", insurance: "insurance", maintenance: "maintenance",
  opLoan: "op-loan", termLoan: "term-loan", interestRate: "interest-rate", loanTerm: "loan-term",
  investments: "investments", goals: "goals"
};

const PROVIDER_NAMES = {
  all: "AgriDecision AI",
  openai: "OpenAI",
  openrouter: "OpenRouter",
  groq: "Groq",
  gemini: "Google Gemini",
  mistral: "Mistral",
  custom: "Custom AI"
};

const SECTIONS = [
  ["exec", "Executive Summary"],
  ["financials", "Financial Analysis"],
  ["risk", "Risk & Scenarios"],
  ["investment", "Investment Analysis"],
  ["strategy", "Business Strategy"]
];

let reportContent = {};
let reportChat = [];
let comboChat = [];
let autoSaveTimer = null;

const $ = id => document.getElementById(id);

function esc(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeAI(raw) {
  let html = String(raw || "").trim()
    .replace(/^\s*```(?:html)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/^#{1,6}\s+(.+)$/gm, "<h3>$1</h3>");
  const match = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1].trim() : html;
}

function cleanAI(html) {
  const template = document.createElement("template");
  template.innerHTML = normalizeAI(html);
  const allowed = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "br", "hr", "strong", "b", "em", "i", "u", "ul", "ol", "li", "table", "thead", "tbody", "tfoot", "tr", "th", "td", "caption", "blockquote", "small", "div", "section", "span", "a"]);
  const blocked = new Set(["script", "style", "head", "title", "meta", "link", "iframe", "object", "embed", "svg", "canvas"]);
  function scrub(parent) {
    Array.from(parent.children).forEach(child => {
      const tag = child.tagName.toLowerCase();
      if (blocked.has(tag)) return child.remove();
      if (!allowed.has(tag)) {
        const span = document.createElement("span");
        span.textContent = child.textContent || "";
        child.replaceWith(span);
        return;
      }
      Array.from(child.attributes).forEach(attr => {
        const name = attr.name.toLowerCase();
        const value = attr.value || "";
        const safeHref = name === "href" && /^https?:\/\//i.test(value);
        const safeSpan = (name === "colspan" || name === "rowspan") && /^\d{1,2}$/.test(value);
        if (name.startsWith("on") || /^\s*javascript:/i.test(value) || (!safeHref && !safeSpan)) child.removeAttribute(attr.name);
      });
      scrub(child);
    });
  }
  scrub(template.content);
  return template.innerHTML;
}

function getFormData() {
  const data = {};
  Object.entries(FIELDS).forEach(([key, id]) => data[key] = $(id)?.value || "");
  data.farmName = data.farmName || "Your Farm";
  return data;
}

function setFormData(data = {}) {
  Object.entries(FIELDS).forEach(([key, id]) => {
    const el = $(id);
    if (el) el.value = data[key] || "";
  });
}

function clearForm(projectName = "") {
  setFormData({});
  $("farm-name").value = projectName;
}

function profile() {
  try { return JSON.parse(localStorage.getItem("agridecisionProfile") || "{}") || {}; }
  catch { return {}; }
}

function hasProfile() {
  const p = profile();
  return Boolean(p.name && p.email);
}

function projectKey() {
  return `agridecisionProjects:${(profile().email || "guest").trim().toLowerCase()}`;
}

function getStore() {
  try {
    const parsed = JSON.parse(localStorage.getItem(projectKey()) || "{}") || {};
    return { activeProjectId: parsed.activeProjectId || "", projects: Array.isArray(parsed.projects) ? parsed.projects : [] };
  } catch {
    return { activeProjectId: "", projects: [] };
  }
}

function saveStore(store) {
  localStorage.setItem(projectKey(), JSON.stringify({ activeProjectId: store.activeProjectId || "", projects: store.projects || [] }));
}

function activeProject(store = getStore()) {
  return store.projects.find(project => project.id === store.activeProjectId) || null;
}

function projectName(fallback = "Untitled Project") {
  const data = getFormData();
  return (data.farmName && data.farmName !== "Your Farm") || data.commodities || fallback;
}

function id() {
  return `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function saveProfileDraft() {
  const p = profile();
  if (!p.name || !p.email) return;
  localStorage.setItem("agridecisionProfile", JSON.stringify({
    ...p,
    farmName: p.farmName || $("farm-name").value.trim(),
    lastFarmData: getFormData(),
    updatedAt: new Date().toISOString()
  }));
}

function projectSnapshot(existing = {}) {
  const now = new Date().toISOString();
  return {
    ...existing,
    id: existing.id || id(),
    name: projectName(existing.name || "Untitled Project"),
    farmData: getFormData(),
    reportContent: { ...reportContent },
    reportChat: [...reportChat],
    comboChat: [...comboChat],
    createdAt: existing.createdAt || now,
    updatedAt: now
  };
}

function setStatus(message) {
  $("project-status").textContent = message;
}

function renderProjects() {
  const store = getStore();
  const select = $("project-select");
  select.innerHTML = "";
  if (!store.projects.length) {
    select.append(new Option("No saved projects yet", ""));
    setStatus(hasProfile() ? "Create your first project or fill out the form. It will autosave under your account." : "Create an account profile, then your projects can save under it.");
    return;
  }
  store.projects.slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""))).forEach(project => {
    select.append(new Option(project.name || "Untitled Project", project.id));
  });
  select.value = store.activeProjectId || store.projects[0].id;
  const active = activeProject(store);
  setStatus(active ? `Loaded ${active.name} - last saved ${new Date(active.updatedAt || active.createdAt).toLocaleString()}` : `${store.projects.length} projects saved.`);
}

function requireProfile() {
  if (hasProfile()) return true;
  openAccount();
  setStatus("Create an account profile first, then your projects can save under it.");
  return false;
}

function ensureFirstProject(name) {
  if (!hasProfile() || !name) return;
  const store = getStore();
  if (store.projects.length) return;
  if (!$("farm-name").value) $("farm-name").value = name;
  const project = projectSnapshot({ name });
  store.projects.unshift(project);
  store.activeProjectId = project.id;
  saveStore(store);
}

function saveProject(options = {}) {
  if (!hasProfile()) {
    if (!options.skipPrompt) requireProfile();
    return false;
  }
  const store = getStore();
  let active = activeProject(store);
  if (!active) {
    active = { id: id(), name: projectName("New Farm Project") };
    store.projects.unshift(active);
    store.activeProjectId = active.id;
  }
  const saved = projectSnapshot(active);
  store.projects = store.projects.map(project => project.id === saved.id ? saved : project);
  if (!store.projects.some(project => project.id === saved.id)) store.projects.unshift(saved);
  store.activeProjectId = saved.id;
  saveStore(store);
  saveProfileDraft();
  renderProjects();
  updateAIContext();
  if (!options.silent) setStatus(`${saved.name} saved under your account.`);
  return true;
}

function scheduleSave() {
  updateAIContext();
  if (!hasProfile()) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => saveProject({ silent: true, skipPrompt: true }), 700);
}

function loadProject(projectId) {
  const store = getStore();
  const project = store.projects.find(item => item.id === projectId);
  if (!project) return;
  store.activeProjectId = project.id;
  saveStore(store);
  setFormData(project.farmData || {});
  reportContent = { ...(project.reportContent || {}) };
  reportChat = Array.isArray(project.reportChat) ? [...project.reportChat] : Array.isArray(project.chatHistory) ? [...project.chatHistory] : [];
  comboChat = Array.isArray(project.comboChat) ? [...project.comboChat] : Array.isArray(project.comboChatHistory) ? [...project.comboChatHistory] : [];
  if (Object.keys(reportContent).length) {
    $("analysis-section").classList.add("visible");
    renderAnalysisShell();
    SECTIONS.forEach(([sectionId]) => {
      if (reportContent[sectionId]) $(`content-${sectionId}`).innerHTML = reportContent[sectionId];
    });
    $("report-farm-name").textContent = `${project.farmData?.farmName || project.name} - Full Business Analysis`;
  } else {
    $("analysis-section").classList.remove("visible");
  }
  restoreComboChat();
  updateAIContext();
  renderProjects();
}

function createProject() {
  const name = prompt("Name this project", projectName("New Farm Project"));
  if (!name) return;
  const now = new Date().toISOString();
  const project = { id: id(), name: name.trim(), farmData: { farmName: name.trim() }, reportContent: {}, reportChat: [], comboChat: [], createdAt: now, updatedAt: now };
  const store = getStore();
  store.projects.unshift(project);
  store.activeProjectId = project.id;
  saveStore(store);
  clearForm(project.name);
  reportContent = {};
  reportChat = [];
  comboChat = [];
  $("analysis-section").classList.remove("visible");
  clearComboChat();
  renderProjects();
  updateAIContext();
  setStatus(`Project "${project.name}" created. ${hasProfile() ? "Autosaving under your account." : "Saved locally — create an account to sync across devices."}`);
}

function deleteProject() {
  const store = getStore();
  const active = activeProject(store);
  if (!active) return setStatus("No saved project is selected.");
  if (!confirm(`Delete ${active.name}? This only removes the saved project from this browser.`)) return;
  store.projects = store.projects.filter(project => project.id !== active.id);
  store.activeProjectId = store.projects[0]?.id || "";
  saveStore(store);
  if (store.activeProjectId) loadProject(store.activeProjectId);
  else {
    clearForm();
    reportContent = {};
    reportChat = [];
    comboChat = [];
    $("analysis-section").classList.remove("visible");
    clearComboChat();
    renderProjects();
    updateAIContext();
  }
}

function openAccount() {
  const p = profile();
  $("account-name").value = p.name || "";
  $("account-email").value = p.email || "";
  $("account-farm").value = p.farmName || $("farm-name").value || "";
  $("account-modal").classList.add("visible");
}

function closeAccount() {
  $("account-modal").classList.remove("visible");
}

function saveAccount() {
  const existing = profile();
  const p = {
    name: $("account-name").value.trim(),
    email: $("account-email").value.trim(),
    farmName: $("account-farm").value.trim(),
    lastFarmData: getFormData(),
    createdAt: existing.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (!p.name || !p.email) return alert("Please enter your name and email.");
  localStorage.setItem("agridecisionProfile", JSON.stringify(p));
  applyProfile();
  ensureFirstProject(p.farmName);
  saveProject({ silent: true, skipPrompt: true });
  renderProjects();
  updateAIContext();
  closeAccount();
}

function applyProfile() {
  const p = profile();
  $("account-nav-btn").textContent = p.name ? `Hi, ${p.name.split(" ")[0]}` : "Create Account";
  if (p.lastFarmData && !getStore().activeProjectId) setFormData(p.lastFarmData);
  if (p.farmName && !$("farm-name").value) $("farm-name").value = p.farmName;
}

function buildContext(data) {
  const costs = ["seed", "fertilizer", "chemicals", "labor", "fuel", "equipment", "customHire", "water", "insurance", "maintenance"];
  const costPerAcre = costs.reduce((sum, key) => sum + (parseFloat(data[key]) || 0), 0);
  const totalCosts = data.totalAcres ? costPerAcre * Number(data.totalAcres) : 0;
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

function systemPrompt() {
  return "You are AgriDecision AI, a helpful assistant with deep expertise in agricultural business, farm finance, and agronomy. Use clean HTML only. Do not use markdown asterisks. Answer any question the user asks — general questions like dates, facts, definitions, or calculations should be answered directly and helpfully. For farm-related questions, give direct, lender-grade recommendations, tables when helpful, clear assumptions, and specific next steps. Today's date is " + new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) + ".";
}

function sectionPrompt(label, context) {
  const prompts = {
    "Executive Summary": "Write an executive farm business summary with strengths, risks, financial highlights, and a 30/90/365 day action plan.",
    "Financial Analysis": "Analyze revenue, costs, gross margin, break-even, DSCR, debt pressure, and cash-flow risk. Include tables and formulas.",
    "Risk & Scenarios": "Stress test price, yield, input costs, interest rate, and debt. Include best/base/stress/worst scenarios and hedging ideas.",
    "Investment Analysis": "Analyze likely capital investments, payback, NPV-style reasoning, ROI assumptions, and buy/hold/pass recommendations.",
    "Business Strategy": "Create a business strategy with SWOT, growth options, management priorities, and a 12 month implementation roadmap."
  };
  return `${prompts[label]}\n\nFarm data:\n${context}`;
}

function getProvider() {
  const providerId = $("ai-provider").value;
  if (!providerId) return { id: "", name: "No configured AI providers" };
  const provider = { id: providerId, name: PROVIDER_NAMES[providerId] || providerId };
  if (providerId === "custom") {
    provider.endpoint = $("custom-endpoint").value.trim();
    provider.model = $("custom-model").value.trim();
  }
  return provider;
}

function updateProviderHelp() {
  const providerId = $("ai-provider").value;
  $("custom-provider-fields").classList.toggle("visible", providerId === "custom");
  $("provider-help").textContent = !providerId
    ? "No configured AI API keys were found in Vercel environment variables."
    : providerId === "all"
      ? "Uses every AI provider with an API key configured in Vercel. This can be slower and may cost more per report."
      : providerId === "custom"
        ? "Custom mode uses CUSTOM_API_KEY from Vercel plus this OpenAI-compatible endpoint and model."
        : "API keys are read from Vercel environment variables. No key is typed into or stored in the browser.";
}

async function loadProviders() {
  try {
    const response = await fetch("/api/providers");
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Could not load providers.");
    const configured = (data.providers || []).filter(provider => provider.configured);
    const select = $("ai-provider");
    const current = select.value;
    select.innerHTML = "";
    if (configured.length > 1) select.append(new Option("AgriDecision AI - all configured", "all"));
    configured.forEach(provider => select.append(new Option(provider.name, provider.id)));
    if (!select.options.length) {
      const option = new Option("No configured AI providers", "");
      option.disabled = true;
      select.append(option);
    }
    select.value = configured.find(provider => provider.id === current)?.id || (configured.length > 1 ? "all" : configured[0]?.id || "");
  } catch {
    $("ai-provider").innerHTML = '<option value="">No configured AI providers</option>';
  }
  updateProviderHelp();
}

async function callAI(provider, userPrompt, maxTokens = 1600, temperature = 0.5, history = []) {
  const response = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      providerId: provider.id,
      endpoint: provider.endpoint,
      model: provider.model,
      systemPrompt: systemPrompt(),
      userPrompt,
      history,
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
  SECTIONS.forEach(([sectionId, label], index) => {
    const tab = document.createElement("button");
    tab.className = `tab-btn ${index === 0 ? "active" : ""}`;
    tab.type = "button";
    tab.textContent = label;
    tab.addEventListener("click", () => switchReportTab(sectionId));
    $("analysis-tabs").append(tab);
    const panel = document.createElement("div");
    panel.id = `panel-${sectionId}`;
    panel.className = `tab-panel ${index === 0 ? "active" : ""}`;
    panel.innerHTML = `<div class="analysis-content" id="content-${sectionId}"><p>Waiting to generate ${label.toLowerCase()}...</p></div>`;
    $("analysis-panels").append(panel);
  });
}

function switchReportTab(sectionId) {
  document.querySelectorAll(".tab-panel").forEach(panel => panel.classList.toggle("active", panel.id === `panel-${sectionId}`));
  document.querySelectorAll(".tab-btn").forEach(button => button.classList.toggle("active", button.textContent === SECTIONS.find(([id]) => id === sectionId)?.[1]));
}

async function runAnalysis() {
  const provider = getProvider();
  if (!provider.id) return alert("No configured AI providers were found in Vercel.");
  if (provider.id === "custom" && (!provider.endpoint || !provider.model)) return alert("Please enter both a custom endpoint and custom model name.");
  const data = getFormData();
  if (!data.totalAcres || !data.totalRevenue) return alert("Please enter at least farm size and total annual revenue.");
  $("analyze-btn").disabled = true;
  $("analysis-section").classList.add("visible");
  $("report-farm-name").textContent = `${data.farmName} - Full Business Analysis`;
  renderAnalysisShell();
  $("analysis-section").scrollIntoView({ behavior: "smooth" });
  reportContent = {};
  const context = buildContext(data);
  for (const [sectionId, label] of SECTIONS) {
    const target = $(`content-${sectionId}`);
    target.innerHTML = `<p>Generating ${label.toLowerCase()} with ${esc(provider.name)}...</p>`;
    try {
      reportContent[sectionId] = cleanAI(await callAI(provider, sectionPrompt(label, context), 2800, 0.55));
      target.innerHTML = reportContent[sectionId];
    } catch (error) {
      target.innerHTML = `<p style="color:#f09595;">Error generating ${esc(label)}: ${esc(error.message)}</p>`;
    }
  }
  $("analyze-btn").disabled = false;
  $("analyze-btn").textContent = "Regenerate Analysis";
  saveProject({ silent: true, skipPrompt: true });
}

async function loadFutures() {
  try {
    const response = await fetch("/api/commodities");
    const data = await response.json();
    if (!response.ok) throw new Error(data?.error || "Unable to load futures data.");
    const rows = (data.quotes || []).slice(0, 12);
    $("futures-body").innerHTML = rows.length ? rows.map(row => `
      <tr><td>${esc(row.commodity)}</td><td>${esc(row.contract || "-")}</td><td>${esc(row.last || row.settle || row.priorSettle || "-")}</td><td>${esc(row.change || "-")}</td><td>${esc(row.volume || "-")}</td><td><a href="${esc(row.sourceUrl)}" target="_blank" rel="noopener">${esc(row.sourceLabel || "CME")}</a></td></tr>
    `).join("") : '<tr><td colspan="6">No futures quotes returned right now.</td></tr>';
    $("futures-note").textContent = data.note || $("futures-note").textContent;
  } catch (error) {
    $("futures-body").innerHTML = '<tr><td colspan="6">Could not load CME futures right now.</td></tr>';
    $("futures-note").textContent = error.message;
  }
}

function reportText() {
  return SECTIONS.map(([sectionId, label]) => `[${label}]\n${$(`content-${sectionId}`)?.innerText || ""}`).join("\n\n").slice(0, 18000);
}

function addMessage(containerId, role, text) {
  const msg = document.createElement("div");
  msg.className = `chat-msg ${role === "user" ? "user" : "ai"}`;
  msg.innerHTML = role === "user" ? esc(text) : cleanAI(text);
  $(containerId).append(msg);
  $(containerId).scrollTop = $(containerId).scrollHeight;
}

async function sendReportChat() {
  const question = $("chatbot-input").value.trim();
  if (!question) return;
  const provider = getProvider();
  if (!provider.id) return alert("No configured AI providers were found in Vercel.");
  addMessage("chatbot-messages", "user", question);
  $("chatbot-input").value = "";
  $("chatbot-send").disabled = true;
  addMessage("chatbot-messages", "ai", "<em>Thinking...</em>");
  const loading = $("chatbot-messages").lastElementChild;
  const prompt = `Farm data:\n${buildContext(getFormData())}\n\nReport context:\n${reportText()}\n\nQuestion: ${question}`;
  try {
    const safe = cleanAI(await callAI(provider, prompt, 1600, 0.45, reportChat.slice(-20)));
    loading.innerHTML = safe;
    reportChat.push({ role: "user", content: question }, { role: "assistant", content: safe.replace(/<[^>]*>/g, " ") });
    saveProject({ silent: true, skipPrompt: true });
  } catch (error) {
    loading.innerHTML = `<span style="color:#f09595;">Chat error: ${esc(error.message)}</span>`;
  } finally {
    $("chatbot-send").disabled = false;
  }
}

function clearComboChat() {
  $("ai-combo-messages").innerHTML = '<div class="chat-msg ai">Ask a farm business, financing, commodity, or project question. I will use your saved project details.</div>';
}

function restoreComboChat() {
  clearComboChat();
  comboChat.forEach(message => addMessage("ai-combo-messages", message.role === "assistant" ? "ai" : "user", message.content));
}

async function sendComboChat() {
  const question = $("ai-combo-input").value.trim();
  if (!question) return;
  if (!hasProfile()) {
    openAccount();
    updateAIContext();
    return;
  }
  saveProject({ silent: true, skipPrompt: true });
  addMessage("ai-combo-messages", "user", question);
  $("ai-combo-input").value = "";
  $("ai-combo-send").disabled = true;
  addMessage("ai-combo-messages", "ai", "<em>Asking AgriDecision AI...</em>");
  const loading = $("ai-combo-messages").lastElementChild;
  const prompt = `Use the saved account and project context below. Compare recommendations across the configured AI providers and produce one practical answer.\n\nAccount: ${profile().name}\nProject: ${activeProject()?.name || projectName("Unsaved Project")}\nFarm data:\n${buildContext(getFormData())}\n\nExisting report context:\n${reportText()}\n\nQuestion: ${question}`;
  try {
    const safe = cleanAI(await callAI({ id: "all", name: "AgriDecision AI" }, prompt, 2200, 0.45, comboChat.slice(-20)));
    loading.innerHTML = safe;
    comboChat.push({ role: "user", content: question }, { role: "assistant", content: safe });
    saveProject({ silent: true, skipPrompt: true });
  } catch (error) {
    loading.innerHTML = `<span style="color:#f09595;">AgriDecision AI error: ${esc(error.message)}</span>`;
  } finally {
    $("ai-combo-send").disabled = false;
  }
}

function updateAIContext() {
  const target = $("ai-context-summary");
  if (!target) return;
  const p = profile();
  const data = getFormData();
  if (!p.name || !p.email) {
    target.textContent = "Create an account and save a project to use farm data as AI context.";
    return;
  }
  target.innerHTML = [
    `<strong>${esc(p.name)}</strong>`,
    `Project: ${esc(activeProject()?.name || projectName("Unsaved Project"))}`,
    `Farm: ${esc(data.farmName || p.farmName || "Not named")}`,
    `Commodities: ${esc(data.commodities || "Not entered")}`,
    `Revenue: ${esc(data.totalRevenue || "Not entered")}`
  ].join("<br>");
}

function switchAppTab(tabName) {
  document.querySelectorAll(".workspace-tab").forEach(button => button.classList.toggle("active", button.dataset.appTab === tabName));
  $("workspace-view").classList.toggle("active", tabName === "workspace");
  $("ai-view").classList.toggle("active", tabName === "ai");
  $("story-view").classList.toggle("active", tabName === "story");
  if (tabName === "ai") {
    saveProject({ silent: true, skipPrompt: true });
    updateAIContext();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function downloadReport() {
  const title = $("report-farm-name").textContent || "Farm Analysis";
  const body = SECTIONS.map(([sectionId, label]) => `<section><h2>${label}</h2>${reportContent[sectionId] || "<p>Not generated.</p>"}</section>`).join("");
  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(title)}</title><style>body{font-family:Georgia,serif;max-width:860px;margin:40px auto;line-height:1.7;padding:0 36px;color:#1a1a18}h1{border-bottom:3px solid #3a8035;padding-bottom:12px}table{width:100%;border-collapse:collapse}td,th{padding:8px;border-bottom:1px solid #dde8db;text-align:left}</style></head><body><h1>${esc(title)}</h1>${body}</body></html>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  a.download = `${title.replace(/[^a-z0-9]/gi, "_")}.html`;
  a.click();
}

function bind() {
  $("account-nav-btn").addEventListener("click", openAccount);
  $("cancel-account").addEventListener("click", closeAccount);
  $("save-account").addEventListener("click", saveAccount);
  $("account-modal").addEventListener("click", event => { if (event.target.id === "account-modal") closeAccount(); });
  $("ai-provider").addEventListener("change", updateProviderHelp);
  $("new-project").addEventListener("click", createProject);
  $("save-project").addEventListener("click", () => saveProject());
  $("delete-project").addEventListener("click", deleteProject);
  $("project-select").addEventListener("change", event => loadProject(event.target.value));
  $("analyze-btn").addEventListener("click", runAnalysis);
  $("download-report").addEventListener("click", downloadReport);
  $("chatbot-send").addEventListener("click", sendReportChat);
  $("ai-save-context").addEventListener("click", () => saveProject());
  $("ai-combo-send").addEventListener("click", sendComboChat);
  $("chatbot-input").addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendReportChat();
    }
  });
  $("ai-combo-input").addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendComboChat();
    }
  });
  document.querySelectorAll("[data-app-tab]").forEach(button => button.addEventListener("click", () => switchAppTab(button.dataset.appTab)));
  document.querySelectorAll("[data-question]").forEach(button => button.addEventListener("click", () => {
    $("chatbot-input").value = button.dataset.question || "";
    sendReportChat();
  }));
  document.querySelectorAll("[data-ai-question]").forEach(button => button.addEventListener("click", () => {
    $("ai-combo-input").value = button.dataset.aiQuestion || "";
    sendComboChat();
  }));
  Object.values(FIELDS).forEach(fieldId => {
    const el = $(fieldId);
    if (!el) return;
    el.addEventListener("input", scheduleSave);
    el.addEventListener("change", scheduleSave);
  });
  window.addEventListener("beforeunload", () => saveProject({ silent: true, skipPrompt: true }));
}

document.addEventListener("DOMContentLoaded", () => {
  renderAnalysisShell();
  bind();
  loadProviders();
  applyProfile();
  renderProjects();
  const activeProjectId = getStore().activeProjectId;
  if (activeProjectId) loadProject(activeProjectId);
  updateAIContext();
  loadFutures();
});
