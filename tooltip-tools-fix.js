(function () {
  const TIP_TEXT = {
    "farm-name": "The farm or business name used on saved projects and generated reports.",
    "farm-type": "The main type of operation. This helps compare the farm against more relevant benchmarks.",
    state: "The state or region where the operation is located. If you draw field boundaries, the map can also drive regional context.",
    "total-acres": "Total acres includes mapped field acres plus any additional acres you enter that are not drawn on the map.",
    "years-op": "How long the farm has been operating. This can help frame lender risk and transition planning.",
    commodities: "The main commodities or enterprises, such as corn, soybeans, wheat, cattle, dairy, cotton, or specialty crops.",
    "op-description": "Notes about rented acres, owned acres, labor, family structure, constraints, or anything the AI should understand.",
    yield: "Expected production per acre, such as bushels per acre.",
    price: "Expected crop price per unit, such as dollars per bushel.",
    "secondary-rev": "Income from secondary crops, livestock, custom work, storage, trucking, or other farm enterprises.",
    "other-income": "Other farm-related income that should count toward the operation's annual revenue.",
    "total-revenue": "Total yearly income before expenses.",
    seed: "Seed cost per acre for the crop plan.",
    fertilizer: "Fertilizer and soil amendment cost per acre.",
    chemicals: "Herbicide, pesticide, fungicide, and related crop protection cost per acre.",
    labor: "Hired labor or allocated labor cost per acre.",
    fuel: "Fuel, oil, and field-operation energy cost per acre.",
    equipment: "Equipment ownership, lease, depreciation, or machinery allocation cost per acre.",
    "custom-hire": "Custom planting, spraying, harvesting, hauling, or other hired field work cost per acre.",
    water: "Irrigation water, pumping, water district, or related water cost per acre.",
    insurance: "Crop insurance and farm insurance cost per acre.",
    maintenance: "Repairs and maintenance cost per acre.",
    "op-loan": "Short-term operating debt used for inputs, rent, fuel, labor, and seasonal expenses.",
    "term-loan": "Longer-term debt such as land, building, or equipment loans.",
    "interest-rate": "The interest rate used to estimate debt service and financing pressure.",
    "loan-term": "The repayment period used to estimate annual debt payments.",
    investments: "Planned equipment, land, irrigation, storage, livestock, technology, or infrastructure purchases.",
    goals: "The main decisions, risks, or improvements you want the analysis to address."
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function installStyles() {
    if (byId("tooltip-tools-fix-style")) return;
    const style = document.createElement("style");
    style.id = "tooltip-tools-fix-style";
    style.textContent = `
      #regional-context-grid {
        width: 100% !important;
        max-width: none !important;
        margin: 22px 0 !important;
      }
      #regional-context-grid::before {
        content: none !important;
        display: none !important;
      }
      #regional-context-heading {
        grid-column: 1 / -1;
      }
      #regional-context-heading .section-lead {
        margin-bottom: 0;
      }
      .agri-tip {
        pointer-events: auto !important;
        cursor: pointer !important;
        user-select: none;
      }
      .agri-tip-popover {
        position: fixed;
        z-index: 100000;
        max-width: min(340px, calc(100vw - 24px));
        padding: 10px 12px;
        border: 1px solid var(--line-strong, #cbd8c4);
        border-radius: 8px;
        background: #fff;
        color: var(--text, #1f2a1d);
        box-shadow: 0 14px 36px rgba(13, 31, 13, 0.2);
        font-size: 13px;
        line-height: 1.4;
      }
    `;
    document.head.appendChild(style);
  }

  function textForTip(tip) {
    const inputId = tip.dataset.tipKey || tip.closest("label")?.querySelector("input, select, textarea")?.id || "";
    return tip.dataset.tooltip || tip.title || TIP_TEXT[inputId] || "Helpful field guidance.";
  }

  function ensurePopover() {
    let popover = byId("agri-tip-popover");
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
    popover.textContent = textForTip(tip);
    popover.hidden = false;
    const top = Math.min(window.innerHeight - popover.offsetHeight - 12, rect.bottom + 10);
    const left = Math.min(window.innerWidth - popover.offsetWidth - 12, Math.max(12, rect.left));
    popover.style.top = `${Math.max(12, top)}px`;
    popover.style.left = `${left}px`;
  }

  function installTipBehavior() {
    if (window.__agriReliableTipsBound) return;
    window.__agriReliableTipsBound = true;
    document.addEventListener("click", event => {
      const tip = event.target.closest?.(".agri-tip");
      const popover = byId("agri-tip-popover");
      if (!tip) {
        if (popover) popover.hidden = true;
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      showTip(tip);
    }, true);
    document.addEventListener("keydown", event => {
      const tip = event.target.closest?.(".agri-tip");
      if (!tip || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      showTip(tip);
    });
  }

  function installFieldTips() {
    Object.entries(TIP_TEXT).forEach(([id, text]) => {
      const field = byId(id);
      const label = field?.closest("label");
      if (!label) return;
      let tip = label.querySelector(`.agri-tip[data-tip-key="${CSS.escape(id)}"]`) || label.querySelector(".agri-tip");
      if (!tip) {
        tip = document.createElement("span");
        tip.className = "agri-tip";
        tip.textContent = "?";
        label.append(tip);
      }
      tip.dataset.tipKey = id;
      tip.dataset.tooltip = text;
      tip.title = text;
      tip.setAttribute("role", "button");
      tip.setAttribute("tabindex", "0");
      tip.setAttribute("aria-label", text);
    });
  }

  function moveRegionalContextToTools() {
    const grid = byId("regional-context-grid");
    const toolsSection = document.querySelector("#tools-view .tools-section");
    if (!grid || !toolsSection) return;
    let heading = byId("regional-context-heading");
    if (!heading) {
      heading = document.createElement("div");
      heading.id = "regional-context-heading";
      heading.innerHTML = `
        <div class="section-kicker">Weather + Local Market Context</div>
        <h2>Field outlook and marketing context</h2>
        <p class="section-lead">Uses the field map when a boundary is saved, then falls back to the State / Region field.</p>
      `;
      grid.prepend(heading);
    }
    const anchor = toolsSection.querySelector(".tool-grid");
    if (grid.parentElement !== toolsSection || grid.nextElementSibling !== anchor) {
      toolsSection.insertBefore(grid, anchor || null);
    }
  }

  function run() {
    installStyles();
    installFieldTips();
    installTipBehavior();
    moveRegionalContextToTools();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  setTimeout(run, 400);
  setTimeout(run, 1200);
  setInterval(run, 2500);
}());
