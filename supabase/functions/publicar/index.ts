// Función «publicar»: la llama la app al pulsar Publicar (o Restaurar versión).
// 1. Comprueba que quien llama es un editor.  2. Guarda la foto del contenido en «publicaciones».
// 3. Avisa a GitHub (repository_dispatch) para que regenere la web y la publique.
// Secretos necesarios en Supabase › Edge Functions › Secrets: GITHUB_TOKEN y GITHUB_REPO («usuario/repositorio»).
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (cuerpo: unknown, estado = 200) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, "Content-Type": "application/json" } });

const TABLAS = ["fotos", "categorias", "platos", "menus", "agenda"] as const;

async function leerTodo(admin: SupabaseClient) {
  const { data: aj, error } = await admin.from("ajustes").select("datos").eq("id", 1).single();
  if (error) throw error;
  const foto: Record<string, unknown> = { ajustes: aj.datos };
  for (const t of TABLAS) {
    const r = await admin.from(t).select("*").order("orden", { ascending: true });
    if (r.error) throw r.error;
    foto[t] = r.data;
  }
  return foto;
}

// Restaurar: deja las tablas exactamente como en la versión elegida.
async function volcar(admin: SupabaseClient, snapshot: Record<string, any>) {
  const ids = (t: string) => (snapshot[t] ?? []).map((x: { id: string }) => x.id);
  // primero se quita lo que sobra (de hijos a padres), luego se escribe (de padres a hijos)
  for (const t of ["platos", "agenda", "menus", "categorias", "fotos"]) {
    const lista = ids(t);
    const q = admin.from(t).delete();
    const r = lista.length ? await q.not("id", "in", `(${lista.map((i: string) => `"${i}"`).join(",")})`) : await q.neq("id", "");
    if (r.error) throw r.error;
  }
  for (const t of TABLAS) {
    if ((snapshot[t] ?? []).length) {
      const r = await admin.from(t).upsert(snapshot[t]);
      if (r.error) throw r.error;
    }
  }
  const r = await admin.from("ajustes").update({ datos: snapshot.ajustes }).eq("id", 1);
  if (r.error) throw r.error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await usuario.auth.getUser();
    if (!user) return json({ error: "Tu sesión ha caducado. Vuelve a entrar." }, 401);
    const { data: esEditor } = await usuario.rpc("es_editor");
    if (!esEditor) return json({ error: "Tu email no tiene permiso para publicar." }, 403);

    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const cuerpo = await req.json().catch(() => ({}));

    const { data: ultima } = await admin.from("publicaciones").select("version, creado")
      .order("version", { ascending: false }).limit(1).maybeSingle();
    if (ultima && Date.now() - new Date(ultima.creado).getTime() < 30_000) {
      return json({ error: "Acabas de publicar. Espera medio minuto y vuelve a intentarlo." }, 429);
    }

    let snapshot: Record<string, unknown>;
    let resumen: string | null = null;
    if (cuerpo.restaurar) {
      const { data: vieja } = await admin.from("publicaciones").select("snapshot").eq("version", cuerpo.restaurar).maybeSingle();
      if (!vieja) return json({ error: "No encuentro esa versión." }, 404);
      snapshot = vieja.snapshot;
      await volcar(admin, vieja.snapshot);
      resumen = `Restaurada la versión ${cuerpo.restaurar}`;
    } else {
      snapshot = await leerTodo(admin);
    }

    const { data: pub, error } = await admin.from("publicaciones")
      .insert({ snapshot, autor: user.email, resumen }).select("version").single();
    if (error) throw error;

    const aviso = await fetch(`https://api.github.com/repos/${Deno.env.get("GITHUB_REPO")}/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("GITHUB_TOKEN")}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "sequer-publicar",
      },
      body: JSON.stringify({ event_type: "publicar", client_payload: { version: pub.version } }),
    });
    if (!aviso.ok) {
      await admin.from("publicaciones").update({ estado: "error" }).eq("version", pub.version);
      return json({ error: "Guardado, pero no se pudo avisar a la web. Vuelve a publicar en un minuto." }, 502);
    }
    return json({ version: pub.version });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
