/**
 * =====================================================================
 *  HONEY FARM ORDER BACKEND  —  Google Apps Script + Google Sheets
 * ---------------------------------------------------------------------
 *  Stores orders in a private Google Sheet and powers the owner
 *  dashboard. The public website never holds customer data.
 *
 *  Two sheet tabs are used:
 *    Orders  — one row per order or request
 *    Stock   — one row per product size; this is the LIVE stock count.
 *              It goes down automatically when an order is placed and
 *              back up if you set that order to "Cancelled".
 *              Edit the "In Stock" cells by hand whenever you bottle more.
 *
 *  Setup: documentation/02-backend-setup.md (step by step, no coding).
 *
 *  Script Properties (Project Settings → Script properties):
 *    ADMIN_KEY            required  long secret used to open the dashboard
 *    SITE_URL             required  your live site, e.g. https://you.github.io/honey-farm-website
 *    OWNER_EMAIL          optional  where new-order alerts go (defaults to your Google account)
 *    SEND_CUSTOMER_EMAIL  optional  "true" (default) / "false" — confirmation email to customer
 *    NOTIFY_STATUS_EMAILS optional  "true" / "false" (default) — email customer when status changes
 *    RAZORPAY_KEY_ID      optional  for online payments later
 *    RAZORPAY_KEY_SECRET  optional  for online payments later (never put this in the website)
 * =====================================================================
 */

var SHEET_NAME = 'Orders';
var STOCK_SHEET = 'Stock';
var STOCK_HEADERS = ['Product ID', 'Product Name', 'Size', 'Price', 'In Stock', 'Total Sold', 'Last Updated'];
var SCOL = {}; STOCK_HEADERS.forEach(function (h, i) { SCOL[h] = i + 1; });

var STATUSES = ['New', 'Confirmed', 'Dispatched', 'Delivered', 'Cancelled'];
var HEADERS = [
  'Booking Ref', 'Type', 'Order Date', 'Status', 'Customer Name', 'Phone', 'Email', 'Address', 'City', 'PIN Code',
  'Products', 'Items JSON', 'Total Qty', 'Subtotal', 'Delivery Fee', 'Order Value',
  'Preferred Delivery Date', 'Preferred Time', 'Customer Message', 'Newsletter Opt-in', 'Consent Given At',
  'Payment Status', 'Payment Ref', 'Last Updated', 'Source Page'
];
var COL = {}; HEADERS.forEach(function (h, i) { COL[h] = i + 1; });

var MAX_LINES = 15;
var ORDERS_PER_PHONE_PER_10_MIN = 5;
var MAX_FAILED_LOGINS = 10;

/* ------------------------------------------------------------------ */
/*  ENTRY POINTS                                                       */
/* ------------------------------------------------------------------ */

function doGet(e) {
  try {
    var action = e && e.parameter && e.parameter.action;
    if (action === 'getStock') return json(getStockPublic_());
  } catch (err) {
    return json({ ok: false, error: 'Could not read stock.' });
  }
  return json({ ok: true, service: 'honey-farm-orders', message: 'Backend is running. Orders are sent with POST.' });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) throw userError('Empty request.');
    if (e.postData.contents.length > 20000) throw userError('Request too large.');
    var body = JSON.parse(e.postData.contents);

    switch (body.action) {
      case 'createOrder':   return json(createOrder_(body.order || {}, body.paymentProvider));
      case 'createRequest': return json(createRequest_(body.order || {}));
      case 'listOrders':    requireAdmin_(body.adminKey); return json(listOrders_());
      case 'updateStatus':  requireAdmin_(body.adminKey); return json(updateStatus_(body.ref, body.status));
      case 'deleteOrder':   requireAdmin_(body.adminKey); return json(deleteOrder_(body.ref));
      case 'verifyPayment': return json(verifyPayment_(body.payment || {}));
      case 'getStock':      return json(getStockPublic_());
      case 'listStock':     requireAdmin_(body.adminKey); return json(listStockAdmin_());
      case 'setStock':      requireAdmin_(body.adminKey); return json(setStock_(body.productId, body.size, body.stock));
      default: throw userError('Unknown action.');
    }
  } catch (err) {
    if (!err.isUser) console.error(err && err.stack || err);
    return json({ ok: false, error: err.isUser ? err.message : 'Something went wrong on our side. Please try again or contact us.', code: err.code || 'ERROR' });
  }
}

/* ------------------------------------------------------------------ */
/*  CREATE ORDER                                                       */
/* ------------------------------------------------------------------ */

