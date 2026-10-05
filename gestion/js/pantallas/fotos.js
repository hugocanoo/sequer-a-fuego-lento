// Fotos: subir varias del carrete (comprimidas en el móvil), describirlas, decidir dónde salen y encuadrarlas.
import { html, useState, useRef } from '../vendor/preact-htm.js';
import { Cabecera, Hoja, Campo, Interruptor, Chips, Vacio } from '../ui.js';
import { urlFoto } from '../datos.js';
import { prepararFoto } from '../imagenes.js';

export const CATEGORIAS = { arroces: 'Arroces', carta: 'Platos', almuerzos: 'Almuerzos', espacio: 'El espacio', eventos: 'Eventos', agenda: 'Agenda (carteles)' };

export function PantallaFotos({ ctx }) {
  const { d } = ctx;
  const [filtro, setFiltro] = useState('todas');
  const [editando, setEditando] = useState(null);
  const [subiendo, setSubiendo] = useState(null);
  const entrada = useRef(null);

  const subir = async (archivos) => {
    const lista = [...archivos];
    if (!lista.length) return;
    let ultima = null;
    for (let i = 0; i < lista.length; i++) {
      setSubiendo(`Preparando ${i + 1} de ${lista.length}…`);
      try {
        const { blobs } = await prepararFoto(lista[i]);
        setSubiendo(`Subiendo ${i + 1} de ${lista.length}…`);
        ultima = await ctx.datos.subirFoto(blobs, { alt: '', categoria: filtro !== 'todas' ? filtro : 'espacio', orden: d.fotos.length + i, uso: null });
        ctx.recargarFoto(ultima);
      } catch (err) { ctx.avisar(err.message, 'error'); }
    }
    setSubiendo(null);
    if (entrada.current) entrada.current.value = '';
    if (ultima) {
      ctx.avisar(lista.length > 1 ? `${lista.length} fotos subidas. Descríbelas para que salgan bien.` : 'Foto subida. Cuéntanos qué se ve.');
      setEditando(ultima);
    }
  };

  const fotos = d.fotos.filter((f) => filtro === 'todas' || f.categoria === filtro).sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  const sinAlt = d.fotos.filter((f) => !f.alt).length;
  return html`<section class="pantalla">
    <${Cabecera} titulo="Fotos" volver="#/inicio" />
    <label class=${`boton boton--principal boton--ancho subir${subiendo ? ' subir--ocupado' : ''}`}>
      <input ref=${entrada} type="file" accept="image/*" multiple disabled=${!!subiendo} onChange=${(e) => subir(e.target.files)} />
      ${subiendo || 'Subir fotos del móvil'}
    </label>
    <p class="intro">Se reducen solas antes de subir, para que la web vaya rápida. ${sinAlt ? html`<strong>${sinAlt} sin describir.</strong>` : ''}</p>
    <${Chips} opciones=${{ todas: 'Todas', ...CATEGORIAS }} valor=${filtro} multiple=${false} cambiar=${setFiltro} />
    ${fotos.length ? html`<ul class="rejilla-fotos">
      ${fotos.map((f) => html`<li key=${f.id}><button onClick=${() => setEditando(f)} aria-label=${`Editar foto: ${f.alt || 'sin descripción'}`}>
        <img src=${urlFoto(f, 640)} alt="" loading="lazy" style=${`object-position:${f.foco || '50% 50%'}`} />
        ${f.uso && html`<span class="marca-foto">Fija</span>`}
        ${!f.alt && html`<span class="marca-foto marca-foto--aviso">Sin describir</span>`}
        ${f.en_galeria === false && f.categoria !== 'agenda' && html`<span class="marca-foto marca-foto--suave">Fuera de galería</span>`}
      </button></li>`)}
    </ul>` : html`<${Vacio} titulo="No hay fotos aquí" texto="Sube la primera con el botón de arriba." />`}
    <${EditorFoto} key=${editando ? editando.id + editando.src : '-'} ctx=${ctx} foto=${editando} cerrar=${() => setEditando(null)} />
  </section>`;
}

