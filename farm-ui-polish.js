(function () {
  const TREND_KEY = "agridecisionCmeTrendHistory";
  const CURRENT_CLASS = "current-section";
  const $ = id => document.getElementById(id);
  const num = id => {
    const el = $(id);
    if (!el || el.value === "") return null;
    const value = Number(el.value);
    return Number.isFinite(value) ? value : null;
  };

  function style() {
    if ($("farm-ui-polish-style")) return;
    const tag = document.createElement("style");
    tag.id = "farm-ui-polish-style";
    tag.textContent = `
      .workspace-tab{position:relative;transition:background-color .18s,color .18s,border-color .18s}
      .workspace-tab.current-section:not(.active){color:var(--green-800);background:var(--green-50)}
      .workspace-tab.current-section:after,.workspace-tab.active:after{content:"";position:absolute;left:14px;right:14px;bottom:5px;height:2px;border-radius:999px;background:currentColor;opacity:.72}
      .privacy-note{display:grid;gap:4px;margin:-6px 0 22px;padding:13px 15px;border:1px solid rgba(45,102,40,.2);border-left:4px solid var(--green-600);border-radius:10px;background:var(--green-50);color:var(--muted);font-size:13px}
      .privacy-note strong{color:var(--green-800)}
      .field-helper,.revenue-calc-note{display:block;margin-top:2px;color:var(--muted);font-size:11px;font-weight:500;line-height:1.35}
      #total-revenue.calculated-field{background:#f7faf5;border-color:rgba(45,102,40,.28);color:var(--green-900);font-weight:700}
      #total-revenue.calculated-field::placeholder{color:#788675}
      .cme-trend-cell{min-width:116px;vertical-align:middle}
      .cme-trend{display:inline-grid;gap:2px;min-width:96px}
      .mini-sparkline{display:block;width:96px;height:28px;overflow:visible}
      .mini-sparkline path{fill:none;stroke:var(--green-600);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
      .mini-sparkline.down path{stroke:#b84a3a}
      .mini-sparkline .baseline{stroke:rgba(26,51,24,.14);stroke-width:1}
      .trend-caption{color:var(--muted);font-size:10px;white-space:nowrap}
    `;
    document.head.appendChild(tag);
  }

  function activeTab() {
    return String(document.querySelector(".app-view.active")?.id || "workspace-view").replace("-view", "") || "workspace";
  }

  function updateNav() {
    const tab = activeTab();
    document.querySelectorAll(".workspace-tab[data-app-tab]").forEach(button => {
      button.classList.toggle(CURRENT_CLASS, button.dataset.appTab === tab);
    });
  }

  function nav() {
    updateNav();
    document.addEventListener("click", event => {
      if (event.target.closest?.(".workspace-tab[data-app-tab]")) setTimeout(updateNav, 0);
    });
    window.addEventListener("scroll", () => requestAnimationFrame(updateNav), { passive: true });
    if (typeof window.switchAppTab === "function" && !window.switchAppTab.__farmUiPolishWrapped) {
      const original = window.switchAppTab;
      window.switchAppTab = function () {
        const result = original.apply(this, arguments);
        setTimeout(updateNav, 0);
        return result;
      };
      window.switchAppTab.__farmUiPolishWrapped = true;
    }
    const observer = new MutationObserver(updateNav);
    document.querySelectorAll(".app-view").forEach(view => observer.observe(view, { attributes: true, attributeFilter: ["class"] }));
  }

  function privacy() {
    const form = $("farm-form");
    if (!form || $("farm-privacy-note")) return;
    const note = document.createElement("div");
    note.id = "farm-privacy-note";
    note.className = "privacy-note";
    note.innerHTML = "<strong>Your farm data stays private.</strong><span>Signed-in projects sync to your account. If you are not signed in, this form stays saved only in this browser.</span>";
    form.parentNode.insertBefore(note, form);
  }

  function formGuidance() {
    const type = $("farm-type");
    if (type) ["Swine / Poultry", "Vegetables / Produce", "Other"].forEach(label => {
      if (!Array.from(type.options).some(option => option.textContent.trim().toLowerCase() === label.toLowerCase())) type.append(new Option(label, label));
    });
    [
      ["yield", "e.g. 185 bu/acre or 6 tons/acre", "Use the unit that matches your main commodity, such as bushels per acre, tons per acre, or cwt."],
      ["price", "e.g. 4.72 per bu or 18.50 per cwt", ""],
      ["secondary-rev", "e.g. custom hire income, livestock, carbon credits", "Include meaningful side income tied to the farm operation."],
      ["other-income", "e.g. patronage, insurance proceeds, grants", ""],
      ["total-revenue", "Calculated automatically", "Calculated as acres x yield x price, plus secondary revenue and other income."]
    ].forEach(([id, placeholder, help]) => {
      const input = $(id);
      if (!input) return;
      input.placeholder = placeholder;
      if (!help || input.closest("label")?.querySelector(`[data-helper-for="${id}"]`)) return;
      const helper = document.createElement("span");
      helper.className = id === "total-revenue" ? "revenue-calc-note" : "field-helper";
      helper.dataset.helperFor = id;
      helper.textContent = help;
      input.closest("label").appendChild(helper);
    });
  }

  let calculating = false;
  function calcRevenue() {
    if (calculating) return;
    const total = $("total-revenue");
    if (!total) return;
    total.readOnly = true;
    total.classList.add("calculated-field");
    total.setAttribute("aria-readonly", "true");
    const acres = num("total-acres");
    const yieldValue = num("yield");
    const price = num("price");
    const secondary = num("secondary-rev");
    const other = num("other-income");
    const hasPrimary = acres !== null && yieldValue !== null && price !== null;
    if (!hasPrimary && secondary === null && other === null) return;
    const nextValue = (hasPrimary ? acres * yieldValue * price : 0) + (secondary || 0) + (other || 0);
    const next = nextValue ? String(Math.round(nextValue)) : "";
    if (total.value === next) return;
    calculating = true;
    total.value = next;
    total.dispatchEvent(new Event("input", { bubbles: true }));
    total.dispatchEvent(new Event("change", { bubbles: true }));
    calculating = false;
  }

  function revenue() {
    ["total-acres", "yield", "price", "secondary-rev", "other-income"].forEach(id => {
      const input = $(id);
      if (!input || input.dataset.revenueCalcBound) return;
      input.dataset.revenueCalcBound = "true";
      input.addEventListener("input", calcRevenue);
      input.addEventListener("change", calcRevenue);
    });
    if (typeof window.setFormData === "function" && !window.setFormData.__farmUiRevenueWrapped) {
      const original = window.setFormData;
      window.setFormData = function () {
        const result = original.apply(this, arguments);
        setTimeout(calcRevenue, 0);
        return result;
      };
      window.setFormData.__farmUiRevenueWrapped = true;
    }
    setTimeout(calcRevenue, 0);
  }

  const parsePrice = value => {
    const match = String(value || "").replace(/,/g, "").match(/-?\d+(?:\.\d+)?/);
    const parsed = match ? Number(match[0]) : NaN;
    return Number.isFinite(parsed) ? parsed : null;
  };

  function trendHistory() {
    try { return JSON.parse(localStorage.getItem(TREND_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function points(key, current, changeText, history) {
    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const existing = Array.isArray(history[key]) ? history[key].filter(point => point && point.t >= cutoff && Number.isFinite(point.v)) : [];
    const last = existing[existing.length - 1];
    if (current !== null && (!last || Math.abs(last.v - current) > 0.0001 || Date.now() - last.t > 55 * 60 * 1000)) existing.push({ t: Date.now(), v: current });
    history[key] = existing.slice(-90);
    const values = history[key].map(point => point.v);
    const change = parsePrice(changeText);
    if (values.length >= 2) return values;
    if (current === null) return [];
    if (!change) return [current, current, current];
    return [current - change, current - change / 2, current];
  }

  function spark(values) {
    if (!values.length) return '<span class="trend-caption">Not enough data</span>';
    const width = 96;
    const height = 28;
    const min = Math.min(...values);
    const spread = Math.max(...values) - min || 1;
    const step = values.length > 1 ? width / (values.length - 1) : width;
    const coords = values.map((value, index) => `${Math.round(index * step * 100) / 100},${Math.round((height - 4 - ((value - min) / spread) * (height - 8)) * 100) / 100}`);
    const direction = values[values.length - 1] < values[0] ? "down" : "up";
    return `<span class="cme-trend" title="Recent trend from saved quotes and the latest market change"><svg class="mini-sparkline ${direction}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Recent price trend"><line class="baseline" x1="0" y1="${height - 4}" x2="${width}" y2="${height - 4}"></line><path d="M ${coords.join(" L ")}"></path></svg><span class="trend-caption">Recent trend</span></span>`;
  }

  function trendHeader(table) {
    const row = table?.querySelector("thead tr");
    if (!row) return -1;
    const headers = Array.from(row.children);
    const existing = headers.findIndex(th => /trend/i.test(th.textContent || ""));
    if (existing >= 0) return existing;
    const price = headers.findIndex(th => /^price$/i.test((th.textContent || "").trim()));
    const after = price >= 0 ? price : Math.min(3, headers.length - 1);
    const th = document.createElement("th");
    th.textContent = "30-day trend";
    row.insertBefore(th, headers[after + 1] || null);
    return after + 1;
  }

  function decorateTrends() {
    const body = $("futures-body");
    const table = body?.closest("table");
    const index = trendHeader(table);
    if (!body || index < 0) return;
    const history = trendHistory();
    let changed = false;
    body.querySelectorAll("tr").forEach(row => {
      const span = row.querySelector("td[colspan]");
      if (span) {
        span.setAttribute("colspan", String(Math.max(Number(span.getAttribute("colspan") || "12"), 13)));
        return;
      }
      let cells = Array.from(row.children);
      let trend = row.querySelector(".cme-trend-cell");
      if (!trend) {
        trend = document.createElement("td");
        trend.className = "cme-trend-cell";
        row.insertBefore(trend, cells[index] || null);
        cells = Array.from(row.children);
      }
      const raw = cells.filter(cell => !cell.classList.contains("cme-trend-cell"));
      const key = `${raw[1]?.textContent?.trim() || raw[0]?.textContent?.trim() || "Commodity"}|${raw[2]?.textContent?.trim() || ""}`;
      trend.innerHTML = spark(points(key, parsePrice(raw[3]?.textContent), raw[8]?.textContent || "", history));
      changed = true;
    });
    if (changed) {
      try { localStorage.setItem(TREND_KEY, JSON.stringify(history)); } catch {}
    }
  }

  function cmeTrends() {
    if (typeof window.loadFutures === "function" && !window.loadFutures.__farmUiTrendWrapped) {
      const original = window.loadFutures;
      window.loadFutures = async function () {
        const result = await original.apply(this, arguments);
        setTimeout(decorateTrends, 0);
        return result;
      };
      window.loadFutures.__farmUiTrendWrapped = true;
    }
    setTimeout(decorateTrends, 250);
    setInterval(decorateTrends, 5000);
  }

  function init() {
    style();
    nav();
    privacy();
    formGuidance();
    revenue();
    cmeTrends();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
}());