function createOrder_(o, paymentProvider) {
  var cfg = siteSettings_();
  var catalog = loadCatalog_();

  // ---- Customer & delivery fields (validated again on the server) ----
  var c = o.customer || {}, d = o.delivery || {};
  var name = clean_(c.name, 80);
  var phone = String(c.phone || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  var email = clean_(c.email, 120).toLowerCase();
  var address = clean_(d.address, 300);
  var city = clean_(d.city, 60);
  var pincode = String(d.pincode || '').replace(/\D/g, '');
  var date = clean_(d.date, 10);
  var slot = clean_(d.slot, 60);
  var message = clean_(o.message, 500);

  if (name.length < 2) throw userError('Please enter your name.');
  if (!/^[6-9]\d{9}$/.test(phone)) throw userError('Please enter a valid 10-digit mobile number.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw userError('Please enter a valid email address.');
  if (address.length < 10) throw userError('Please enter your full delivery address.');
  if (city.length < 2) throw userError('Please enter your city.');
  if (!/^[1-9]\d{5}$/.test(pincode)) throw userError('Please enter a valid 6-digit PIN code.');
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw userError('Invalid delivery date.');
  if (o.consent !== true) throw userError('Consent is required to process your order.');

  rateLimit_('rl_' + phone, ORDERS_PER_PHONE_PER_10_MIN, 600, 'Too many orders from this number. Please wait a few minutes or call us.');

  // ---- Items: prices and stock ALWAYS come from the live catalogue ----
  var raw = Array.isArray(o.items) ? o.items.slice(0, MAX_LINES) : [];
  var merged = {}, keys = [];
  raw.forEach(function (it) {
    var k = String(it.productId) + '|' + String(it.size);
    if (!merged[k]) { merged[k] = { productId: String(it.productId), size: String(it.size), qty: 0 }; keys.push(k); }
    merged[k].qty += parseInt(it.qty, 10) || 0;
  });
  if (!keys.length) throw userError('Please choose at least one product.');

  /* Live stock comes from the Stock sheet, which is the single source of truth.
     products.js is only used for names and as the seed when a size is new. */
  var live = readStock_();

  var items = keys.map(function (k) {
    var it = merged[k];
    var p = catalog[it.productId];
    if (!p || p.available === false) throw userError('One of the products is no longer available. Please refresh the page.');
    var s = (p.sizes || []).filter(function (x) { return x.label === it.size; })[0];
    if (!s) throw userError('Please choose a valid size for ' + p.name + '.');

    var sk = stockKey_(p.id, s.label);
    var avail = live[sk] ? live[sk].stock : Number(s.stock) || 0;
    if (!(avail > 0)) throw userError(p.name + ' (' + s.label + ') is sold out.');
    var cap = Math.min(cfg.maxQty, avail);
    if (it.qty < 1 || it.qty > cap) throw userError('Only ' + cap + ' × ' + p.name + ' (' + s.label + ') ' + (cap === 1 ? 'is' : 'are') + ' available right now.');

    return { productId: p.id, name: p.name, size: s.label, qty: it.qty, price: Number(s.price), lineTotal: Number(s.price) * it.qty };
  });

  var subtotal = items.reduce(function (a, i) { return a + i.lineTotal; }, 0);
  var totalGrams = items.reduce(function (a, i) { return a + itemGrams_(i.size) * i.qty; }, 0);
  var deliveryFee = deliveryFor_(subtotal, totalGrams, pincode);
  var total = subtotal + deliveryFee;
  var totalQty = items.reduce(function (a, i) { return a + i.qty; }, 0);
  var itemsText = items.map(function (i) { return i.name + ' ' + i.size + ' x' + i.qty; }).join('; ');

  // ---- Save ----
  var now = new Date();
  var ref;
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    /* Re-check stock inside the lock, then reserve it. This stops two people
       buying the last jar at the same moment. */
    applyStockChange_(items, -1, catalog);

    var sheet = getSheet_();
    ref = newRef_(now, 'HNY');
    var row = [];
    row[COL['Booking Ref'] - 1] = ref;
    row[COL['Type'] - 1] = 'Order';
    row[COL['Order Date'] - 1] = now;
    row[COL['Status'] - 1] = 'New';
    row[COL['Customer Name'] - 1] = safe_(name);
    row[COL['Phone'] - 1] = phone;
    row[COL['Email'] - 1] = safe_(email);
    row[COL['Address'] - 1] = safe_(address);
    row[COL['City'] - 1] = safe_(city);
    row[COL['PIN Code'] - 1] = pincode;
    row[COL['Products'] - 1] = safe_(itemsText);
    row[COL['Items JSON'] - 1] = JSON.stringify(items);
    row[COL['Total Qty'] - 1] = totalQty;
    row[COL['Subtotal'] - 1] = subtotal;
    row[COL['Delivery Fee'] - 1] = deliveryFee;
    row[COL['Order Value'] - 1] = total;
    row[COL['Preferred Delivery Date'] - 1] = date;
    row[COL['Preferred Time'] - 1] = safe_(slot);
    row[COL['Customer Message'] - 1] = safe_(message);
    row[COL['Newsletter Opt-in'] - 1] = o.marketingOptIn === true ? 'Yes' : 'No';
    row[COL['Consent Given At'] - 1] = now;
    row[COL['Payment Status'] - 1] = 'Pending';
    row[COL['Payment Ref'] - 1] = '';
    row[COL['Last Updated'] - 1] = now;
    row[COL['Source Page'] - 1] = safe_(clean_(o.page, 200));
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }

  var result = { ok: true, ref: ref, items: items, subtotal: subtotal, deliveryFee: deliveryFee, total: total, emailSent: false };

  // ---- Optional: create a Razorpay order for online payment ----
  if (paymentProvider === 'razorpay' && prop_('RAZORPAY_KEY_ID') && prop_('RAZORPAY_KEY_SECRET')) {
    try {
      result.razorpayOrderId = createRazorpayOrder_(ref, total);
      setCell_(ref, 'Payment Ref', result.razorpayOrderId);
    } catch (err) { console.error('Razorpay order failed', err); }
  }

  // ---- Notifications (never block the order if email fails) ----
  var order = { ref: ref, date: now, name: name, phone: phone, email: email, address: address, city: city, pincode: pincode,
    items: items, subtotal: subtotal, deliveryFee: deliveryFee, total: total, deliveryDate: date, slot: slot, message: message };
  try { notifyOwner_(order, cfg); } catch (err) { console.error('Owner email failed', err); }
  if (prop_('SEND_CUSTOMER_EMAIL', 'true') === 'true') {
    try { sendCustomerConfirmation_(order, cfg); result.emailSent = true; } catch (err) { console.error('Customer email failed', err); }
  }
  return result;
}


/* ------------------------------------------------------------------ */
/*  CREATE REQUEST (items we don't sell off the shelf — we call back)   */
/* ------------------------------------------------------------------ */

function createRequest_(o) {
  var cfg = siteSettings_();
  var catalog = loadRequestCatalog_();

  var c = o.customer || {}, d = o.delivery || {};
  var name = clean_(c.name, 80);
  var phone = String(c.phone || '').replace(/\D/g, '').replace(/^(91|0)(?=\d{10}$)/, '');
  var email = clean_(c.email, 120).toLowerCase();
  var city = clean_(d.city, 60);
  var message = clean_(o.message, 500);

  if (name.length < 2) throw userError('Please enter your name.');
  if (!/^[6-9]\d{9}$/.test(phone)) throw userError('Please enter a valid 10-digit mobile number.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) throw userError('Please enter a valid email address.');
  if (o.consent !== true) throw userError('Consent is required so we can contact you.');

  rateLimit_('rq_' + phone, ORDERS_PER_PHONE_PER_10_MIN, 600, 'Too many requests from this number. Please wait a few minutes or call us.');

  var ids = Array.isArray(o.requestItems) ? o.requestItems.slice(0, 10) : [];
  var items = [];
  ids.forEach(function (id) {
    var it = catalog[String(id)];
    if (it && items.indexOf(it.name) < 0) items.push(it.name);
  });
  if (!items.length) throw userError('Please choose at least one item to request.');
  var itemsText = items.join('; ');

  var now = new Date();
  var ref;
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sheet = getSheet_();
    ref = newRef_(now, 'REQ');
    var row = [];
    row[COL['Booking Ref'] - 1] = ref;
    row[COL['Type'] - 1] = 'Request';
    row[COL['Order Date'] - 1] = now;
    row[COL['Status'] - 1] = 'New';
    row[COL['Customer Name'] - 1] = safe_(name);
    row[COL['Phone'] - 1] = phone;
    row[COL['Email'] - 1] = safe_(email);
    row[COL['Address'] - 1] = '';
    row[COL['City'] - 1] = safe_(city);
    row[COL['PIN Code'] - 1] = '';
    row[COL['Products'] - 1] = safe_(itemsText);
    row[COL['Items JSON'] - 1] = JSON.stringify(items.map(function (n) { return { name: n, size: 'On request', qty: 1, price: 0, lineTotal: 0 }; }));
    row[COL['Total Qty'] - 1] = items.length;
    row[COL['Subtotal'] - 1] = 0;
    row[COL['Delivery Fee'] - 1] = 0;
    row[COL['Order Value'] - 1] = 0;
    row[COL['Preferred Delivery Date'] - 1] = '';
    row[COL['Preferred Time'] - 1] = '';
    row[COL['Customer Message'] - 1] = safe_(message);
    row[COL['Newsletter Opt-in'] - 1] = o.marketingOptIn === true ? 'Yes' : 'No';
    row[COL['Consent Given At'] - 1] = now;
    row[COL['Payment Status'] - 1] = 'Not applicable';
    row[COL['Payment Ref'] - 1] = '';
    row[COL['Last Updated'] - 1] = now;
    row[COL['Source Page'] - 1] = safe_(clean_(o.page, 200));
    sheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }

  var result = { ok: true, ref: ref, items: items, emailSent: false };
  try { notifyOwnerRequest_({ ref: ref, name: name, phone: phone, email: email, city: city, items: items, message: message }, cfg); }
  catch (err) { console.error('Owner request email failed', err); }
  if (email && prop_('SEND_CUSTOMER_EMAIL', 'true') === 'true') {
    try { sendRequestConfirmation_({ ref: ref, name: name, phone: phone, email: email, items: items }, cfg); result.emailSent = true; }
    catch (err) { console.error('Customer request email failed', err); }
  }
  return result;
}

function notifyOwnerRequest_(q, cfg) {
  var to = prop_('OWNER_EMAIL') || Session.getEffectiveUser().getEmail();
  if (!to) return;
  MailApp.sendEmail({
    to: to,
    subject: 'New request ' + q.ref + ' from ' + q.name,
    htmlBody: '<div style="font-family:Arial,sans-serif;max-width:560px">' +
      '<h2 style="margin:0 0 8px">New request ' + h_(q.ref) + '</h2>' +
      '<p><b>' + h_(q.name) + '</b><br>+91 ' + h_(q.phone) + (q.email ? ' · ' + h_(q.email) : '') + (q.city ? '<br>' + h_(q.city) : '') + '</p>' +
      '<p><b>Asked about:</b></p><ul>' + q.items.map(function (i) { return '<li>' + h_(i) + '</li>'; }).join('') + '</ul>' +
      (q.message ? '<p>Message: <i>' + h_(q.message) + '</i></p>' : '') +
      '<p><a href="https://wa.me/91' + h_(q.phone) + '">WhatsApp them</a> · <a href="' + h_(cfg.siteUrl) + '/admin/">Open dashboard</a></p></div>',
    name: cfg.farmName + ' Requests'
  });
}

function sendRequestConfirmation_(q, cfg) {
  MailApp.sendEmail({
    to: q.email,
    replyTo: cfg.email || undefined,
    subject: 'We received your request ' + q.ref + ' — ' + cfg.farmName,
    htmlBody: '<div style="font-family:Arial,sans-serif;max-width:560px;color:#2a1f14">' +
      '<h2 style="font-family:Georgia,serif;font-weight:normal">Thank you, ' + h_(String(q.name).split(' ')[0]) + '!</h2>' +
      '<p>We have your request and will call or WhatsApp you on +91 ' + h_(q.phone) + ' within one working day with availability and price.</p>' +
      '<p style="background:#f3e6c8;padding:12px;border-radius:8px">Request reference: <b>' + h_(q.ref) + '</b></p>' +
      '<p><b>You asked about:</b></p><ul>' + q.items.map(function (i) { return '<li>' + h_(i) + '</li>'; }).join('') + '</ul>' +
      '<p>Questions? Reply to this email or call ' + h_(cfg.phone) + '.</p>' +
      '<p style="color:#6d5e4b;font-size:12px">' + h_(cfg.farmName) + ' · You received this email because you sent a request on our website. ' +
      '<a href="' + h_(cfg.siteUrl) + '/privacy.html">Privacy Policy</a></p></div>',
    name: cfg.farmName
  });
}

/* ------------------------------------------------------------------ */
/*  ADMIN                                                              */
/* ------------------------------------------------------------------ */

function listOrders_() {
  var sheet = getSheet_();
  var last = sheet.getLastRow();
  if (last < 2) return { ok: true, orders: [] };
  var tz = Session.getScriptTimeZone();
  var values = sheet.getRange(2, 1, last - 1, HEADERS.length).getValues();
  var orders = values.filter(function (r) { return r[0]; }).map(function (r) {
    var get = function (h) { return r[COL[h] - 1]; };
    var iso = function (v) { return v instanceof Date ? v.toISOString() : String(v || ''); };
    var dateOnly = function (v) { return v instanceof Date ? Utilities.formatDate(v, tz, 'yyyy-MM-dd') : String(v || ''); };
    var items = [];
    try { items = JSON.parse(get('Items JSON') || '[]'); } catch (e) {}
    return {
      ref: String(get('Booking Ref')), type: String(get('Type') || 'Order'), orderDate: iso(get('Order Date')), status: String(get('Status') || 'New'),
      name: String(get('Customer Name')), phone: String(get('Phone')), email: String(get('Email')),
      address: String(get('Address')), city: String(get('City')), pincode: String(get('PIN Code')),
      itemsText: String(get('Products')), items: items, totalQty: Number(get('Total Qty')) || 0,
      subtotal: Number(get('Subtotal')) || 0, deliveryFee: Number(get('Delivery Fee')) || 0, total: Number(get('Order Value')) || 0,
      deliveryDate: dateOnly(get('Preferred Delivery Date')), deliverySlot: String(get('Preferred Time')),
      message: String(get('Customer Message')), marketingOptIn: String(get('Newsletter Opt-in')),
      paymentStatus: String(get('Payment Status')), paymentRef: String(get('Payment Ref')), updatedAt: iso(get('Last Updated'))
    };
  });
  return { ok: true, orders: orders };
}

function updateStatus_(ref, status) {
  if (STATUSES.indexOf(status) < 0) throw userError('Invalid status.');
  var row = findRow_(ref);
  if (!row) throw userError('Order not found.');
  var sheet = getSheet_();
  var was = String(sheet.getRange(row, COL['Status']).getValue() || 'New');

  /* Cancelling puts the jars back on the shelf; un-cancelling takes them off again. */
  if (was !== status && String(sheet.getRange(row, COL['Type']).getValue() || 'Order') === 'Order') {
    var items = [];
    try { items = JSON.parse(sheet.getRange(row, COL['Items JSON']).getValue() || '[]'); } catch (e) {}
    if (items.length) {
      var sign = 0;
      if (status === 'Cancelled') sign = 1;
      else if (was === 'Cancelled') sign = -1;
      if (sign !== 0) {
        var lock = LockService.getScriptLock();
        lock.waitLock(15000);
        try { applyStockChange_(items, sign); }
        catch (err) { if (err.isUser) throw err; console.error('Stock adjust failed', err); }
        finally { lock.releaseLock(); }
      }
    }
  }

  sheet.getRange(row, COL['Status']).setValue(status);
  sheet.getRange(row, COL['Last Updated']).setValue(new Date());

  if (prop_('NOTIFY_STATUS_EMAILS', 'false') === 'true' && status !== 'New') {
    try {
      var r = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
      sendStatusEmail_(r[COL['Email'] - 1], r[COL['Customer Name'] - 1], ref, status, siteSettings_());
    } catch (err) { console.error('Status email failed', err); }
  }
  return { ok: true, ref: ref, status: status };
}

/* Permanently removes a row. Only finished orders can go — a live order
   must be Delivered or Cancelled first, so nothing in progress is lost by
   a mis-tap. Stock is deliberately left alone: a Delivered order really
   did sell those jars, and a Cancelled one already gave them back. */
function deleteOrder_(ref) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var row = findRow_(ref);
    if (!row) throw userError('Order not found. It may already have been deleted.');
    var sheet = getSheet_();
    var data = sheet.getRange(row, 1, 1, HEADERS.length).getValues()[0];
    var status = String(data[COL['Status'] - 1] || '');
    var type = String(data[COL['Type'] - 1] || 'Order');

    if (type === 'Order' && status !== 'Delivered' && status !== 'Cancelled') {
      throw userError('Only Delivered or Cancelled orders can be deleted. Set the status first.', 'NOT_CLOSED');
    }
    sheet.deleteRow(row);
    console.log('Deleted ' + type + ' ' + ref + ' (was ' + status + ')');
  } finally {
    lock.releaseLock();
  }
  return { ok: true, ref: ref, deleted: true };
}