function EditorFoto({ ctx, foto, cerrar }) {
  const [f, setF] = useState(() => (foto ? { ...foto } : null));
  const [ocupado, setOcupado] = useState(false);
  if (!f) return html`<${Hoja} abierta=${false} cerrar=${cerrar} />`;
  const cambiar = (k, v) => setF((x) => ({ ...x, [k]: v }));
  const url = urlFoto(f, 1600) || urlFoto(f);
  const marcarFoco = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - r.left) / r.width) * 100), y = Math.round(((e.clientY - r.top) / r.height) * 100);
    cambiar('foco', `${Math.min(100, Math.max(0, x))}% ${Math.min(100, Math.max(0, y))}%`);
  };
  const [fx, fy] = (f.foco || '50% 50%').split(' ');
  const usadaEn = [
    ...ctx.d.platos.filter((p) => p.foto_id === f.id).map((p) => `el plato «${p.nombre}»`),
    ...ctx.d.agenda.filter((c) => c.foto_id === f.id).map((c) => `la cita «${c.titulo}»`),
  ];
  const guardar = async () => {
    if (!f.alt.trim()) return ctx.avisar('Escribe en pocas palabras qué se ve: ayuda a Google y a quien no ve bien', 'error');
    await ctx.guardar('fotos', { ...f, alt: f.alt.trim() });
    ctx.avisar('Foto guardada. Recuerda publicar.');
    cerrar();
  };
  const reemplazar = async (archivo) => {
    if (!archivo) return;
    setOcupado(true);
    try {
      const { blobs } = await prepararFoto(archivo);
      const nueva = await ctx.datos.reemplazarFoto({ ...f, alt: f.alt.trim() }, blobs);
      ctx.recargarFoto(nueva);
      setF({ ...nueva });
      ctx.avisar('Foto cambiada. Revisa el encuadre y publica.');
    } catch (err) { ctx.avisar(err.message, 'error'); }
    setOcupado(false);
  };
  const borrar = async () => {
    if (f.uso) return ctx.avisar('Esta foto tiene un sitio fijo en la web: cámbiala con «Reemplazar»', 'error');
    if (usadaEn.length) return ctx.avisar(`Primero quítala de ${usadaEn.join(' y ')}`, 'error');
    if (!confirm('¿Quitar esta foto de la web?')) return;
    await ctx.borrar('fotos', f.id);
    ctx.avisar('Foto quitada. Recuerda publicar.');
    cerrar();
  };
  return html`<${Hoja} abierta=${true} titulo="Foto" cerrar=${cerrar}
    pie=${html`<button class="boton boton--peligro" onClick=${borrar} disabled=${!!f.uso}>Quitar</button><button class="boton boton--principal" onClick=${guardar}>Guardar</button>`}>
    <div class="formulario">
      <div class="encuadre">
        <button class="encuadre__foto" onClick=${marcarFoco} aria-label="Toca el punto más importante de la foto">
          <img src=${url} alt="" /><span class="encuadre__punto" style=${`left:${fx};top:${fy}`}></span>
        </button>
        <p class="campo__ayuda">Toca lo más importante (el arroz, la brasa…). Así se recorta en la web:</p>
        <div class="encuadre__vistas" aria-hidden="true">
          ${['arco', 'cuadrado', 'apaisado'].map((forma) => html`<span class=${`encuadre__vista encuadre__vista--${forma}`}><img src=${url} alt="" style=${`object-position:${f.foco}`} /></span>`)}
        </div>
      </div>
      ${f.uso && html`<p class="nota-fija"><strong>Sitio fijo:</strong> ${f.uso}. Puedes reemplazarla por otra, pero no quitarla.</p>`}
      <${Campo} etiqueta="¿Qué se ve?" ayuda="Ej.: Paella valenciana al fuego de leña">
        <input value=${f.alt} onInput=${(e) => cambiar('alt', e.target.value)} placeholder="Describe la foto en una frase" /></${Campo}>
      <div class="campo"><span class="campo__etiqueta">¿Dónde la ponemos?</span>
        <${Chips} opciones=${CATEGORIAS} valor=${f.categoria} multiple=${false} cambiar=${(v) => cambiar('categoria', v)} /></div>
      ${f.categoria !== 'agenda' && html`<${Interruptor} activo=${f.en_galeria !== false} cambiar=${(v) => cambiar('en_galeria', v)} etiqueta="Mostrar en la galería" />`}
      <label class=${`boton boton--suave boton--ancho subir${ocupado ? ' subir--ocupado' : ''}`}>
        <input type="file" accept="image/*" disabled=${ocupado} onChange=${(e) => reemplazar(e.target.files[0])} />${ocupado ? 'Subiendo…' : 'Reemplazar por otra foto'}
      </label>
      ${usadaEn.length > 0 && html`<p class="campo__ayuda">También sale en ${usadaEn.join(' y ')}.</p>`}
    </div>
  </${Hoja}>`;
}
