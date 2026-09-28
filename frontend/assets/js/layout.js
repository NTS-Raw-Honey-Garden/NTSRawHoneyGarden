/* =====================================================================
   layout.js — shared header, footer, navigation and small effects.
   The header and footer are built here once, so every page stays in
   sync. Farm name, phone, email etc. come from config/site-config.js.
   ===================================================================== */
(function () {
  "use strict";
  var C = window.SITE_CONFIG || {};
  document.documentElement.classList.remove("no-js");

  var NAV = [
    { href: "index.html", label: "Home" },
    { href: "about.html", label: "Our Farm" },
    { href: "products.html", label: "Our Honey" },
    { href: "harvest.html", label: "How We Harvest" }
  ];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  window.escapeHtml = esc;

  var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (page === "") page = "index.html";

  var brandHtml =
    '<a class="brand" href="index.html" aria-label="' + esc(C.farmName) + ' – home">' +
    '<img src="assets/images/logo.svg" alt="" width="42" height="42">' +
    '<span class="brand-name">' + esc(C.farmName) + '<small>Est. ' + esc(C.foundedYear) + ' · Raw & Unheated</small></span></a>';

  // ---------- Header ----------
  var header = document.getElementById("site-header");
  if (header) {
    var links = NAV.map(function (n) {
      var cur = n.href === page ? ' aria-current="page"' : "";
      return '<li><a href="' + n.href + '"' + cur + ">" + n.label + "</a></li>";
    }).join("");
    header.className = "site-header";
    header.innerHTML =
      '<div class="wrap header-inner">' + brandHtml +
      '<button class="nav-toggle" aria-expanded="false" aria-controls="main-nav" aria-label="Open menu"><span></span><span></span><span></span></button>' +
      '<nav class="main-nav" id="main-nav" aria-label="Main"><ul>' + links +
      '<li><a class="btn btn-primary" href="order.html">Order Honey</a></li></ul></nav></div>';

    var toggle = header.querySelector(".nav-toggle");
    var nav = header.querySelector(".main-nav");
    toggle.addEventListener("click", function () {
      var open = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!open));
      toggle.setAttribute("aria-label", open ? "Open menu" : "Close menu");
      nav.classList.toggle("open", !open);
    });
    nav.addEventListener("click", function (e) {
      if (e.target.tagName === "A") { nav.classList.remove("open"); toggle.setAttribute("aria-expanded", "false"); }
    });
    var onScroll = function () { header.classList.toggle("scrolled", window.scrollY > 8); };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  // ---------- Footer ----------
  var footer = document.getElementById("site-footer");
  if (footer) {
    var social = ["instagram", "facebook", "youtube"].filter(function (k) { return C[k]; }).map(function (k) {
      return '<li><a href="' + esc(C[k]) + '" target="_blank" rel="noopener">' + k.charAt(0).toUpperCase() + k.slice(1) + "</a></li>";
    }).join("");
    footer.className = "site-footer";
    footer.innerHTML =
      '<div class="wrap"><div class="footer-grid">' +
      '<div class="footer-brand">' + brandHtml +
      "<p>" + esc(C.tagline) + ". Small-batch honey from our own hives in " + esc(C.regionShort) + ", bottled by hand and never heated.</p>" +
      '<p style="font-size:.85rem;opacity:.75">' + esc(C.fssaiLicense) + "</p></div>" +
      '<div><h4>Explore</h4><ul>' + NAV.map(function (n) { return '<li><a href="' + n.href + '">' + n.label + "</a></li>"; }).join("") +
      '<li><a href="order.html">Order / Book</a></li></ul></div>' +
      '<div><h4>Follow</h4><ul>' + (social || "<li>Coming soon</li>") + '<li><a href="privacy.html">Privacy Policy</a></li></ul></div>' +
      '<div><h4>Contact</h4><ul>' +
      '<li><a href="tel:' + esc(String(C.phone).replace(/\s/g, "")) + '">' + esc(C.phone) + "</a></li>" +
      '<li><a href="mailto:' + esc(C.email) + '">' + esc(C.email) + "</a></li>" +
      "<li>" + esc(C.address) + "</li><li>" + esc(C.businessHours) + "</li></ul></div>" +
      "</div>" +
      '<div class="footer-bottom"><span>© ' + new Date().getFullYear() + " " + esc(C.farmName) + ". All rights reserved.</span>" +
      '<span><a href="privacy.html">Privacy</a> · Made with care, one jar at a time.</span></div></div>';
  }

  // ---------- WhatsApp floating button ----------
  if (C.whatsappNumber && page !== "order.html") {
    var wa = document.createElement("a");
    wa.className = "whatsapp-fab";
    wa.href = "https://wa.me/" + encodeURIComponent(C.whatsappNumber) + "?text=" + encodeURIComponent("Hi " + C.farmName + ", I'd like to know more about your honey.");
    wa.target = "_blank"; wa.rel = "noopener";
    wa.setAttribute("aria-label", "Chat with us on WhatsApp");
    wa.innerHTML = '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6.5-.1 1.5-.6 1.7-1.2s.2-1.1.2-1.2-.2-.2-.5-.3z"/></svg>';
    document.body.appendChild(wa);
  }

  // ---------- Fill any element with data-config="key" ----------
  document.querySelectorAll("[data-config]").forEach(function (el) {
    var v = C[el.getAttribute("data-config")];
    if (v != null && v !== "") el.textContent = v;
  });

  // ---------- Reveal-on-scroll ----------
  var items = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
    items.forEach(function (el) { io.observe(el); });
    window.observeReveal = function (el) { io.observe(el); };
  } else {
    items.forEach(function (el) { el.classList.add("in"); });
    window.observeReveal = function (el) { el.classList.add("in"); };
  }

  // ---------- Optional Google Analytics 4 ----------
  if (C.analyticsId && /^G-[A-Z0-9]+$/.test(C.analyticsId)) {
    var s = document.createElement("script");
    s.async = true; s.src = "https://www.googletagmanager.com/gtag/js?id=" + C.analyticsId;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag("js", new Date());
    window.gtag("config", C.analyticsId, { anonymize_ip: true });
  }
  window.trackEvent = function (name, params) { if (window.gtag) window.gtag("event", name, params || {}); };
})();
