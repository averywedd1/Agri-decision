(function () {
  const STYLE_ID = "experience-polish-style";
  const CME_TIMEOUT_MS = 8500;

  const UNIT_LABELS = {
    "total-acres": "acres",
    "years-op": "years",
    yield: "bu/acre",
    price: "$/unit",
    "secondary-rev": "$",
    "other-income": "$",
    "total-revenue": "$",
    seed: "$/acre",
    fertilizer: "$/acre",
    chemicals: "$/acre",
    labor: "$/acre",
    fuel: "$/acre",
    equipment: "$/acre",
    "custom-hire": "$/acre",
    water: "$/acre",
    insurance: "$/acre",
    maintenance: "$/acre",
    "op-loan": "$",
    "term-loan": "$",
    "interest-rate": "%",
    "loan-term": "years"
  };

  const PLACEHOLDERS = {
    "farm-name": "Miller Family Farms",
    state: "Iowa or Central Illinois",
    "total-acres": "1,200",
    "years-op": "12",
    commodities: "Corn, soybeans, wheat",
    "op-description": "Owned/rented acres, labor, pressure points...",
    yield: "185",
    price: "4.65",
    "secondary-rev": "25,000",
    "other-income": "12,000",
    "total-revenue": "900,000",
    seed: "112",
    fertilizer: "190",
    chemicals: "62",
    labor: "42",
    fuel: "35",
    equipment: "58",
    "custom-hire": "20",
    water: "0",
    insurance: "28",
    maintenance: "18",
    "op-loan": "140,000",
    "term-loan": "260,000",
    "interest-rate": "7.1",
    "loan-term": "7",
    investments: "Planter upgrade, storage, irrigation, land...",
    goals: "Prepare for lender, cut costs, compare expansion..."
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function installStyles() {
    if (byId(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .settings-bar #provider-help,
      .settings-bar .custom-provider-fields:not(.visible) {
        display: none !important;
      }
      .experience-preview {
        display: grid;
        grid-template-columns: 1.15fr .85fr;
        gap: 14px;
        align-items: stretch;
        max-width: 1040px;
        margin: 0 auto 20px;
      }
      .experience-preview > article {
        display: grid;
        gap: 10px;
        padding: 16px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
      }
      .experience-preview strong {
        color: var(--green-800);
      }
      .preview-metrics {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 8px;
      }
      .preview-metrics span {
        display: grid;
        gap: 2px;
        padding: 10px;
        border-radius: 8px;
        background: #f7faf5;
        color: var(--muted);
        font-size: 12px;
      }
      .preview-metrics b {
        color: var(--green-900);
        font-size: 18px;
      }
      .guest-save-explainer {
        grid-column: 1 / -1;
        padding: 10px 12px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #f7faf5;
        color: var(--muted);
      }
      .field-unit-chip {
        display: inline-flex;
        width: fit-content;
        margin-left: 6px;
        padding: 1px 7px;
        border-radius: 999px;
        background: #eef4ec;
        color: var(--green-800);
        font-size: 11px;
        font-weight: 800;
      }
      .cme-status-box {
        padding: 16px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #f7faf5;
        color: var(--muted);
        text-align: center;
      }
      .cme-status-box strong {
        color: var(--green-800);
      }
      @media (max-width: 820px) {
        .experience-preview { grid-template-columns: 1fr; }
        .preview-metrics { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function polishCopy() {
    const hero = document.querySelector(".hero");
    const h1 = hero?.querySelector("h1");
    const badge = hero?.querySelector(".hero-badge");
    const lead = hero?.querySelector("p");
    const cta = hero?.querySelector(".hero-cta");
    if (badge) badge.textContent = "Farm decision support";
    if (h1) h1.innerHTML = "Know your numbers<br><em>before your lender does</em>";
    if (lead) lead.textContent = "Turn acres, yields, costs, debt, and price risk into a lender-ready plan you can use before a loan meeting, equipment decision, or marketing call.";
    if (cta) cta.textContent = "Start my farm analysis";

    const features = byId("features");
    const featureH2 = features?.querySelector("h2");
    const featureLead = features?.querySelector(".section-lead");
    if (featureH2) featureH2.textContent = "From farm numbers to lender-ready decisions";
    if (featureLead) featureLead.textContent = "One workspace turns the numbers you already manage into break-even, cash-flow, risk, and next-step guidance.";

    const dataLead = document.querySelector("#data-entry .section-lead");
    if (dataLead) dataLead.textContent = "Start blank or load the demo farm to see what a completed analysis looks like.";
  }

  function polishProviderUi() {
    const select = byId("ai-provider");
    const label = select?.closest("label");
    const help = byId("provider-help");
    if (label) {
      const textNode = Array.from(label.childNodes).find(node => node.nodeType === Node.TEXT_NODE);
      if (textNode) textNode.textContent = "AI Advisor ";
    }
    if (select && !select.options.length) {
      select.innerHTML = '<option value="all">AgriDecision AI</option>';
    }
    if (select) {
      Array.from(select.options).forEach(option => {
        option.textContent = option.textContent
          .replace(/Loading configured AIs[. ]*/i, "AgriDecision AI")
          .replace(/AgriDecision AI - all configured/i, "AgriDecision AI")
          .replace(/all configured/ig, "")
          .trim() || "AgriDecision AI";
      });
    }
    if (help) {
      help.textContent = "";
      help.hidden = true;
    }
  }

  function installPreview() {
    if (byId("experience-preview")) return;
    const form = byId("farm-form");
    const dataSection = byId("data-entry");
    if (!form || !dataSection) return;
    const preview = document.createElement("div");
    preview.className = "experience-preview";
    preview.id = "experience-preview";
    preview.innerHTML = `
      <article>
        <strong>See the finished experience before typing everything in.</strong>
        <p class="fineprint">Load a sample 500-acre corn operation, run the report, then replace the numbers with your own farm data when you are ready.</p>
        <div class="preview-metrics">
          <span>Breakeven <b>$3.05</b> per bushel</span>
          <span>Operating cost <b>$565</b> per acre</span>
          <span>Lender read <b>DSCR</b> and cash flow</span>
        </div>
      </article>
      <article>
        <strong>What gets saved?</strong>
        <p class="fineprint">Guests keep a browser draft. Signed-in users can sync projects, reports, and farm context across devices.</p>
      </article>
    `;
    form.parentElement?.insertBefore(preview, form);
  }

  function polishProjectSave() {
    const manager = document.querySelector(".project-manager");
    const status = byId("project-status");
    if (!manager || byId("guest-save-explainer")) return;
    const explainer = document.createElement("p");
    explainer.className = "guest-save-explainer";
    explainer.id = "guest-save-explainer";
    explainer.textContent = "Not signed in? You can still save a browser draft on this device. Create an account when you want projects to follow you across devices.";
    manager.append(explainer);
    if (status && /Create an account profile/i.test(status.textContent || "")) {
      status.textContent = "Save a local draft now, or create an account to sync projects across devices.";
    }
  }

  function addUnitsAndPlaceholders() {
    Object.entries(PLACEHOLDERS).forEach(([id, placeholder]) => {
      const field = byId(id);
      if (field) field.placeholder = placeholder;
    });
    Object.entries(UNIT_LABELS).forEach(([id, unit]) => {
      const input = byId(id);
      const label = input?.closest("label");
      if (!label || label.querySelector(`[data-polish-unit="${id}"]`)) return;
      const chip = document.createElement("span");
      chip.className = "field-unit-chip";
      chip.dataset.polishUnit = id;
      chip.textContent = unit;
      label.insertBefore(chip, input);
    });
  }

  function quoteUnit(row) {
    const name = `${row?.commodity || ""} ${row?.category || ""}`;
    if (/soybean meal/i.test(name)) return "dollars per short ton";
    if (/corn|soybean|wheat|oats/i.test(name)) return "cents per bushel";
    if (/soybean oil|cattle|hog|cotton|sugar|coffee/i.test(name)) return "cents per pound";
    if (/cocoa/i.test(name)) return "dollars per metric ton";
    if (/milk/i.test(name)) return "dollars per hundredweight";
    return row?.priceUnit || "contract quote units";
  }

  function quotePrice(row) {
    return row?.last || row?.settle || row?.priorSettle || "-";
  }

  function formatUpdated(value) {
    if (!value) return "Just checked";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function renderSnapshot(rows) {
    const body = byId("futures-snapshot-body");
    if (!body) return;
    body.innerHTML = rows.slice(0, 8).map(row => `
      <tr>
        <td>${esc(row.commodity)}</td>
        <td>${esc(row.contract || "-")}</td>
        <td>${esc(quotePrice(row))}</td>
        <td>${esc(quoteUnit(row))}</td>
        <td>${esc(formatUpdated(row.updated))}</td>
      </tr>
    `).join("");
  }

  function renderCmeRows(rows) {
    const body = byId("futures-body");
    if (!body) return;
    const columns = body.closest("table")?.querySelectorAll("thead th").length || 12;
    if (!rows.length) {
      renderCmeUnavailable();
      return;
    }
    if (columns <= 6) {
      body.innerHTML = rows.slice(0, 12).map(row => `
        <tr>
          <td>${esc(row.commodity)}</td>
          <td>${esc(row.contract || "-")}</td>
          <td>${esc(quotePrice(row))}</td>
          <td>${esc(row.change || "-")}</td>
          <td>${esc(row.volume || "-")}</td>
          <td><a href="${esc(row.sourceUrl || "https://www.cmegroup.com/markets/agriculture.html")}" target="_blank" rel="noopener">${esc(row.sourceLabel || "CME")}</a></td>
        </tr>
      `).join("");
      return;
    }
    body.innerHTML = rows.map(row => `
      <tr>
        <td>${esc(row.category || "Agriculture")}</td>
        <td>${esc(row.commodity)}</td>
        <td>${esc(row.contract || "-")}</td>
        <td>${esc(quotePrice(row))}</td>
        <td>${esc(quoteUnit(row))}</td>
        <td>${esc(row.last || row.settle || row.priorSettle || "-")}</td>
        <td>${esc(row.settle || "-")}</td>
        <td>${esc(row.priorSettle || "-")}</td>
        <td>${esc(row.change || "-")}</td>
        <td>${esc(row.volume || "-")}</td>
        <td>${esc(formatUpdated(row.updated))}</td>
        <td><a href="${esc(row.sourceUrl || "https://www.cmegroup.com/markets/agriculture.html")}" target="_blank" rel="noopener">${esc(row.sourceLabel || "CME")}</a></td>
      </tr>
    `).join("");
  }

  function renderCmeUnavailable(message = "Live futures did not return in time.") {
    const body = byId("futures-body");
    const note = byId("futures-note");
    const snapshot = byId("futures-snapshot-body");
    const columns = body?.closest("table")?.querySelectorAll("thead th").length || 12;
    const box = `
      <div class="cme-status-box">
        <strong>Futures prices are unavailable right now.</strong><br>
        ${esc(message)} Use the CME Group link for current quotes before trading or hedging.
        <br><a href="https://www.cmegroup.com/markets/agriculture.html" target="_blank" rel="noopener">Open CME Group agriculture markets</a>
      </div>
    `;
    if (body) body.innerHTML = `<tr><td colspan="${columns}">${box}</td></tr>`;
    if (snapshot) snapshot.innerHTML = `<tr><td colspan="5">${box}</td></tr>`;
    if (note) note.textContent = "Futures refresh attempted. Verify directly with CME Group before trading or hedging.";
  }

  function patchLoadFutures() {
    if (window.loadFutures?.isExperiencePolishPatch) return;
    window.loadFutures = async function (options = {}) {
      const refresh = byId("refresh-futures");
      const note = byId("futures-note");
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), CME_TIMEOUT_MS);
      if (refresh && !options.silent) refresh.textContent = "Refreshing...";
      if (note && !options.silent) note.textContent = "Checking delayed futures...";
      try {
        const response = await fetch("/api/commodities", { signal: controller.signal });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error || "Unable to load futures.");
        const rows = Array.isArray(data?.quotes) ? data.quotes : [];
        if (!rows.length) throw new Error("No futures quotes were returned.");
        window.agriLastFuturesRows = rows;
        renderSnapshot(rows);
        renderCmeRows(rows);
        if (note) {
          note.textContent = `${data.note || "Delayed futures snapshot."} Last checked ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`;
        }
      } catch (error) {
        renderCmeUnavailable(error.name === "AbortError" ? "The price feed timed out." : error.message);
      } finally {
        clearTimeout(timeout);
        if (refresh) refresh.textContent = "Refresh Futures";
      }
    };
    window.loadFutures.isExperiencePolishPatch = true;
  }

  function protectCmeLoadingState() {
    const text = byId("futures-body")?.textContent || "";
    if (/Loading futures/i.test(text)) {
      setTimeout(() => {
        const current = byId("futures-body")?.textContent || "";
        if (/Loading futures/i.test(current)) renderCmeUnavailable("The price feed did not respond.");
      }, CME_TIMEOUT_MS + 500);
    }
  }

  function install() {
    installStyles();
    polishCopy();
    polishProviderUi();
    installPreview();
    polishProjectSave();
    addUnitsAndPlaceholders();
    patchLoadFutures();
    protectCmeLoadingState();
    if (typeof window.loadFutures === "function") window.loadFutures({ silent: true });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
  setTimeout(install, 500);
  setTimeout(install, 1500);
  setInterval(() => {
    polishProviderUi();
    protectCmeLoadingState();
  }, 3000);
}());
