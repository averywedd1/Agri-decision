(function () {
  function installLogoStyles() {
    if (document.getElementById("agri-logo-style")) return;
    const style = document.createElement("style");
    style.id = "agri-logo-style";
    style.textContent = `
      .brand-logo {
        display: block;
        width: 172px;
        height: 48px;
        object-fit: contain;
        object-position: left center;
      }
      .brand:has(.brand-logo) {
        gap: 0;
        min-width: 172px;
      }
      @media (max-width: 640px) {
        .brand-logo { width: 140px; height: 42px; }
        .brand:has(.brand-logo) { min-width: 140px; }
      }
    `;
    document.head.appendChild(style);
  }

  function installChatContrastStyles() {
    if (document.getElementById("agri-chat-contrast-style")) return;
    const style = document.createElement("style");
    style.id = "agri-chat-contrast-style";
    style.textContent = `
      #analysis-section .chatbot-card {
        background: #f7faf5;
        border-color: rgba(176, 223, 169, 0.55);
        box-shadow: 0 18px 38px rgba(0, 0, 0, 0.24);
      }
      #analysis-section .chatbot-header {
        background: #1a3318;
        border-bottom-color: rgba(176, 223, 169, 0.28);
      }
      #analysis-section .chatbot-header h3 {
        color: #ffffff;
      }
      #analysis-section .chatbot-header small {
        color: #dff2db;
      }
      #analysis-section .chatbot-messages {
        background: #eef6ea;
      }
      #analysis-section .chat-msg {
        border: 1px solid rgba(26, 51, 24, 0.13);
        box-shadow: 0 4px 12px rgba(26, 51, 24, 0.08);
      }
      #analysis-section .chat-msg.ai {
        background: #ffffff;
        color: #1a1a18;
      }
      #analysis-section .chat-msg.ai strong,
      #analysis-section .chat-msg.ai h1,
      #analysis-section .chat-msg.ai h2,
      #analysis-section .chat-msg.ai h3,
      #analysis-section .chat-msg.ai h4 {
        color: #122212;
      }
      #analysis-section .chat-msg.user {
        background: #244d22;
        color: #ffffff;
        border-color: #3a8035;
      }
      #analysis-section .chatbot-quick {
        background: #f7faf5;
      }
      #analysis-section .chatbot-quick button {
        background: #dff2db;
        color: #122212;
        border-color: #b0dfa9;
      }
      #analysis-section .chatbot-input-row {
        background: #ffffff;
        border-top-color: rgba(26, 51, 24, 0.16);
      }
      #analysis-section .chatbot-input-row textarea {
        background: #ffffff;
        color: #1a1a18;
      }
    `;
    document.head.appendChild(style);
  }

  function applyLogo() {
    const brand = document.querySelector(".brand");
    if (!brand || brand.dataset.logoApplied === "true") return;
    brand.innerHTML = '<img class="brand-logo" src="/agridecision_ai_logo_v2.svg" alt="AgriDecision AI">';
    brand.dataset.logoApplied = "true";
  }

  function moveExpenseChartToTools() {
    const card = document.getElementById("expense-chart-card");
    const toolsSection = document.querySelector("#tools-view .tools-section");
    if (!card || !toolsSection || toolsSection.contains(card)) return;

    const toolGrid = toolsSection.querySelector(".tool-grid");
    toolsSection.insertBefore(card, toolGrid || null);
    if (typeof updateExpensePieChart === "function") updateExpensePieChart();
  }

  function formatUpdatedTime(value) {
    const raw = String(value || "").trim();
    if (!raw || raw === "-" || raw.toLowerCase().includes("loading")) return raw || "-";
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return raw;
    return new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    }).format(date);
  }

  function applyCmeTableFixes() {
    document.querySelectorAll(".cme-snapshot-panel, .cme-snapshot-shell").forEach(element => {
      element.hidden = true;
    });

    document.querySelectorAll("#futures-body tr").forEach(row => {
      if (row.cells.length < 11) return;
      const updatedCell = row.cells[10];
      const raw = updatedCell.dataset.rawUpdated || updatedCell.textContent.trim();
      const formatted = formatUpdatedTime(raw);
      updatedCell.dataset.rawUpdated = raw;
      updatedCell.textContent = formatted;
      if (formatted !== raw) updatedCell.title = raw;
    });
  }

  function wrapCmeRefresh() {
    if (typeof loadFutures !== "function" || loadFutures.isAgriUiFix) return;
    const originalLoadFutures = loadFutures;
    loadFutures = async function (...args) {
      const result = await originalLoadFutures(...args);
      applyCmeTableFixes();
      return result;
    };
    loadFutures.isAgriUiFix = true;
  }

  function applyUiFixes() {
    installLogoStyles();
    installChatContrastStyles();
    applyLogo();

    const workspaceMarketWatch = document.getElementById("market-watch");
    if (workspaceMarketWatch) workspaceMarketWatch.remove();

    const select = document.getElementById("ai-provider");
    if (select) {
      Array.from(select.options).forEach(option => {
        if (option.value === "all" || /all configured/i.test(option.textContent)) {
          option.textContent = "AgriDecision AI";
        }
      });
    }

    const help = document.getElementById("provider-help");
    if (help) {
      help.textContent = "";
      help.hidden = true;
    }

    moveExpenseChartToTools();
    applyCmeTableFixes();
  }

  function installUiFixes() {
    if (typeof updateProviderHelp === "function" && !updateProviderHelp.isAgriUiFix) {
      const originalUpdateProviderHelp = updateProviderHelp;
      updateProviderHelp = function () {
        originalUpdateProviderHelp();
        applyUiFixes();
      };
      updateProviderHelp.isAgriUiFix = true;
    }

    wrapCmeRefresh();
    applyUiFixes();
    setTimeout(() => {
      wrapCmeRefresh();
      applyUiFixes();
    }, 0);
    setTimeout(() => {
      wrapCmeRefresh();
      applyUiFixes();
    }, 250);
    setTimeout(applyUiFixes, 1000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installUiFixes);
  } else {
    installUiFixes();
  }
}());
