(function () {
  const STYLE_ID = "agri-qc-fixes-style";

  function byId(id) {
    return document.getElementById(id);
  }

  function installStyles() {
    if (byId(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #data-entry > .section-kicker,
      #data-entry > h2,
      #data-entry > .section-lead {
        max-width: 760px;
        margin-left: auto;
        margin-right: auto;
        text-align: center;
      }
      #data-entry > .section-lead {
        margin-bottom: 22px;
      }
      #three-step-explainer,
      #demo-onboarding,
      #experience-preview,
      #pwa-install-card,
      #farm-form,
      #form-stepper,
      #data-entry .settings-bar,
      #data-entry .project-manager {
        width: min(1040px, calc(100% - 44px));
        margin-left: auto !important;
        margin-right: auto !important;
      }
      #three-step-explainer,
      #demo-onboarding {
        text-align: center;
      }
      #three-step-explainer article {
        align-content: start;
        justify-items: center;
      }
      #demo-onboarding .demo-actions {
        justify-content: center;
      }
      #experience-preview {
        align-items: stretch;
      }
      .regional-context-card {
        min-height: 190px;
      }
      #weather-context-body,
      #basis-context-body {
        color: var(--text);
      }
      #weather-context-body.context-muted,
      #basis-context-body.context-muted {
        color: var(--muted);
      }
      .regional-context-card .context-table {
        min-width: 0;
      }
      .regional-context-card .context-table td,
      .regional-context-card .context-table th {
        vertical-align: top;
      }

      #ai-view {
        color: rgba(255, 255, 255, 0.88);
      }
      #ai-view .ai-lab {
        padding-top: 92px;
      }
      #ai-view .ai-combo-card {
        background: #f7faf5 !important;
        color: var(--text) !important;
        border-color: rgba(26, 51, 24, 0.16) !important;
      }
      #ai-view .ai-combo-card .chatbot-header {
        border-bottom-color: rgba(26, 51, 24, 0.12) !important;
      }
      #ai-view .ai-combo-card .chatbot-header h3,
      #ai-view .ai-combo-card h3 {
        color: var(--green-900) !important;
      }
      #ai-view .ai-combo-card h.chatbot-header small,
      #ai-view .ai-combo-card small {
        color: var(--muted) !important;
      }
      #ai-view .ai-combo-card .chatbot-messages {
        background: #eef6ea !important;
        color: var(--text) !important;
      }
      #ai-view .ai-combo-card .chat-msg.ai {
        background: #ffffff !important;
        color: var(--text) !important;
        border: 1px solid rgba(26, 51, 24, 0.12);
      }
      #ai-view .ai-combo-card .chat-msg.user {
        background: var(--green-700) !important;
        color: #ffffff !important;
      }
      #ai-view .ai-combo-card .chatbot-quick button {
        background: #ffffff !important;
        color: var(--green-800) !important;
        border-color: rgba(26, 51, 24, 0.18) !important;
      }
      #ai-view .ai-combo-card .chatbot-input-row {
        border-top-color: rgba(26, 51, 24, 0.12) !important;
      }
      #ai-view .ai-combo-card textarea {
        background: #ffffff !important;
        color: var(--text) !important;
        border-color: rgba(26, 51, 24, 0.24) !important;
      }
      #ai-view .ai-context-panel,
      #ai-view .ai-context-panel p,
      #ai-view .ai-context-note {
        color: rgba(255, 255, 255, 0.84) !important;
      }
      #ai-view .ai-context-note {
        background: rgba(255, 255, 255, 0.08) !important;
        border-color: rgba(255, 255, 255, 0.14) !important;
      }

      @media (max-width: 820px) {
        #three-step-explainer,
        #demo-onboarding,
        #experience-preview,
        #regional-context-grid,
        #pwa-install-card,
        #farm-form,
        #form-stepper,
        #data-entry .settings-bar,
        #data-entry .project-manager {
          width: min(100% - 28px, 1040px);
        }
        #data-entry > .section-kicker,
        #data-entry > h2,
        #data-entry > .section-lead {
          width: min(100% - 28px, 760px);
        }
        #ai-view .ai-lab {
          padding-top: 82px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function keepWeatherPanelInTools() {
    const grid = byId("regional-context-grid");
    const toolsSection = document.querySelector("#tools-view .tools-section");
    if (!grid || !toolsSection || toolsSection.contains(grid)) return;
    const anchor = toolsSection.querySelector(".tool-grid");
    toolsSection.insertBefore(grid, anchor || null);
  }

  function removeStrayWeatherPanelsFromFarmEntry() {
    const dataSection = byId("data-entry");
    if (!dataSection) return;
    dataSection.querySelectorAll("#regional-context-grid").forEach(grid => {
      const toolsSection = document.querySelector("#tools-view .tools-section");
      if (!toolsSection) return;
      const anchor = toolsSection.querySelector(".tool-grid");
      toolsSection.insertBefore(grid, anchor || null);
    });
  }

  function moveWeatherPanelUp() {
    keepWeatherPanelInTools();
    removeStrayWeatherPanelsFromFarmEntry();
  }

  function improveWeatherEmptyState() {
    const weather = byId("weather-context-body");
    const basis = byId("basis-context-body");
    const source = byId("weather-source");
    if (source && /Uses the state/i.test(source.textContent || "")) {
      source.textContent = "Enter State / Region in the farm profile and this fills automatically.";
    }
   if (weather && /Enter a state or region/i.test(weather.textContent || "")) {
      weather.innerHTML = "<p><strong>Weather appears here.</strong> Add a State / Region below, such as Iowa, and AgriDecision will load the local National Weather Service outlook.</p>";
    }
    if (basis && /Enter commodities and a region/i.test(basis.textContent || "")) {
      basis.innerHTML = "<p><strong>Cash-price context appears here.</strong> Add commodities and a region to see local basis planning ranges beside CME futures.</p>";
    }
  }

  function runQc() {
    installStyles();
    moveWeatherPanelUp();
    improveWeatherEmptyState();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", runQc);
  else runQc();
  setTimeout(runQc, 400);
  setTimeout(runQc, 1200);
  setInterval(runQc, 3000);
}());
