(function () {
  const FIELD_KEY = "agriFieldBoundary";
  const POLYGON_KEY = "agridecisionFieldPolygons";
  const nativeSetItem = Storage.prototype.setItem;
  let lastBoundaryWriteAt = 0;

  function orderPoints(points) {
    const cleaned = Array.isArray(points)
      ? points
        .map(point => ({ lat: Number(point.lat), lng: Number(point.lng) }))
        .filter(point => Number.isFinite(point.lat) && Number.isFinite(point.lng))
      : [];
    if (cleaned.length < 3) return cleaned;
    const center = cleaned.reduce((sum, point) => ({
      lat: sum.lat + point.lat / cleaned.length,
      lng: sum.lng + point.lng / cleaned.length
    }), { lat: 0, lng: 0 });
    return cleaned.sort((a, b) =>
      Math.atan2(a.lat - center.lat, a.lng - center.lng) -
      Math.atan2(b.lat - center.lat, b.lng - center.lng)
    );
  }

  Storage.prototype.setItem = function (key, value) {
    if (key === FIELD_KEY) {
      try {
        const points = orderPoints(JSON.parse(value));
        const current = orderPoints(JSON.parse(this.getItem(FIELD_KEY) || "[]"));
        const now = Date.now();
        const duplicateMapHandler = now - lastBoundaryWriteAt < 40 && points.length === current.length + 1;
        if (duplicateMapHandler) return;
        lastBoundaryWriteAt = now;
        value = JSON.stringify(points);
      } catch {}
    }
    if (key === POLYGON_KEY) {
      try {
        const fields = JSON.parse(value);
        if (Array.isArray(fields)) {
          value = JSON.stringify(fields.map(field => ({
            ...field,
            points: orderPoints(field?.points)
          })));
        }
      } catch {}
    }
    return nativeSetItem.call(this, key, value);
  };

  function normalizeSavedPoints() {
    [FIELD_KEY, POLYGON_KEY].forEach(key => {
      const value = localStorage.getItem(key);
      if (value) localStorage.setItem(key, value);
    });
  }

  function fixCreatorPhotos() {
    document.querySelectorAll(".creator-profile").forEach(profile => {
      const name = profile.querySelector("h4")?.textContent?.trim();
      const photo = profile.querySelector(".creator-photo");
      if (!photo || !name) return;
      const source = name === "Jose Mercado"
        ? "/assets/creators/jose-mercado-v2.webp"
        : name === "Avery Weddle"
          ? "/assets/creators/avery-weddle-v2.webp"
          : "";
      if (source) {
        const image = photo.querySelector("img") || document.createElement("img");
        image.src = source;
        image.alt = name;
        image.loading = "eager";
        image.decoding = "sync";
        if (!image.isConnected) photo.appendChild(image);
      }
    });
  }

  normalizeSavedPoints();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fixCreatorPhotos, { once: true });
  } else {
    fixCreatorPhotos();
  }
}());