function requireAdmin_(key) {
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('admin_fails') || 0);
  if (fails >= MAX_FAILED_LOGINS) throw userError('Too many wrong attempts. Try again in 15 minutes.', 'AUTH');
  var real = prop_('ADMIN_KEY');
  if (!real || real.length < 12) throw userError('ADMIN_KEY is not set up in Script properties (min 12 characters).');
  if (!safeEqual_(String(key || ''), real)) {
    cache.put('admin_fails', String(fails + 1), 900);
    throw userError('Wrong admin key.', 'AUTH');
  }
}

/* ------------------------------------------------------------------ */
/*  PAYMENTS (ready for Razorpay — inactive until keys are added)      */
/* ------------------------------------------------------------------ */

function createRazorpayOrder_(ref, total) {
  var res = UrlFetchApp.fetch('https://api.razorpay.com/v1/orders', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { Authorization: 'Basic ' + Utilities.base64Encode(prop_('RAZORPAY_KEY_ID') + ':' + prop_('RAZORPAY_KEY_SECRET')) },
    payload: JSON.stringify({ amount: Math.round(total * 100), currency: 'INR', receipt: ref })
  });
  if (res.getResponseCode() >= 300) throw new Error('Razorpay: ' + res.getContentText());
  return JSON.parse(res.getContentText()).id;
}

