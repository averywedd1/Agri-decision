(function () {
  function keepSingleCmeTable() {
    const section = document.getElementById("market-watch-table");
    if (!section) return;

    section.querySelectorAll(".cme-snapshot-panel, .cme-snapshot-shell").forEach(element => element.remove());

    let markers = document.getElementById("cme-snapshot-markers");
    if (!markers) {
      markers = document.createElement("div");
      markers.id = "cme-snapshot-markers";
      markers.hidden = true;
      markers.innerHTML = '<span id="futures-snapshot-body"></span><span id="futures-snapshot-summary"></span>';
      section.appendChild(markers);
    }

    let actions = section.querySelector(".cme-table-actions");
    if (!actions) {
      actions = document.createElement("div");
      actions.className = "cme-table-actions";
      actions.style.cssText = "display:flex;justify-content:flex-end;margin:0 0 14px";
      actions.innerHTML = '<button class="ghost-btn" type="button" id="refresh-futures">Refresh Futures</button>';
      section.insertBefore(actions, section.querySelector(".cme-table-shell"));
    }

    const refresh = actions.querySelector("#refresh-futures");
    if (refresh && refresh.dataset.singleTableBound !== "true") {
      refresh.dataset.singleTableBound = "true";
      refresh.addEventListener("click", () => {
        if (typeof window.loadFutures === "function") window.loadFutures();
      });
    }
  }

  keepSingleCmeTable();
  new MutationObserver(keepSingleCmeTable).observe(document.body, { childList: true, subtree: true });
}());
