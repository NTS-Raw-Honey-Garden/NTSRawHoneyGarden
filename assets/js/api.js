/* =====================================================================
   api.js — the ONLY file that talks to the backend.
   ---------------------------------------------------------------------
   • OrderAPI   : sends a new order to the backend (Google Apps Script),
                  or falls back to "WhatsApp mode" when no backend URL is set.
   • AdminAPI   : used by the owner dashboard (list orders, change status).
   • Payments   : pluggable payment providers. "none" today; "razorpay"
                  is prepared for later (see documentation/06-future-features.md).
   To move to a different backend later (Firebase, Supabase, your own
   server), only this file needs to change.
   ===================================================================== */
(function () {
  "use strict";
  var C = window.SITE_CONFIG || {};
  var TIMEOUT_MS = 25000;

  function post(body) {
    var ctrl = "AbortController" in window ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS) : null;
    // text/plain avoids a CORS "preflight", which Google Apps Script does not support.
    return fetch(C.orderBackendUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined,
      redirect: "follow"
    }).then(function (res) {
      if (timer) clearTimeout(timer);
      if (!res.ok) throw new Error("Server returned " + res.status);
      return res.json();
    }).then(function (data) {
      if (!data || data.ok !== true) {
        var err = new Error((data && data.error) || "Unknown server error");
        err.code = data && data.code;
        throw err;
      }
      return data;
    }).catch(function (e) {
      if (timer) clearTimeout(timer);
      if (e.name === "AbortError") throw new Error("The request took too long. Please check your connection and try again.");
      throw e;
    });
  }

  function localRef() {
    var d = new Date();
    var ymd = d.getFullYear().toString().slice(2) + String(d.getMonth() + 1).padStart(2, "0") + String(d.getDate()).padStart(2, "0");
    var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789", r = "";
    for (var i = 0; i < 4; i++) r += chars[Math.floor(Math.random() * chars.length)];
    return "WA-" + ymd + "-" + r;
  }

  window.OrderAPI = {
    hasBackend: function () { return !!C.orderBackendUrl; },

    /* order = { items:[{productId,size,qty}], customer:{...}, delivery:{...}, message, consent, marketingOptIn } */
    submit: function (order) {
      if (!C.orderBackendUrl) {
        // WhatsApp mode: nothing is stored. The customer sends the summary to the farm.
        return Promise.resolve({ ok: true, mode: "whatsapp", ref: localRef() });
      }
      return post({ action: "createOrder", order: order, paymentProvider: (C.payment || {}).provider || "none" });
    },

    confirmPayment: function (payload) {
      return post({ action: "verifyPayment", payment: payload });
    }
  };

  window.AdminAPI = {
    call: function (action, key, extra) {
      if (!C.orderBackendUrl) return Promise.reject(new Error("No backend configured. Add orderBackendUrl in config/site-config.js."));
      var body = { action: action, adminKey: key };
      for (var k in extra || {}) body[k] = extra[k];
      return post(body);
    }
  };

  /* ---------------- Payment providers ----------------
     Each provider has collect(serverOrder) -> Promise<{status, reference}>
     status: "pending" (pay later / on delivery), "paid", or "failed". */
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) return resolve();
      var s = document.createElement("script");
      s.src = src; s.onload = resolve; s.onerror = function () { reject(new Error("Could not load payment window.")); };
      document.head.appendChild(s);
    });
  }

  window.Payments = {
    none: {
      label: "Pay on delivery or by UPI after we confirm",
      collect: function () { return Promise.resolve({ status: "pending", reference: "" }); }
    },

    /* Razorpay — ready for later. Requires: payment.provider = "razorpay",
       payment.razorpayKeyId (PUBLIC key) here, and RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET
       set as Script Properties in the backend, which creates the Razorpay order. */
    razorpay: {
      label: "Pay online (UPI, cards, netbanking)",
      collect: function (serverOrder, customer) {
        if (!serverOrder.razorpayOrderId) return Promise.reject(new Error("Online payment is not set up on the server yet."));
        return loadScript("https://checkout.razorpay.com/v1/checkout.js").then(function () {
          return new Promise(function (resolve) {
            var rz = new window.Razorpay({
              key: C.payment.razorpayKeyId,
              amount: Math.round(serverOrder.total * 100),
              currency: "INR",
              name: C.farmName,
              description: "Order " + serverOrder.ref,
              order_id: serverOrder.razorpayOrderId,
              prefill: { name: customer.name, email: customer.email, contact: customer.phone },
              theme: { color: "#2c4431" },
              handler: function (resp) {
                window.OrderAPI.confirmPayment({
                  ref: serverOrder.ref,
                  razorpay_order_id: resp.razorpay_order_id,
                  razorpay_payment_id: resp.razorpay_payment_id,
                  razorpay_signature: resp.razorpay_signature
                }).then(function () { resolve({ status: "paid", reference: resp.razorpay_payment_id }); })
                  .catch(function () { resolve({ status: "failed", reference: resp.razorpay_payment_id }); });
              },
              modal: { ondismiss: function () { resolve({ status: "pending", reference: "" }); } }
            });
            rz.open();
          });
        });
      }
    },

    current: function () {
      var name = (C.payment && C.payment.provider) || "none";
      return window.Payments[name] || window.Payments.none;
    }
  };
})();