function verifyPayment_(p) {
  var secret = prop_('RAZORPAY_KEY_SECRET');
  if (!secret) throw userError('Online payment is not enabled.');
  var row = findRow_(p.ref);
  if (!row) throw userError('Order not found.');
  var sheet = getSheet_();
  var stored = String(sheet.getRange(row, COL['Payment Ref']).getValue());
  if (stored !== String(p.razorpay_order_id)) throw userError('Payment does not match this order.');
  var sig = Utilities.computeHmacSha256Signature(p.razorpay_order_id + '|' + p.razorpay_payment_id, secret)
    .map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
  if (!safeEqual_(sig, String(p.razorpay_signature || ''))) throw userError('Payment could not be verified.');
  sheet.getRange(row, COL['Payment Status']).setValue('Paid (online)');
  sheet.getRange(row, COL['Payment Ref']).setValue(String(p.razorpay_payment_id));
  sheet.getRange(row, COL['Last Updated']).setValue(new Date());
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/*  EMAILS                                                             */
/* ------------------------------------------------------------------ */

function itemsTable_(o) {
  var rows = o.items.map(function (i) {
    return '<tr><td style="padding:6px 0">' + h_(i.name) + ' · ' + h_(i.size) + ' × ' + i.qty + '</td><td style="text-align:right">₹' + i.lineTotal + '</td></tr>';
  }).join('');
  return '<table style="width:100%;border-collapse:collapse;font-size:14px">' + rows +
    '<tr><td style="padding:6px 0;border-top:1px solid #ddd">Delivery</td><td style="text-align:right;border-top:1px solid #ddd">' + (o.deliveryFee ? '₹' + o.deliveryFee : 'Free') + '</td></tr>' +
    '<tr><td style="padding:6px 0"><b>Total</b></td><td style="text-align:right"><b>₹' + o.total + '</b></td></tr></table>';
}

/* Shows how much is left after this order, so low stock is obvious. */
function stockAfterTable_(o) {
  var live;
  try { live = readStock_(); } catch (e) { return ''; }
  var rows = o.items.map(function (i) {
    var e = live[stockKey_(i.productId, i.size)];
    if (!e) return '';
    var low = e.stock <= 3;
    return '<tr><td style="padding:4px 0">' + h_(i.name) + ' · ' + h_(i.size) + '</td>' +
      '<td style="text-align:right;' + (low ? 'color:#b3261e;font-weight:bold' : '') + '">' +
      e.stock + ' left' + (low ? ' ⚠' : '') + '</td></tr>';
  }).join('');
  if (!rows) return '';
  return '<p style="margin:16px 0 4px;font-size:13px;color:#6d5e4b"><b>Stock remaining</b></p>' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px">' + rows + '</table>';
}

function notifyOwner_(o, cfg) {
  var to = prop_('OWNER_EMAIL') || Session.getEffectiveUser().getEmail();
  if (!to) return;
  MailApp.sendEmail({
    to: to,
    subject: 'New honey order ' + o.ref + ' — ₹' + o.total + ' from ' + o.name,
    htmlBody: '<div style="font-family:Arial,sans-serif;max-width:560px">' +
      '<h2 style="margin:0 0 8px">New order ' + h_(o.ref) + '</h2>' +
      '<p><b>' + h_(o.name) + '</b><br>+91 ' + h_(o.phone) + ' · ' + h_(o.email) + '<br>' + h_(o.address) + ', ' + h_(o.city) + ' – ' + h_(o.pincode) + '</p>' +
      itemsTable_(o) +
      stockAfterTable_(o) +
      '<p>Preferred delivery: ' + (o.deliveryDate ? h_(o.deliveryDate) + ' ' + h_(o.slot) : 'No preference') + '</p>' +
      (o.message ? '<p>Message: <i>' + h_(o.message) + '</i></p>' : '') +
      '<p><a href="https://wa.me/91' + h_(o.phone) + '">WhatsApp the customer</a> · <a href="' + h_(cfg.siteUrl) + '/admin/">Open dashboard</a></p></div>',
    name: cfg.farmName + ' Orders'
  });
}

function sendCustomerConfirmation_(o, cfg) {
  MailApp.sendEmail({
    to: o.email,
    replyTo: cfg.email || undefined,
    subject: 'We received your booking ' + o.ref + ' — ' + cfg.farmName,
    htmlBody: '<div style="font-family:Arial,sans-serif;max-width:560px;color:#2a1f14">' +
      '<h2 style="font-family:Georgia,serif;font-weight:normal">Thank you, ' + h_(o.name.split(' ')[0]) + '!</h2>' +
      '<p>Your honey is reserved. We will call or WhatsApp you on +91 ' + h_(o.phone) + ' within one working day to confirm delivery. No payment is needed yet.</p>' +
      '<p style="background:#f3e6c8;padding:12px;border-radius:8px">Booking reference: <b>' + h_(o.ref) + '</b></p>' +
      itemsTable_(o) +
      '<p>Delivering to: ' + h_(o.address) + ', ' + h_(o.city) + ' – ' + h_(o.pincode) + '</p>' +
      '<p>Questions? Reply to this email or call ' + h_(cfg.phone) + '.</p>' +
      '<p style="color:#6d5e4b;font-size:12px">' + h_(cfg.farmName) + ' · You received this email because you placed an order on our website. ' +
      '<a href="' + h_(cfg.siteUrl) + '/privacy.html">Privacy Policy</a></p></div>',
    name: cfg.farmName
  });
}

function sendStatusEmail_(to, name, ref, status, cfg) {
  if (!to) return;
  var lines = {
    Confirmed: 'Good news — your order is confirmed. We will let you know when it is on its way.',
    Dispatched: 'Your honey is on its way! It should reach you soon.',
    Delivered: 'Your order has been delivered. We hope you enjoy it — we would love to hear what you think.',
    Cancelled: 'Your order has been cancelled. If this is unexpected, please reply to this email.'
  };
  MailApp.sendEmail({
    to: String(to), subject: 'Order ' + ref + ' — ' + status, name: cfg.farmName, replyTo: cfg.email || undefined,
    htmlBody: '<div style="font-family:Arial,sans-serif;max-width:560px"><p>Hello ' + h_(String(name).split(' ')[0]) + ',</p><p>' + lines[status] +
      '</p><p>Booking reference: <b>' + h_(ref) + '</b></p><p>— ' + h_(cfg.farmName) + ', ' + h_(cfg.phone) + '</p></div>'
  });
}

/* ------------------------------------------------------------------ */
/*  STOCK  —  the Stock sheet is the live source of truth              */
/* ------------------------------------------------------------------ */

function stockKey_(productId, size) {
  return String(productId).trim().toLowerCase() + '|' + String(size).trim().toLowerCase();
}

function getStockSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(STOCK_SHEET);
  if (!sh) {
    sh = ss.insertSheet(STOCK_SHEET);
    sh.getRange(1, 1, 1, STOCK_HEADERS.length).setValues([STOCK_HEADERS])
      .setFontWeight('bold').setBackground('#2c4431').setFontColor('#ffffff');
    sh.setFrozenRows(1);
    sh.setColumnWidths(1, STOCK_HEADERS.length, 130);
    seedStock_(sh);
  }
  return sh;
}

