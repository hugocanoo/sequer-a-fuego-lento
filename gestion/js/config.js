// Configuración de la app de gestión.
// modo 'demo'     → todo se guarda en este navegador (para enseñarla sin tocar la web real).
// modo 'supabase' → datos reales; «Publicar» regenera la web en 1-2 minutos.
// La clave anónima de Supabase es pública por diseño: la seguridad la ponen las reglas (RLS).
export const CONFIG = {
  modo: 'demo',
  supabaseUrl: '',
  supabaseAnonKey: '',
  // dirección pública de la web (para «Ver mi web» y para comprobar que la publicación llegó)
  urlWeb: new URL('../', location.href).href,
  negocio: 'Sequer A Fuego Lento',
};
