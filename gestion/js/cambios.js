// Compara lo que hay ahora con lo último publicado y lo cuenta en frases que entiende cualquiera.
const NOMBRES = { categorias: 'Sección', platos: 'Plato', menus: 'Menú', fotos: 'Foto', agenda: 'Cita' };
const FEMENINO = new Set(['categorias', 'fotos', 'agenda']);
const CAMPOS = {
  nombre: 'nombre', descripcion: 'descripción', precio: 'precio', precio_texto: 'precio', por_persona: 'precio por persona',
  disponible: 'disponible hoy', visible: 'visible en la web', alergenos: 'alérgenos', etiquetas: 'etiquetas', foto_id: 'foto',
  categoria_id: 'sección', precio_persona: 'precio por persona', minimo: 'mínimo de personas', tiempos: 'platos del menú',
  incluye: 'qué incluye', notas: 'notas', titulo: 'título', fecha: 'fecha', hora_inicio: 'hora', hora_fin: 'hora', acceso: 'acceso',
  alt: 'descripción de la foto', categoria: 'dónde sale', foco: 'encuadre', src: 'imagen', en_galeria: 'en la galería', nota: 'nota',
};
const IGNORAR = new Set(['orden', 'anchos', 'creado', 'actualizado']);

const euros = (v) => (v === null || v === undefined || v === '' ? 'sin precio' : `${String(v).replace('.', ',')} €`);
const sino = (v) => (v ? 'sí' : 'no');
function valor(campo, v) {
  if (campo === 'precio' || campo === 'precio_persona') return euros(v);
  if (typeof v === 'boolean') return sino(v);
  if (Array.isArray(v)) return v.length ? `${v.length}` : 'ninguno';
  if (v === null || v === undefined || v === '') return 'vacío';
  const s = String(v);
  return s.length > 28 ? s.slice(0, 26) + '…' : s;
}
const nombreDe = (x) => x.nombre || x.titulo || x.alt || x.id;
const igual = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

export function cambios(base, actual) {
  if (!base || !actual) return [];
  const lista = [];
  for (const col of Object.keys(NOMBRES)) {
    const antes = new Map((base[col] || []).map((x) => [x.id, x]));
    const ahora = new Map((actual[col] || []).map((x) => [x.id, x]));
    for (const [id, x] of ahora) {
      const y = antes.get(id);
      if (!y) { lista.push({ tipo: 'nuevo', texto: `${FEMENINO.has(col) ? 'Nueva' : 'Nuevo'} ${NOMBRES[col].toLowerCase()}: ${nombreDe(x)}` }); continue; }
      const campos = Object.keys({ ...x, ...y }).filter((k) => !IGNORAR.has(k) && !igual(x[k], y[k]));
      const simples = campos.filter((k) => ['precio', 'precio_persona', 'disponible', 'visible'].includes(k));
      for (const k of simples) lista.push({ tipo: 'cambio', texto: `${nombreDe(x)}: ${CAMPOS[k]} ${valor(k, y[k])} → ${valor(k, x[k])}` });
      const resto = campos.filter((k) => !simples.includes(k)).map((k) => CAMPOS[k] || k);
      if (resto.length) lista.push({ tipo: 'cambio', texto: `${nombreDe(x)}: cambia ${[...new Set(resto)].join(', ')}` });
    }
    for (const [id, y] of antes) if (!ahora.has(id)) lista.push({ tipo: 'borrado', texto: `${NOMBRES[col]} ${FEMENINO.has(col) ? 'quitada' : 'quitado'}: ${nombreDe(y)}` });
    const ordenAntes = (base[col] || []).map((x) => `${x.id}:${x.orden}`).join();
    const ordenAhora = (actual[col] || []).map((x) => `${x.id}:${x.orden}`).join();
    if (ordenAntes !== ordenAhora && (base[col] || []).length === (actual[col] || []).length
        && (actual[col] || []).some((x) => antes.get(x.id) && antes.get(x.id).orden !== x.orden)) {
      lista.push({ tipo: 'cambio', texto: `Nuevo orden: ${{ categorias: 'secciones', platos: 'platos', menus: 'menús', fotos: 'fotos', agenda: 'agenda' }[col]}` });
    }
  }
  const a = base.ajustes || {}, b = actual.ajustes || {};
  const ETQ = { telefono: 'teléfono', whatsapp: 'WhatsApp', email: 'email', horarios: 'horario', parking: 'parking', aviso: 'aviso', video_hero: 'vídeo de portada' };
  for (const k of Object.keys({ ...a, ...b })) if (!igual(a[k], b[k])) lista.push({ tipo: 'cambio', texto: `Cambia ${ETQ[k] || k}` });
  return lista;
}
