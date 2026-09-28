/* =====================================================================
   catalog.js — reads config/products.js and draws product cards.
   Also shared by the order page (pricing helpers live here).
   ===================================================================== */
(function () {
  "use strict";
  var C = window.SITE_CONFIG || {};
  var esc = window.escapeHtml;
  var LOW_STOCK = 5;

  var Catalog = {
    all: function () {
      return ((window.HONEY_PRODUCTS || {}).products || []).filter(function (p) { return p.available !== false; });
    },
    find: function (id) {
      return Catalog.all().filter(function (p) { return p.id === id; })[0] || null;
    },
    size: function (product, label) {
      if (!product) return null;
      return product.sizes.filter(function (s) { return s.label === label; })[0] || null;
    },
    money: function (n) {
      return (C.currency || "₹") + Number(n || 0).toLocaleString("en-IN");
    },
    isSoldOut: function (p) {
      return p.sizes.every(function (s) { return !(s.stock > 0); });
    },
    firstInStock: function (p) {
      return p.sizes.filter(function (s) { return s.stock > 0; })[0] || p.sizes[0];
    },
    stockText: function (size) {
      if (!size || !(size.stock > 0)) return { cls: "out", text: "Sold out — back next harvest" };
      if (size.stock <= LOW_STOCK) return { cls: "low", text: "Only " + size.stock + " left" };
      return { cls: "", text: "In stock · " + size.stock + " available" };
    },
    /* Delivery fee rule (mirrored on the server, which has the final say). */
    delivery: function (subtotal) {
      if (!subtotal) return 0;
      if (C.freeDeliveryAbove && subtotal >= C.freeDeliveryAbove) return 0;
      return Number(C.deliveryFee || 0);
    }
  };
  window.Catalog = Catalog;

  var leafIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l8-8"/></svg>';

  function card(p, idx) {
    var first = Catalog.firstInStock(p);
    var chips = p.sizes.map(function (s, i) {
      var id = "sz-" + p.id + "-" + i;
      return '<label class="size-chip" for="' + id + '"><input type="radio" id="' + id + '" name="size-' + esc(p.id) + '" value="' + esc(s.label) + '"' +
        (s === first ? " checked" : "") + (s.stock > 0 ? "" : " disabled") + '><span>' + esc(s.label) + "</span></label>";
    }).join("");
    var st = Catalog.stockText(first);
    var soldOut = Catalog.isSoldOut(p);
    return '<article class="product-card reveal reveal-delay-' + (idx % 3) + '" data-id="' + esc(p.id) + '">' +
      '<div class="product-media">' + (p.badge ? '<span class="product-badge">' + esc(p.badge) + "</span>" : "") +
      '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + ' jar" loading="lazy" width="400" height="480"></div>' +
      '<div class="product-body">' +
      '<div class="product-variety">' + esc(p.variety) + "</div>" +
      "<h3>" + esc(p.name) + "</h3>" +
      '<p class="product-tagline">' + esc(p.tagline) + "</p>" +
      '<p class="product-desc">' + esc(p.description) + "</p>" +
      '<p class="product-source">' + leafIcon + "<span><strong>Source:</strong> " + esc(p.source) + "</span></p>" +
      '<fieldset class="size-options"><legend>Choose size</legend>' + chips + "</fieldset>" +
      '<div class="product-foot"><div><div class="price" data-price>' + Catalog.money(first.price) + "</div>" +
      '<div class="stock-note ' + st.cls + '" data-stock>' + st.text + "</div></div>" +
      '<a class="btn btn-primary btn-small" data-order href="order.html?product=' + encodeURIComponent(p.id) + "&size=" + encodeURIComponent(first.label) + '"' +
      (soldOut ? ' aria-disabled="true" style="pointer-events:none;opacity:.5"' : "") + ">" + (soldOut ? "Sold out" : "Book / Order") + "</a></div>" +
      "</div></article>";
  }

  function bind(root) {
    root.querySelectorAll(".product-card").forEach(function (el) {
      var p = Catalog.find(el.getAttribute("data-id"));
      el.addEventListener("change", function (e) {
        if (!e.target.matches('input[type="radio"]')) return;
        var s = Catalog.size(p, e.target.value);
        var st = Catalog.stockText(s);
        el.querySelector("[data-price]").textContent = Catalog.money(s.price);
        var stock = el.querySelector("[data-stock]");
        stock.textContent = st.text; stock.className = "stock-note " + st.cls;
        el.querySelector("[data-order]").href = "order.html?product=" + encodeURIComponent(p.id) + "&size=" + encodeURIComponent(s.label);
      });
    });
    root.querySelectorAll(".reveal").forEach(function (el) { if (window.observeReveal) window.observeReveal(el); });
  }

  /* Any element with data-products="all" or data-products="3" gets cards. */
  document.querySelectorAll("[data-products]").forEach(function (root) {
    var limit = root.getAttribute("data-products");
    var list = Catalog.all();
    if (limit !== "all") list = list.slice(0, parseInt(limit, 10) || 3);
    root.innerHTML = list.length ? list.map(card).join("") : "<p>New harvest coming soon — check back shortly.</p>";
    bind(root);
  });

  /* SEO: structured data for products (helps Google show prices). */
  if (document.querySelector('[data-products="all"]')) {
    var ld = {
      "@context": "https://schema.org",
      "@graph": Catalog.all().map(function (p) {
        return {
          "@type": "Product", name: p.name, description: p.description, category: p.variety,
          image: (C.siteUrl || "") + "/" + p.image,
          brand: { "@type": "Brand", name: C.farmName },
          offers: p.sizes.map(function (s) {
            return { "@type": "Offer", name: s.label, price: s.price, priceCurrency: "INR",
              availability: s.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock" };
          })
        };
      })
    };
    var tag = document.createElement("script");
    tag.type = "application/ld+json"; tag.textContent = JSON.stringify(ld);
    document.head.appendChild(tag);
  }
})();
