// Publicar: resumen de cambios → generar la web → confirmar que ya está en internet. Y el historial para deshacer.
import { html, useEffect, useState } from '../vendor/preact-htm.js';
import { Cabecera, Vacio } from '../ui.js';
import { cambios } from '../cambios.js';
import { CONFIG } from '../config.js';

const PASOS = ['Guardando esta versión', 'Generando la web', 'Publicada en internet'];

export function PantallaPublicar({ ctx }) {
  const lista = cambios(ctx.base, ctx.d);
  const [paso, setPaso] = useState(-1);
  const [error, setError] = useState(null);

  const esperarWeb = async (version) => {
    const fin = Date.now() + 5 * 60 * 1000;
    while (Date.now() < fin) {
      const v = await ctx.datos.versionWeb();
      if (v !== null && v >= version) return true;
      await new Promise((r) => setTimeout(r, 5000));
    }
    return false;
  };
  const publicar = async () => {
    setError(null); setPaso(0);
    try {
      const r = await ctx.datos.publicar();
      setPaso(1);
      const llego = r.simulado ? (await new Promise((ok) => setTimeout(ok, 1200)), true) : await esperarWeb(r.version);
      if (!llego) throw new Error('La web está tardando más de lo normal. Se publicará sola en unos minutos; no hace falta repetir.');
      setPaso(2);
      await ctx.recargar();
      ctx.avisar('¡Publicado!');
    } catch (err) { setError(err.message); setPaso(-1); }
  };

  return html`<section class="pantalla">
    <${Cabecera} titulo="Publicar" volver="#/inicio" accion=${html`<a class="boton-texto" href="#/historial">Historial</a>`} />
    ${ctx.datos.modo === 'demo' && html`<p class="nota-fija">Modo demostración: se simula la publicación y la web real no cambia.</p>`}
    ${paso === -1 && (lista.length
      ? html`<p class="intro">Esto es lo que va a cambiar en la web:</p>
        <ul class="cambios">${lista.map((c) => html`<li class=${`cambios__item cambios__item--${c.tipo}`}>${c.texto}</li>`)}</ul>
        <div class="pie-fijo"><button class="boton boton--principal boton--ancho boton--grande" onClick=${publicar}>Publicar ${lista.length} ${lista.length === 1 ? 'cambio' : 'cambios'}</button></div>`
      : html`<${Vacio} titulo="La web está al día" texto="Cuando cambies algo, aparecerá aquí para publicarlo." />`)}
    ${paso >= 0 && html`<ol class="progreso">
      ${PASOS.map((t, i) => html`<li class=${i < paso || paso === 2 ? 'hecho' : i === paso ? 'activo' : ''}>${t}${i === 1 && paso === 1 ? html` <small>(1-2 minutos)</small>` : ''}</li>`)}
    </ol>
    ${paso === 2 && html`<a class="boton boton--principal boton--ancho" href=${CONFIG.urlWeb} target="_blank" rel="noopener">Ver la web</a>`}`}
    ${error && html`<p class="error" role="alert">${error}</p>`}
  </section>`;
}

export function PantallaHistorial({ ctx }) {
  const [lista, setLista] = useState(null);
  const [ocupado, setOcupado] = useState(false);
  useEffect(() => { ctx.datos.historial().then(setLista).catch((e) => ctx.avisar(e.message, 'error')); }, []);
  const restaurar = async (v) => {
    if (!confirm(`¿Volver a dejar la web como estaba en la versión ${v}? Se publicará al momento.`)) return;
    setOcupado(true);
    try { await ctx.datos.restaurar(v); await ctx.recargar(); ctx.avisar(`Restaurada la versión ${v}`); location.hash = '#/inicio'; }
    catch (e) { ctx.avisar(e.message, 'error'); }
    setOcupado(false);
  };
  const fecha = (iso) => new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  return html`<section class="pantalla">
    <${Cabecera} titulo="Historial" volver="#/publicar" />
    <p class="intro">Cada publicación queda guardada. Si algo sale mal, vuelve a una versión anterior.</p>
    ${lista === null ? html`<p class="cargando">Cargando…</p>` : !lista.length ? html`<${Vacio} titulo="Aún no hay publicaciones" />` : html`<ul class="filas filas--tarjeta">
      ${lista.map((p, i) => html`<li class="fila" key=${p.version}>
        <div class="fila__principal"><span class="fila__nombre">Versión ${p.version}${i === 0 ? ' · en la web' : ''}</span>
          <span class="fila__nota">${fecha(p.creado)}${p.autor ? ` · ${p.autor}` : ''}${p.resumen ? ` · ${p.resumen}` : ''}</span></div>
        ${i > 0 && html`<button class="boton boton--suave" disabled=${ocupado} onClick=${() => restaurar(p.version)}>Volver a esta</button>`}
      </li>`)}
    </ul>`}
  </section>`;
}
