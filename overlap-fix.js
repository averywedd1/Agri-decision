(function () {
  function cleanupDuplicateUnits() {
    document.querySelectorAll(".field-unit-chip").forEach(chip => {
      if (chip.parentElement?.querySelector(".unit-label")) chip.remove();
    });
    document.querySelectorAll("label").forEach(label => {
      const units = Array.from(label.querySelectorAll(".unit-label, .field-unit-chip"));
      units.slice(1).forEach(unit => unit.remove());
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

  function installStyles() {
    if (document.getElementById("overlap-fix-style")) return;
    const style = document.createElement("style");
    style.id = "overlap-fix-style";
    style.textContent = `
      label .unit-label ~ .field-unit-chip,
      label .field-unit-chip ~ .unit-label,
      label .unit-label ~ .unit-label,
      label .field-unit-chip ~ .field-unit-chip {
        display: none !important;
      }
      .hero h1 {
        min-height: 2.25em;
      }
    `;
    document.head.appendChild(style);
  }

  function run() {
    installStyles();
    cleanupDuplicateUnits();
    cleanupDuplicateBlocks();
    stabilizeHero();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run);
  else run();
  setTimeout(run, 250);
  setTimeout(run, 1000);
  setInterval(run, 3000);
}());
