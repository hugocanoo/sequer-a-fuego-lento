// Menús: mediodía, bodas, comuniones, grupos y cóctel de pie. Cada menú tiene «tiempos» con sus platos.
import { html, useState } from '../vendor/preact-htm.js';
import { Cabecera, Hoja, Campo, Interruptor, Vacio, leerPrecio, verPrecio } from '../ui.js';
import { nuevoId } from '../datos.js';

export const TIPOS = { mediodia: 'Mediodía', boda: 'Bodas', comunion: 'Comuniones', grupo: 'Grupos y empresa', coctel: 'Cóctel de pie' };

export function PantallaMenus({ ctx }) {
  const { d } = ctx;
  const [editando, setEditando] = useState(null);
  const nuevo = (tipo) => setEditando({
    id: nuevoId(), tipo, nombre: '', descripcion: '', precio_persona: null, minimo: null,
    tiempos: [{ titulo: 'Entrantes', platos: [''] }], incluye: '', notas: '', pendiente: null, visible: true,
    orden: d.menus.length, _nuevo: true,
  });
  return html`<section class="pantalla">
    <${Cabecera} titulo="Menús y celebraciones" volver="#/inicio" />
    <p class="intro">Lo que pongas aquí sale en «Carta › Menús del mediodía» y en la página de Celebraciones.</p>
    ${Object.entries(TIPOS).map(([tipo, nombre]) => {
      const ms = d.menus.filter((m) => m.tipo === tipo).sort((a, b) => a.orden - b.orden);
      return html`<article class="seccion" key=${tipo}>
        <header class="seccion__cabecera"><h2 class="seccion__titulo seccion__titulo--fijo"><span>${nombre}</span><small>${ms.length} ${ms.length === 1 ? 'menú' : 'menús'}</small></h2></header>
        <ul class="filas">
          ${ms.map((m) => html`<li class=${`fila${m.visible === false ? ' fila--oculta' : ''}`} key=${m.id}>
            <button class="fila__principal" onClick=${() => setEditando(m)}>
              <span class="fila__nombre">${m.nombre}</span>
              <span class="fila__nota">${m.precio_persona !== null ? `${verPrecio(m.precio_persona)} € por persona` : 'Sin precio'}${m.pendiente ? ' · incompleto' : ''}</span>
            </button><span class="fila__flecha" aria-hidden="true">›</span>
          </li>`)}
          <li><button class="boton-anadir" onClick=${() => nuevo(tipo)}>+ Añadir menú</button></li>
        </ul>
      </article>`;
    })}
    <${EditorMenu} key=${editando ? editando.id : '-'} ctx=${ctx} menu=${editando} cerrar=${() => setEditando(null)} />
  </section>`;
}

