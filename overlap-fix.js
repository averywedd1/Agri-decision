(function () {
  const UNITS = {
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

  function cleanupDuplicateUnits() {
    document.querySelectorAll("label").forEach(label => {
      const input = label.querySelector("input, select, textarea");
      const expected = input ? UNITS[input.id] : "";
      const units = Array.from(label.querySelectorAll(".unit-label, .field-unit-chip"));

      units.forEach(unit => unit.remove());
      if (!input || !expected) return;

      const chip = document.createElement("span");
      chip.className = "unit-label overlap-owned-unit";
      chip.textContent = expected;
      label.insertBefore(chip, input);
    });
  }

  function cleanupDuplicateBlocks() {
    ["experience-preview", "save-nudge", "guest-save-explainer", "three-step-explainer"].forEach(id => {
      document.querySelectorAll(`#${id}`).forEach((node, index) => {
        if (index > 0) node.remove();
      });
    });
  }

  function stabilizeHero() {
    const hero = document.querySelector(".hero");
    if (!hero) return;
    const h1 = hero.querySelector("h1");
    const badge = hero.querySelector(".hero-badge");
    const lead = hero.querySelector("p");
    const cta = hero.querySelector(".hero-cta");
    if (badge) badge.textContent = "Farm decision support";
    if (h1) h1.innerHTML = "Know your numbers<br><em>before your lender does</em>";
    if (lead) lead.textContent = "Turn acres, yields, costs, debt, and price risk into a lender-ready plan you can use before a loan meeting, equipment decision, or marketing call.";
    if (cta) cta.textContent = "Start my farm analysis";
  }

  function tooltipText(tip) {
    return tip.getAttribute("data-tooltip")
      || tip.getAttribute("title")
      || tip.closest("label")?.textContent?.replace("?", "").trim()
      || "Helpful field guidance.";
  }

  function ensurePopover() {
    let popover = document.getElementById("agri-tip-popover");
    if (!popover) {
      popover = document.createElement("div");
      popover.id = "agri-tip-popover";
      popover.className = "agri-tip-popover";
      popover.hidden = true;
      document.body.appendChild(popover);
    }
    return popover;
  }

  function showTip(tip) {
    const popover = ensurePopover();
    const rect = tip.getBoundingClientRect();
    popover.textContent = tooltipText(tip);
    popover.hidden = false;
    const top = Math.min(window.innerHeight - popover.offsetHeight - 12, rect.bottom + 10);
    const left = Math.min(window.innerWidth - popover.offsetWidth - 12, Math.max(12, rect.left));
    popover.style.top = `${Math.max(12, top)}px`;
    popover.style.left = `${left}px`;
  }

  function cleanupTooltips() {
    document.querySelectorAll("label").forEach(label => {
      const input = label.querySelector("input, select, textarea");
      const tips = Array.from(label.querySelectorAll(".agri-tip"));
      tips.slice(1).forEach(tip => tip.remove());
      const tip = tips[0];
      if (input && tip && tip.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_PRECEDING) {
        label.insertBefore(tip, input);
      }
    });

    document.querySelectorAll(".agri-tip").forEach(tip => {
      if (tip.dataset.clickTipBound === "true") return;
      tip.dataset.clickTipBound = "true";
      tip.setAttribute("role", "button");
      tip.setAttribute("tabindex", "0");
      tip.setAttribute("aria-label", tooltipText(tip));
      tip.addEventListener("click", event => {
        event.stopPropagation();
        showTip(tip);
      });
      tip.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          showTip(tip);
        }
      });
    });
  }

  function installStyles() {
    if (document.getElementById("overlap-fix-style")) return;
    const style = document.createElement("style");
    style.id = "overlap-fix-style";
    style.textContent = `
      label {
        position: relative;
      }
      label .unit-label,
      label .field-unit-chip {
        position: static !important;
        display: inline-flex !important;
        width: fit-content;
        margin: 0 0 2px;
        padding: 1px 7px;
        line-height: 1.4;
        transform: none !important;
      }
      label .unit-label:not(.overlap-owned-unit),
      label .field-unit-chip {
        display: none !important;
      }
      label .agri-tip {
        position: absolute;
        top: 0;
        right: 0;
        z-index: 3;
        cursor: pointer;
      }
      .hero h1 {
        min-height: 2.25em;
      }
      .agri-tip-popover {
        position: fixed;
        z-index: 10000;
        max-width: min(320px, calc(100vw - 24px));
        padding: 10px 12px;
        border: 1px solid var(--line-strong);
        border-radius: 8px;
        background: #fff;
        color: var(--text);
        box-shadow: 0 14px 36px rgba(13, 31, 13, 0.18);
        font-size: 13px;
        line-height: 1.4;
      }
    `;
    document.head.appendChild(style);

    document.addEventListener("click", event => {
      const popover = document.getElementById("agri-tip-popover");
      if (popover && !event.target.closest(".agri-tip")) popover.hidden = true;
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        const popover = document.getElementById("agri-tip-popover");
        if (popover) popover.hidden = true;
      }
    });
  }

  function run() {
    installStyles();
    cleanupDuplicateUnits();
    cleanupDuplicateBlocks();
    cleanupTooltips();
    stabilizeHero();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  setTimeout(run, 250);
  setTimeout(run, 1000);
  setInterval(run, 3000);
}());
