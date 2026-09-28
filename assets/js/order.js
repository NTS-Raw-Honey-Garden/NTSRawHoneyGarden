/* =====================================================================
   order.js — booking / order form: line items, live summary,
   validation, submission and confirmation screen.
   ===================================================================== */
(function () {
  "use strict";
  var C = window.SITE_CONFIG || {};
  var Cat = window.Catalog;
  var esc = window.escapeHtml;
  var form = document.getElementById("order-form");
  if (!form) return;

  var linesEl = document.getElementById("line-items");
  var addBtn = document.getElementById("add-line");
  var errorBox = document.getElementById("form-error");
  var submitBtn = document.getElementById("submit-order");
  var MAXQ = C.maxQuantityPerItem || 20;

  /* ---------- Mode notice ---------- */
  var modeNote = document.getElementById("mode-note");
  if (modeNote) {
    modeNote.innerHTML = window.OrderAPI.hasBackend()
      ? "No online payment needed now. We'll call or WhatsApp you to confirm, then you can pay " + (C.payment.upiId ? "by UPI or " : "") + "on delivery."
      : "After you submit, you'll get a booking reference and a button to send the order to us on WhatsApp. No online payment needed.";
  }

  /* ---------- Line items ---------- */
  function productOptions(selected) {
    return '<option value="">Choose honey…</option>' + Cat.all().map(function (p) {
      var out = Cat.isSoldOut(p);
      return '<option value="' + esc(p.id) + '"' + (p.id === selected ? " selected" : "") + (out ? " disabled" : "") + ">" +
        esc(p.name) + (out ? " (sold out)" : "") + "</option>";
    }).join("");
  }
  function sizeOptions(p, selected) {
    if (!p) return '<option value="">—</option>';
    return p.sizes.map(function (s) {
      var ok = s.stock > 0;
      return '<option value="' + esc(s.label) + '"' + (s.label === selected && ok ? " selected" : "") + (ok ? "" : " disabled") + ">" +
        esc(s.label) + " · " + Cat.money(s.price) + (ok ? "" : " (sold out)") + "</option>";
    }).join("");
  }

  var lineCounter = 0;
  function addLine(productId, sizeLabel, qty) {
    var n = ++lineCounter;
    var p = Cat.find(productId);
    if (p && !sizeLabel) sizeLabel = Cat.firstInStock(p).label;
    var row = document.createElement("div");
    row.className = "line-item";
    row.innerHTML =
      '<div class="field"><label for="p' + n + '">Honey / product</label><select id="p' + n + '" data-f="product" required>' + productOptions(productId) + "</select></div>" +
      '<div class="field"><label for="s' + n + '">Size</label><select id="s' + n + '" data-f="size" required>' + sizeOptions(p, sizeLabel) + "</select></div>" +
      '<div class="field"><label for="q' + n + '">Qty</label><input id="q' + n + '" data-f="qty" type="number" inputmode="numeric" min="1" max="' + MAXQ + '" value="' + (qty || 1) + '" required></div>' +
      '<button type="button" class="remove" aria-label="Remove this item"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<div class="line-total"><span data-f="stock"></span><strong data-f="total"></strong></div>';
    linesEl.appendChild(row);
    refreshLine(row);
    updateRemoveButtons();
    return row;
  }

  function readLine(row) {
    var p = Cat.find(row.querySelector('[data-f="product"]').value);
    var s = Cat.size(p, row.querySelector('[data-f="size"]').value);
    var q = parseInt(row.querySelector('[data-f="qty"]').value, 10) || 0;
    return { product: p, size: s, qty: q };
  }

  function refreshLine(row) {
    var l = readLine(row);
    var qtyEl = row.querySelector('[data-f="qty"]');
    var max = l.size ? Math.min(MAXQ, l.size.stock) : MAXQ;
    qtyEl.max = max;
    row.querySelector('[data-f="stock"]').textContent = l.size ? (l.size.stock <= 5 ? "Only " + l.size.stock + " left" : "In stock") : "";
    row.querySelector('[data-f="total"]').textContent = l.size && l.qty ? Cat.money(l.size.price * l.qty) : "";
  }

  function updateRemoveButtons() {
    var rows = linesEl.querySelectorAll(".line-item");
    rows.forEach(function (r) { r.querySelector(".remove").hidden = rows.length < 2; });
  }

  linesEl.addEventListener("change", function (e) {
    var row = e.target.closest(".line-item");
    if (e.target.getAttribute("data-f") === "product") {
      var p = Cat.find(e.target.value);
      row.querySelector('[data-f="size"]').innerHTML = sizeOptions(p, p ? Cat.firstInStock(p).label : "");
    }
    refreshLine(row); renderSummary();
  });
  linesEl.addEventListener("input", function (e) {
    if (e.target.getAttribute("data-f") === "qty") { refreshLine(e.target.closest(".line-item")); renderSummary(); }
  });
  linesEl.addEventListener("click", function (e) {
    var btn = e.target.closest(".remove");
    if (!btn) return;
    btn.closest(".line-item").remove();
    updateRemoveButtons(); renderSummary();
  });
  addBtn.addEventListener("click", function () {
    var row = addLine("");
    row.querySelector("select").focus();
    renderSummary();
  });

  /* Merge identical product+size rows and drop incomplete ones. */
  function collectItems() {
    var map = {}, order = [];
    linesEl.querySelectorAll(".line-item").forEach(function (row) {
      var l = readLine(row);
      if (!l.product || !l.size || l.qty < 1) return;
      var key = l.product.id + "|" + l.size.label;
      if (!map[key]) { map[key] = { product: l.product, size: l.size, qty: 0 }; order.push(key); }
      map[key].qty += l.qty;
    });
    return order.map(function (k) { return map[k]; });
  }

  /* ---------- Summary ---------- */
  function totals(items) {
    var sub = items.reduce(function (a, i) { return a + i.size.price * i.qty; }, 0);
    var del = Cat.delivery(sub);
    return { subtotal: sub, delivery: del, total: sub + del, qty: items.reduce(function (a, i) { return a + i.qty; }, 0) };
  }

  function renderSummary() {
    var items = collectItems();
    var t = totals(items);
    var list = document.getElementById("summary-lines");
    list.innerHTML = items.length ? items.map(function (i) {
      return "<li><span>" + esc(i.product.name) + " · " + esc(i.size.label) + " × " + i.qty + "</span><span>" + Cat.money(i.size.price * i.qty) + "</span></li>";
    }).join("") : '<li class="empty">Your basket is empty</li>';
    document.getElementById("sum-subtotal").textContent = Cat.money(t.subtotal);
    document.getElementById("sum-delivery").textContent = t.subtotal ? (t.delivery ? Cat.money(t.delivery) : "Free") : "—";
    document.getElementById("sum-total").textContent = Cat.money(t.total);
    var fd = document.getElementById("free-delivery");
    if (C.freeDeliveryAbove) {
      var left = C.freeDeliveryAbove - t.subtotal;
      fd.querySelector("span").textContent = left > 0 ? "Add " + Cat.money(left) + " more for free delivery" : "You've unlocked free delivery";
      fd.querySelector(".free-delivery-bar div").style.width = Math.min(100, (t.subtotal / C.freeDeliveryAbove) * 100) + "%";
    } else fd.hidden = true;
    return { items: items, totals: t };
  }

  /* ---------- Delivery date & slots ---------- */
  var dateEl = form.elements.deliveryDate;
  var minD = new Date(); minD.setDate(minD.getDate() + (C.minDeliveryDaysAhead || 2));
  var maxD = new Date(); maxD.setDate(maxD.getDate() + 60);
  function ymd(d) { return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }
  dateEl.min = ymd(minD); dateEl.max = ymd(maxD);
  form.elements.deliverySlot.innerHTML = '<option value="">No preference</option>' + (C.deliverySlots || []).map(function (s) { return "<option>" + esc(s) + "</option>"; }).join("");

  /* ---------- Validation ---------- */
  var rules = {
    name: function (v) { return v.length >= 2 && v.length <= 80 ? "" : "Please enter your full name."; },
    phone: function (v) { return /^[6-9]\d{9}$/.test(v) ? "" : "Enter a valid 10-digit Indian mobile number."; },
    email: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) && v.length <= 120 ? "" : "Enter a valid email address."; },
    address: function (v) { return v.length >= 10 && v.length <= 300 ? "" : "Please enter your full delivery address (house, street, area)."; },
    city: function (v) { return v.length >= 2 && v.length <= 60 ? "" : "Please enter your city / town."; },
    pincode: function (v) { return /^[1-9]\d{5}$/.test(v) ? "" : "Enter a valid 6-digit PIN code."; },
    deliveryDate: function (v) { return !v || (v >= dateEl.min && v <= dateEl.max) ? "" : "Choose a date between " + dateEl.min + " and " + dateEl.max + "."; },
    message: function (v) { return v.length <= 500 ? "" : "Please keep your message under 500 characters."; },
    consent: function (v, el) { return el.checked ? "" : "Please agree so we can process your order."; }
  };
  function clean(name) {
    var el = form.elements[name];
    var v = el.type === "checkbox" ? el.checked : el.value.trim();
    if (name === "phone") v = v.replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
    if (name === "pincode") v = v.replace(/\D/g, "");
    return v;
  }
  function validateField(name) {
    var el = form.elements[name];
    var msg = rules[name](clean(name), el);
    var wrap = el.closest(".field") || el.closest(".check");
    if (wrap) {
      wrap.classList.toggle("invalid", !!msg);
      var e = wrap.querySelector(".error");
      if (e) e.textContent = msg;
    }
    el.setAttribute("aria-invalid", msg ? "true" : "false");
    return !msg;
  }
  Object.keys(rules).forEach(function (name) {
    var el = form.elements[name];
    el.addEventListener("blur", function () { if (el.value || el.type === "checkbox") validateField(name); });
    el.addEventListener("input", function () { if (el.getAttribute("aria-invalid") === "true") validateField(name); });
  });

  function showError(msg) {
    errorBox.textContent = msg; errorBox.hidden = false;
    errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  /* ---------- Submit ---------- */
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    errorBox.hidden = true;
    if (form.elements.website.value) return; // honeypot: bots fill hidden fields

    var s = renderSummary();
    if (!s.items.length) return showError("Please choose at least one product.");
    var overStock = s.items.filter(function (i) { return i.qty > i.size.stock; })[0];
    if (overStock) return showError("Sorry, only " + overStock.size.stock + " × " + overStock.product.name + " (" + overStock.size.label + ") are available.");

    var firstBad = null;
    Object.keys(rules).forEach(function (n) { if (!validateField(n) && !firstBad) firstBad = form.elements[n]; });
    if (firstBad) { firstBad.focus(); return showError("Please check the highlighted fields."); }

    var order = {
      items: s.items.map(function (i) { return { productId: i.product.id, size: i.size.label, qty: i.qty }; }),
      customer: { name: clean("name"), phone: clean("phone"), email: clean("email").toLowerCase() },
      delivery: { address: clean("address"), city: clean("city"), pincode: clean("pincode"), date: clean("deliveryDate"), slot: form.elements.deliverySlot.value },
      message: clean("message"),
      consent: true,
      marketingOptIn: form.elements.marketing.checked,
      clientTotal: s.totals.total,
      page: location.href.split("?")[0]
    };

    submitBtn.disabled = true;
    var btnText = submitBtn.innerHTML;
    submitBtn.innerHTML = "Placing your order…";

    window.OrderAPI.submit(order).then(function (res) {
      // The server recalculates prices; prefer its numbers when available.
      var result = {
        ref: res.ref, mode: res.mode || "backend",
        items: res.items || s.items.map(function (i) { return { name: i.product.name, size: i.size.label, qty: i.qty, price: i.size.price, lineTotal: i.size.price * i.qty }; }),
        subtotal: res.subtotal != null ? res.subtotal : s.totals.subtotal,
        delivery: res.deliveryFee != null ? res.deliveryFee : s.totals.delivery,
        total: res.total != null ? res.total : s.totals.total,
        razorpayOrderId: res.razorpayOrderId,
        emailSent: !!res.emailSent
      };
      var pay = window.Payments.current();
      return pay.collect(result, order.customer).then(function (p) { result.payment = p; return result; });
    }).then(function (result) {
      window.trackEvent && window.trackEvent("purchase", { transaction_id: result.ref, value: result.total, currency: "INR" });
      showConfirmation(result, order);
    }).catch(function (err) {
      submitBtn.disabled = false; submitBtn.innerHTML = btnText;
      var fallback = C.whatsappNumber ? ' You can also order directly on WhatsApp: <a href="https://wa.me/' + esc(C.whatsappNumber) + '" target="_blank" rel="noopener">message us</a>.' : "";
      errorBox.innerHTML = "We couldn't place your order: " + esc(err.message) + "." + fallback;
      errorBox.hidden = false;
      errorBox.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });

  /* ---------- Confirmation ---------- */
  function waText(r, o) {
    var lines = ["Hello " + C.farmName + ", I'd like to place this order.", "", "Booking ref: " + r.ref];
    r.items.forEach(function (i) { lines.push("• " + i.name + " " + i.size + " × " + i.qty + " = " + Cat.money(i.lineTotal)); });
    lines.push("Delivery: " + (r.delivery ? Cat.money(r.delivery) : "Free"), "Total: " + Cat.money(r.total), "",
      "Name: " + o.customer.name, "Phone: " + o.customer.phone,
      "Address: " + o.delivery.address + ", " + o.delivery.city + " – " + o.delivery.pincode);
    if (o.delivery.date) lines.push("Preferred date: " + o.delivery.date + (o.delivery.slot ? " (" + o.delivery.slot + ")" : ""));
    if (o.message) lines.push("Note: " + o.message);
    return lines.join("\n");
  }

  function showConfirmation(r, o) {
    var wa = C.whatsappNumber ? "https://wa.me/" + C.whatsappNumber + "?text=" + encodeURIComponent(waText(r, o)) : "";
    var whatsappMode = r.mode === "whatsapp";
    var paid = r.payment && r.payment.status === "paid";
    var rows = r.items.map(function (i) {
      return "<tr><td>" + esc(i.name) + "</td><td>" + esc(i.size) + "</td><td>" + i.qty + "</td><td>" + Cat.money(i.lineTotal) + "</td></tr>";
    }).join("");
    var payInfo = paid
      ? "<p><strong>Payment received.</strong> Payment ID: " + esc(r.payment.reference) + "</p>"
      : "<p>No payment is needed yet. Once we confirm availability we'll share payment details" + (C.payment && C.payment.upiId ? " — you can pay by UPI to <strong>" + esc(C.payment.upiId) + "</strong>" : "") + " or pay on delivery.</p>";

    var el = document.getElementById("confirmation");
    el.innerHTML =
      '<div class="confirmation">' +
      '<div class="confirm-icon"><svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
      '<p class="eyebrow" style="justify-content:center">' + (whatsappMode ? "One last step" : "Booking received") + "</p>" +
      "<h1 style=\"font-size:clamp(2rem,4vw,3rem)\">Thank you, " + esc(o.customer.name.split(" ")[0]) + "!</h1>" +
      (whatsappMode
        ? '<p class="lead" style="margin:0 auto 10px">Please tap <strong>Send order on WhatsApp</strong> below so your booking reaches us. We\'ll reply to confirm.</p>'
        : '<p class="lead" style="margin:0 auto 10px">Your honey is reserved. We\'ll call or WhatsApp you on <strong>' + esc(o.customer.phone) + "</strong> within one working day to confirm delivery." +
          (r.emailSent ? " A copy has been emailed to " + esc(o.customer.email) + "." : "") + "</p>") +
      '<div class="ref-box"><small>Booking reference</small><strong>' + esc(r.ref) + "</strong></div>" +
      '<div class="card" style="text-align:left">' +
      '<h2 style="font-size:1.35rem">Order summary</h2>' +
      '<table class="confirm-table"><thead><tr><th>Item</th><th>Size</th><th>Qty</th><th>Amount</th></tr></thead><tbody>' + rows + "</tbody>" +
      "<tfoot><tr><td colspan=\"3\">Delivery</td><td>" + (r.delivery ? Cat.money(r.delivery) : "Free") + "</td></tr>" +
      "<tr><td colspan=\"3\"><strong>Total</strong></td><td><strong>" + Cat.money(r.total) + "</strong></td></tr></tfoot></table>" +
      payInfo +
      '<div class="confirm-meta">' +
      "<div><h3>Delivering to</h3>" + esc(o.customer.name) + "<br>" + esc(o.delivery.address) + "<br>" + esc(o.delivery.city) + " – " + esc(o.delivery.pincode) +
      (o.delivery.date ? "<br><em>Preferred: " + esc(o.delivery.date) + (o.delivery.slot ? ", " + esc(o.delivery.slot) : "") + "</em>" : "") + "</div>" +
      "<div><h3>Questions? Contact the farm</h3>" + esc(C.farmName) + "<br>" +
      '<a href="tel:' + esc(String(C.phone).replace(/\s/g, "")) + '">' + esc(C.phone) + "</a><br>" +
      '<a href="mailto:' + esc(C.email) + '">' + esc(C.email) + "</a><br><small>" + esc(C.businessHours) + "</small></div>" +
      "</div></div>" +
      '<div class="confirm-actions" style="margin-top:26px">' +
      (wa ? '<a class="btn ' + (whatsappMode ? "btn-primary" : "btn-ghost") + '" href="' + wa + '" target="_blank" rel="noopener">' + (whatsappMode ? "Send order on WhatsApp" : "Share on WhatsApp") + "</a>" : "") +
      '<button class="btn btn-ghost" type="button" id="print-order">Print / save as PDF</button>' +
      '<a class="btn btn-ghost" href="products.html">Back to shop</a></div></div>';

    document.getElementById("print-order").addEventListener("click", function () { window.print(); });
    document.getElementById("order-view").hidden = true;
    el.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.title = "Booking " + r.ref + " · " + C.farmName;
  }

  /* ---------- Start ---------- */
  var params = new URLSearchParams(location.search);
  addLine(params.get("product") || "", params.get("size") || "", 1);
  renderSummary();
})();
