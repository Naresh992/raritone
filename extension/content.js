/* Raritone content script — hover any sizable product image, get a "Try On" pill.
 * Clicking opens the Raritone Live Studio with that image as the garment.
 * Runs in an isolated world: only image URLs + coarse dimensions leave the page,
 * never page content, form data or cookies.
 */
(function () {
  if (window.__raritone_injected) return;
  window.__raritone_injected = true;

  const MIN = 140;        // min displayed size (CSS px) — skip icons/thumbnails
  const MIN_INTRINSIC = 200; // min natural size when known — skip logos/spacers
  const BAD_URL = /(logo|favicon|sprite|placeholder|transparent|spacer|blank\.gif|tracking|pixel|avatar|icon-)/i;
  const BAD_ALT = /\b(logo|icon|sprite|avatar|favicon|emoji|badge)\b/i;

  let pill = null;
  let current = null;

  function track(name, props) {
    try {
      chrome.runtime.sendMessage({ type: "RARITONE_TRACK", name, props });
    } catch { /* ignore — analytics must never break the pill */ }
  }

  function ensurePill() {
    if (pill) return pill;
    pill = document.createElement("button");
    pill.textContent = "✨ Try On";
    pill.setAttribute("type", "button");
    Object.assign(pill.style, {
      position: "fixed",
      zIndex: "2147483647",
      padding: "6px 12px",
      fontSize: "12px",
      fontWeight: "600",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      background: "#111111",
      color: "#ffffff",
      border: "none",
      borderRadius: "999px",
      cursor: "pointer",
      display: "none",
      boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
      fontFamily: "system-ui, sans-serif",
    });
    pill.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (!current) return;
      track("extension_pill_click", {
        src: window.location.hostname,
        width: Math.round(current.w || 0),
        height: Math.round(current.h || 0),
      });
      chrome.runtime.sendMessage(
        { type: "RARITONE_OPEN_LIVE", imageUrl: current.src, source: window.location.hostname },
        () => hide()
      );
    });
    document.documentElement.appendChild(pill);
    return pill;
  }

  function pickImg(el) {
    if (el === pill || (pill && pill.contains && pill.contains(el))) return null;
    const img = el && el.closest ? el.closest("img") || (el.tagName === "IMG" ? el : null) : null;
    if (!img) return null;
    const r = img.getBoundingClientRect();
    if (r.width < MIN || r.height < MIN) return null;
    // intrinsic (natural) size — once loaded, reject tiny sources (logos, spacers)
    if (img.naturalWidth > 0 && img.naturalHeight > 0 &&
        img.naturalWidth < MIN_INTRINSIC && img.naturalHeight < MIN_INTRINSIC) {
      return null;
    }
    if (img.alt && BAD_ALT.test(img.alt)) return null;
    // currentSrc respects <picture>/srcset picks (gallery/carousel friendly)
    let src = img.currentSrc || img.src;
    if (!src || src.startsWith("data:") || src.startsWith("blob:")) return null;
    try {
      const u = new URL(src, window.location.href);
      if (u.protocol !== "https:" && u.protocol !== "http:") return null;
      if (BAD_URL.test(u.pathname)) return null;
      return { src: u.href, rect: r, w: img.naturalWidth || r.width, h: img.naturalHeight || r.height };
    } catch {
      return null;
    }
  }

  function hide() {
    if (pill) pill.style.display = "none";
    current = null;
  }

  document.addEventListener(
    "mousemove",
    (e) => {
      if (e.target === pill) return; // don't flicker over the pill itself
      const found = pickImg(e.target);
      const p = ensurePill();
      if (!found) return hide();
      current = found;
      p.style.display = "block";
      // rect is viewport-relative; pill is fixed → use client coords
      p.style.left = `${Math.min(window.innerWidth - 110, Math.max(8, found.rect.left + 8))}px`;
      p.style.top = `${Math.max(8, found.rect.top + 8)}px`;
    },
    { passive: true }
  );
  document.addEventListener("scroll", hide, { passive: true, capture: true });
  document.addEventListener("mouseleave", hide);
})();