/* Fills the Stock sheet from products.js. Only ADDS missing rows —
   it never overwrites a stock number you have edited by hand. */
function seedStock_(sh) {
  sh = sh || getStockSheet_();
  var catalog;
  try { catalog = loadCatalog_(); } catch (e) { console.error('Could not read products.js to seed stock', e); return 0; }

  var existing = readStock_(sh);
  var added = [];
  Object.keys(catalog).forEach(function (pid) {
    var p = catalog[pid];
    (p.sizes || []).forEach(function (s) {
      if (existing[stockKey_(p.id, s.label)]) return;
      var row = [];
      row[SCOL['Product ID'] - 1] = String(p.id);
      row[SCOL['Product Name'] - 1] = safe_(String(p.name || ''));
      row[SCOL['Size'] - 1] = safe_(String(s.label));
      row[SCOL['Price'] - 1] = Number(s.price) || 0;
      row[SCOL['In Stock'] - 1] = Number(s.stock) || 0;
      row[SCOL['Total Sold'] - 1] = 0;
      row[SCOL['Last Updated'] - 1] = new Date();
      added.push(row);
    });
  });
  if (added.length) sh.getRange(sh.getLastRow() + 1, 1, added.length, STOCK_HEADERS.length).setValues(added);
  return added.length;
}

