// Piezas comunes de la app: cabecera, hoja inferior, campos, interruptor, chips, aviso flotante.
import { html, useEffect, useRef, useState } from './vendor/preact-htm.js';

export function Cabecera({ titulo, volver, accion }) {
  return html`<header class="barra">
    ${volver ? html`<a class="barra__volver" href=${volver} aria-label="Volver">‹</a>` : html`<span class="barra__hueco"></span>`}
    <h1 class="barra__titulo">${titulo}</h1>
    ${accion || html`<span class="barra__hueco"></span>`}
  </header>`;
}

// Hoja que sube desde abajo; usa <dialog> para que el foco y la tecla Esc funcionen solos.
export function Hoja({ abierta, titulo, cerrar, children, pie }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (abierta && !d.open) d.showModal();
    if (!abierta && d.open) d.close();
  }, [abierta]);
  return html`<dialog ref=${ref} class="hoja" onClose=${cerrar} onClick=${(e) => { if (e.target === ref.current) cerrar(); }}>
    ${abierta && html`<div class="hoja__dentro">
      <div class="hoja__asa" aria-hidden="true"></div>
      <header class="hoja__cabecera"><h2>${titulo}</h2><button class="boton-icono" onClick=${cerrar} aria-label="Cerrar">×</button></header>
      <div class="hoja__cuerpo">${children}</div>
      ${pie && html`<footer class="hoja__pie">${pie}</footer>`}
    </div>`}
  </dialog>`;
}

export function Campo({ etiqueta, ayuda, children }) {
  return html`<label class="campo"><span class="campo__etiqueta">${etiqueta}</span>${children}${ayuda && html`<span class="campo__ayuda">${ayuda}</span>`}</label>`;
}

export function Interruptor({ activo, cambiar, etiqueta, ayuda }) {
  return html`<button type="button" class="interruptor" role="switch" aria-checked=${activo ? 'true' : 'false'} onClick=${() => cambiar(!activo)}>
    <span class="interruptor__texto"><span>${etiqueta}</span>${ayuda && html`<small>${ayuda}</small>`}</span>
    <span class="interruptor__pista" aria-hidden="true"><span></span></span>
  </button>`;
}

export function Chips({ opciones, valor, cambiar, multiple = true }) {
  const lista = multiple ? valor || [] : [valor];
  const pulsar = (k) => {
    if (!multiple) return cambiar(k);
    cambiar(lista.includes(k) ? lista.filter((x) => x !== k) : [...lista, k]);
  };
  return html`<div class="chips">${Object.entries(opciones).map(([k, v]) => html`
    <button type="button" class="chip" aria-pressed=${lista.includes(k) ? 'true' : 'false'} onClick=${() => pulsar(k)}>${v}</button>`)}
  </div>`;
}

export function Vacio({ titulo, texto, children }) {
  return html`<div class="vacio"><p class="vacio__titulo">${titulo}</p>${texto && html`<p>${texto}</p>`}${children}</div>`;
}

export function useAviso() {
  const [msg, setMsg] = useState(null);
  const t = useRef(null);
  const avisar = (texto, tipo = 'ok') => {
    clearTimeout(t.current);
    setMsg({ texto, tipo, n: Date.now() });
    t.current = setTimeout(() => setMsg(null), tipo === 'error' ? 6000 : 2600);
  };
  // popover: así el aviso queda por encima de una hoja abierta (que vive en la capa superior)
  const mostrar = (el) => { try { el && el.showPopover && !el.matches(':popover-open') && el.showPopover(); } catch (_) { /* sin soporte */ } };
  const nodo = msg && html`<div class=${`toast toast--${msg.tipo}`} role="status" popover="manual" ref=${mostrar} key=${msg.n}>${msg.texto}</div>`;
  return [nodo, avisar];
}

// precio escrito a la española («14,5») → número; vacío → null
export function leerPrecio(texto) {
  const t = String(texto ?? '').trim().replace('€', '').replace(',', '.');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}
export const verPrecio = (n) => (n === null || n === undefined ? '' : String(n).replace('.', ','));
