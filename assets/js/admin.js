/* =====================================================================
   admin.js — owner dashboard: sign in, list/filter orders, change
   status, export CSV / Excel. Data comes from the Apps Script backend
   and is never stored in the website itself.
   ===================================================================== */
(function () {
  "use strict";
  var C = window.SITE_CONFIG || {};
  var STATUSES = ["New", "Confirmed", "Dispatched", "Delivered", "Cancelled"];
  var KEY_STORE = "hf_admin_key";
  var state = { key: "", orders: [], status: "All", type: "All", demo: false, open: {} };

  var $ = function (id) { return document.getElementById(id); };
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function money(n) { return "₹" + Number(n || 0).toLocaleString("en-IN"); }
  function fmtDate(iso) {
    if (!iso) return "";
    var d = new Date(iso);
    return isNaN(d) ? esc(iso) : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) + ", " + d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  }
  function getKey() { try { return sessionStorage.getItem(KEY_STORE) || ""; } catch (e) { return ""; } }
  function setKey(k) { try { k ? sessionStorage.setItem(KEY_STORE, k) : sessionStorage.removeItem(KEY_STORE); } catch (e) {} }

  $("farm-name").textContent = C.farmName || "Farm";
  $("login-farm").textContent = (C.farmName || "Farm") + " · owner access only";
  if (!C.orderBackendUrl) $("demo-box").hidden = false;

  /* ---------------- Sign in / out ---------------- */
  $("login-form").addEventListener("submit", function (e) {
    e.preventDefault();
    var k = $("admin-key").value.trim();
    if (!k) return;
    signIn(k);
  });
  $("demo-btn").addEventListener("click", function () {
    state.demo = true; state.orders = sampleOrders(); showApp();
  });
  $("logout-btn").addEventListener("click", function () {
    setKey(""); state = { key: "", orders: [], status: "All", type: "All", demo: false, open: {} };
    $("app").hidden = true; $("login").hidden = false; $("admin-key").value = "";
  });
  $("refresh-btn").addEventListener("click", function () { if (!state.demo) load(); });

  function signIn(k) {
    var btn = $("login-form").querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "Checking…";
    $("login-error").hidden = true;
    window.AdminAPI.call("listOrders", k).then(function (res) {
      state.key = k; setKey(k); state.orders = res.orders || []; showApp();
    }).catch(function (err) {
      $("login-error").textContent = err.code === "AUTH" ? "That admin key is not correct." : err.message;
      $("login-error").hidden = false;
      setKey("");
    }).then(function () { btn.disabled = false; btn.textContent = "Sign in"; });
  }

  function load() {
    var b = $("refresh-btn"); b.disabled = true; b.textContent = "Loading…";
    return window.AdminAPI.call("listOrders", state.key).then(function (res) {
      state.orders = res.orders || []; render();
    }).catch(notify).then(function () { b.disabled = false; b.textContent = "Refresh"; });
  }

  function showApp() {
    $("login").hidden = true; $("app").hidden = false;
    $("demo-flag").hidden = !state.demo;
    render();
  }

  function notify(err, ok) {
    var n = $("notice");
    n.className = "alert" + (ok ? " ok" : "");
    n.textContent = typeof err === "string" ? err : (err.code === "AUTH" ? "Your session has expired — please sign in again." : err.message);
    n.hidden = false;
    clearTimeout(notify.t); notify.t = setTimeout(function () { n.hidden = true; }, 5000);
  }

  /* ---------------- Filters ---------------- */
  ["search", "from", "to"].forEach(function (id) { $(id).addEventListener("input", render); });
  $("status-tabs").addEventListener("click", function (e) {
    var t = e.target.closest(".tab"); if (!t) return;
    state.status = t.getAttribute("data-s"); render();
  });
  $("type-tabs").addEventListener("click", function (e) {
    var t = e.target.closest(".tab"); if (!t) return;
    state.type = t.getAttribute("data-t"); render();
  });

  function filtered() {
    var q = $("search").value.trim().toLowerCase();
    var from = $("from").value, to = $("to").value;
    return state.orders.filter(function (o) {
      if (state.type !== "All" && (o.type || "Order") !== state.type) return false;
      if (state.status !== "All" && o.status !== state.status) return false;
      var day = (o.orderDate || "").slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (!q) return true;
      return [o.ref, o.name, o.phone, o.email, o.city, o.pincode, o.itemsText, o.message].join(" ").toLowerCase().indexOf(q) > -1;
    }).sort(function (a, b) { return (b.orderDate || "").localeCompare(a.orderDate || ""); });
  }

  /* ---------------- Render ---------------- */
  function render() {
    var typeCounts = { All: state.orders.length, Order: 0, Request: 0 };
    state.orders.forEach(function (o) { typeCounts[o.type || "Order"] = (typeCounts[o.type || "Order"] || 0) + 1; });
    $("type-tabs").innerHTML = [["All", "Everything"], ["Order", "Orders"], ["Request", "Requests"]].map(function (t) {
      return '<button class="tab" data-t="' + t[0] + '" aria-selected="' + (state.type === t[0]) + '">' + t[1] + "<b>" + (typeCounts[t[0]] || 0) + "</b></button>";
    }).join("");

    var all = state.type === "All" ? state.orders : state.orders.filter(function (o) { return (o.type || "Order") === state.type; });
    var counts = { All: all.length };
    STATUSES.forEach(function (s) { counts[s] = 0; });
    all.forEach(function (o) { counts[o.status] = (counts[o.status] || 0) + 1; });

    $("status-tabs").innerHTML = ["All"].concat(STATUSES).map(function (s) {
      return '<button class="tab" role="tab" data-s="' + s + '" aria-selected="' + (state.status === s) + '">' + s + "<b>" + (counts[s] || 0) + "</b></button>";
    }).join("");

    var open = all.filter(function (o) { return o.status !== "Delivered" && o.status !== "Cancelled"; });
    var delivered = all.filter(function (o) { return o.status === "Delivered"; });
    var today = new Date().toISOString().slice(0, 10);
    var month = today.slice(0, 7);
    var sum = function (list) { return list.reduce(function (a, o) { return a + Number(o.total || 0); }, 0); };
    $("kpis").innerHTML =
      kpi("New orders", counts.New, "waiting to be confirmed") +
      kpi("Open orders", open.length, money(sum(open)) + " to fulfil") +
      kpi("Delivered", delivered.length, money(sum(delivered)) + " revenue") +
      kpi("This month", all.filter(function (o) { return (o.orderDate || "").slice(0, 7) === month && o.status !== "Cancelled"; }).length,
        money(sum(all.filter(function (o) { return (o.orderDate || "").slice(0, 7) === month && o.status !== "Cancelled"; }))) + " booked") +
      kpi("Requests", state.orders.filter(function (o) { return o.type === "Request"; }).length, "to call back");

    var list = filtered();
    $("count").textContent = "Showing " + list.length + " of " + all.length + " orders";
    $("empty").hidden = list.length > 0;
    $("orders").querySelector("tbody").innerHTML = list.map(row).join("");
  }
  function kpi(label, value, sub) { return '<div class="kpi"><span>' + label + "</span><strong>" + value + "</strong><em>" + sub + "</em></div>"; }

  function row(o) {
    var items = (o.items && o.items.length)
      ? "<ul>" + o.items.map(function (i) { return "<li>" + esc(i.name) + " · " + esc(i.size) + " × " + esc(i.qty) + "</li>"; }).join("") + "</ul>"
      : esc(o.itemsText);
    var opts = STATUSES.map(function (s) { return "<option" + (s === o.status ? " selected" : "") + ">" + s + "</option>"; }).join("");
    var phone = String(o.phone || "");
    var waMsg = "Hello " + String(o.name || "").split(" ")[0] + ", this is " + C.farmName + " about your honey order " + o.ref + ".";
    var isOpen = !!state.open[o.ref];
    var isReq = (o.type || "Order") === "Request";
    return '<tr class="main">' +
      '<td><span class="ref">' + esc(o.ref) + '</span><span class="sub">' + fmtDate(o.orderDate) + "</span>" +
      (isReq ? '<span class="pill req">Request</span>' : "") + "</td>" +
      "<td><strong>" + esc(o.name) + '</strong><span class="sub"><a href="tel:+91' + esc(phone) + '">+91 ' + esc(phone) + '</a></span><span class="sub"><a href="mailto:' + esc(o.email) + '">' + esc(o.email) + "</a></span></td>" +
      "<td>" + items + "</td>" +
      '<td class="num">' + (isReq ? '<span class="muted">On request</span>' : "<strong>" + money(o.total) + "</strong>") +
      '<span class="sub">' + esc(o.totalQty) + " item(s)</span></td>" +
      "<td>" + (isReq ? '<span class="muted">—</span>' : (o.deliveryDate ? esc(o.deliveryDate) : '<span class="muted">No preference</span>')) +
      '<span class="sub">' + esc(o.deliverySlot || "") + "</span><span class=\"sub\">" + esc(o.city) + " " + esc(o.pincode) + "</span></td>" +
      '<td><select class="status-select st-' + esc(o.status) + '" data-ref="' + esc(o.ref) + '" aria-label="Status for ' + esc(o.ref) + '">' + opts + "</select></td>" +
      '<td><button class="more" type="button" data-toggle="' + esc(o.ref) + '" aria-expanded="' + isOpen + '">' + (isOpen ? "Hide" : "Details") + "</button></td></tr>" +
      '<tr class="details"' + (isOpen ? "" : " hidden") + '><td colspan="7"><div class="detail-grid">' +
      "<div><h4>" + (isReq ? "Location" : "Delivery address") + "</h4><p>" +
      (isReq ? (esc(o.city) || '<span class="muted">Not given</span>') : esc(o.address) + "<br>" + esc(o.city) + " – " + esc(o.pincode)) + "</p></div>" +
      "<div><h4>Customer message</h4><p>" + (o.message ? esc(o.message) : '<span class="muted">—</span>') + "</p></div>" +
      "<div><h4>" + (isReq ? "Items requested" : "Amounts") + "</h4><p>" +
      (isReq ? esc(o.itemsText) : "Subtotal " + money(o.subtotal) + "<br>Delivery " + money(o.deliveryFee) + "<br><strong>Total " + money(o.total) + "</strong>") + "</p></div>" +
      "<div><h4>Payment &amp; consent</h4><p>Payment: " + esc(o.paymentStatus || "Pending") + (o.paymentRef ? " (" + esc(o.paymentRef) + ")" : "") +
      "<br>Newsletter: " + esc(o.marketingOptIn === true ? "Yes" : o.marketingOptIn === false ? "No" : o.marketingOptIn) +
      "<br><span class=\"muted small\">Last updated " + fmtDate(o.updatedAt) + "</span></p>" +
      (phone ? '<a class="wa" target="_blank" rel="noopener" href="https://wa.me/91' + esc(phone) + "?text=" + encodeURIComponent(waMsg) + '">Message on WhatsApp →</a>' : "") +
      "</div></div></td></tr>";
  }

  $("orders").addEventListener("click", function (e) {
    var b = e.target.closest("[data-toggle]"); if (!b) return;
    var ref = b.getAttribute("data-toggle");
    state.open[ref] = !state.open[ref]; render();
  });

  $("orders").addEventListener("change", function (e) {
    var sel = e.target.closest(".status-select"); if (!sel) return;
    var ref = sel.getAttribute("data-ref"), status = sel.value;
    var order = state.orders.filter(function (o) { return o.ref === ref; })[0];
    var prev = order.status;
    if (status === "Cancelled" && !confirm("Mark " + ref + " as Cancelled?")) { sel.value = prev; return; }
    sel.disabled = true;
    var done = function () { order.status = status; order.updatedAt = new Date().toISOString(); render(); notify("Order " + ref + " marked " + status + ".", true); };
    if (state.demo) return done();
    window.AdminAPI.call("updateStatus", state.key, { ref: ref, status: status })
      .then(done)
      .catch(function (err) { sel.value = prev; sel.disabled = false; notify(err); });
  });

  /* ---------------- Export ---------------- */
  var COLUMNS = [
    ["Booking Ref", "ref"], ["Type", "type"], ["Order Date", "orderDate"], ["Status", "status"], ["Customer Name", "name"], ["Phone", "phone"],
    ["Email", "email"], ["Address", "address"], ["City", "city"], ["PIN Code", "pincode"], ["Products", "itemsText"],
    ["Total Qty", "totalQty"], ["Subtotal", "subtotal"], ["Delivery Fee", "deliveryFee"], ["Order Value", "total"],
    ["Preferred Delivery Date", "deliveryDate"], ["Preferred Time", "deliverySlot"], ["Customer Message", "message"],
    ["Newsletter Opt-in", "marketingOptIn"], ["Payment Status", "paymentStatus"], ["Last Updated", "updatedAt"]
  ];
  function tableData() {
    return filtered().map(function (o) { return COLUMNS.map(function (c) { var v = o[c[1]]; return v === true ? "Yes" : v === false ? "No" : (v == null ? "" : v); }); });
  }
  function fileName(ext) { return "orders-" + new Date().toISOString().slice(0, 10) + "." + ext; }
  function download(blob, name) {
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name;
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  // Protects against spreadsheet formula injection (=, +, -, @ at the start of a cell).
  function safeCell(v) { v = String(v); return /^[=+\-@\t\r]/.test(v) ? "'" + v : v; }

  $("csv-btn").addEventListener("click", function () {
    var rows = [COLUMNS.map(function (c) { return c[0]; })].concat(tableData());
    var csv = rows.map(function (r) { return r.map(function (v) { v = safeCell(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(","); }).join("\r\n");
    download(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }), fileName("csv")); // BOM so Excel shows ₹ correctly
  });

  $("xlsx-btn").addEventListener("click", function () {
    var btn = this; btn.disabled = true; btn.textContent = "Preparing…";
    loadXLSX().then(function (XLSX) {
      var rows = [COLUMNS.map(function (c) { return c[0]; })].concat(tableData().map(function (r) { return r.map(function (v) { return typeof v === "number" ? v : safeCell(v); }); }));
      var ws = XLSX.utils.aoa_to_sheet(rows);
      ws["!cols"] = COLUMNS.map(function (c) { return { wch: Math.max(12, c[0].length + 2) }; });
      var wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Orders");
      XLSX.writeFile(wb, fileName("xlsx"));
    }).catch(function () { notify("Could not load the Excel exporter. Use Export CSV instead — it opens in Excel too."); })
      .then(function () { btn.disabled = false; btn.textContent = "Export Excel"; });
  });
  function loadXLSX() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (res, rej) {
      var s = document.createElement("script");
      s.src = "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js";
      s.onload = function () { res(window.XLSX); }; s.onerror = rej;
      document.head.appendChild(s);
    });
  }

  /* ---------------- Sample data (preview only) ---------------- */
  function sampleOrders() {
    var names = ["Ananya Rao", "Vikram Shetty", "Meera Iyer", "Rahul Gowda", "Fatima Khan", "Arjun Nair", "Divya Menon", "Karthik Hegde"];
    var prods = [["വൻതേൻ · Vanthen", "500 g", 549], ["വൻതേൻ · Vanthen", "1 kg", 999], ["വൻതേൻ · Vanthen", "250 g", 299]];
    var st = ["New", "New", "Confirmed", "Dispatched", "Delivered", "Delivered", "Cancelled", "Confirmed"];
    var requests = [
      { items: ["ചെറുതേൻ · Cheruthen"], who: "Lakshmi Pillai", msg: "How much for 250 g?" },
      { items: ["Bee Hive for Farmers", "Raw Bee Hive Honey Box"], who: "Joseph Thomas", msg: "I have a 2-acre plot, need 3 hives." }
    ];
    var out = names.map(function (n, i) {
      var d = new Date(Date.now() - i * 86400000 * 1.7);
      var items = [prods[i % 3], prods[(i + 2) % 3]].slice(0, i % 2 + 1).map(function (p, j) { var q = (i + j) % 3 + 1; return { name: p[0], size: p[1], qty: q, price: p[2], lineTotal: p[2] * q }; });
      var sub = items.reduce(function (a, x) { return a + x.lineTotal; }, 0), fee = sub >= 999 ? 0 : 60;
      return {
        ref: "HNY-" + d.toISOString().slice(2, 10).replace(/-/g, "") + "-" + ["K7QF", "M2TZ", "A9PL", "R4XD", "B8NW", "H3VC", "T6JS", "E5GY"][i],
        orderDate: d.toISOString(), status: st[i], name: n, phone: "98" + (45012300 + i * 1111), email: n.split(" ")[0].toLowerCase() + "@example.com",
        address: (12 + i) + ", 4th Cross, Sample Layout", city: "Your City", pincode: "4000" + (10 + i),
        items: items, itemsText: items.map(function (x) { return x.name + " " + x.size + " x" + x.qty; }).join("; "),
        totalQty: items.reduce(function (a, x) { return a + x.qty; }, 0), subtotal: sub, deliveryFee: fee, total: sub + fee,
        deliveryDate: i % 3 ? new Date(d.getTime() + 3 * 86400000).toISOString().slice(0, 10) : "", deliverySlot: i % 3 ? "Morning (9 am – 12 pm)" : "",
        message: i === 1 ? "Gift wrap please — it's for my parents' anniversary." : "", marketingOptIn: i % 2 === 0,
        paymentStatus: st[i] === "Delivered" ? "Paid (UPI)" : "Pending", updatedAt: d.toISOString(), type: "Order"
      };
    });
    requests.forEach(function (r, i) {
      var d = new Date(Date.now() - (i + 1) * 86400000 * 0.8);
      out.push({
        ref: "REQ-" + d.toISOString().slice(2, 10).replace(/-/g, "") + "-" + ["W4KD", "P9LM"][i],
        orderDate: d.toISOString(), status: i ? "Confirmed" : "New", name: r.who, phone: "98" + (45099100 + i * 77),
        email: r.who.split(" ")[0].toLowerCase() + "@example.com", address: "", city: "Your City", pincode: "",
        items: r.items.map(function (n) { return { name: n, size: "On request", qty: 1 }; }),
        itemsText: r.items.join("; "), totalQty: r.items.length, subtotal: 0, deliveryFee: 0, total: 0,
        deliveryDate: "", deliverySlot: "", message: r.msg, marketingOptIn: false,
        paymentStatus: "Not applicable", updatedAt: d.toISOString(), type: "Request"
      });
    });
    return out;
  }

  /* Auto sign-in if a key is saved for this tab */
  var saved = getKey();
  if (saved && C.orderBackendUrl) signIn(saved);
})();
