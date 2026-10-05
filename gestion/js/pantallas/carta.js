// Carta y almuerzos: secciones plegables, precio al toque, «disponible hoy» y editor completo.
import { html, useState } from '../vendor/preact-htm.js';
import { Cabecera, Hoja, Campo, Interruptor, Chips, Vacio, leerPrecio, verPrecio } from '../ui.js';
import { nuevoId, urlFoto } from '../datos.js';

export const ALERGENOS = {
  gluten: 'Gluten', crustaceos: 'Crustáceos', huevos: 'Huevos', pescado: 'Pescado', cacahuetes: 'Cacahuetes',
  soja: 'Soja', lacteos: 'Lácteos', 'frutos-cascara': 'Frutos de cáscara', apio: 'Apio', mostaza: 'Mostaza',
  sesamo: 'Sésamo', sulfitos: 'Sulfitos', altramuces: 'Altramuces', moluscos: 'Moluscos',
};
const ETIQUETAS = { nuevo: 'Nuevo', recomendado: 'Recomendado', vegetariano: 'Vegetariano', 'fuera-de-carta': 'Fuera de carta' };

const porOrden = (a, b) => (a.orden ?? 0) - (b.orden ?? 0);

export function PantallaCarta({ ctx, carta }) {
  const { d } = ctx;
  const titulo = carta === 'almuerzos' ? 'Almuerzos' : 'Carta';
  const cats = d.categorias.filter((c) => c.carta === carta).sort(porOrden);
  const [abiertas, setAbiertas] = useState(() => new Set(cats.slice(0, 1).map((c) => c.id)));
  const [ordenar, setOrdenar] = useState(false);
  const [editando, setEditando] = useState(null);   // plato completo
  const [precio, setPrecio] = useState(null);       // plato, solo precio
  const [seccion, setSeccion] = useState(null);     // categoría

  const plegar = (id) => setAbiertas((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const platosDe = (cid) => d.platos.filter((p) => p.categoria_id === cid).sort(porOrden);
  const mover = async (lista, i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= lista.length) return;
    const a = lista[i], b = lista[j];
    const col = a.categoria_id !== undefined ? 'platos' : 'categorias';
    await ctx.guardar(col, { ...a, orden: j });
    await ctx.guardar(col, { ...b, orden: i });
    lista.forEach((x, k) => { if (k !== i && k !== j && x.orden !== k) ctx.guardar(col, { ...x, orden: k }); });
  };
  const nuevoPlato = (cid) => setEditando({
    id: nuevoId(), categoria_id: cid, nombre: '', descripcion: '', precio: null, precio_texto: null, por_persona: false,
    alergenos: [], etiquetas: [], foto_id: null, disponible: true, visible: true, orden: platosDe(cid).length, _nuevo: true,
  });

  return html`<section class="pantalla">
    <${Cabecera} titulo=${titulo} volver="#/inicio"
      accion=${html`<button class="boton-texto" onClick=${() => setOrdenar(!ordenar)}>${ordenar ? 'Hecho' : 'Ordenar'}</button>`} />
    <p class="intro">${carta === 'almuerzos' ? 'Bocadillos y lo que acompaña al almuerzo.' : 'Toca un precio para cambiarlo. Toca un plato para editarlo entero.'}</p>
    ${cats.map((c, ci) => {
      const platos = platosDe(c.id);
      const abierta = abiertas.has(c.id) || ordenar;
      return html`<article class=${`seccion${c.visible === false ? ' seccion--oculta' : ''}`} key=${c.id}>
        <header class="seccion__cabecera">
          <button class="seccion__titulo" aria-expanded=${abierta} onClick=${() => plegar(c.id)}>
            <span>${c.nombre}</span><small>${platos.length} ${platos.length === 1 ? 'plato' : 'platos'}${c.visible === false ? ' · oculta' : ''}</small>
          </button>
          ${ordenar
            ? html`<span class="mover"><button aria-label="Subir sección" onClick=${() => mover(cats, ci, -1)}>↑</button><button aria-label="Bajar sección" onClick=${() => mover(cats, ci, 1)}>↓</button></span>`
            : html`<button class="boton-icono" aria-label=${`Editar sección ${c.nombre}`} onClick=${() => setSeccion(c)}>⋯</button>`}
        </header>
        ${abierta && html`<ul class="filas">
          ${platos.map((p, i) => html`<li class=${`fila${p.visible === false ? ' fila--oculta' : ''}`} key=${p.id}>
            ${p.foto_id && html`<img class="fila__foto" src=${urlFoto(d.fotos.find((f) => f.id === p.foto_id), 640)} alt="" loading="lazy" />`}
            <button class="fila__principal" onClick=${() => setEditando(p)}>
              <span class="fila__nombre">${p.nombre}</span>
              ${!p.disponible && html`<span class="fila__nota fila__nota--aviso">Hoy no disponible</span>`}
              ${p.visible === false && html`<span class="fila__nota">Oculto en la web</span>`}
            </button>
            ${ordenar
              ? html`<span class="mover"><button aria-label="Subir" onClick=${() => mover(platos, i, -1)}>↑</button><button aria-label="Bajar" onClick=${() => mover(platos, i, 1)}>↓</button></span>`
              : html`<button class=${`precio-boton${p.precio === null && !p.precio_texto ? ' precio-boton--vacio' : ''}`} onClick=${() => setPrecio(p)}>
                  ${p.precio_texto || (p.precio !== null ? `${verPrecio(p.precio)} €` : 'Precio')}</button>`}
          </li>`)}
          ${!platos.length && html`<li class="fila fila--vacia">Aún no hay platos en esta sección.</li>`}
          ${!ordenar && html`<li><button class="boton-anadir" onClick=${() => nuevoPlato(c.id)}>+ Añadir plato</button></li>`}
        </ul>`}
      </article>`;
    })}
    ${!ordenar && html`<button class="boton-anadir boton-anadir--seccion" onClick=${() => setSeccion({ id: nuevoId(), carta, nombre: '', nota: null, visible: true, orden: cats.length, _nuevo: true })}>+ Añadir sección</button>`}
    ${!cats.length && html`<${Vacio} titulo="Sin secciones" texto="Crea la primera sección para empezar." />`}

    <${EditorPlato} key=${editando ? editando.id : '-'} ctx=${ctx} plato=${editando} cerrar=${() => setEditando(null)} />
    <${PrecioRapido} key=${precio ? 'p' + precio.id : '-'} ctx=${ctx} plato=${precio} cerrar=${() => setPrecio(null)} />
    <${EditorSeccion} key=${seccion ? seccion.id : '-'} ctx=${ctx} seccion=${seccion} cerrar=${() => setSeccion(null)} />
  </section>`;
}

function PrecioRapido({ ctx, plato, cerrar }) {
  const [texto, setTexto] = useState(() => (plato ? verPrecio(plato.precio) : ''));
  const [sm, setSm] = useState(() => !!(plato && plato.precio_texto));
  const valor = leerPrecio(texto);
  const sumar = (x) => setTexto(verPrecio(Math.max(0, Math.round(((Number.isNaN(valor) || valor === null ? 0 : valor) + x) * 100) / 100)));
  const guardar = async () => {
    if (!sm && Number.isNaN(valor)) return ctx.avisar('Escribe el precio con números, por ejemplo 14,50', 'error');
    await ctx.guardar('platos', { ...plato, precio: sm ? null : valor, precio_texto: sm ? 'S/M' : null });
    ctx.avisar('Precio guardado. Recuerda publicar.');
    cerrar();
  };
  return html`<${Hoja} abierta=${!!plato} titulo=${plato ? plato.nombre : ''} cerrar=${cerrar}
    pie=${html`<button class="boton boton--principal" onClick=${guardar}>Guardar precio</button>`}>
    ${plato && html`<div class="precio-rapido">
      ${!sm && html`<div class="precio-rapido__fila">
        <button class="redondo" onClick=${() => sumar(-0.5)} aria-label="Bajar 50 céntimos">−</button>
        <label class="precio-rapido__campo"><input inputmode="decimal" value=${texto} placeholder="0,00" autofocus
          onInput=${(e) => setTexto(e.target.value)} onKeyDown=${(e) => e.key === 'Enter' && guardar()} aria-label="Precio en euros" /><span>€</span></label>
        <button class="redondo" onClick=${() => sumar(0.5)} aria-label="Subir 50 céntimos">+</button>
      </div>`}
      <${Interruptor} activo=${sm} cambiar=${setSm} etiqueta="Según mercado (S/M)" ayuda="Para pescado o marisco con precio del día" />
    </div>`}
  </${Hoja}>`;
}

function EditorPlato({ ctx, plato, cerrar }) {
  const { d } = ctx;
  const [p, setP] = useState(() => (plato ? { ...plato, _precio: verPrecio(plato.precio) } : null));
  const [eligiendoFoto, setEligiendoFoto] = useState(false);
  const cambiar = (k, v) => setP((x) => ({ ...x, [k]: v }));
  const guardar = async () => {
    if (!p.nombre.trim()) return ctx.avisar('El plato necesita un nombre', 'error');
    const precio = leerPrecio(p._precio);
    if (Number.isNaN(precio)) return ctx.avisar('El precio tiene que ser un número, por ejemplo 14,50', 'error');
    const { _precio, _nuevo, ...limpio } = p;
    await ctx.guardar('platos', { ...limpio, nombre: p.nombre.trim(), descripcion: (p.descripcion || '').trim() || null, precio: p.precio_texto ? null : precio });
    ctx.avisar(_nuevo ? 'Plato añadido. Recuerda publicar.' : 'Guardado. Recuerda publicar.');
    cerrar();
  };
  const borrar = async () => {
    if (!confirm(`¿Quitar «${p.nombre}» de la carta? Si solo es por hoy, mejor desactiva «Disponible hoy».`)) return;
    await ctx.borrar('platos', p.id);
    ctx.avisar('Plato quitado. Recuerda publicar.');
    cerrar();
  };
  const fotoActual = p && d.fotos.find((f) => f.id === p.foto_id);
  const cats = p ? d.categorias.filter((c) => c.carta === d.categorias.find((x) => x.id === p.categoria_id)?.carta).sort(porOrden) : [];
  return html`<${Hoja} abierta=${!!plato} titulo=${p && p._nuevo ? 'Nuevo plato' : 'Editar plato'} cerrar=${cerrar}
    pie=${p && html`${!p._nuevo && html`<button class="boton boton--peligro" onClick=${borrar}>Quitar</button>`}<button class="boton boton--principal" onClick=${guardar}>Guardar</button>`}>
    ${p && html`<div class="formulario">
      <${Campo} etiqueta="Nombre"><input value=${p.nombre} onInput=${(e) => cambiar('nombre', e.target.value)} placeholder="Ej.: Paella valenciana" /></${Campo}>
      <${Campo} etiqueta="Descripción" ayuda=${`${(p.descripcion || '').length}/160 · opcional`}>
        <textarea rows="3" maxlength="160" value=${p.descripcion || ''} onInput=${(e) => cambiar('descripcion', e.target.value)} placeholder="Qué lleva o cómo se hace"></textarea></${Campo}>
      <div class="dos">
        <${Campo} etiqueta="Precio (€)"><input inputmode="decimal" disabled=${!!p.precio_texto} value=${p.precio_texto ? 'S/M' : p._precio} onInput=${(e) => cambiar('_precio', e.target.value)} placeholder="0,00" /></${Campo}>
        <${Campo} etiqueta="Sección"><select value=${p.categoria_id} onChange=${(e) => cambiar('categoria_id', e.target.value)}>
          ${cats.map((c) => html`<option value=${c.id}>${c.nombre}</option>`)}</select></${Campo}>
      </div>
      <${Interruptor} activo=${!!p.precio_texto} cambiar=${(v) => cambiar('precio_texto', v ? 'S/M' : null)} etiqueta="Según mercado (S/M)" />
      <${Interruptor} activo=${!!p.por_persona} cambiar=${(v) => cambiar('por_persona', v)} etiqueta="Precio por persona" ayuda="Para arroces y menús" />
      <${Interruptor} activo=${p.disponible !== false} cambiar=${(v) => cambiar('disponible', v)} etiqueta="Disponible hoy" ayuda="Si se acaba, desactívalo: sale «Hoy no disponible»" />
      <${Interruptor} activo=${p.visible !== false} cambiar=${(v) => cambiar('visible', v)} etiqueta="Visible en la web" />
      <div class="campo"><span class="campo__etiqueta">Alérgenos</span>
        <${Chips} opciones=${ALERGENOS} valor=${p.alergenos} cambiar=${(v) => cambiar('alergenos', v)} /></div>
      <div class="campo"><span class="campo__etiqueta">Etiquetas</span>
        <${Chips} opciones=${ETIQUETAS} valor=${p.etiquetas} cambiar=${(v) => cambiar('etiquetas', v)} /></div>
      <div class="campo"><span class="campo__etiqueta">Foto</span>
        <div class="foto-elegida">
          ${fotoActual ? html`<img src=${urlFoto(fotoActual, 640)} alt=${fotoActual.alt} />` : html`<span class="foto-elegida__vacia">Sin foto</span>`}
          <button class="boton boton--suave" onClick=${() => setEligiendoFoto(!eligiendoFoto)}>${eligiendoFoto ? 'Cerrar' : fotoActual ? 'Cambiar' : 'Elegir foto'}</button>
          ${fotoActual && html`<button class="boton-texto" onClick=${() => cambiar('foto_id', null)}>Quitar</button>`}
        </div>
        ${eligiendoFoto && html`<div class="selector-fotos">
          ${d.fotos.filter((f) => f.categoria !== 'agenda').map((f) => html`<button key=${f.id} class=${`selector-fotos__item${f.id === p.foto_id ? ' activo' : ''}`}
            onClick=${() => { cambiar('foto_id', f.id); setEligiendoFoto(false); }} aria-label=${f.alt}><img src=${urlFoto(f, 640)} alt="" loading="lazy" /></button>`)}
          <p class="campo__ayuda">¿No está? Súbela antes en «Fotos».</p>
        </div>`}
      </div>
    </div>`}
  </${Hoja}>`;
}

function EditorSeccion({ ctx, seccion, cerrar }) {
  const [s, setS] = useState(() => (seccion ? { ...seccion } : null));
  const guardar = async () => {
    if (!s.nombre.trim()) return ctx.avisar('Ponle un nombre a la sección', 'error');
    const { _nuevo, ...limpio } = s;
    await ctx.guardar('categorias', { ...limpio, nombre: s.nombre.trim(), nota: (s.nota || '').trim() || null });
    ctx.avisar('Sección guardada. Recuerda publicar.');
    cerrar();
  };
  const borrar = async () => {
    if (ctx.d.platos.some((p) => p.categoria_id === s.id)) return ctx.avisar('Primero mueve o quita los platos de esta sección', 'error');
    if (!confirm(`¿Quitar la sección «${s.nombre}»?`)) return;
    await ctx.borrar('categorias', s.id);
    cerrar();
  };
  return html`<${Hoja} abierta=${!!seccion} titulo=${s && s._nuevo ? 'Nueva sección' : 'Sección'} cerrar=${cerrar}
    pie=${s && html`${!s._nuevo && html`<button class="boton boton--peligro" onClick=${borrar}>Quitar</button>`}<button class="boton boton--principal" onClick=${guardar}>Guardar</button>`}>
    ${s && html`<div class="formulario">
      <${Campo} etiqueta="Nombre"><input value=${s.nombre} onInput=${(e) => setS({ ...s, nombre: e.target.value })} placeholder="Ej.: Postres" /></${Campo}>
      <${Campo} etiqueta="Nota bajo el título" ayuda="Opcional"><input value=${s.nota || ''} onInput=${(e) => setS({ ...s, nota: e.target.value })} /></${Campo}>
      <${Interruptor} activo=${s.visible !== false} cambiar=${(v) => setS({ ...s, visible: v })} etiqueta="Visible en la web" />
      ${s.pendiente && html`<${Interruptor} activo=${!!s.pendiente} cambiar=${(v) => setS({ ...s, pendiente: v ? s.pendiente : null })} etiqueta="Mostrar el aviso de «pendiente»" ayuda="Quítalo cuando la sección esté completa" />`}
    </div>`}
  </${Hoja}>`;
}
