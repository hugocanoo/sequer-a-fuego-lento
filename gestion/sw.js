// Guarda la «carcasa» de la app para que abra al instante y sin red.
// Los datos (Supabase) siempre van por red: nunca se edita sobre datos viejos.
const CACHE = 'sequer-gestion-v1';
const CARCASA = ['./', 'index.html', 'app.css', 'manifest.webmanifest', 'iconos/icono-192.png',
  'js/app.js', 'js/config.js', 'js/datos.js', 'js/ui.js', 'js/cambios.js', 'js/imagenes.js',
  'js/pantallas/carta.js', 'js/pantallas/menus.js', 'js/pantallas/fotos.js', 'js/pantallas/ajustes.js', 'js/pantallas/publicar.js',
  'js/vendor/preact-htm.js', 'js/vendor/supabase.js', '../fuentes/young-serif-normal.woff2', '../fuentes/schibsted-grotesk-normal.woff2'];

self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CARCASA)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // red primero (para coger siempre la última versión), y la caché si no hay conexión
  e.respondWith(fetch(e.request).then((r) => {
    if (r.ok && CARCASA.some((p) => url.pathname.endsWith(p.replace('./', '').replace('../', '')))) {
      const copia = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copia));
    }
    return r;
  }).catch(() => caches.match(e.request)));
});
