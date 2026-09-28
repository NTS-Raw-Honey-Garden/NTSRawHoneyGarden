/* =====================================================================
   SITE CONFIGURATION  —  edit this file to change farm details.
   ---------------------------------------------------------------------
   You do NOT need to know coding. Only change the text between quotes
   "like this", keep the commas at the end of each line, and save.
   ===================================================================== */

window.SITE_CONFIG = {

  /* ---------- Farm identity ---------- */
  farmName: "Madhuvana Raw Honey",        // Your brand / farm name
  tagline: "Raw honey, straight from our hives",
  foundedYear: "2014",
  region: "Your District, Your State, India",   // Shown on About page
  regionShort: "Your District",

  /* ---------- Contact details (shown on site & order confirmation) ---------- */
  phone: "+91 90000 00000",              // Shown to customers
  whatsappNumber: "919000000000",         // Country code + number, digits only (no + or spaces)
  email: "hello@yourfarm.in",
  address: "Farm Road, Your Village, Your District, Your State – 000000",
  businessHours: "Mon–Sat, 9:00 am – 6:00 pm",
  fssaiLicense: "FSSAI Lic. No. 00000000000000",   // Add your FSSAI registration number

  /* ---------- Social links (leave "" to hide) ---------- */
  instagram: "https://instagram.com/yourfarm",
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
  orderBackendUrl: "",

  /* ---------- Delivery rules ---------- */
  currency: "₹",
  deliveryFee: 60,               // Flat delivery charge in rupees
  freeDeliveryAbove: 999,        // Orders at or above this get free delivery (0 = never free)
  minDeliveryDaysAhead: 2,       // Earliest delivery date = today + this many days
  deliverySlots: ["Morning (9 am – 12 pm)", "Afternoon (12 – 4 pm)", "Evening (4 – 8 pm)", "Any time"],
  maxQuantityPerItem: 20,

  /* ---------- Payment ----------
     "none"     = customer pays on delivery / by UPI after confirmation (current setup)
     "razorpay" = online payment (see documentation/06-future-features.md before switching) */
  payment: {
    provider: "none",
    upiId: "yourfarm@upi",       // Shown in confirmation as a payment option (leave "" to hide)
    razorpayKeyId: ""            // PUBLIC key id only. Never put a secret key in this file.
  },

  /* ---------- SEO ---------- */
  siteUrl: "https://yourusername.github.io/honey-farm-website",   // Change after deploying / adding a domain
  metaDescription: "Small-batch raw honey from our own hives — unheated, unfiltered and bottled by hand. Order wildflower, forest and moringa honey online.",

  /* ---------- Analytics (optional) ----------
     Paste a Google Analytics 4 Measurement ID like "G-XXXXXXX" to enable. */
  analyticsId: ""
};
