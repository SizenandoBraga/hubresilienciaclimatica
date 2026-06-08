const CACHE_NAME = "nsru-app-v1";

const APP_FILES = [
  "./",
  "./login.html",
  "./cooperativa-vila-pinto.html",
  "./cooperativa-cooadesc.html",
  "./cooperativa-padre-cacique.html"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});