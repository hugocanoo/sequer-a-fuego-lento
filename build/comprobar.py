#!/usr/bin/env python3
"""Comprueba la web generada: enlaces y fotos rotos, fotos huérfanas, platos perdidos
y restos de plantilla. Sale con código 1 si algo falla (lo usa también la GitHub Action)."""
import glob
import json
import os
import re
import sys
from html.parser import HTMLParser

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(RAIZ)
errores, avisos = [], []


class Recoger(HTMLParser):
    def __init__(self):
        super().__init__()
        self.refs, self.ids, self.platos, self.imgs_sin_alt = [], set(), 0, 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if "id" in a:
            self.ids.add(a["id"])
        for k in ("href", "src", "data-ampliar"):
            if a.get(k):
                self.refs.append(a[k])
        if a.get("srcset"):
            self.refs += [p.strip().split(" ")[0] for p in a["srcset"].split(",")]
        if tag == "li" and "plato" in (a.get("class") or "").split():
            self.platos += 1
        if tag == "img" and "alt" not in a:
            self.imgs_sin_alt += 1


datos = json.load(open("datos/contenido.json", encoding="utf-8"))
usadas = set()
platos_html = {}
for pagina in sorted(glob.glob("*.html")):
    texto = open(pagina, encoding="utf-8").read()
    p = Recoger()
    p.feed(texto)
    for ref in p.refs:
        if re.match(r"^(https?:|mailto:|tel:|data:|#)", ref):
            if ref.startswith("#") and len(ref) > 1 and ref[1:] not in p.ids:
                errores.append(f"{pagina}: ancla rota {ref}")
            continue
        ruta = ref.split("#")[0].split("?")[0]
        if not os.path.exists(ruta):
            errores.append(f"{pagina}: no existe {ruta}")
        if ruta.startswith("fotos/"):
            usadas.add(ruta)
    if p.imgs_sin_alt:
        errores.append(f"{pagina}: {p.imgs_sin_alt} imágenes sin alt")
    for resto in ("None", "{e(", "{self", "undefined", "nan €"):
        if re.search(r">[^<]*" + re.escape(resto), texto):
            errores.append(f"{pagina}: resto de plantilla «{resto}»")
    platos_html[pagina] = p.platos

# fotos huérfanas (optimizadas que ya nadie usa)
for f in glob.glob("fotos/*.webp"):
    if f not in usadas:
        avisos.append(f"foto sin usar: {f}")

# ningún plato perdido
visibles_cat = {c["id"]: c["carta"] for c in datos["categorias"] if c.get("visible", True)}
esperados = {"carta.html": 0, "almuerzos.html": 0}
for pl in datos["platos"]:
    if pl.get("visible", True) and pl["categoria_id"] in visibles_cat:
        esperados[visibles_cat[pl["categoria_id"]] + ".html"] += 1
for pag, n in esperados.items():
    if platos_html.get(pag) != n:
        errores.append(f"{pag}: {platos_html.get(pag)} platos en la web y {n} en contenido.json")

print(f"Páginas: {len(platos_html)} · platos carta {platos_html.get('carta.html')} · almuerzos {platos_html.get('almuerzos.html')} · fotos usadas {len(usadas)}")
for a in avisos:
    print("  aviso:", a)
for e in errores:
    print("  ✗", e)
print("✓ Todo en orden" if not errores else f"✗ {len(errores)} errores")
sys.exit(1 if errores else 0)
