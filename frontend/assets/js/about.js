/* about.js — shows the Google Map if a mapEmbedUrl is set in site-config.js */
(function () {
  var url = (window.SITE_CONFIG || {}).mapEmbedUrl;
  if (url && /^https:\/\/www\.google\.com\/maps\/embed/.test(url)) {
    document.getElementById("farm-map").src = url;
    document.getElementById("map-wrap").hidden = false;
  }
})();