/* Returns { "productid|size": { row, stock, sold, price, name } } */
function readStock_(sh) {
  sh = sh || getStockSheet_();
  var last = sh.getLastRow();
  var map = {};
  if (last < 2) return map;
  var values = sh.getRange(2, 1, last - 1, STOCK_HEADERS.length).getValues();
  values.forEach(function (r, i) {
    var pid = r[SCOL['Product ID'] - 1], size = r[SCOL['Size'] - 1];
    if (!pid || !size) return;
    map[stockKey_(pid, size)] = {
      row: i + 2,
      stock: Number(r[SCOL['In Stock'] - 1]) || 0,
      sold: Number(r[SCOL['Total Sold'] - 1]) || 0,
      price: Number(r[SCOL['Price'] - 1]) || 0,
      name: String(r[SCOL['Product Name'] - 1] || '')
    };
  });
  return map;
}

/* sign = -1 when an order is placed (stock down, sold up)
   sign = +1 when an order is cancelled (stock back, sold down)
   Call this INSIDE a script lock. */
function applyStockChange_(items, sign, catalog) {
  var sh = getStockSheet_();
  var live = readStock_(sh);

  // Make sure every line has a row; create it from products.js if missing.
  var missing = items.filter(function (i) { return !live[stockKey_(i.productId, i.size)]; });
  if (missing.length) {
    seedStock_(sh);
    live = readStock_(sh);
  }

  if (sign < 0) {
    items.forEach(function (i) {
      var e = live[stockKey_(i.productId, i.size)];
      var have = e ? e.stock : 0;
      if (have < i.qty) {
        throw userError(i.name + ' (' + i.size + '): only ' + have + ' left. Please lower the quantity and try again.', 'STOCK');
      }
    });
  }

  var now = new Date();
  items.forEach(function (i) {
    var e = live[stockKey_(i.productId, i.size)];
    if (!e) return;
    var newStock = Math.max(0, e.stock + sign * i.qty);
    var newSold = Math.max(0, e.sold - sign * i.qty);
    sh.getRange(e.row, SCOL['In Stock']).setValue(newStock);
    sh.getRange(e.row, SCOL['Total Sold']).setValue(newSold);
    sh.getRange(e.row, SCOL['Last Updated']).setValue(now);
  });
  SpreadsheetApp.flush();
}

/* Public: the website calls this to show live "only N left" numbers. */
function getStockPublic_() {
  var live = readStock_();
  var out = {};
  Object.keys(live).forEach(function (k) {
    var parts = k.split('|');
    if (!out[parts[0]]) out[parts[0]] = {};
    out[parts[0]][parts[1]] = live[k].stock;
  });
  return { ok: true, stock: out, at: new Date().toISOString() };
}

/* Admin: the full Stock sheet, for the dashboard's Stock panel. */
function listStockAdmin_() {
  var sh = getStockSheet_();
  var last = sh.getLastRow();
  if (last < 2) return { ok: true, rows: [] };
  var tz = Session.getScriptTimeZone();
  var values = sh.getRange(2, 1, last - 1, STOCK_HEADERS.length).getValues();
  var rows = values.filter(function (r) { return r[SCOL['Product ID'] - 1] && r[SCOL['Size'] - 1]; }).map(function (r) {
    var u = r[SCOL['Last Updated'] - 1];
    return {
      productId: String(r[SCOL['Product ID'] - 1]),
      name: String(r[SCOL['Product Name'] - 1] || ''),
      size: String(r[SCOL['Size'] - 1]),
      price: Number(r[SCOL['Price'] - 1]) || 0,
      stock: Number(r[SCOL['In Stock'] - 1]) || 0,
      sold: Number(r[SCOL['Total Sold'] - 1]) || 0,
      updated: u instanceof Date ? Utilities.formatDate(u, tz, 'dd MMM, HH:mm') : ''
    };
  });
  return { ok: true, rows: rows };
}

