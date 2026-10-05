// Capa de datos con dos adaptadores intercambiables y los mismos métodos:
//   iniciar · entrar · salir · cargar · guardar · borrar · guardarAjustes
//   subirFoto · reemplazarFoto · ultimaPublicada · publicar · historial · restaurar
import { CONFIG } from './config.js';

export const COLECCIONES = ['categorias', 'platos', 'menus', 'fotos', 'agenda'];

export function nuevoId() {
  return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)).slice(0, 18);
}

// Las fotos del repositorio tienen ruta relativa a la web («fotos/salon»); la app vive en /gestion/.
const urlsLocales = new Map();
export function urlFoto(foto, ancho) {
  if (!foto) return '';
  const w = ancho && foto.anchos.includes(ancho) ? ancho : Math.max(...foto.anchos);
  if (foto.src.startsWith('idb:')) return urlsLocales.get(`${foto.src}-${w}`) || '';
  const base = /^https?:/.test(foto.src) ? foto.src : new URL('../' + foto.src, location.href).href;
  return `${base}-${w}.webp`;
}

/* ───────────── modo demostración (navegador) ───────────── */
const CLAVE = 'sequer-demo-datos';
const CLAVE_PUB = 'sequer-demo-publicaciones';
const CLAVE_SES = 'sequer-demo-sesion';

function bd() {
  return new Promise((ok, mal) => {
    const r = indexedDB.open('sequer-demo', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('fotos');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => mal(r.error);
  });
}
async function idb(modo, fn) {
  const db = await bd();
  return new Promise((ok, mal) => {
    const tx = db.transaction('fotos', modo);
    const req = fn(tx.objectStore('fotos'));
    tx.oncomplete = () => ok(req && req.result);
    tx.onerror = () => mal(tx.error);
  });
}

const demo = {
  modo: 'demo',
  async iniciar() {
    return { email: localStorage.getItem(CLAVE_SES) };
  },
  async entrar(email) {
    localStorage.setItem(CLAVE_SES, email || 'demo@sequer');
    return { enviado: false, email: email || 'demo@sequer' };
  },
  async salir() { localStorage.removeItem(CLAVE_SES); },
  async cargar() {
    let datos = JSON.parse(localStorage.getItem(CLAVE) || 'null');
    if (!datos) {
      datos = await (await fetch('../datos/contenido.json', { cache: 'no-store' })).json();
      localStorage.setItem(CLAVE, JSON.stringify(datos));
      localStorage.setItem(CLAVE_PUB, JSON.stringify([{ version: datos.version || 0, creado: new Date().toISOString(), autor: 'web actual', snapshot: datos }]));
    }
    // reconstruir las URLs de las fotos subidas en esta demo
    for (const f of datos.fotos.filter((f) => f.src.startsWith('idb:'))) {
      for (const w of f.anchos) {
        const blob = await idb('readonly', (s) => s.get(`${f.src}-${w}`));
        if (blob) urlsLocales.set(`${f.src}-${w}`, URL.createObjectURL(blob));
      }
    }
    return datos;
  },
  _escribir(fn) {
    const datos = JSON.parse(localStorage.getItem(CLAVE));
    fn(datos);
    localStorage.setItem(CLAVE, JSON.stringify(datos));
    return datos;
  },
  async guardar(col, item) {
    this._escribir((d) => {
      const i = d[col].findIndex((x) => x.id === item.id);
      if (i >= 0) d[col][i] = item; else d[col].push(item);
    });
    return item;
  },
  async borrar(col, id) {
    this._escribir((d) => { d[col] = d[col].filter((x) => x.id !== id); });
  },
  async guardarAjustes(ajustes) {
    this._escribir((d) => { d.ajustes = ajustes; });
    return ajustes;
  },
  async _guardarBlobs(clave, blobs) {
    for (const [w, blob] of Object.entries(blobs)) {
      await idb('readwrite', (s) => s.put(blob, `${clave}-${w}`));
      urlsLocales.set(`${clave}-${w}`, URL.createObjectURL(blob));
    }
  },
  async subirFoto(blobs, meta) {
    const id = nuevoId();
    await this._guardarBlobs(`idb:${id}`, blobs);
    return this.guardar('fotos', { id, src: `idb:${id}`, anchos: Object.keys(blobs).map(Number).sort((a, b) => b - a), foco: '50% 50%', en_galeria: true, ...meta });
  },
  async reemplazarFoto(foto, blobs) {
    const clave = `idb:${nuevoId()}`;
    await this._guardarBlobs(clave, blobs);
    return this.guardar('fotos', { ...foto, src: clave, anchos: Object.keys(blobs).map(Number).sort((a, b) => b - a) });
  },
  async ultimaPublicada() {
    const pubs = JSON.parse(localStorage.getItem(CLAVE_PUB) || '[]');
    return pubs.length ? pubs[pubs.length - 1].snapshot : null;
  },
  async publicar() {
    const pubs = JSON.parse(localStorage.getItem(CLAVE_PUB) || '[]');
    const datos = JSON.parse(localStorage.getItem(CLAVE));
    const version = (pubs.length ? pubs[pubs.length - 1].version : 0) + 1;
    datos.version = version;
    localStorage.setItem(CLAVE, JSON.stringify(datos));
    pubs.push({ version, creado: new Date().toISOString(), autor: localStorage.getItem(CLAVE_SES), snapshot: datos });
    localStorage.setItem(CLAVE_PUB, JSON.stringify(pubs.slice(-20)));
    await new Promise((r) => setTimeout(r, 1800));
    return { version, simulado: true };
  },
  async historial() {
    return JSON.parse(localStorage.getItem(CLAVE_PUB) || '[]').map(({ snapshot, ...r }) => r).reverse();
  },
  async restaurar(version) {
    const pub = JSON.parse(localStorage.getItem(CLAVE_PUB) || '[]').find((p) => p.version === version);
    if (!pub) throw new Error('No encuentro esa versión');
    localStorage.setItem(CLAVE, JSON.stringify(pub.snapshot));
    return this.publicar();
  },
  async versionWeb() { return null; },
  // solo en demo: empezar de cero con lo que hay publicado en la web
  async reiniciar() {
    localStorage.removeItem(CLAVE); localStorage.removeItem(CLAVE_PUB);
    await idb('readwrite', (s) => s.clear());
  },
};

/* ───────────── modo real (Supabase) ───────────── */
let sb = null;
function cliente() {
  if (!sb) sb = window.supabase.createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, { auth: { persistSession: true, detectSessionInUrl: true } });
  return sb;
}
function comprobar({ data, error }) {
  if (error) throw new Error(traducirError(error.message));
  return data;
}
function traducirError(m) {
  if (/JWT|session|not authenticated/i.test(m)) return 'Tu sesión ha caducado. Vuelve a entrar.';
  if (/row-level security|permission/i.test(m)) return 'Tu email no tiene permiso para editar. Pide acceso.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sin conexión. Revisa el wifi o los datos y vuelve a intentarlo.';
  return m;
}

