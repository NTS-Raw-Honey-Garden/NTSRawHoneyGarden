/* =====================================================================
   catalog.js — reads config/products.js and draws the product blocks.
   Also holds the pricing helpers used by the order page.
   ===================================================================== */
(function () {
  "use strict";
  var C = window.SITE_CONFIG || {};
  var DATA = window.HONEY_PRODUCTS || {};
  var esc = window.escapeHtml;
  var LOW_STOCK = 5;

  var Catalog = {
    all: function () {
      return (DATA.products || []).filter(function (p) { return p.available !== false; });
    },
    requests: function () {
      return (DATA.requestItems || []).filter(function (p) { return p.available !== false; });
    },
    soon: function () {
      return (DATA.comingSoon || []).filter(function (p) { return p.available !== false; });
    },
    find: function (id) {
      return Catalog.all().filter(function (p) { return p.id === id; })[0] || null;
    },
    findRequest: function (id) {
      return Catalog.requests().filter(function (p) { return p.id === id; })[0] || null;
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
      if (!size || !(size.stock > 0)) return { cls: "out", text: "Sold out — back next season" };
      if (size.stock <= LOW_STOCK) return { cls: "low", text: "Only " + size.stock + " left" };
      return { cls: "", text: "In stock · " + size.stock + " available" };
    },
    /* Delivery fee rule (mirrored on the server, which has the final say). */
    delivery: function (subtotal) {
      if (!subtotal) return 0;
      if (C.freeDeliveryAbove && subtotal >= C.freeDeliveryAbove) return 0;
      return Number(C.deliveryFee || 0);
    },
    /* Wraps Malayalam characters so they get the right font. */
    script: function (name) {
      return esc(name).replace(/[ഀ-ൿ][ഀ-ൿ\s]*/g, function (m) {
        return '<span class="mal">' + m + "</span>";
      });
    }
  };
  window.Catalog = Catalog;

  var leafIcon = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 19c0-8 5-14 15-14 0 10-6 15-14 15"/><path d="M5 19l8-8"/></svg>';

  /* ---------- Orderable product card ---------- */
  function card(p, idx) {
    var first = Catalog.firstInStock(p);
    /* Use the size-specific image if provided, else fall back to the product image. */
    var firstImg = (first.image || p.image);
    var chips = p.sizes.map(function (s, i) {
      var id = "sz-" + p.id + "-" + i;
      /* Embed the per-size image path as a data attribute so the JS can swap it. */
      var imgAttr = s.image ? ' data-img="' + esc(s.image) + '"' : "";
      return '<label class="size-chip" for="' + id + '"><input type="radio" id="' + id + '" name="size-' + esc(p.id) + '" value="' + esc(s.label) + '"' +
        (s === first ? " checked" : "") + (s.stock > 0 ? "" : " disabled") + imgAttr + '><span>' + esc(s.label) + "</span></label>";
    }).join("");
    var st = Catalog.stockText(first);
    var soldOut = Catalog.isSoldOut(p);
    return '<article class="product-card reveal reveal-delay-' + (idx % 3) + '" data-id="' + esc(p.id) + '">' +
      '<div class="product-media">' + (p.badge ? '<span class="product-badge">' + esc(p.badge) + "</span>" : "") +
      '<img src="' + esc(firstImg) + '" alt="' + esc(p.englishName || p.name) + ' jar" loading="lazy" width="400" height="600" data-product-img></div>' +
      '<div class="product-body">' +
      '<div class="product-variety">' + esc(p.variety) + "</div>" +
      "<h3>" + Catalog.script(p.name) + "</h3>" +
      '<p class="product-tagline">' + esc(p.tagline) + "</p>" +
      '<p class="product-desc">' + esc(p.description) + "</p>" +
      '<p class="product-source">' + leafIcon + "<span><strong>Source:</strong> " + esc(p.source) + "</span></p>" +
      '<fieldset class="size-options"><legend>Choose size</legend>' + chips + "</fieldset>" +
      '<div class="product-foot"><div><div class="price" data-price>' + Catalog.money(first.price) + "</div>" +
      '<div class="stock-note ' + st.cls + '" data-stock>' + st.text + "</div></div>" +
      '<a class="btn btn-primary btn-small" data-order href="order.html?product=' + encodeURIComponent(p.id) + "&size=" + encodeURIComponent(first.label) + '"' +
      (soldOut ? ' aria-disabled="true" style="pointer-events:none;opacity:.5"' : "") + ">" + (soldOut ? "Sold out" : "Order now") + "</a></div>" +
      "</div></article>";
  }

  /* ---------- Request-only card ---------- */
  function requestCard(p, idx) {
    return '<article class="request-card reveal reveal-delay-' + (idx % 3) + '">' +
      '<div class="product-media"><img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy" width="400" height="600"></div>' +
      '<div class="product-body">' +
      (p.note ? '<span class="request-note">' + esc(p.note) + "</span>" : "") +
      "<h3>" + Catalog.script(p.name) + "</h3>" +
      '<p class="product-tagline">' + esc(p.tagline) + "</p>" +
      '<p class="product-desc">' + esc(p.description) + "</p>" +
      '<a class="btn btn-ghost btn-small" href="order.html?request=' + encodeURIComponent(p.id) + '">Request this <span class="arrow" aria-hidden="true">→</span></a>' +
      "</div></article>";
  }

  /* ---------- Coming soon ---------- */
  function soonCard(p) {
    return '<div class="coming-soon reveal">' +
      '<img src="' + esc(p.image) + '" alt="' + esc(p.name) + '" loading="lazy">' +
      '<div><span class="tag">Coming soon</span><h3>' + esc(p.name) + "</h3><p>" + esc(p.description) + "</p></div></div>";
  }

  function bind(root) {
    root.querySelectorAll(".product-card").forEach(function (el) {
      var p = Catalog.find(el.getAttribute("data-id"));
      if (!p) return;
      el.addEventListener("change", function (e) {
        if (!e.target.matches('input[type="radio"]')) return;
        var s = Catalog.size(p, e.target.value);
        var st = Catalog.stockText(s);
        el.querySelector("[data-price]").textContent = Catalog.money(s.price);
        var stock = el.querySelector("[data-stock]");
        stock.textContent = st.text; stock.className = "stock-note " + st.cls;
        el.querySelector("[data-order]").href = "order.html?product=" + encodeURIComponent(p.id) + "&size=" + encodeURIComponent(s.label);
        /* Swap product image if this size has its own image. */
        var newImg = e.target.getAttribute("data-img") || p.image;
        var imgEl = el.querySelector("[data-product-img]");
        if (imgEl && newImg && imgEl.getAttribute("src") !== newImg) {
          imgEl.style.opacity = "0";
          imgEl.src = newImg;
          imgEl.onload = function () { imgEl.style.opacity = "1"; };
          imgEl.onerror = function () { imgEl.style.opacity = "1"; }; /* show broken img rather than hide */
        }
      });
      /* Fire change once for the pre-checked size so the correct image loads on page open. */
      var checked = el.querySelector('input[type="radio"]:checked');
      if (checked) {
        setTimeout(function () {
          checked.dispatchEvent(new Event("change", { bubbles: true }));
        }, 0);
      }
    });
    root.querySelectorAll(".reveal").forEach(function (el) { if (window.observeReveal) window.observeReveal(el); });
  }

  /* Render into any element carrying one of these attributes. */
  document.querySelectorAll("[data-products]").forEach(function (root) {
    var limit = root.getAttribute("data-products");
    var list = Catalog.all();
    if (limit !== "all") list = list.slice(0, parseInt(limit, 10) || 3);
    root.innerHTML = list.length ? list.map(card).join("") : "<p>New harvest coming soon — check back shortly.</p>";
    bind(root);
  });
  document.querySelectorAll("[data-request-items]").forEach(function (root) {
    root.innerHTML = Catalog.requests().map(requestCard).join("");
    bind(root);
  });
  document.querySelectorAll("[data-coming-soon]").forEach(function (root) {
    var list = Catalog.soon();
    if (!list.length) { root.hidden = true; return; }
    root.innerHTML = list.map(soonCard).join("");
    bind(root);
  });

  /* SEO: structured data for the orderable products. */
  if (document.querySelector("[data-products]")) {
    var ld = {
      "@context": "https://schema.org",
      "@graph": Catalog.all().map(function (p) {
        return {
          "@type": "Product", name: (p.englishName || p.name), description: p.description, category: p.variety,
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