/* Admin: set a stock number by hand (used by the dashboard). */
function setStock_(productId, size, stock) {
  var n = parseInt(stock, 10);
  if (isNaN(n) || n < 0 || n > 100000) throw userError('Stock must be a number between 0 and 100000.');
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var sh = getStockSheet_();
    var live = readStock_(sh);
    var e = live[stockKey_(productId, size)];
    if (!e) throw userError('That product and size is not in the Stock sheet.');
    sh.getRange(e.row, SCOL['In Stock']).setValue(n);
    sh.getRange(e.row, SCOL['Last Updated']).setValue(new Date());
  } finally {
    lock.releaseLock();
  }
  return { ok: true, productId: productId, size: size, stock: n };
}

/* Run this by hand after you add a new product or size to products.js. */
function syncStockFromProducts() {
  var n = seedStock_();
  console.log(n ? 'Added ' + n + ' new size row(s) to the Stock sheet.' : 'Stock sheet is already up to date.');
}

/* ------------------------------------------------------------------ */
/*  CATALOGUE & SITE SETTINGS (read from your live website)            */
/* ------------------------------------------------------------------ */

function siteUrl_() {
  var u = prop_('SITE_URL');
  if (!u) throw new Error('SITE_URL script property is not set.');
  return u.replace(/\/+$/, '');
}

function fetchText_(path, cacheKey) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(cacheKey);
  if (hit) return hit;
  var res = UrlFetchApp.fetch(siteUrl_() + '/' + path + '?v=' + Date.now(), { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('Could not load ' + path + ' (' + res.getResponseCode() + ')');
  var text = res.getContentText();
  if (text.length < 90000) cache.put(cacheKey, text, 300); // 5-minute cache
  return text;
}

function loadCatalog_() {
  var text = fetchText_('config/products.js', 'catalog_js');
  var a = text.indexOf('/*JSON-START*/'), b = text.indexOf('/*JSON-END*/');
  if (a < 0 || b < 0) throw new Error('products.js is missing the JSON-START / JSON-END markers.');
  var data = JSON.parse(text.substring(a + 14, b));
  var map = {};
  (data.products || []).forEach(function (p) { map[p.id] = p; });
  return map;
}

function loadRequestCatalog_() {
  var text = fetchText_('config/products.js', 'catalog_js');
  var a = text.indexOf('/*JSON-START*/'), b = text.indexOf('/*JSON-END*/');
  if (a < 0 || b < 0) throw new Error('products.js is missing the JSON-START / JSON-END markers.');
  var data = JSON.parse(text.substring(a + 14, b));
  var map = {};
  (data.requestItems || []).forEach(function (p) { if (p.available !== false) map[p.id] = p; });
  return map;
}

/* ------------------------------------------------------------------ */
/*  DELIVERY  —  total weight × distance zone                          */
/*  Reads the JSON block between the DELIVERY markers in               */
/*  config/site-config.js, so the website and this backend can never   */
/*  disagree about a price.                                            */
/* ------------------------------------------------------------------ */

function deliveryPricing_() {
  var t = fetchText_('config/site-config.js', 'siteconfig_js');
  var a = t.indexOf('/*DELIVERY-START*/'), b = t.indexOf('/*DELIVERY-END*/');
  if (a < 0 || b < 0) throw new Error('site-config.js is missing the DELIVERY-START / DELIVERY-END markers.');
  return JSON.parse(t.substring(a + 18, b));
}

/* Weight of one bottle in grams, from the size label. */
function itemGrams_(sizeLabel) {
  var p;
  try { p = deliveryPricing_(); } catch (e) { p = {}; }
  var w = (p.sizeWeights || {})[sizeLabel];
  if (w != null) return Number(w) || 0;
  var m = String(sizeLabel || '').match(/([\d.]+)\s*(kg|g)\b/i);
  if (!m) return 0;
  return Math.round(parseFloat(m[1]) * (m[2].toLowerCase() === 'kg' ? 1000 : 1));
}

/* Longest matching PIN prefix wins, so "6915" (local) beats "691" (near). */
function deliveryZone_(pincode, p) {
  var pin = String(pincode || '').replace(/\D/g, '');
  var best = null, bestLen = -1;
  (p.zones || []).forEach(function (z) {
    (z.prefixes || []).forEach(function (pre) {
      if (pin.indexOf(pre) === 0 && pre.length > bestLen) { best = z.zone; bestLen = pre.length; }
    });
  });
  return best || p.defaultZone || 'mid';
}

/* A standing offer on a town or region. Longest matching prefix wins. */
function deliveryOffer_(pincode, p) {
  var pin = String(pincode || '').replace(/\D/g, '');
  var best = null, bestLen = -1;
  (p.offers || []).forEach(function (o) {
    (o.prefixes || []).forEach(function (pre) {
      if (pin.indexOf(pre) === 0 && pre.length > bestLen) { best = o; bestLen = pre.length; }
    });
  });
  return best;
}

/* Order: zone rate -> offer percentage -> bulk-order discount -> floor at 0. */
function deliveryFor_(subtotal, totalGrams, pincode) {
  if (!subtotal) return 0;
  var p;
  try { p = deliveryPricing_(); } catch (e) { console.error('Delivery pricing unreadable', e); return 0; }

  var zone = deliveryZone_(pincode, p);
  var rows = p.rates || [], row = null;
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].maxGrams == null || totalGrams <= rows[i].maxGrams) { row = rows[i]; break; }
  }
  if (!row) return 0;

  var fee = Number(row[zone] || 0);

  var offer = deliveryOffer_(pincode, p);
  if (offer && offer.percentOff) {
    fee = Math.round(fee * (1 - Number(offer.percentOff) / 100));
  }

  if (p.discountAbove && subtotal >= p.discountAbove) {
    fee = fee - Number(p.discountAmount || 0);
  }
  return Math.max(0, fee);
}