function EditorMenu({ ctx, menu, cerrar }) {
  const [m, setM] = useState(() => (menu ? { ...menu, _precio: verPrecio(menu.precio_persona), tiempos: (menu.tiempos || []).map((t) => ({ ...t, platos: [...t.platos] })) } : null));
  if (!m) return html`<${Hoja} abierta=${false} cerrar=${cerrar} />`;
  const cambiar = (k, v) => setM((x) => ({ ...x, [k]: v }));
  const tiempo = (i, cambio) => cambiar('tiempos', m.tiempos.map((t, k) => (k === i ? { ...t, ...cambio } : t)));
  const guardar = async () => {
    if (!m.nombre.trim()) return ctx.avisar('Ponle un nombre al menú', 'error');
    const precio = leerPrecio(m._precio);
    if (Number.isNaN(precio)) return ctx.avisar('El precio tiene que ser un número', 'error');
    const minimo = m.minimo === '' || m.minimo === null ? null : parseInt(m.minimo, 10);
    const { _precio, _nuevo, ...limpio } = m;
    const tiempos = m.tiempos.map((t) => ({ titulo: t.titulo.trim(), platos: t.platos.map((p) => p.trim()).filter(Boolean) })).filter((t) => t.titulo && t.platos.length);
    await ctx.guardar('menus', { ...limpio, nombre: m.nombre.trim(), precio_persona: precio, minimo: Number.isNaN(minimo) ? null : minimo, tiempos,
      descripcion: (m.descripcion || '').trim() || null, incluye: (m.incluye || '').trim() || null, notas: (m.notas || '').trim() || null });
    ctx.avisar('Menú guardado. Recuerda publicar.');
    cerrar();
  };
  const borrar = async () => {
    if (!confirm(`¿Quitar el menú «${m.nombre}»?`)) return;
    await ctx.borrar('menus', m.id); cerrar();
  };
  return html`<${Hoja} abierta=${true} titulo=${m._nuevo ? 'Nuevo menú' : 'Editar menú'} cerrar=${cerrar}
    pie=${html`${!m._nuevo && html`<button class="boton boton--peligro" onClick=${borrar}>Quitar</button>`}<button class="boton boton--principal" onClick=${guardar}>Guardar</button>`}>
    <div class="formulario">
      <div class="dos">
        <${Campo} etiqueta="Tipo"><select value=${m.tipo} onChange=${(e) => cambiar('tipo', e.target.value)}>${Object.entries(TIPOS).map(([k, v]) => html`<option value=${k}>${v}</option>`)}</select></${Campo}>
        <${Campo} etiqueta="Nombre"><input value=${m.nombre} onInput=${(e) => cambiar('nombre', e.target.value)} placeholder="Ej.: Menú comunión" /></${Campo}>
      </div>
      <${Campo} etiqueta="Presentación" ayuda="Opcional"><textarea rows="2" value=${m.descripcion || ''} onInput=${(e) => cambiar('descripcion', e.target.value)}></textarea></${Campo}>
      <div class="dos">
        <${Campo} etiqueta="Precio por persona (€)"><input inputmode="decimal" value=${m._precio} onInput=${(e) => cambiar('_precio', e.target.value)} placeholder="Sin precio" /></${Campo}>
        <${Campo} etiqueta="Mínimo de personas"><input inputmode="numeric" value=${m.minimo ?? ''} onInput=${(e) => cambiar('minimo', e.target.value)} placeholder="—" /></${Campo}>
      </div>
      <div class="campo"><span class="campo__etiqueta">Platos del menú</span>
        ${m.tiempos.map((t, i) => html`<fieldset class="tiempo" key=${i}>
          <div class="tiempo__cabecera">
            <input class="tiempo__titulo" value=${t.titulo} onInput=${(e) => tiempo(i, { titulo: e.target.value })} placeholder="Ej.: Al centro" aria-label="Nombre del tiempo" />
            <button class="boton-icono" aria-label="Quitar este tiempo" onClick=${() => cambiar('tiempos', m.tiempos.filter((_, k) => k !== i))}>×</button>
          </div>
          ${t.platos.map((p, j) => html`<div class="tiempo__plato" key=${j}>
            <input value=${p} placeholder="Plato" onInput=${(e) => tiempo(i, { platos: t.platos.map((x, k) => (k === j ? e.target.value : x)) })} />
            <button class="boton-icono" aria-label="Quitar plato" onClick=${() => tiempo(i, { platos: t.platos.filter((_, k) => k !== j) })}>−</button>
          </div>`)}
          <button class="boton-texto" onClick=${() => tiempo(i, { platos: [...t.platos, ''] })}>+ plato</button>
        </fieldset>`)}
        <button class="boton boton--suave" onClick=${() => cambiar('tiempos', [...m.tiempos, { titulo: '', platos: [''] }])}>+ Añadir tiempo (entrantes, arroz, postre…)</button>
      </div>
      <${Campo} etiqueta="Qué incluye" ayuda="Ej.: bebida, pan, café"><input value=${m.incluye || ''} onInput=${(e) => cambiar('incluye', e.target.value)} /></${Campo}>
      <${Campo} etiqueta="Notas" ayuda="Ej.: reserva con 15 días de antelación"><input value=${m.notas || ''} onInput=${(e) => cambiar('notas', e.target.value)} /></${Campo}>
      <${Interruptor} activo=${m.visible !== false} cambiar=${(v) => cambiar('visible', v)} etiqueta="Visible en la web" />
      ${m.pendiente && html`<${Interruptor} activo=${!!m.pendiente} cambiar=${(v) => cambiar('pendiente', v ? m.pendiente : null)} etiqueta="Mostrar «pendiente» en la web" ayuda="Quítalo cuando el menú esté completo" />`}
    </div>
  </${Hoja}>`;
}

export function PantallaAgenda({ ctx }) {
  const { d } = ctx;
  const [editando, setEditando] = useState(null);
  const hoy = new Date().toISOString().slice(0, 10);
  const citas = [...d.agenda].sort((a, b) => a.fecha.localeCompare(b.fecha));
  const proximas = citas.filter((c) => c.fecha >= hoy), pasadas = citas.filter((c) => c.fecha < hoy).reverse();
  const fecha = (iso) => new Date(iso + 'T12:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long' });
  const fila = (c) => html`<li class=${`fila${c.visible === false ? ' fila--oculta' : ''}`} key=${c.id}>
    <button class="fila__principal" onClick=${() => setEditando(c)}><span class="fila__nombre">${c.titulo}</span><span class="fila__nota">${fecha(c.fecha)}${c.hora_inicio ? ` · ${c.hora_inicio}` : ''}</span></button>
    <span class="fila__flecha" aria-hidden="true">›</span></li>`;
  return html`<section class="pantalla">
    <${Cabecera} titulo="Agenda" volver="#/inicio" accion=${html`<button class="boton-texto" onClick=${() => setEditando({ id: nuevoId(), titulo: '', fecha: hoy, hora_inicio: '', hora_fin: '', descripcion: '', foto_id: null, acceso: 'libre', precio_texto: '', visible: true, _nuevo: true })}>+ Nueva</button>`} />
    <p class="intro">Markets, talleres, catas… Las citas pasadas se mueven solas a «Lo que hemos hecho».</p>
    <h2 class="subtitulo">Próximas</h2>
    ${proximas.length ? html`<ul class="filas filas--tarjeta">${proximas.map(fila)}</ul>` : html`<${Vacio} titulo="No hay citas próximas" texto="En la web saldrá que las fechas se anuncian en Instagram." />`}
    <h2 class="subtitulo">Ya celebradas</h2>
    <ul class="filas filas--tarjeta">${pasadas.map(fila)}</ul>
    <${EditorCita} key=${editando ? editando.id : '-'} ctx=${ctx} cita=${editando} cerrar=${() => setEditando(null)} />
  </section>`;
}

