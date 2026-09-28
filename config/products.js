/* =====================================================================
   PRODUCT CATALOGUE  —  edit this file to change prices, stock, images
   or to add products. The whole website updates itself.
   ---------------------------------------------------------------------
   There are THREE lists:
     "products"     → can be ordered instantly (price + sizes + stock)
     "requestItems" → customer requests it, you call back (no price needed)
     "comingSoon"   → shown as a teaser, cannot be ordered yet

   RULES (the order system reads this file, so keep it tidy):
   • Everything between JSON-START and JSON-END must stay valid JSON:
       - use "double quotes" around every name and text
       - put a comma between items, but NOT after the last one
       - no comments inside the JSON block
   • Prices are in rupees, numbers only (no ₹ sign, no commas): 549
   • stock = how many jars of that size you can sell right now.
       0 = shows "Sold out" and cannot be ordered.
   • "available": false hides the item completely.
   • "id" must be unique, lowercase, no spaces (use-dashes). Do not change
     the id of a product that already has orders.
   Check your edits at https://jsonlint.com (paste only the JSON block).
   Full guide: documentation/04-managing-products.md
   ===================================================================== */

window.HONEY_PRODUCTS = /*JSON-START*/
{
  "products": [
    {
      "id": "vanthen-rock-bee-honey",
      "name": "വൻതേൻ · Vanthen",
      "englishName": "Indian Rock Bee Honey",
      "tagline": "Deep amber, bold and full of character",
      "variety": "Indian Rock Bee Honey",
      "source": "Wild rock bee colonies and the flowering trees around our garden",
      "description": "Our signature honey — thick, dark amber with a rich, lingering taste that changes gently with each season's flowering. Collected in small batches and bottled by hand at the garden.",
      "image": "assets/images/products/vanthen.svg",
      "badge": "Our signature",
      "available": true,
      "sizes": [
        { "label": "250 g", "price": 299, "stock": 40 },
        { "label": "500 g", "price": 549, "stock": 30 },
        { "label": "1 kg",  "price": 999, "stock": 18 }
      ]
    }
  ],

  "requestItems": [
    {
      "id": "raw-hive-honey-box",
      "name": "Raw Bee Hive Honey Box",
      "tagline": "A whole comb, straight from the hive",
      "description": "A boxed frame of natural comb, capped and full of honey, exactly as the bees built it. Availability depends on the season and the strength of our colonies, so we take these by request.",
      "image": "assets/images/products/hive-box.svg",
      "note": "Seasonal · limited",
      "available": true
    },
    {
      "id": "bee-hive-for-farmers",
      "name": "Bee Hive for Farmers",
      "tagline": "Start your own colony",
      "description": "A healthy, ready-to-place hive box with an established colony, for farmers and home gardeners who want better pollination and their own honey. We guide you through placement and basic care.",
      "image": "assets/images/products/bee-hive.svg",
      "note": "Guidance included",
      "available": true
    },
    {
      "id": "cheruthen",
      "name": "ചെറുതേൻ · Cheruthen",
      "tagline": "Stingless bee honey, in very small quantities",
      "description": "Prized, tangy honey from tiny stingless bees. Each colony gives only a little each year, so we collect it on demand and share it as and when it is ready.",
      "image": "assets/images/products/cheruthen.svg",
      "note": "On demand",
      "available": true
    }
  ],

  "comingSoon": [
    {
      "id": "beeswax-candles",
      "name": "Pure Beeswax Candles",
      "description": "Hand-poured candles made from the wax of our own hives. Coming soon.",
      "image": "assets/images/products/candles.svg",
      "available": true
    }
  ]
}
/*JSON-END*/;
