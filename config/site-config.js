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
  region: "Your District, Kerala, India",          // Shown on the About page
  regionShort: "Kerala",

  /* ---------- Contact details (shown on site & order confirmation) ---------- */
  phone: "+91 8547478411",              // Shown to customers
  whatsappNumber: "918547478411",         // Country code + number, digits only (no + or spaces)
  email: "ntshoneygarden@gmail.com",
  address: "Parippally, Kollam, Kerala – 691574",
  fssaiLicense: "FSSAI Lic. No. 21326150000831",   

  /* ---------- Social links (leave "" to hide) ---------- */
  instagram: "https://instagram.com/ntshoneygarden",
  facebook: "",
  youtube: "",

  /* ---------- Map (optional) ----------
     Paste a Google Maps "Embed a map" src URL here to show a map on the About page.
     Leave "" to hide the map. */
  mapEmbedUrl: "",

  /* ---------- Order backend ----------
     Paste the Google Apps Script "Web app URL" here after following
     documentation/02-backend-setup.md. While it is "", the site runs in
     WHATSAPP MODE: orders are not stored, and the customer is asked to
     send the order summary to you on WhatsApp instead. */
  orderBackendUrl: "https://script.google.com/macros/s/AKfycbxS1K97SGQziKd_lRvkZELVCEnYAwqeXVHkFFbwmgs9hZRh7uKcph8_ip-U-bk1O4j4qA/exec",

  /* ---------- Delivery rules ---------- */
  currency: "₹",
  minDeliveryDaysAhead: 15,       // Earliest delivery date = today + this many days
  deliverySlots: ["Morning (9 am – 12 pm)", "Afternoon (12 – 4 pm)", "Evening (4 – 8 pm)", "Any time"],
  maxQuantityPerItem: 20,

  /* ---------- Delivery pricing ----------
     Delivery is worked out from TWO things:
       1. the TOTAL weight of the order (all bottles added together), and
       2. which distance zone the customer's PIN code falls in.

     IMPORTANT: everything between the DELIVERY-START and DELIVERY-END markers
     must stay valid JSON — "double quotes" around every name, commas between
     items but NOT after the last one, and no comments inside. The website and
     the order backend BOTH read this block, so they always agree on the price.
     Check edits at https://jsonlint.com (paste only the part between markers). */
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

    "rates": [
      { "maxGrams": 250,  "local": 0, "near": 0,   "mid": 100, "far": 100 },
      { "maxGrams": 1000, "local": 0, "near": 70,  "mid": 150, "far": 200 },
      { "maxGrams": 3000, "local": 0, "near": 140, "mid": 300, "far": 400 },
      { "maxGrams": 5000, "local": 0, "near": 210, "mid": 450, "far": 600 },
      { "maxGrams": null, "local": 0, "near": 280, "mid": 600, "far": 800 }
    ],

    "discountAbove": 2000,
    "discountAmount": 200,

    "offers": [
      { "label": "50% off delivery", "percentOff": 50,
        "prefixes": ["517619", "517501"] }
    ]

  } /*DELIVERY-END*/,

  /* ---------- Payment ----------
     "none"     = customer pays by UPI after confirmation (current setup)
     "razorpay" = online payment (see documentation/06-future-features.md before switching) */
  payment: {
    provider: "razorpay",
    upiId: "sudanvs@icic",   // Shown in confirmation as a payment option (leave "" to hide)
    razorpayKeyId: "rzp_test_TpjzQxxIcYhPxa"              // PUBLIC key id only. Never put a secret key in this file.
  },

  /* ---------- SEO ---------- */
  siteUrl: "https://nts-raw-honey-garden.github.io/NTSRawHoneyGarden",   // Change if your address changes
  metaDescription: "Raw, pure, golden honey from our own garden hives in Kerala. വൻതേൻ (Vanthen) Indian rock bee honey in 250 g, 500 g and 1 kg. Order online.",

  /* ---------- Analytics (optional) ----------
     Paste a Google Analytics 4 Measurement ID like "G-XXXXXXX" to enable. */
  analyticsId: ""
};
