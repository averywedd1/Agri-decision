(function () {
  function run() {
    if (document.getElementById("mobile-scroll-fix-style")) return;
    const style = document.createElement("style");
    style.id = "mobile-scroll-fix-style";
    style.textContent = `
      @media (max-width: 760px) {
        html { scroll-behavior: auto !important; }
        body { overflow-x: hidden; -webkit-overflow-scrolling: touch; }
        .topbar {
          position: sticky !important;
          top: 0 !important;
          inset: auto 0 auto 0 !important;
          background: #faf8f3 !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        .hero { padding-top: 56px !important; }
        .site-menu[open] .menu-panel {
          position: fixed !important;
          top: 66px !important;
          right: 12px !important;
          left: auto !important;
          max-height: calc(100dvh - 84px);
          overflow: auto;
          overscroll-behavior: contain;
          -webkit-overflow-scrolling: touch;
        }
        .table-shell {
          overscroll-behavior-x: contain;
          -webkit-overflow-scrolling: touch;
        }
      }
    `;
    document.head.appendChild(style);

    if (!window.__agriMobileScrollToFixed) {
      const nativeScrollTo = window.scrollTo.bind(window);
      window.scrollTo = function patchedScrollTo(first, second) {
        if (
          window.matchMedia("(max-width: 760px)").matches &&
          first &&
          typeof first === "object" &&
          first.behavior === "smooth"
        ) {
          return nativeScrollTo({ ...first, behavior: "auto" });
        }
        return nativeScrollTo(first, second);
      };
      window.__agriMobileScrollToFixed = true;
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", run, { once: true });
  else run();
}());