function siteSettings_() {
  var t = '';
  try { t = fetchText_('config/site-config.js', 'siteconfig_js'); } catch (e) { console.error(e); }
  var num = function (key, def) { var m = t.match(new RegExp(key + '\\s*:\\s*(\\d+)')); return m ? Number(m[1]) : def; };
  var str = function (key, def) { var m = t.match(new RegExp(key + '\\s*:\\s*"([^"]*)"')); return m ? m[1] : def; };
  return {
    farmName: str('farmName', 'Our Honey Farm'), phone: str('phone', ''), email: str('email', ''),
    maxQty: num('maxQuantityPerItem', 20),
    siteUrl: prop_('SITE_URL', '').replace(/\/+$/, '')
  };
}

/* ------------------------------------------------------------------ */
/*  HELPERS                                                            */
/* ------------------------------------------------------------------ */

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { setup(); sh = ss.getSheetByName(SHEET_NAME); }
  return sh;
}

function findRow_(ref) {
  if (!ref || !/^[A-Z]{2,4}-\d{6}-[A-Z0-9]{4,6}$/.test(String(ref))) return 0;
  var sh = getSheet_();
  var last = sh.getLastRow();
  if (last < 2) return 0;
  var hit = sh.getRange(2, 1, last - 1, 1).createTextFinder(String(ref)).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}

function setCell_(ref, header, value) {
  var row = findRow_(ref);
  if (row) getSheet_().getRange(row, COL[header]).setValue(value);
}

function newRef_(d, prefix) {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', r = '';
  for (var i = 0; i < 5; i++) r += chars.charAt(Math.floor(Math.random() * chars.length));
  return (prefix || 'HNY') + '-' + Utilities.formatDate(d, Session.getScriptTimeZone(), 'yyMMdd') + '-' + r;
}

function rateLimit_(key, max, seconds, msg) {
  var cache = CacheService.getScriptCache();
  var n = Number(cache.get(key) || 0);
  if (n >= max) throw userError(msg);
  cache.put(key, String(n + 1), seconds);
}

function clean_(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, max);
}
/* Stops spreadsheet "formula injection" (cells starting with = + - @). */
function safe_(v) { v = String(v == null ? '' : v); return /^[=+\-@]/.test(v) ? "'" + v : v; }
function h_(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
function prop_(k, def) { var v = PropertiesService.getScriptProperties().getProperty(k); return v == null || v === '' ? (def === undefined ? '' : def) : v; }
function safeEqual_(a, b) {
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
function userError(msg, code) { var e = new Error(msg); e.isUser = true; e.code = code || 'VALIDATION'; return e; }
function json(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

/* ------------------------------------------------------------------ */
/*  ONE-TIME SETUP — select "setup" in the toolbar and press Run       */
/* ------------------------------------------------------------------ */

function setup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
  sh.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold').setBackground('#2c4431').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  sh.getRange('B:B').setNumberFormat('dd mmm yyyy, hh:mm');
  sh.getRange(1, COL['Phone'], sh.getMaxRows(), 1).setNumberFormat('@');
  sh.getRange(1, COL['PIN Code'], sh.getMaxRows(), 1).setNumberFormat('@');
  sh.getRange(2, COL['Order Value'], sh.getMaxRows() - 1, 1).setNumberFormat('₹#,##0');
  sh.getRange(2, COL['Status'], sh.getMaxRows() - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).setAllowInvalid(false).build());
  sh.hideColumns(COL['Items JSON']);
  sh.getRange(2, COL['Type'], sh.getMaxRows() - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['Order', 'Request'], true).setAllowInvalid(false).build());
  sh.setColumnWidths(1, HEADERS.length, 140);

  var props = PropertiesService.getScriptProperties();
  if (!props.getProperty('ADMIN_KEY')) {
    var key = Utilities.getUuid().replace(/-/g, '').slice(0, 20);
    props.setProperty('ADMIN_KEY', key);
    console.log('Your new ADMIN_KEY is: ' + key + '  (also visible in Project Settings → Script properties)');
  }
  if (!props.getProperty('SEND_CUSTOMER_EMAIL')) props.setProperty('SEND_CUSTOMER_EMAIL', 'true');
  if (!props.getProperty('NOTIFY_STATUS_EMAILS')) props.setProperty('NOTIFY_STATUS_EMAILS', 'false');

  /* Stock sheet — needs SITE_URL to read products.js, so it may be empty
     on the very first run. Run syncStockFromProducts() afterwards. */
  try {
    var stock = getStockSheet_();
    stock.getRange(2, SCOL['Price'], stock.getMaxRows() - 1, 1).setNumberFormat('₹#,##0');
    stock.getRange(2, SCOL['Last Updated'], stock.getMaxRows() - 1, 1).setNumberFormat('dd mmm yyyy, hh:mm');
    console.log('Stock sheet ready with ' + Math.max(0, stock.getLastRow() - 1) + ' size row(s).');
  } catch (e) {
    console.log('Stock sheet created but empty — set SITE_URL, then run syncStockFromProducts().');
  }

  console.log('Setup complete. Now set SITE_URL in Script properties, then Deploy → New deployment → Web app.');
}

/* Optional: run this to check that the backend can read your live products. */
function testCatalog() {
  var c = loadCatalog_();
  console.log('Loaded ' + Object.keys(c).length + ' products: ' + Object.keys(c).join(', '));
  console.log('Settings: ' + JSON.stringify(siteSettings_()));
}