function EditorCita({ ctx, cita, cerrar }) {
  const [c, setC] = useState(() => (cita ? { ...cita } : null));
  if (!c) return html`<${Hoja} abierta=${false} cerrar=${cerrar} />`;
  const cambiar = (k, v) => setC((x) => ({ ...x, [k]: v }));
  const guardar = async () => {
    if (!c.titulo.trim() || !c.fecha) return ctx.avisar('Pon al menos título y fecha', 'error');
    const { _nuevo, ...limpio } = c;
    const vacio = (v) => (v && String(v).trim()) || null;
    await ctx.guardar('agenda', { ...limpio, titulo: c.titulo.trim(), descripcion: vacio(c.descripcion), hora_inicio: vacio(c.hora_inicio), hora_fin: vacio(c.hora_fin), precio_texto: vacio(c.precio_texto) });
    ctx.avisar('Cita guardada. Recuerda publicar.');
    cerrar();
  };
  const borrar = async () => { if (confirm(`¿Quitar «${c.titulo}»?`)) { await ctx.borrar('agenda', c.id); cerrar(); } };
  const carteles = ctx.d.fotos.filter((f) => f.categoria === 'agenda' || f.categoria === 'eventos');
  return html`<${Hoja} abierta=${true} titulo=${c._nuevo ? 'Nueva cita' : 'Editar cita'} cerrar=${cerrar}
    pie=${html`${!c._nuevo && html`<button class="boton boton--peligro" onClick=${borrar}>Quitar</button>`}<button class="boton boton--principal" onClick=${guardar}>Guardar</button>`}>
    <div class="formulario">
      <${Campo} etiqueta="Título"><input value=${c.titulo} onInput=${(e) => cambiar('titulo', e.target.value)} placeholder="Ej.: Market a l'horta" /></${Campo}>
      <div class="tres">
        <${Campo} etiqueta="Fecha"><input type="date" value=${c.fecha} onInput=${(e) => cambiar('fecha', e.target.value)} /></${Campo}>
        <${Campo} etiqueta="Desde"><input type="time" value=${c.hora_inicio || ''} onInput=${(e) => cambiar('hora_inicio', e.target.value)} /></${Campo}>
        <${Campo} etiqueta="Hasta"><input type="time" value=${c.hora_fin || ''} onInput=${(e) => cambiar('hora_fin', e.target.value)} /></${Campo}>
      </div>
      <${Campo} etiqueta="Descripción"><textarea rows="3" value=${c.descripcion || ''} onInput=${(e) => cambiar('descripcion', e.target.value)}></textarea></${Campo}>
      <div class="dos">
        <${Campo} etiqueta="Acceso"><select value=${c.acceso} onChange=${(e) => cambiar('acceso', e.target.value)}>
          <option value="libre">Entrada libre</option><option value="reserva">Con reserva</option><option value="entrada">Con entrada</option></select></${Campo}>
        <${Campo} etiqueta="Precio" ayuda="Opcional, tal cual: «20 € todo incluido»"><input value=${c.precio_texto || ''} onInput=${(e) => cambiar('precio_texto', e.target.value)} /></${Campo}>
      </div>
      <${Campo} etiqueta="Cartel o foto"><select value=${c.foto_id || ''} onChange=${(e) => cambiar('foto_id', e.target.value || null)}>
        <option value="">Sin foto</option>${carteles.map((f) => html`<option value=${f.id}>${f.alt}</option>`)}</select></${Campo}>
      <p class="campo__ayuda">Para un cartel nuevo, súbelo en «Fotos» y marca «Agenda».</p>
      <${Interruptor} activo=${c.visible !== false} cambiar=${(v) => cambiar('visible', v)} etiqueta="Visible en la web" />
    </div>
  </${Hoja}>`;
}
