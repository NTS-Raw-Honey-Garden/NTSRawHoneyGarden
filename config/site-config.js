/* =====================================================================
   SITE CONFIGURATION  —  edit this file to change farm details.
   ---------------------------------------------------------------------
   You do NOT need to know coding. Only change the text between quotes
   "like this", keep the commas at the end of each line, and save.
   ===================================================================== */

window.SITE_CONFIG = {

  /* ---------- Farm identity ---------- */
  farmName: "NTS Honey Garden",
  tagline: "Raw. Pure. Natural.",
  strapline: "From Our Hive to Your Home",
  foundedYear: "2018",
  region: "Kollam, Kerala, India",
  regionShort: "Parippally",

  /* ---------- Contact details ---------- */
  phone: "+91 8547478411",
  whatsappNumber: "918547478411",
  address: "NTS Honey Garden, Parippally",
  location: "https://maps.app.goo.gl/w4FGyFiy28UCYyMx6",

  /* ---------- Social links (leave "" to hide) ---------- */

  /* ---------- Map (optional) ---------- */
  mapEmbedUrl: "",

  /* ---------- Order backend ---------- */
  orderBackendUrl: "https://script.google.com/macros/s/AKfycbwMkfUVZVaDTw0ik86r_5RnIOq7v3O8dvyC5X-Pp7TDwx89O5pf0hpKqnV2DxZVhrAqfg/exec",

  /* ---------- Delivery rules ---------- */
  currency: "₹",
  minDeliveryDaysAhead: 5,
  deliverySlots: ["Morning (9 am – 12 pm)", "Afternoon (12 – 4 pm)", "Evening (4 – 8 pm)", "Any time"],
  maxQuantityPerItem: 20,

  /* ---------- Delivery pricing ----------
     The charge comes from TWO things: the TOTAL weight of the order (every
     bottle added together, whatever the sizes) and which distance zone the
     customer's PIN code falls in.

     Everything between DELIVERY-START and DELIVERY-END must stay valid JSON:
     "double quotes" around every name, commas between items but NOT after the
     last one, no comments inside. The website and the order backend both read
     this block, so they can never disagree on a price. Check edits at
     https://jsonlint.com (paste only the part between the markers). */
  deliveryPricing: /*DELIVERY-START*/ {

    "originPincode": "691574",

    "sizeWeights": { "250 g": 250, "500 g": 500, "1 kg": 1000 },

    "zones": [
      { "zone": "local", "label": "Within 20 km",
        "prefixes": ["6915"] },

      { "zone": "near",  "label": "20 – 200 km",
        "prefixes": ["691", "695", "690", "689", "688", "686", "685", "683", "682",
                     "629", "628", "627"] },

      { "zone": "far",   "label": "Over 2,000 km",
        "prefixes": ["1", "2", "7", "8", "30", "31", "32", "33", "34"] }
    ],

    "defaultZone": "mid",
    "defaultZoneLabel": "200 – 2,000 km",

    "rates": [
      { "maxGrams": 250,  "local": 0, "near": 50, "mid": 85, "far": 120 },
      { "maxGrams": 500,  "local": 0, "near": 85,   "mid": 100, "far": 120 },
      { "maxGrams": 1000, "local": 0, "near": 85,  "mid": 130, "far": 180 },
      { "maxGrams": 3000, "local": 0, "near": 150, "mid": 250, "far": 350 },
      { "maxGrams": 5000, "local": 0, "near": 230, "mid": 450, "far": 600 },
      { "maxGrams": null, "local": 0, "near": 300, "mid": 600, "far": 800 }
    ],

    "offers": [
      { "label": "Bengaluru & Tirupati offer — 50% off delivery",
        "percentOff": 25,
        "prefixes": ["560", "562", "5175"] }
    ],

    "discountAbove": 2000,
    "discountPercentOff": 10

  } /*DELIVERY-END*/,

  /* ---------- Payment ---------- */
  payment: {
    provider: "none",
    upiId: "sudanvs@icici",
    razorpayKeyId: "rzp_test_TpjzQxxIcYhPxa"
  },

  /* ---------- SEO ---------- */
  siteUrl: "https://nts-raw-honey-garden.github.io/NTSRawHoneyGarden",
  metaDescription: "Raw, pure, golden honey from our own garden hives in Kerala. വൻതേൻ (Vanthen) honey in 250 g, 500 g and 1 kg. Order online.",

  /* ---------- Analytics (optional) ---------- */
  analyticsId: ""
};
