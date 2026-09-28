/* =====================================================================
   SITE CONFIGURATION  —  edit this file to change farm details.
   ---------------------------------------------------------------------
   You do NOT need to know coding. Only change the text between quotes
   "like this", keep the commas at the end of each line, and save.
   ===================================================================== */

window.SITE_CONFIG = {

  /* ---------- Farm identity ---------- */
  farmName: "NTS Honey Garden",
  tagline: "Raw. Pure. Golden.",
  strapline: "From Our Hive to Your Home",
  foundedYear: "2018",
  region: "Kollam, Kerala, India",          // Shown on the About page
  regionShort: "Parippally",

  /* ---------- Contact details (shown on site & order confirmation) ---------- */
  phone: "+91 8547478411 ",              // Shown to customers
  whatsappNumber: "+91 8547478411",         // Country code + number, digits only (no + or spaces)
  address: "NTS Honey Garden, ESI Junction, Parippally ",
  businessHours: "Mon–Sat, 9:00 am – 6:00 pm",
  location: https://maps.app.goo.gl/w4FGyFiy28UCYyMx6

  /* ---------- Social links (leave "" to hide) ---------- */


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
  deliveryFee: 50,               // Flat delivery charge in rupees
  freeDeliveryAbove: 999,        // Orders at or above this get free delivery (0 = never free)
  minDeliveryDaysAhead: 5,       // Earliest delivery date = today + this many days
  deliverySlots: ["Morning (9 am – 12 pm)", "Afternoon (12 – 4 pm)", "Evening (4 – 8 pm)", "Any time"],
  maxQuantityPerItem: 20,

  /* ---------- Payment ----------
     "none"     = customer pays on delivery / by UPI after confirmation (current setup)
     "razorpay" = online payment (see documentation/06-future-features.md before switching) */
  payment: {
    provider: "none",
    upiId: "ntshoneygarden@upi",   // Shown in confirmation as a payment option (leave "" to hide)
    razorpayKeyId: ""              // PUBLIC key id only. Never put a secret key in this file.
  },

  /* ---------- SEO ---------- */
  siteUrl: "https://nts-raw-honey-garden.github.io/NTSRawHoneyGarden",   // Change if your address changes
  metaDescription: "Raw, pure, golden honey from our own garden hives in Kerala. വൻതേൻ (Vanthen) Indian rock bee honey in 250 g, 500 g and 1 kg. Order online.",

  /* ---------- Analytics (optional) ----------
     Paste a Google Analytics 4 Measurement ID like "G-XXXXXXX" to enable. */
  analyticsId: ""
};