const supabase = {
  modo: 'supabase',
  async iniciar() {
    const { data } = await cliente().auth.getSession();
    return { email: data.session?.user?.email || null };
  },
  async entrar(email) {
    comprobar(await cliente().auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: false } }));
    return { enviado: true, email };
  },
  async salir() { await cliente().auth.signOut(); },
  async cargar() {
    const c = cliente();
    const [aj, ...cols] = await Promise.all([
      c.from('ajustes').select('datos').eq('id', 1).single(),
      ...COLECCIONES.map((t) => c.from(t).select('*').order('orden', { ascending: true, nullsFirst: false })),
    ]);
    const datos = { ajustes: comprobar(aj).datos };
    COLECCIONES.forEach((t, i) => { datos[t] = comprobar(cols[i]); });
    const v = await c.from('publicaciones').select('version').order('version', { ascending: false }).limit(1);
    datos.version = v.data?.[0]?.version || 0;
    return datos;
  },
  async guardar(col, item) {
    return comprobar(await cliente().from(col).upsert(item).select().single());
  },
  async borrar(col, id) {
    comprobar(await cliente().from(col).delete().eq('id', id));
  },
  async guardarAjustes(ajustes) {
    comprobar(await cliente().from('ajustes').update({ datos: ajustes }).eq('id', 1));
    return ajustes;
  },
  async _subirBlobs(base, blobs) {
    const almacen = cliente().storage.from('fotos');
    for (const [w, blob] of Object.entries(blobs)) {
      comprobar(await almacen.upload(`${base}-${w}.webp`, blob, { contentType: 'image/webp', upsert: true, cacheControl: '31536000' }));
    }
    return almacen.getPublicUrl(base).data.publicUrl;
  },
  async subirFoto(blobs, meta) {
    const id = nuevoId();
    const src = await this._subirBlobs(id, blobs);
    return this.guardar('fotos', { id, src, anchos: Object.keys(blobs).map(Number).sort((a, b) => b - a), foco: '50% 50%', en_galeria: true, ...meta });
  },
  async reemplazarFoto(foto, blobs) {
    const src = await this._subirBlobs(`${foto.id}-${Date.now().toString(36)}`, blobs);
    return this.guardar('fotos', { ...foto, src, anchos: Object.keys(blobs).map(Number).sort((a, b) => b - a) });
  },
  async ultimaPublicada() {
    const r = comprobar(await cliente().from('publicaciones').select('snapshot').order('version', { ascending: false }).limit(1));
    return r[0]?.snapshot || null;
  },
  async publicar(extra = {}) {
    const { data, error } = await cliente().functions.invoke('publicar', { body: extra });
    if (error) {
      let m = error.message;
      try { m = (await error.context.json()).error || m; } catch (_) { /* respuesta sin json */ }
      throw new Error(traducirError(m));
    }
    return data;
  },
  async historial() {
    return comprobar(await cliente().from('publicaciones').select('version, creado, autor, resumen, estado').order('version', { ascending: false }).limit(20));
  },
  async restaurar(version) { return this.publicar({ restaurar: version }); },
  async versionWeb() {
    try {
      const r = await fetch(new URL('version.json', CONFIG.urlWeb).href + '?t=' + Date.now(), { cache: 'no-store' });
      return (await r.json()).version;
    } catch (_) { return null; }
  },
};

export const datos = CONFIG.modo === 'supabase' && CONFIG.supabaseUrl ? supabase : demo;
