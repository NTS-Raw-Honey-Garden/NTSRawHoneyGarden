/* =====================================================================
   PRODUCT CATALOGUE  —  edit this file to add products, change prices,
   swap images or mark items sold out. The whole website updates itself.
   ---------------------------------------------------------------------
   RULES (the order system reads this file, so keep it tidy):
   • Everything between JSON-START and JSON-END must stay valid JSON:
       - use "double quotes" around every name and text
       - put a comma between items, but NOT after the last one
       - no comments inside the JSON block
   • Prices are in rupees, numbers only (no ₹ sign, no commas): 449
   • stock = how many jars of that size you can sell right now.
       0 = shows "Sold out" and cannot be ordered.
   • "available": false hides the whole product from the shop.
   • "id" must be unique, lowercase, no spaces (use-dashes). Do not change
     the id of a product that already has orders.
   Check your edits at https://jsonlint.com (paste only the JSON block).
   Full guide: documentation/04-managing-products.md
   ===================================================================== */

window.HONEY_PRODUCTS = /*JSON-START*/
{
  "products": [
    {
      "id": "wildflower-raw-honey",
      "name": "Wildflower Raw Honey",
      "tagline": "Our everyday honey — bright, floral, golden",
      "variety": "Multifloral",
      "source": "Seasonal wildflowers, sunflower and farm-border blossoms",
      "description": "Collected from hives set among open fields and hedgerows. Light amber, gently floral with a soft caramel finish. Naturally crystallises in cooler months — a sign it has never been heated.",
      "image": "assets/images/products/wildflower.svg",
      "badge": "Bestseller",
      "available": true,
      "sizes": [
        { "label": "250 g", "price": 249, "stock": 40 },
        { "label": "500 g", "price": 449, "stock": 35 },
        { "label": "1 kg",  "price": 849, "stock": 20 }
      ]
    },
    {
      "id": "wild-forest-honey",
      "name": "Wild Forest Honey",
      "tagline": "Deep, dark and full of character",
      "variety": "Forest multifloral",
      "source": "Forest trees and wild undergrowth flowers near the farm",
      "description": "A darker, richer honey with woody, slightly smoky notes and a lingering finish. Harvested only once a year after the forest flowering season, in small quantities.",
      "image": "assets/images/products/forest.svg",
      "badge": "Seasonal",
      "available": true,
      "sizes": [
        { "label": "250 g", "price": 299, "stock": 25 },
        { "label": "500 g", "price": 549, "stock": 18 },
        { "label": "1 kg",  "price": 999, "stock": 8 }
      ]
    },
    {
      "id": "moringa-blossom-honey",
      "name": "Moringa Blossom Honey",
      "tagline": "Single-flower honey from drumstick trees",
      "variety": "Monofloral",
      "source": "Moringa (drumstick) orchards in bloom",
      "description": "Pale gold with a delicate, herbal sweetness. Our hives are moved to moringa orchards during peak bloom so the bees work mostly one flower — giving a honey with a distinct, clean taste.",
      "image": "assets/images/products/moringa.svg",
      "badge": "Limited",
      "available": true,
      "sizes": [
        { "label": "250 g", "price": 349, "stock": 15 },
        { "label": "500 g", "price": 649, "stock": 6 }
      ]
    },
    {
      "id": "raw-honeycomb",
      "name": "Raw Honeycomb",
      "tagline": "Honey exactly as the bees made it",
      "variety": "Comb honey",
      "source": "Cut directly from our wildflower hive frames",
      "description": "A slab of natural beeswax comb, capped and full of honey. Chew it, spread it on toast or serve it on a cheese board. Nothing extracted, nothing added.",
      "image": "assets/images/products/honeycomb.svg",
      "badge": "",
      "available": true,
      "sizes": [
        { "label": "200 g", "price": 499, "stock": 0 },
        { "label": "400 g", "price": 899, "stock": 4 }
      ]
    },
    {
      "id": "beeswax-candles",
      "name": "Pure Beeswax Candles",
      "tagline": "Hand-poured from our own hive wax",
      "variety": "Hive product",
      "source": "Cappings wax saved during our honey harvest",
      "description": "Slow-burning, naturally honey-scented pillar candles with cotton wicks. Made in small batches from the wax cappings we remove when extracting honey.",
      "image": "assets/images/products/candles.svg",
      "badge": "",
      "available": true,
      "sizes": [
        { "label": "Set of 2", "price": 399, "stock": 12 },
        { "label": "Set of 4", "price": 749, "stock": 6 }
      ]
    }
  ]
}
/*JSON-END*/;
