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
    /* ---------- Delivery: total weight × distance zone ----------
       Mirrored in the Apps Script backend, which has the final say. */

    /* Weight of one bottle in grams. Reads site-config, then falls back to
       reading the label itself ("500 g", "1 kg") so a new size still works. */
    grams: function (sizeLabel) {
      var p = C.deliveryPricing || {};
      var w = (p.sizeWeights || {})[sizeLabel];
      if (w != null) return Number(w) || 0;
      var m = String(sizeLabel || "").match(/([\d.]+)\s*(kg|g)\b/i);
      if (!m) return 0;
      return Math.round(parseFloat(m[1]) * (m[2].toLowerCase() === "kg" ? 1000 : 1));
    },

    /* Longest matching PIN prefix wins, so "6915" (local) beats "691" (near).
       Returns null until the PIN is a full 6 digits, so the summary can say
       "Enter PIN code" rather than quoting a wrong price. */
    zoneFor: function (pincode) {
      var pin = String(pincode || "").replace(/\D/g, "");
      if (pin.length !== 6) return null;
      var p = C.deliveryPricing || {};
      var best = null, bestLen = -1;
      (p.zones || []).forEach(function (z) {
        (z.prefixes || []).forEach(function (pre) {
          if (pin.indexOf(pre) === 0 && pre.length > bestLen) { best = z.zone; bestLen = pre.length; }
        });
      });
      return best || p.defaultZone || "mid";
    },

    zoneLabel: function (zone) {
      var p = C.deliveryPricing || {};
      var hit = (p.zones || []).filter(function (z) { return z.zone === zone; })[0];
      if (hit) return hit.label || zone;
      return p.defaultZoneLabel || zone;
    },

    /* A town-specific offer, e.g. 50% off to Bengaluru and Tirupati. */
    offerFor: function (pincode) {
      var pin = String(pincode || "").replace(/\D/g, "");
      if (pin.length !== 6) return null;
      var p = C.deliveryPricing || {};
      var best = null, bestLen = -1;
      (p.offers || []).forEach(function (o) {
        (o.prefixes || []).forEach(function (pre) {
          if (pin.indexOf(pre) === 0 && pre.length > bestLen) { best = o; bestLen = pre.length; }
        });
      });
      return best;
    },

    /* The full delivery working-out, so the summary can SHOW the discounts
       instead of quietly applying them. Returns null while the PIN is short.
       Order: base rate → town offer → large-order discount.
         { fee, base, saved, zone, lines: [{label, off}] } */
    deliveryDetail: function (subtotal, totalGrams, pincode) {
      var empty = { fee: 0, base: 0, saved: 0, zone: null, lines: [] };
      if (!subtotal) return empty;

      var p = C.deliveryPricing || {};
      var zone = this.zoneFor(pincode);
      if (!zone) return null;

      var rows = p.rates || [], row = null;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].maxGrams == null || totalGrams <= rows[i].maxGrams) { row = rows[i]; break; }
      }
      if (!row) return empty;

      var base = Number(row[zone] || 0);
      var fee = base, lines = [], before;

      var offer = this.offerFor(pincode);
      if (offer && offer.percentOff) {
        before = fee;
        fee = Math.round(fee * (1 - Number(offer.percentOff) / 100));
        if (before - fee > 0) lines.push({ label: offer.label, off: before - fee });
      }

      if (p.discountAbove && subtotal >= p.discountAbove && p.discountPercentOff) {
        before = fee;
        fee = Math.round(fee * (1 - Number(p.discountPercentOff) / 100));
        if (before - fee > 0) {
          lines.push({ label: "Large order — " + p.discountPercentOff + "% off delivery", off: before - fee });
        }
      }

      fee = Math.max(0, fee);
      return { fee: fee, base: base, saved: Math.max(0, base - fee), zone: zone, lines: lines };
    },

    /* Just the number. Built on deliveryDetail so the two can never drift. */
    delivery: function (subtotal, totalGrams, pincode) {
      var d = this.deliveryDetail(subtotal, totalGrams, pincode);
      return d === null ? null : d.fee;
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
