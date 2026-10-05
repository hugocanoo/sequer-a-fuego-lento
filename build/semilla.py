#!/usr/bin/env python3
"""Genera supabase/migraciones/004_semilla.sql desde datos/contenido.json,
para que la base de datos arranque exactamente igual que la web publicada."""
import json
import os

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = json.load(open(os.path.join(RAIZ, "datos", "contenido.json"), encoding="utf-8"))

DEFECTOS = {"traducciones": {}, "visible": True}


def completar(filas):
    out = []
    for i, f in enumerate(filas):
        f = {**DEFECTOS, "orden": i, **f}
        out.append(f)
    return out


def j(valor):
    texto = json.dumps(valor, ensure_ascii=False)
    assert "$sem$" not in texto
    return f"$sem${texto}$sem$::jsonb"


snapshot = {k: d[k] for k in ("ajustes", "categorias", "platos", "menus", "fotos", "agenda")}
lineas = [
    "-- Generado por build/semilla.py desde datos/contenido.json. No editar a mano.",
    f"insert into public.ajustes (id, datos) values (1, {j(d['ajustes'])});",
]
# orden de carga: fotos y categorías antes que lo que las referencia
for tabla in ("fotos", "categorias", "platos", "menus", "agenda"):
    lineas.append(f"insert into public.{tabla} select * from jsonb_populate_recordset(null::public.{tabla}, {j(completar(d[tabla]))});")
lineas.append(f"insert into public.publicaciones (snapshot, autor, resumen) values ({j(snapshot)}, 'HCM Studio', 'Versión inicial de la web');")
lineas.append("-- Alta del propietario (cambiar por su email real antes de ejecutar):")
lineas.append("-- insert into public.editores (email, nombre) values ('email@del-propietario.es', 'Propietario');")

ruta = os.path.join(RAIZ, "supabase", "migraciones", "004_semilla.sql")
with open(ruta, "w", encoding="utf-8") as f:
    f.write("\n".join(lineas) + "\n")
print(f"{ruta}: {len(d['platos'])} platos, {len(d['fotos'])} fotos, {len(d['menus'])} menús, {len(d['agenda'])} citas")
