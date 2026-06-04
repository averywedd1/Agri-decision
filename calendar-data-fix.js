(function () {
  const STYLE_ID = "calendar-data-fix-style";
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

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

  function money(value, digits = 0) {
    return Number(value || 0).toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: digits
    });
  }

  function num(value, digits = 1) {
    return Number(value || 0).toLocaleString("en-US", { maximumFractionDigits: digits });
  }

  function getData() {
    return typeof getFormData === "function" ? getFormData() : {};
  }

  function n(value) {
    return Number(value || 0) || 0;
  }

  function text(value) {
    return String(value || "").trim();
  }

  function directCostPerAcre(data) {
    return [
      "seed", "fertilizer", "chemicals", "labor", "fuel",
      "equipment", "customHire", "water", "insurance", "maintenance"
    ].reduce((sum, key) => sum + n(data[key]), 0);
  }

  function totalDebt(data) {
    return n(data.opLoan) + n(data.termLoan);
  }

  function debtService(data) {
    const debt = totalDebt(data);
    const rate = Math.max(n(data.interestRate) / 100 || 0.07, 0);
    const years = Math.max(n(data.loanTerm) || 7, 1);
    if (!debt) return 0;
    return debt * (rate / (1 - Math.pow(1 + rate, -years)));
  }

  function metrics(data) {
    const acres = n(data.totalAcres);
    const yieldPerAcre = n(data.yield);
    const price = n(data.price);
    const costPerAcre = directCostPerAcre(data);
    const revenue = n(data.totalRevenue) || acres * yieldPerAcre * price + n(data.secondaryRev) + n(data.otherIncome);
    const totalCost = costPerAcre * acres;
    const margin = revenue - totalCost;
    const breakEven = yieldPerAcre ? costPerAcre / yieldPerAcre : 0;
    const ds = debtService(data);
    const dscr = ds ? margin / ds : 0;
    return { acres, yieldPerAcre, price, costPerAcre, revenue, totalCost, margin, breakEven, debt: totalDebt(data), debtService: ds, dscr };
  }

  function cropInfo(data) {
    const raw = `${data.commodities || ""} ${data.farmType || ""}`.toLowerCase();
    const crops = [];
    if (/corn/.test(raw)) crops.push("corn");
    if (/soy|bean/.test(raw)) crops.push("soybeans");
    if (/wheat/.test(raw)) crops.push("wheat");
    if (/cotton/.test(raw)) crops.push("cotton");
    if (/cattle|beef/.test(raw)) crops.push("cattle");
    if (/hog|swine/.test(raw)) crops.push("hogs");
    if (/dairy|milk/.test(raw)) crops.push("dairy");
    if (!crops.length && text(data.commodities)) crops.push(text(data.commodities));
    return {
      raw,
      crops,
      rowCrop: /corn|soy|bean|row/.test(raw),
      wheat: /wheat/.test(raw),
      livestock: /cattle|beef|hog|swine|dairy|milk/.test(raw)
    };
  }

  function regionInfo(data) {
    const region = text(data.state);
    const lower = region.toLowerCase();
    const north = /north dakota|\bnd\b|minnesota|\bmn\b|wisconsin|\bwi\b|michigan|\bmi\b|montana|\bmt\b/i.test(region);
    const south = /texas|\btx\b|oklahoma|\bok\b|arkansas|\bar\b|mississippi|\bms\b|louisiana|\bla\b|georgia|\bga\b|alabama|\bal\b|florida|\bfl\b/i.test(region);
    const plains = /kansas|\bks\b|nebraska|\bne\b|south dakota|\bsd\b|north dakota|\bnd\b|plains/i.test(region);
    const cornBelt = /iowa|\bia\b|illinois|\bil\b|indiana|\bin\b|ohio|\boh\b|missouri|\bmo\b|corn belt/i.test(region);
    return { region, north, south, plains, cornBelt };
  }

  function add(months, task) {
    months[task.month].push(task);
  }

  function baseTask(month, title, reason, type = "From your data") {
    return { month, title, reason, type };
  }

  function plantingMonths(crops, region) {
    if (crops.wheat && region.plains) return [8, 9];
    if (crops.wheat && region.north) return [3, 4];
    if (crops.rowCrop && region.south) return [2, 3];
    if (crops.rowCrop && region.north) return [3, 4, 5];
    if (crops.rowCrop) return [3, 4];
    if (crops.livestock) return [1, 2, 8];
    return [2, 3, 4];
  }

  function harvestMonths(crops, region) {
    if (crops.wheat && region.plains) return [5, 6];
    if (crops.wheat && region.north) return [7, 8];
    if (crops.rowCrop && region.south) return [8, 9];
    if (crops.rowCrop && region.north) return [9, 10];
    if (crops.rowCrop) return [8, 9, 10];
    if (crops.livestock) return [5, 10];
    return [8, 9, 10];
  }

  function buildCalendarTasks(data = getData()) {
    const crop = cropInfo(data);
    const region = regionInfo(data);
    const m = metrics(data);
    const months = Array.from({ length: 12 }, () => []);
    const cropLabel = crop.crops.length ? crop.crops.join(", ") : "your enterprise";
    const regionLabel = region.region || "your region";

    if (!crop.crops.length) {
      add(months, baseTask(0, "Enter commodities", "The calendar can time planting, harvest, marketing, and insurance once commodities are entered.", "Needs input"));
    }
    if (!region.region) {
      add(months, baseTask(0, "Enter region", "Regional timing changes by state, especially for planting, harvest, crop insurance, and input decisions.", "Needs input"));
    }
    if (!m.acres) {
      add(months, baseTask(0, "Enter total acres", "Acreage drives cost exposure, operating loan size, and lender-ready cash flow timing.", "Needs input"));
    }

    add(months, baseTask(0, "Build the yearly cash-flow plan", m.acres ? `Use ${num(m.acres, 1)} acres to size operating needs and lender requests.` : "Add acres, costs, and debt so the cash-flow plan is not generic."));
    add(months, baseTask(1, "Set crop insurance and lender assumptions", crop.crops.length ? `Use ${cropLabel} yield and price assumptions before coverage deadlines.` : "Add commodities so coverage reminders match the operation."));
    add(months, baseTask(11, "Close books and reset next-year targets", m.costPerAcre ? `Start next year from the current ${money(m.costPerAcre)}/acre operating cost base.` : "Enter costs so next-year targets are based on real numbers."));

    if (m.debt) {
      add(months, baseTask(0, "Review operating and term debt renewal", `Current entered debt is ${money(m.debt)} with estimated annual service near ${money(m.debtService)}.`));
      add(months, baseTask(10, "Prepare lender update package", m.dscr ? `Include DSCR near ${num(m.dscr, 2)}x, cost per acre, and cash-flow changes.` : "Add revenue and cost values so DSCR can be included."));
    }

    if (m.costPerAcre) {
      add(months, baseTask(1, "Lock input budget limits", `Operating costs entered total ${money(m.costPerAcre)}/acre. Use this as the spring input ceiling.`));
      if (n(data.fertilizer) > 0) add(months, baseTask(9, "Price fall fertilizer", `Fertilizer is ${money(n(data.fertilizer))}/acre, so fall pricing can materially move breakeven.`));
      if (n(data.fuel) > 0 || n(data.equipment) > 0) add(months, baseTask(7, "Check fuel and equipment exposure", `Fuel and equipment total ${money(n(data.fuel) + n(data.equipment))}/acre before harvest.`));
    }

    if (m.breakEven) {
      add(months, baseTask(2, "Set pre-season breakeven price", `With ${num(m.yieldPerAcre, 1)} yield and ${money(m.costPerAcre)}/acre cost, breakeven is about ${money(m.breakEven, 2)} per unit.`));
      add(months, baseTask(5, "Update marketing trigger after stand/yield check", `Compare current price ${money(m.price, 2)} against breakeven ${money(m.breakEven, 2)}.`));
      add(months, baseTask(8, "Recheck harvest sell versus store decision", `Use breakeven ${money(m.breakEven, 2)} and local basis before pricing harvest bushels.`));
    } else {
      add(months, baseTask(2, "Enter yield, price, and cost values", "These fields are needed before the calendar can calculate breakeven-based hedge timing.", "Needs input"));
    }

    plantingMonths(crop, region).forEach((month, index) => {
      add(months, baseTask(month, index === 0 ? "Start field-readiness and input timing" : "Update planting progress and cash spend", `${cropLabel} timing is based on ${regionLabel}. Update costs and yield assumptions as conditions change.`));
    });

    harvestMonths(crop, region).forEach((month, index) => {
      add(months, baseTask(month, index === 0 ? "Start harvest cash-flow plan" : "Update harvest marketing decision", `${cropLabel} harvest timing is based on ${regionLabel}. Compare storage, delivery, and loan needs.`));
    });

    if (text(data.investments)) {
      add(months, baseTask(6, "Review capital project timing", `Entered investment plan: ${text(data.investments).slice(0, 120)}${text(data.investments).length > 120 ? "..." : ""}`));
      add(months, baseTask(10, "Decide whether to buy, delay, or rent equipment", "Use the equipment ownership tool before year-end tax and lender discussions."));
    }

    if (text(data.goals)) {
      add(months, baseTask(3, "Turn stated goals into a spring action list", `Goal context: ${text(data.goals).slice(0, 120)}${text(data.goals).length > 120 ? "..." : ""}`));
      add(months, baseTask(7, "Mid-season check against goals", "Compare current costs, yield outlook, and lender targets against the goals entered in the workspace."));
    }

    if (crop.livestock) {
      add(months, baseTask(1, "Review feed and working capital needs", "Livestock/dairy entries add feed, labor, and cash-flow timing to the calendar."));
      add(months, baseTask(6, "Refresh feed price and margin outlook", "Use current prices and cash-flow needs before locking feed or production assumptions."));
    }

    return months.map((items, month) => {
      const unique = [];
      items.forEach(item => {
        if (!unique.some(existing => existing.title === item.title)) unique.push(item);
      });
      if (!unique.length) {
        unique.push(baseTask(month, "Update workspace numbers", `Refresh ${cropLabel} costs, price, yield, and debt assumptions for ${MONTHS[month]}.`, "Monthly check"));
      }
      return unique.slice(0, 5);
    });
  }

  function installStyles() {
    if (byId(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      .calendar-source-card {
        display: grid;
        gap: 8px;
        margin: 0 0 14px;
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #fff;
      }
      .calendar-source-card strong { color: var(--green-800); }
      .calendar-source-grid {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
      }
      .calendar-source-grid span {
        display: grid;
        gap: 2px;
        padding: 9px;
        border-radius: 8px;
        background: #f7faf5;
        color: var(--muted);
      }
      .calendar-source-grid b { color: var(--green-900); }
      .calendar-task-type {
        display: inline-flex;
        width: fit-content;
        margin-bottom: 4px;
        padding: 2px 7px;
        border-radius: 999px;
        background: #eef4ec;
        color: var(--green-800);
        font-size: 11px;
        font-weight: 800;
      }
      .calendar-month li {
        margin-bottom: 9px;
      }
      .calendar-month li strong {
        display: block;
        color: var(--green-900);
      }
      .calendar-month li small {
        display: block;
        color: var(--muted);
        line-height: 1.35;
      }
      @media (max-width: 860px) {
        .calendar-source-grid { grid-template-columns: 1fr 1fr; }
      }
      @media (max-width: 560px) {
        .calendar-source-grid { grid-template-columns: 1fr; }
      }
    `;
    document.head.appendChild(style);
  }

  function summaryMarkup(data) {
    const crop = cropInfo(data);
    const region = regionInfo(data);
    const m = metrics(data);
    const cropText = crop.crops.length ? crop.crops.join(", ") : "Add commodities";
    const regionText = region.region || "Add region";
    const acresText = m.acres ? `${num(m.acres, 1)} acres` : "Add acres";
    const breakEvenText = m.breakEven ? money(m.breakEven, 2) : "Add yield, price, and cost";
    return `
      <div class="calendar-source-card" id="calendar-source-card">
        <strong>Calendar built from your workspace data</strong>
        <div class="calendar-source-grid">
          <span>Commodity <b>${esc(cropText)}</b></span>
          <span>Region <b>${esc(regionText)}</b></span>
          <span>Acres <b>${esc(acresText)}</b></span>
          <span>Breakeven <b>${esc(breakEvenText)}</b></span>
        </div>
      </div>
    `;
  }

  function renderDataDrivenCalendar() {
    const view = byId("calendar-view");
    const grid = byId("decision-calendar-grid");
    if (!view || !grid) return;
    installStyles();
    const data = getData();
    let source = byId("calendar-source-card");
    if (!source) {
      const lead = view.querySelector(".section-lead");
      lead?.insertAdjacentHTML("afterend", summaryMarkup(data));
    } else {
      source.outerHTML = summaryMarkup(data);
    }

    const now = new Date();
    const tasksByMonth = buildCalendarTasks(data);
    grid.innerHTML = tasksByMonth.map((tasks, month) => `
      <article class="calendar-month ${month === now.getMonth() ? "current" : ""}">
        <h3>${MONTHS[month]}</h3>
        <ul>
          ${tasks.map(task => `
            <li>
              <span class="calendar-task-type">${esc(task.type)}</span>
              <strong>${esc(task.title)}</strong>
              <small>${esc(task.reason)}</small>
            </li>
          `).join("")}
        </ul>
      </article>
    `).join("");
  }

  function bindInputs() {
    document.querySelectorAll("#farm-form input, #farm-form select, #farm-form textarea").forEach(input => {
      if (input.dataset.calendarDataFixBound === "true") return;
      input.dataset.calendarDataFixBound = "true";
      input.addEventListener("input", renderDataDrivenCalendar);
      input.addEventListener("change", renderDataDrivenCalendar);
    });
  }

  function patchSwitchTab() {
    if (typeof switchAppTab !== "function" || switchAppTab.isCalendarDataFixPatch) return;
    const base = switchAppTab;
    switchAppTab = function (tabName) {
      const result = base(tabName);
      if (tabName === "calendar") setTimeout(renderDataDrivenCalendar, 0);
      return result;
    };
    switchAppTab.isCalendarDataFixPatch = true;
  }

  function install() {
    installStyles();
    bindInputs();
    patchSwitchTab();
    renderDataDrivenCalendar();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", install);
  else install();
  setTimeout(install, 500);
  setTimeout(install, 1400);
  setInterval(() => {
    bindInputs();
    if (byId("calendar-view")?.classList.contains("active")) renderDataDrivenCalendar();
  }, 3000);
}());
