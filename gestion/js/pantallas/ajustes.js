// Horario, aviso temporal, contacto y parking.
import { html, useState } from '../vendor/preact-htm.js';
import { Cabecera, Campo, Interruptor } from '../ui.js';

const DIAS = [[1, 'L'], [2, 'M'], [3, 'X'], [4, 'J'], [5, 'V'], [6, 'S'], [0, 'D']];
const NOMBRE_DIA = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function PantallaAjustes({ ctx }) {
  const [a, setA] = useState(() => JSON.parse(JSON.stringify(ctx.d.ajustes)));
  const [sucio, setSucio] = useState(false);
  const cambiar = (k, v) => { setA((x) => ({ ...x, [k]: v })); setSucio(true); };
  const horario = (i, cambio) => cambiar('horarios', a.horarios.map((h, k) => (k === i ? { ...h, ...cambio } : h)));
  const dia = (i, d) => { const h = a.horarios[i]; horario(i, { dias: h.dias.includes(d) ? h.dias.filter((x) => x !== d) : [...h.dias, d].sort() }); };
  const aviso = a.aviso || { texto: null, hasta: null };
  const parking = a.parking || {};
  const tri = (v) => (v === true ? 'si' : v === false ? 'no' : '');
  const deTri = (v) => (v === 'si' ? true : v === 'no' ? false : null);
  const guardar = async () => {
    const tel = (t) => (t || '').replace(/\s+/g, ' ').trim() || null;
    for (const h of a.horarios) if (!h.nombre.trim() || !h.desde || !h.hasta) return ctx.avisar('Cada horario necesita nombre y horas', 'error');
    await ctx.guardarAjustes({ ...a, telefono: tel(a.telefono), whatsapp: tel(a.whatsapp), email: (a.email || '').trim() || null,
      aviso: aviso.texto && aviso.texto.trim() ? { texto: aviso.texto.trim(), hasta: aviso.hasta || null } : { texto: null, hasta: null } });
    setSucio(false);
    ctx.avisar('Guardado. Recuerda publicar.');
  };
  return html`<section class="pantalla">
    <${Cabecera} titulo="Horario y avisos" volver="#/inicio" />

    <article class="bloque">
      <h2 class="subtitulo">Aviso en la web</h2>
      <p class="intro">Sale como franja arriba en todas las páginas. Ej.: «Hoy cerramos por evento privado».</p>
      <${Campo} etiqueta="Texto del aviso" ayuda="Déjalo vacío para no mostrar nada">
        <input value=${aviso.texto || ''} onInput=${(e) => cambiar('aviso', { ...aviso, texto: e.target.value })} placeholder="Sin aviso" /></${Campo}>
      <${Campo} etiqueta="Se quita solo el día" ayuda="Opcional"><input type="date" value=${aviso.hasta || ''} onInput=${(e) => cambiar('aviso', { ...aviso, hasta: e.target.value || null })} /></${Campo}>
    </article>

    <article class="bloque">
      <h2 class="subtitulo">Horario</h2>
      ${a.horarios.map((h, i) => html`<fieldset class="horario-editor" key=${i}>
        <div class="tiempo__cabecera">
          <input class="tiempo__titulo" value=${h.nombre} onInput=${(e) => horario(i, { nombre: e.target.value })} aria-label="Nombre del servicio" />
          <button class="boton-icono" aria-label="Quitar este horario" onClick=${() => cambiar('horarios', a.horarios.filter((_, k) => k !== i))}>×</button>
        </div>
        <div class="dias" role="group" aria-label="Días">
          ${DIAS.map(([d, l]) => html`<button type="button" class="dia" aria-pressed=${h.dias.includes(d) ? 'true' : 'false'} aria-label=${NOMBRE_DIA[d]} onClick=${() => dia(i, d)}>${l}</button>`)}
        </div>
        <div class="dos">
          <${Campo} etiqueta="Abre"><input type="time" value=${h.desde} onInput=${(e) => horario(i, { desde: e.target.value })} /></${Campo}>
          <${Campo} etiqueta="Cierra"><input type="time" value=${h.hasta} onInput=${(e) => horario(i, { hasta: e.target.value })} /></${Campo}>
        </div>
      </fieldset>`)}
      <button class="boton boton--suave" onClick=${() => cambiar('horarios', [...a.horarios, { servicio: 'cenas', nombre: 'Cenas', dias: [5, 6], desde: '20:30', hasta: '23:30' }])}>+ Añadir horario (cenas, temporada…)</button>
    </article>

    <article class="bloque">
      <h2 class="subtitulo">Contacto</h2>
      <${Campo} etiqueta="Teléfono de reservas"><input type="tel" inputmode="tel" value=${a.telefono || ''} onInput=${(e) => cambiar('telefono', e.target.value)} /></${Campo}>
      <${Campo} etiqueta="WhatsApp" ayuda="Si lo pones, aparece el botón de WhatsApp y el formulario de presupuesto"><input type="tel" inputmode="tel" value=${a.whatsapp || ''} onInput=${(e) => cambiar('whatsapp', e.target.value)} placeholder="Sin WhatsApp" /></${Campo}>
      <${Campo} etiqueta="Email"><input type="email" inputmode="email" value=${a.email || ''} onInput=${(e) => cambiar('email', e.target.value)} placeholder="Sin email" /></${Campo}>
    </article>

    <article class="bloque">
      <h2 class="subtitulo">Parking</h2>
      <${Campo} etiqueta="Texto"><textarea rows="2" value=${parking.texto || ''} onInput=${(e) => cambiar('parking', { ...parking, texto: e.target.value })}></textarea></${Campo}>
      <div class="tres">
        <${Campo} etiqueta="Plazas"><input inputmode="numeric" value=${parking.plazas ?? ''} onInput=${(e) => cambiar('parking', { ...parking, plazas: e.target.value ? parseInt(e.target.value, 10) || null : null })} placeholder="—" /></${Campo}>
        <${Campo} etiqueta="¿Gratis?"><select value=${tri(parking.gratuito)} onChange=${(e) => cambiar('parking', { ...parking, gratuito: deTri(e.target.value) })}><option value="">Sin decir</option><option value="si">Sí</option><option value="no">No</option></select></${Campo}>
        <${Campo} etiqueta="¿Autocares?"><select value=${tri(parking.autocares)} onChange=${(e) => cambiar('parking', { ...parking, autocares: deTri(e.target.value) })}><option value="">Sin decir</option><option value="si">Sí</option><option value="no">No</option></select></${Campo}>
      </div>
    </article>

    <div class="pie-fijo"><button class="boton boton--principal boton--ancho" disabled=${!sucio} onClick=${guardar}>${sucio ? 'Guardar cambios' : 'Todo guardado'}</button></div>
  </section>`;
}
