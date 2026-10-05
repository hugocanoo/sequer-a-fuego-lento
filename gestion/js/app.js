// App de gestión de Sequer A Fuego Lento: arranque, sesión, navegación y pantalla de inicio.
import { html, render, useEffect, useState } from './vendor/preact-htm.js';
import { datos } from './datos.js';
import { CONFIG } from './config.js';
import { cambios } from './cambios.js';
import { useAviso } from './ui.js';
import { PantallaCarta } from './pantallas/carta.js';
import { PantallaMenus, PantallaAgenda } from './pantallas/menus.js';
import { PantallaFotos } from './pantallas/fotos.js';
import { PantallaAjustes } from './pantallas/ajustes.js';
import { PantallaPublicar, PantallaHistorial } from './pantallas/publicar.js';

const leerRuta = () => (location.hash.replace(/^#\/?/, '') || 'inicio').split('?')[0];

function App() {
  const [sesion, setSesion] = useState(undefined);   // undefined = comprobando
  const [d, setD] = useState(null);
  const [base, setBase] = useState(null);
  const [ruta, setRuta] = useState(leerRuta());
  const [errorCarga, setErrorCarga] = useState(null);
  const [enLinea, setEnLinea] = useState(navigator.onLine);
  const [aviso, avisar] = useAviso();

  const recargar = async () => {
    try {
      // en orden: la primera vez, cargar() es quien deja preparada la publicación de partida
      const nuevo = await datos.cargar();
      const ultima = await datos.ultimaPublicada();
      setD(nuevo); setBase(ultima); setErrorCarga(null);
    } catch (e) { setErrorCarga(e.message); }
  };

  useEffect(() => {
    datos.iniciar().then((s) => { setSesion(s.email ? s : null); if (s.email) recargar(); })
      .catch((e) => { setSesion(null); avisar(e.message, 'error'); });
    const cambiarRuta = () => {
      const nueva = leerRuta();
      if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(() => setRuta(nueva));
      else setRuta(nueva);
      window.scrollTo(0, 0);
    };
    const red = () => setEnLinea(navigator.onLine);
    addEventListener('hashchange', cambiarRuta); addEventListener('online', red); addEventListener('offline', red);
    return () => { removeEventListener('hashchange', cambiarRuta); removeEventListener('online', red); removeEventListener('offline', red); };
  }, []);

  if (sesion === undefined) return html`<div class="arranque"><img src="iconos/icono-192.png" alt="" /></div>`;
  if (!sesion) return html`<${Entrar} alEntrar=${(s) => { setSesion(s); recargar(); }} avisar=${avisar} />${aviso}`;
  if (errorCarga) return html`<div class="arranque arranque--error"><p>${errorCarga}</p><button class="boton boton--principal" onClick=${recargar}>Reintentar</button></div>`;
  if (!d) return html`<div class="arranque"><img src="iconos/icono-192.png" alt="" /><p>Cargando la carta…</p></div>`;

  const ctx = {
    d, base, datos, avisar, recargar,
    async guardar(col, item) {
      try {
        const guardado = await datos.guardar(col, item);
        setD((x) => ({ ...x, [col]: x[col].some((y) => y.id === guardado.id) ? x[col].map((y) => (y.id === guardado.id ? guardado : y)) : [...x[col], guardado] }));
        return guardado;
      } catch (e) { avisar(e.message, 'error'); throw e; }
    },
    async borrar(col, id) {
      try { await datos.borrar(col, id); setD((x) => ({ ...x, [col]: x[col].filter((y) => y.id !== id) })); }
      catch (e) { avisar(e.message, 'error'); throw e; }
    },
    async guardarAjustes(a) {
      try { await datos.guardarAjustes(a); setD((x) => ({ ...x, ajustes: a })); }
      catch (e) { avisar(e.message, 'error'); throw e; }
    },
    recargarFoto(f) { setD((x) => ({ ...x, fotos: x.fotos.some((y) => y.id === f.id) ? x.fotos.map((y) => (y.id === f.id ? f : y)) : [...x.fotos, f] })); },
  };
  const pendientes = cambios(base, d).length;
  const pantallas = {
    inicio: () => html`<${Inicio} ctx=${ctx} pendientes=${pendientes} sesion=${sesion} salir=${async () => { await datos.salir(); setSesion(null); setD(null); }} />`,
    carta: () => html`<${PantallaCarta} key="carta" ctx=${ctx} carta="carta" />`,
    almuerzos: () => html`<${PantallaCarta} key="almuerzos" ctx=${ctx} carta="almuerzos" />`,
    menus: () => html`<${PantallaMenus} ctx=${ctx} />`,
    fotos: () => html`<${PantallaFotos} ctx=${ctx} />`,
    agenda: () => html`<${PantallaAgenda} ctx=${ctx} />`,
    ajustes: () => html`<${PantallaAjustes} ctx=${ctx} />`,
    publicar: () => html`<${PantallaPublicar} ctx=${ctx} />`,
    historial: () => html`<${PantallaHistorial} ctx=${ctx} />`,
  };
  const actual = pantallas[ruta] ? ruta : 'inicio';
  return html`
    ${datos.modo === 'demo' && html`<div class="cinta">Modo demostración · los cambios no salen en la web real</div>`}
    ${!enLinea && html`<div class="cinta cinta--aviso">Sin conexión: no se puede guardar hasta que vuelva</div>`}
    <main class="vista">${pantallas[actual]()}</main>
    <nav class="pestanas-app" aria-label="Secciones">
      ${[['inicio', 'Inicio', 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z'],
         ['carta', 'Carta', 'M5 3h11l3 3v15H5zM8 9h8M8 13h8M8 17h5'],
         ['fotos', 'Fotos', 'M4 7h3l2-3h6l2 3h3v13H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
         ['publicar', 'Publicar', 'M12 3v12M7 8l5-5 5 5M5 21h14']].map(([r, t, ico]) => html`
        <a href=${`#/${r}`} aria-current=${actual === r || (r === 'carta' && actual === 'almuerzos') ? 'page' : null}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d=${ico} /></svg><span>${t}</span>
          ${r === 'publicar' && pendientes > 0 && html`<b class="globo" aria-label=${`${pendientes} sin publicar`}>${pendientes}</b>`}
        </a>`)}
    </nav>
    ${aviso}`;
}

function Entrar({ alEntrar, avisar }) {
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const enviar = async (e) => {
    e.preventDefault();
    setOcupado(true);
    try {
      const r = await datos.entrar(email.trim());
      if (r.enviado) setEnviado(true); else alEntrar({ email: r.email });
    } catch (err) { avisar(err.message, 'error'); }
    setOcupado(false);
  };
  return html`<main class="entrar">
    <img class="entrar__logo" src="../fotos/logo-provisional.png" alt=${CONFIG.negocio} />
    <h1>Gestiona tu web</h1>
    ${enviado
      ? html`<p class="entrar__texto">Te hemos enviado un enlace a <strong>${email}</strong>. Ábrelo desde este móvil y entrarás directamente.</p>
          <button class="boton-texto" onClick=${() => setEnviado(false)}>Usar otro email</button>`
      : datos.modo === 'demo'
        ? html`<p class="entrar__texto">Carta, precios, fotos, menús y horario, desde el móvil. Esta es una demostración: puedes tocar todo sin miedo.</p>
            <button class="boton boton--principal boton--ancho boton--grande" onClick=${enviar}>Entrar en la demostración</button>`
        : html`<form onSubmit=${enviar} class="formulario">
            <p class="entrar__texto">Escribe tu email y te mandamos un enlace para entrar. Sin contraseñas.</p>
            <label class="campo"><span class="campo__etiqueta">Tu email</span>
              <input type="email" inputmode="email" autocomplete="email" required value=${email} onInput=${(e) => setEmail(e.target.value)} /></label>
            <button class="boton boton--principal boton--ancho boton--grande" disabled=${ocupado}>${ocupado ? 'Enviando…' : 'Envíame el enlace'}</button>
          </form>`}
  </main>`;
}

function Inicio({ ctx, pendientes, sesion, salir }) {
  const { d } = ctx;
  const cuenta = (carta) => d.platos.filter((p) => d.categorias.find((c) => c.id === p.categoria_id)?.carta === carta).length;
  const agotados = d.platos.filter((p) => p.disponible === false).length;
  const sinPrecio = d.platos.filter((p) => p.precio === null && !p.precio_texto && p.visible !== false && d.categorias.find((c) => c.id === p.categoria_id)?.carta === 'carta').length;
  const hoy = new Date().toISOString().slice(0, 10);
  const proximas = d.agenda.filter((c) => c.fecha >= hoy).length;
  const avisoActivo = d.ajustes.aviso && d.ajustes.aviso.texto;
  const accesos = [
    ['carta', 'Carta', `${cuenta('carta')} platos${sinPrecio ? ` · ${sinPrecio} sin precio` : ''}`],
    ['almuerzos', 'Almuerzos', `${cuenta('almuerzos')} opciones`],
    ['menus', 'Menús y celebraciones', `${d.menus.length} menús`],
    ['fotos', 'Fotos', `${d.fotos.length} fotos`],
    ['agenda', 'Agenda', proximas ? `${proximas} próximas` : 'Sin citas próximas'],
    ['ajustes', 'Horario y avisos', avisoActivo ? 'Aviso activo' : 'Horario, contacto, parking'],
  ];
  return html`<section class="pantalla pantalla--inicio">
    <header class="saludo">
      <img src="../fotos/logo-provisional.png" alt=${CONFIG.negocio} />
      <p>Hola${sesion.email && !sesion.email.startsWith('demo') ? `, ${sesion.email.split('@')[0]}` : ''}</p>
    </header>
    ${pendientes > 0
      ? html`<a class="tarjeta-publicar" href="#/publicar"><span><strong>${pendientes} ${pendientes === 1 ? 'cambio' : 'cambios'} sin publicar</strong>La web todavía no los muestra.</span><span class="boton boton--principal">Publicar</span></a>`
      : html`<p class="tarjeta-ok">La web está al día.</p>`}
    ${agotados > 0 && html`<p class="nota-fija">${agotados} ${agotados === 1 ? 'plato marcado' : 'platos marcados'} como «Hoy no disponible». Acuérdate de reactivarlos.</p>`}
    <nav class="accesos" aria-label="Qué quieres cambiar">
      ${accesos.map(([r, t, s]) => html`<a class="acceso" href=${`#/${r}`}><span class="acceso__titulo">${t}</span><span class="acceso__dato">${s}</span></a>`)}
    </nav>
    <div class="inicio__pie">
      <a class="boton boton--suave boton--ancho" href=${CONFIG.urlWeb} target="_blank" rel="noopener">Ver mi web</a>
      ${datos.modo === 'demo' && html`<button class="boton-texto" onClick=${async () => { if (confirm('¿Borrar los cambios de la demostración y empezar de cero?')) { await datos.reiniciar(); location.reload(); } }}>Reiniciar la demostración</button>`}
      <button class="boton-texto" onClick=${salir}>Salir</button>
    </div>
  </section>`;
}

render(html`<${App} />`, document.getElementById('app'));

if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
