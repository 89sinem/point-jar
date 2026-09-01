/* Keeps Point Jar working with no internet at all.
   Bump CACHE when the app changes so phones pick the new version up. */

var CACHE = "point-jar-v7";

var FILES = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-180.png",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) { return c.addAll(FILES); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;

  // The app itself is fetched fresh whenever there is a connection, so a new
  // version shows up the first time the icon is opened rather than the second.
  // With no connection the stored copy is served instead.
  var isPage = e.request.mode === "navigate" ||
               (e.request.destination === "document");

  if (isPage) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) {
          try { c.put("./index.html", copy); } catch (err) {}
        });
        return res;
      }).catch(function () {
        return caches.match("./index.html").then(function (hit) {
          return hit || caches.match("./");
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(function (hit) {
      if (hit) return hit;

      return fetch(e.request).then(function (res) {
        // keep a copy of anything fetched successfully, fonts included
        var copy = res.clone();
        caches.open(CACHE).then(function (c) {
          try { c.put(e.request, copy); } catch (err) {}
        });
        return res;
      }).catch(function () {
        // offline and not cached: fall back to the app itself for page loads
        if (e.request.mode === "navigate") return caches.match("./index.html");
        return new Response("", { status: 504 });
      });
    })
  );
});
