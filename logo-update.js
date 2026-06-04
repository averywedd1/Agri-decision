(function () {
  function installLogoUpdateStyles() {
    if (document.getElementById("agri-concept-logo-style")) return;
    const style = document.createElement("style");
    style.id = "agri-concept-logo-style";
    style.textContent = `
      .brand.agri-logo-brand {
        display: inline-flex;
        align-items: center;
        min-width: 0;
        gap: 0;
        text-decoration: none;
      }
      .agri-brand-lockup {
        display: block;
        width: 226px;
        height: 48px;
        object-fit: contain;
        object-position: left center;
      }
      @media (max-width: 640px) {
        .agri-brand-lockup {
          width: 176px;
          height: 40px;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function installFavicon() {
    document.querySelectorAll('link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]').forEach(link => link.remove());
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.type = "image/svg+xml";
    icon.href = "/agridecision_icon.svg?v=5";
    document.head.appendChild(icon);
    const apple = document.createElement("link");
    apple.rel = "apple-touch-icon";
    apple.href = "/agridecision_icon.svg?v=5";
    document.head.appendChild(apple);
  }

  function applyLogo() {
    const brand = document.querySelector(".brand");
    if (!brand) return;
    installLogoUpdateStyles();
    installFavicon();
    brand.classList.add("agri-logo-brand");
    brand.innerHTML = '<img class="agri-brand-lockup" src="/agridecision_logo.svg?v=5" alt="AgriDecision AI">';
    brand.dataset.logoApplied = "concept-d-light-header";
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyLogo);
  } else {
    applyLogo();
  }

  setTimeout(applyLogo, 300);
  setTimeout(applyLogo, 1200);
}());
