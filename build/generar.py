#!/usr/bin/env python3
"""Genera la web de Sequer A Fuego Lento a partir de datos/contenido.json.

Uso:
  python3 build/generar.py                 # desde datos/contenido.json
  python3 build/generar.py --desde-supabase  # baja la última publicación (SUPABASE_URL y SUPABASE_ANON_KEY)

Es idempotente: con los mismos datos y el mismo día, escribe exactamente los mismos archivos.
La única dependencia del día es la agenda (próximas citas / ya celebradas).
"""
import datetime as dt
import html
import json
import os
import sys
import urllib.parse
import urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATOS = os.path.join(RAIZ, "datos", "contenido.json")

NAV = [
    ("carta", "Carta"),
    ("almuerzos", "Almuerzos"),
    ("celebraciones", "Celebraciones"),
    ("agenda", "Agenda"),
    ("galeria", "Galería"),
    ("visitanos", "Visítanos"),
]
DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"]
MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto",
         "septiembre", "octubre", "noviembre", "diciembre"]
ALERGENOS = {
    "gluten": "Gluten", "crustaceos": "Crustáceos", "huevos": "Huevos", "pescado": "Pescado",
    "cacahuetes": "Cacahuetes", "soja": "Soja", "lacteos": "Lácteos", "frutos-cascara": "Frutos de cáscara",
    "apio": "Apio", "mostaza": "Mostaza", "sesamo": "Sésamo", "sulfitos": "Sulfitos",
    "altramuces": "Altramuces", "moluscos": "Moluscos",
}
ETIQUETAS = {"nuevo": "Nuevo", "recomendado": "Recomendado", "vegetariano": "Vegetariano",
             "fuera-de-carta": "Fuera de carta"}
TIPOS_MENU = [("boda", "Bodas"), ("comunion", "Comuniones"), ("grupo", "Grupos y empresa"),
              ("coctel", "Cóctel de pie")]


# ───────────────────────── datos ─────────────────────────

def cargar():
    if "--desde-supabase" in sys.argv:
        url = os.environ["SUPABASE_URL"].rstrip("/")
        key = os.environ["SUPABASE_ANON_KEY"]
        req = urllib.request.Request(
            f"{url}/rest/v1/publicaciones?select=version,snapshot,creado&order=version.desc&limit=1",
            headers={"apikey": key, "Authorization": f"Bearer {key}"})
        fila = json.load(urllib.request.urlopen(req, timeout=30))[0]
        datos = fila["snapshot"]
        datos["version"] = fila["version"]
        datos["actualizado"] = fila["creado"]
        with open(DATOS, "w", encoding="utf-8") as f:
            json.dump(datos, f, ensure_ascii=False, indent=1)
            f.write("\n")
    with open(DATOS, encoding="utf-8") as f:
        return json.load(f)


def e(s):
    return html.escape(str(s), quote=True) if s is not None else ""


def visibles(lista):
    return sorted((x for x in lista if x.get("visible", True)), key=lambda x: x.get("orden", 0))


class Web:
    def __init__(self, d):
        self.d = d
        self.a = d["ajustes"]
        self.fotos = {f["id"]: f for f in d["fotos"]}
        self.hoy = dt.date.today()

    # ── piezas pequeñas ──
    def foto(self, fid, alt=None, clase="", sizes="100vw", eager=False, extra=""):
        f = self.fotos.get(fid)
        if not f:
            return ""
        anchos = sorted(f["anchos"])
        srcset = ", ".join(f"{f['src']}-{w}.webp {w}w" for w in anchos)
        carga = 'fetchpriority="high"' if eager else 'loading="lazy"'
        return (f'<img class="{clase}" src="{e(f["src"])}-{anchos[-1]}.webp" srcset="{e(srcset)}" '
                f'sizes="{sizes}" alt="{e(alt if alt is not None else f["alt"])}" {carga} decoding="async" '
                f'style="object-position:{e(f.get("foco", "50% 50%"))}" {extra}>')

    def tel_href(self, numero=None):
        return "tel:+34" + (numero or self.a["telefono"]).replace(" ", "")

    def wa_href(self, texto=""):
        if not self.a.get("whatsapp"):
            return None
        n = "34" + self.a["whatsapp"].replace(" ", "")
        return f"https://wa.me/{n}" + (f"?text={urllib.parse.quote(texto)}" if texto else "")

    def precio(self, p):
        if p.get("precio_texto"):
            return f'<span class="precio">{e(p["precio_texto"])}</span>'
        if p.get("precio") is None:
            return ""  # el restaurante no quiere precios en la web: sin precio no se pinta ni el hueco
        v = float(p["precio"])
        t = f"{v:.2f}".replace(".", ",").replace(",00", "")
        pp = ' <small>/pers.</small>' if p.get("por_persona") else ""
        return f'<span class="precio">{t}&nbsp;€{pp}</span>'

    def pendiente(self, texto):
        return f'<p class="hueco"><span>Pendiente</span>{e(texto)}</p>'

    def dias_texto(self, dias):
        dias = sorted(dias)
        if len(dias) == 7:
            return "Todos los días"
        if dias == [1, 2, 3, 4, 5, 6]:
            return "De lunes a sábado"
        faltan = [x for x in range(7) if x not in dias]
        if len(faltan) == 1:
            return f"Todos los días menos {DIAS[faltan[0]]}"
        return ", ".join(DIAS[x].capitalize() for x in dias)

    def horario_lista(self):
        filas = "".join(
            f'<li><strong>{e(h["nombre"])}</strong><span>{e(self.dias_texto(h["dias"]))}</span>'
            f'<span class="horas">{e(h["desde"])}–{e(h["hasta"])}</span></li>'
            for h in self.a["horarios"])
        return f'<ul class="horario">{filas}</ul>'

    def direccion(self):
        a = self.a
        return f'{e(a["direccion"])}, {e(a["codigo_postal"])} {e(a["localidad"])}'

    def antetitulo(self, t):
        return f'<p class="antetitulo">{e(t)}</p>'

    # ── esqueleto ──
    def pagina(self, pid, titulo, desc, cuerpo, og="paella-fuego-lena", oscura=False):
        a = self.a
        nav = "".join(
            f'<li><a href="{k}.html"{" aria-current=page" if k == pid else ""}>{v}</a></li>' for k, v in NAV)
        nav_movil = "".join(
            f'<li style="--i:{i}"><a href="{k}.html">{v}</a></li>' for i, (k, v) in enumerate(NAV))
        aviso = ""
        av = a.get("aviso") or {}
        if av.get("texto") and (not av.get("hasta") or av["hasta"] >= self.hoy.isoformat()):
            aviso = f'<div class="aviso" data-hasta="{e(av.get("hasta") or "")}"><p>{e(av["texto"])}</p></div>'
        wa = self.wa_href()
        barra_wa = f'<a href="{e(wa)}">WhatsApp</a>' if wa else ""
        og_img = self.fotos.get(og, {}).get("src", "fotos/paella-fuego-lena")
        ld = {
            "@context": "https://schema.org", "@type": "Restaurant",
            "name": f'{a["nombre"]} · {a["apellido"]}', "servesCuisine": ["Arroces", "Cocina valenciana"],
            "telephone": "+34 " + a["telefono"], "priceRange": "€€",
            "address": {"@type": "PostalAddress", "streetAddress": a["direccion"],
                        "postalCode": a["codigo_postal"], "addressLocality": a["localidad"],
                        "addressRegion": a["provincia"], "addressCountry": "ES"},
            "sameAs": [f'https://www.instagram.com/{a["instagram"]}/'],
            "openingHoursSpecification": [
                {"@type": "OpeningHoursSpecification",
                 "dayOfWeek": [["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday",
                                "Saturday"][x] for x in h["dias"]],
                 "opens": h["desde"], "closes": h["hasta"]} for h in a["horarios"]],
        }
        return f"""<!doctype html>
<html lang="es" class="{"pagina-oscura" if oscura else ""}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(titulo)}</title>
<meta name="description" content="{e(desc)}">
<meta property="og:type" content="website">
<meta property="og:title" content="{e(titulo)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:image" content="{e(og_img)}.jpg">
<meta name="theme-color" content="#1e3326">
<link rel="icon" href="fotos/favicon.png">
<link rel="preload" href="fuentes/young-serif-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="css/estilo.css">
<script>document.documentElement.classList.add('js');setTimeout(function(){{if(!window.SEQUER)document.documentElement.classList.add('listo')}},2500)</script>
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
</head>
<body data-pagina="{pid}">
<a class="saltar" href="#contenido">Saltar al contenido</a>
{aviso}
<header class="cabecera" data-cabecera>
  <a class="marca" href="index.html" aria-label="{e(a["nombre"])} · {e(a["apellido"])}, inicio">
    <img class="marca__logo marca__logo--oscuro" src="fotos/logo-provisional.png" alt="" width="457" height="205">
    <img class="marca__logo marca__logo--claro" src="fotos/logo-provisional-claro.png" alt="" width="457" height="205">
  </a>
  <nav class="nav" aria-label="Principal"><ul>{nav}</ul></nav>
  <a class="boton boton--brasa boton--pequeno cabecera__reservar" href="{self.tel_href()}">Reservar</a>
  <button class="cabecera__menu" type="button" aria-expanded="false" aria-controls="menu-movil" data-abrir-menu>
    <span class="sr">Menú</span><span class="hamburguesa" aria-hidden="true"></span>
  </button>
</header>
<div class="menu-movil" id="menu-movil" data-menu-movil hidden>
  <ul>{nav_movil}</ul>
  <div class="menu-movil__pie">
    <a class="boton boton--brasa" href="{self.tel_href()}">Reservar · {e(a["telefono"])}</a>
    <p>{self.direccion()}</p>
  </div>
</div>
<main id="contenido">
{cuerpo}
</main>
{self.pie()}
<nav class="barra-movil" aria-label="Acciones rápidas">
  <a href="{self.tel_href()}">Llamar</a>
  {barra_wa}
  <a href="{e(a["maps_url"])}" target="_blank" rel="noopener">Cómo llegar</a>
</nav>
<script type="application/json" id="horarios">{json.dumps(a["horarios"], ensure_ascii=False)}</script>
<script src="js/vendor/lenis.min.js" defer></script>
<script src="js/principal.js" defer></script>
</body>
</html>
"""

    def pie(self):
        a = self.a
        enlaces = "".join(f'<li><a href="{k}.html">{v}</a></li>' for k, v in NAV)
        return f"""<footer class="pie">
  <div class="pie__grande envoltura">
    <p class="pie__frase">Arroces a leña, almuerzos a la brasa y la huerta de Alboraia alrededor.</p>
    <a class="boton boton--brasa" href="{self.tel_href()}">Reserva: {e(a["telefono"])}</a>
  </div>
  <div class="pie__rejilla envoltura">
    <div>
      <img class="pie__logo" src="fotos/logo-provisional-claro.png" alt="{e(a["nombre"])} · {e(a["apellido"])}" width="457" height="205" loading="lazy">
      <p class="pie__lema">{e(a["lema"])}</p>
    </div>
    <div>
      <h2 class="pie__titulo">Dónde</h2>
      <p>{self.direccion()}</p>
      <p><a href="{e(a["maps_url"])}" target="_blank" rel="noopener">Abrir en Google Maps</a></p>
      <p class="pie__parking">Parking privado</p>
    </div>
    <div>
      <h2 class="pie__titulo">Cuándo</h2>
      {self.horario_lista()}
    </div>
    <div>
      <h2 class="pie__titulo">Sigue la huerta</h2>
      <ul class="pie__nav">{enlaces}</ul>
      <p><a href="https://www.instagram.com/{e(a["instagram"])}/" target="_blank" rel="noopener">Instagram · @{e(a["instagram"])}</a></p>
    </div>
  </div>
  <p class="pie__legal envoltura">© {self.hoy.year} {e(a["nombre"])} · {e(a["apellido"])}</p>
</footer>"""

    def cabecera_pagina(self, ante, titulo, texto, foto, alt=None):
        return f"""<section class="portadilla">
  <div class="portadilla__texto envoltura">
    {self.antetitulo(ante)}
    <h1 class="titular" data-titular>{titulo}</h1>
    <p class="entradilla">{texto}</p>
  </div>
  <figure class="portadilla__foto" data-parallax="0.12">{self.foto(foto, alt, sizes="100vw", eager=True)}</figure>
</section>"""

    # ───────────────────────── páginas ─────────────────────────

    def inicio(self):
        a = self.a
        g = f'<p class="sello"><strong>{str(a["google_nota"]).replace(".", ",")}</strong> en Google · {a["google_resenas"]} reseñas</p>' if a.get("google_nota") else ""
        video = a.get("video_hero")
        medio = (f'<video class="arco__medio" autoplay muted loop playsinline poster="fotos/paella-fuego-lena-1080.webp">'
                 f'<source src="{e(video)}" type="video/mp4"></video>') if video else self.foto(
            "paella-fuego-lena", clase="arco__medio", sizes="(min-width: 900px) 40vw, 90vw", eager=True)
        puertas = [
            ("carta.html", "paella-horno-lena", "Arroces a leña", "Paella valenciana, bogavante, marisco, negro y fideuà."),
            ("almuerzos.html", "almuerzo-chivito", "Almuerzos a la brasa", "De lunes a sábado, de 9 a 12."),
            ("celebraciones.html", "salon", "Celebrar en la huerta", "Bodas, comuniones, aniversarios y grupos."),
        ]
        puertas_html = "".join(
            f'<a class="puerta" href="{h}" data-revelar style="--i:{i}" data-tilt>'
            f'<figure>{self.foto(f, sizes="(min-width: 900px) 30vw, 90vw")}</figure>'
            f'<span class="puerta__texto"><span class="puerta__titulo">{t}</span><span>{s}</span>'
            f'<span class="puerta__flecha" aria-hidden="true">→</span></span></a>'
            for i, (h, f, t, s) in enumerate(puertas))
        dia = [
            ("9:00", "Las brasas ya están listas",
             "Fuego encendido, pan crujiente y el almuerzo que tú eliges: chivito, longaniza, panceta, lomo… De lunes a sábado, hasta las 12.",
             "brasa-almuerzos"),
            ("13:00", "El arroz, a fuego lento",
             "La leña encendida desde primera hora y los arroces cocinándose con paciencia, grano a grano.",
             "paella-horno-lena"),
            ("Sobremesa", "A la sombra de los árboles",
             "Una jarra fría en la terraza, el sol en la huerta y ese momento en el que el tiempo se afloja.",
             "jarra-cerveza-terraza"),
            ("Celebrar", "Un lugar para los días grandes",
             "Bodas, comuniones, aniversarios y comidas de grupo, con el salón mirando a las plantaciones.",
             "salon"),
        ]
        dia_html = "".join(
            f'<article class="dia__panel" style="--i:{i}"><figure class="dia__foto">{self.foto(f, sizes="(min-width: 900px) 34vw, 90vw")}</figure>'
            f'<div class="dia__texto"><p class="dia__hora{"" if h[0].isdigit() else " dia__hora--palabra"}">{h}</p><h3>{t}</h3><p>{x}</p></div></article>'
            for i, (h, t, x, f) in enumerate(dia))
        destacados = [p for p in visibles(self.d["platos"]) if p.get("foto_id")
                      and p["id"] in ("titaina", "sepia", "pulpo", "tomate-ventresca", "bunuelo", "clotxines")]
        destacados_html = "".join(
            f'<li data-revelar style="--i:{i}"><figure>{self.foto(p["foto_id"], sizes="(min-width: 900px) 22vw, 60vw")}</figure>'
            f'<p>{e(p["nombre"])}</p></li>' for i, p in enumerate(destacados))
        proximas, _ = self.agenda_partida()
        agenda = ""
        if proximas:
            agenda = "".join(self.cita(c) for c in proximas[:3])
        else:
            agenda = ('<p class="agenda-vacia">Markets de artesanía, talleres y esmorzarets en la huerta. '
                      f'Las próximas fechas las anunciamos en <a href="https://www.instagram.com/{e(a["instagram"])}/" '
                      'target="_blank" rel="noopener">Instagram</a>.</p>')
        cuerpo = f"""<section class="portada">
  <div class="portada__texto">
    {self.antetitulo(a["lema"])}
    <h1 class="titular titular--portada" data-titular>
      <span class="linea"><span>Arroces a leña</span></span>
      <span class="linea"><span>en plena huerta</span></span>
      <span class="linea"><span>de Alboraia</span></span>
    </h1>
    <p class="entradilla">Almuerzos a la brasa por la mañana, arroces a fuego lento al mediodía y un espacio para celebrar, junto a las plantaciones.</p>
    <div class="acciones">
      <a class="boton boton--brasa" href="{self.tel_href()}">Reservar mesa</a>
      <a class="boton boton--linea" href="carta.html">Ver la carta</a>
    </div>
    <ul class="chips">
      <li class="chip chip--parking"><span aria-hidden="true">P</span> Parking privado</li>
      <li class="chip" data-estado-hoy>{e(self.dias_texto(a["horarios"][0]["dias"]))} · desde las {e(a["horarios"][0]["desde"])}</li>
    </ul>
    {g}
  </div>
  <div class="portada__fotos">
    <figure class="arco" data-parallax="-0.06">{medio}</figure>
    <figure class="portada__secundaria" data-parallax="0.14">{self.foto("almuerzo-caballo-ajetes", sizes="20vw")}</figure>
  </div>
</section>

<section class="puertas envoltura" aria-label="Qué hacemos">{puertas_html}</section>

<section class="dia" data-dia aria-labelledby="dia-titulo">
  <div class="dia__fijo">
    <header class="dia__cabecera envoltura">
      {self.antetitulo("Un día en el Sequer")}
      <h2 id="dia-titulo" class="titulo-seccion">De las primeras brasas a la sobremesa</h2>
    </header>
    <div class="dia__pista" data-dia-pista>{dia_html}</div>
    <div class="dia__progreso" aria-hidden="true"><span></span></div>
  </div>
</section>

<section class="destacados envoltura">
  <div class="destacados__cabecera">
    {self.antetitulo("De la carta")}
    <h2 class="titulo-seccion">Huerta, brasa y mar</h2>
    <a class="enlace-flecha" href="carta.html">Toda la carta <span aria-hidden="true">→</span></a>
  </div>
  <ul class="destacados__lista">{destacados_html}</ul>
</section>

<section class="parking-banda">
  <div class="envoltura parking-banda__dentro">
    <p class="parking-banda__p" aria-hidden="true">P</p>
    <div>
      {self.antetitulo("Llegar es fácil")}
      <h2 class="titulo-seccion">Parking privado, en el propio recinto</h2>
      <p>{e(a["parking"]["texto"])} {self.direccion()}.</p>
      <a class="enlace-flecha" href="visitanos.html">Cómo llegar <span aria-hidden="true">→</span></a>
    </div>
  </div>
</section>

<section class="bloque-partido envoltura">
  <figure class="bloque-partido__foto" data-parallax="0.08">{self.foto("paella-bajo-los-arboles", sizes="(min-width: 900px) 45vw, 100vw")}</figure>
  <div class="bloque-partido__texto" data-revelar>
    {self.antetitulo("Celebraciones")}
    <h2 class="titulo-seccion">Bodas, comuniones y días que se recuerdan</h2>
    <p>Terraza bajo los árboles, salón con vistas a las plantaciones y arroces a leña para todos. Cada celebración es diferente: preparamos el menú contigo.</p>
    <a class="boton boton--oscuro" href="celebraciones.html">Ver celebraciones</a>
  </div>
</section>

<section class="agenda-inicio envoltura">
  {self.antetitulo("Agenda")}
  <h2 class="titulo-seccion">En el Sequer pasan cosas</h2>
  <div class="agenda-inicio__lista">{agenda}</div>
  <a class="enlace-flecha" href="agenda.html">Ver la agenda <span aria-hidden="true">→</span></a>
</section>"""
        return self.pagina("inicio", f'{a["nombre"]} · {a["apellido"]} — Arroces a leña en la huerta de Alboraia',
                           "Arrocería en plena huerta de Alboraia: arroces a leña, almuerzos a la brasa de lunes a sábado, celebraciones y parking privado.",
                           cuerpo, oscura=True)

    def lista_platos(self, cat):
        platos = [p for p in visibles(self.d["platos"]) if p["categoria_id"] == cat["id"]]
        filas = []
        for p in platos:
            etq = "".join(f'<span class="etiqueta">{e(ETIQUETAS.get(t, t))}</span>' for t in p.get("etiquetas", []))
            if not p.get("disponible", True):
                etq += '<span class="etiqueta etiqueta--agotado">Hoy no disponible</span>'
            al = p.get("alergenos") or []
            al_html = (f'<p class="alergenos" aria-label="Alérgenos">{", ".join(e(ALERGENOS.get(x, x)) for x in al)}</p>' if al else "")
            mini = self.foto(p["foto_id"], clase="plato__mini", sizes="80px") if p.get("foto_id") else ""
            datos_foto = f' data-foto="{e(p["foto_id"])}"' if p.get("foto_id") else ""
            filas.append(
                f'<li class="plato"{datos_foto}>{mini}<div class="plato__cuerpo">'
                f'<p class="plato__linea"><span class="plato__nombre">{e(p["nombre"])}</span>'
                + ('<span class="plato__puntos" aria-hidden="true"></span>' + self.precio(p) if self.precio(p) else '') + '</p>'
                + (f'<p class="plato__desc">{e(p["descripcion"])}</p>' if p.get("descripcion") else "")
                + (f'<p class="plato__etiquetas">{etq}</p>' if etq else "") + al_html + '</div></li>')
        cuerpo = f'<ul class="platos">{"".join(filas)}</ul>' if filas else ""
        if cat.get("pendiente"):
            cuerpo += self.pendiente(cat["pendiente"])
        return cuerpo

    def carta(self):
        cats = [c for c in visibles(self.d["categorias"]) if c["carta"] == "carta"]
        indice = "".join(f'<li><a href="#{e(c["id"])}">{e(c["nombre"])}</a></li>' for c in cats)
        secciones = "".join(
            f'<section class="categoria" id="{e(c["id"])}" data-categoria>'
            f'<h2 class="categoria__titulo">{e(c["nombre"])}</h2>'
            + (f'<p class="categoria__nota">{e(c["nota"])}</p>' if c.get("nota") else "")
            + self.lista_platos(c) + '</section>' for c in cats)
        menus = [m for m in visibles(self.d["menus"]) if m["tipo"] == "mediodia"]
        menus_html = "".join(self.tarjeta_menu(m) for m in menus)
        primer_foto = next((p["foto_id"] for p in visibles(self.d["platos"]) if p.get("foto_id")), "paella-valenciana")
        hay_al = any(p.get("alergenos") for p in self.d["platos"])
        leyenda = ('<p class="nota-carta">Si tienes alguna alergia o intolerancia, avísanos al pedir.</p>' if hay_al else
                   self.pendiente("Alérgenos de cada plato (se marcan desde la app)"))
        cuerpo = self.cabecera_pagina(
            "La carta", "Huerta, brasa y arroces&nbsp;a&nbsp;leña",
            "Producto de la huerta valenciana y el aroma de nuestras brasas de leña. Pregunta también por los platos fuera de carta.",
            "titaina-brasa") + f"""
<div class="carta envoltura">
  <nav class="indice" aria-label="Secciones de la carta" data-indice>
    <ul>{indice}<li><a href="#menus">Menús</a></li></ul>
    <span class="indice__marca" aria-hidden="true"></span>
  </nav>
  <div class="carta__rejilla">
    <div class="carta__lista">{secciones}
      <section class="categoria" id="menus" data-categoria>
        <h2 class="categoria__titulo">Menús del mediodía</h2>
        <div class="menus-lista">{menus_html}</div>
      </section>
      {leyenda}
    </div>
    <aside class="carta__visor" aria-hidden="true"><figure data-visor>{self.foto(primer_foto, sizes="35vw")}</figure></aside>
  </div>
</div>
<template id="fotos-carta">{"".join(f'<div data-id="{e(p["foto_id"])}">{self.foto(p["foto_id"], sizes="35vw")}</div>' for p in visibles(self.d["platos"]) if p.get("foto_id"))}</template>"""
        return self.pagina("carta", f'Carta — {self.a["nombre"]}',
                           "Carta de Sequer A Fuego Lento: ensaladas de la huerta, titaina y pulpo a la brasa, mariscos y arroces a leña.",
                           cuerpo, og="paella-bajo-los-arboles")

    def tarjeta_menu(self, m):
        tiempos = "".join(
            f'<div class="menu__tiempo{" menu__tiempo--cols" if len(t["platos"]) > 8 else ""}"><h4>{e(t["titulo"])}</h4><ul>{"".join(f"<li>{e(x)}</li>" for x in t["platos"])}</ul></div>'
            for t in m.get("tiempos") or [])
        precio = ""
        if m.get("precio_persona") is not None:
            v = f'{float(m["precio_persona"]):.2f}'.replace(".", ",").replace(",00", "")
            precio = f'<p class="menu__precio">{v}&nbsp;€ <small>por persona</small></p>'
        minimo = f'<p class="menu__min">Mínimo {int(m["minimo"])} personas</p>' if m.get("minimo") else ""
        incluye = f'<p class="menu__incluye">{e(m["incluye"])}</p>' if m.get("incluye") else ""
        notas = f'<p class="menu__notas">{e(m["notas"])}</p>' if m.get("notas") else ""
        pend = self.pendiente(m["pendiente"]) if m.get("pendiente") else ""
        return (f'<article class="menu"><h3 class="menu__nombre">{e(m["nombre"])}</h3>'
                + (f'<p>{e(m["descripcion"])}</p>' if m.get("descripcion") else "")
                + precio + minimo + tiempos + incluye + notas + pend + '</article>')

    def almuerzos(self):
        a = self.a
        h = next((x for x in a["horarios"] if x["servicio"] == "almuerzos"), None)
        cats = [c for c in visibles(self.d["categorias"]) if c["carta"] == "almuerzos"]
        listas = "".join(
            f'<section class="categoria" id="{e(c["id"])}"><h2 class="categoria__titulo">{e(c["nombre"])}</h2>'
            + (f'<p class="categoria__nota">{e(c["nota"])}</p>' if c.get("nota") else "")
            + self.lista_platos(c) + '</section>' for c in cats)
        pasos = [
            ("1", "El gasto", "Cacaos y olivas sobre la mesa, buena compañía y tiempo por delante.", "almuerzo-chivito"),
            ("2", "El bocadillo, a la brasa", "Chivito, longaniza, panceta, lomo o caballo con ajetes, recién salido del fuego.", "brasa-almuerzos"),
            ("3", "Vino con casera", "Como manda la tradición. Y sin prisas.", "almuerzo-caballo-ajetes"),
        ]
        pasos_html = "".join(
            f'<li class="paso" data-revelar style="--i:{i}"><figure>{self.foto(f, sizes="(min-width: 900px) 30vw, 90vw")}</figure>'
            f'<p class="paso__n">{n}</p><h3>{t}</h3><p>{x}</p></li>' for i, (n, t, x, f) in enumerate(pasos))
        horario = (f'<p class="gran-horario"><span>{e(self.dias_texto(h["dias"]))}</span>'
                   f'<strong>{e(h["desde"])} – {e(h["hasta"])}</strong></p>') if h else ""
        cuerpo = self.cabecera_pagina(
            "Esmorzaret valenciano", "Almuerzos a&nbsp;la&nbsp;brasa",
            "El auténtico almuerzo popular valenciano, a la brasa y al aire libre, en plena huerta.",
            "brasa-almuerzos") + f"""
<section class="envoltura almuerzos-horario">{horario}
  <a class="boton boton--brasa" href="{self.tel_href()}">Reservar · {e(a["telefono"])}</a>
</section>
<section class="ritual envoltura">
  {self.antetitulo("El ritual")}
  <h2 class="titulo-seccion">Así se almuerza en la huerta</h2>
  <ol class="pasos">{pasos_html}</ol>
</section>
<section class="carta carta--almuerzos envoltura"><div class="carta__lista">{listas}
  {self.pendiente("Si hay almuerzos los martes (al mediodía cerráis)")}</div>
</section>"""
        return self.pagina("almuerzos", f'Almuerzos a la brasa — {a["nombre"]}',
                           "Almuerzos a la brasa de lunes a sábado de 9 a 12 en la huerta de Alboraia: chivito, longaniza, panceta, lomo y caballo con ajetes.",
                           cuerpo, og="paella-fuego-lena")

    def celebraciones(self):
        a = self.a
        menus = visibles(self.d["menus"])
        pestanas, paneles = [], []
        for i, (tipo, nombre) in enumerate(TIPOS_MENU):
            ms = [m for m in menus if m["tipo"] == tipo]
            if not ms:
                continue
            pestanas.append(f'<button role="tab" id="tab-{tipo}" aria-controls="panel-{tipo}" '
                            f'aria-selected="{"true" if not pestanas else "false"}" data-tab="{tipo}">{nombre}</button>')
            paneles.append(f'<div class="panel" role="tabpanel" id="panel-{tipo}" aria-labelledby="tab-{tipo}" data-panel="{tipo}">'
                           + "".join(self.tarjeta_menu(m) for m in ms) + '</div>')
        espacios = [
            ("paella-bajo-los-arboles", "La terraza", "Bajo los árboles, con la brisa de la huerta."),
            ("salon", "El salón", "Con ventanales y vistas a las plantaciones."),
            ("jarra-cerveza-terraza", "Al aire libre", "Zona exterior junto a la huerta, para el almuerzo y las sobremesas."),
        ]
        esp_html = "".join(
            f'<li class="espacio" data-revelar style="--i:{i}" data-tilt><figure>{self.foto(f, sizes="(min-width: 900px) 30vw, 90vw")}</figure>'
            f'<h3>{t}</h3><p>{x}</p></li>' for i, (f, t, x) in enumerate(espacios))
        montajes = [
            ("cartel-cocktail", "El cóctel", "Cartel a cartel, cada momento de la fiesta tiene su sitio."),
            ("carro-vermut", "El vermut", "Un carro de vermut a la sombra, para empezar con buen pie."),
            ("cartel-bailoteo", "El bailoteo", "Y cuando se acaba la mesa, a bailar bajo los árboles."),
            ("banquete-mesas-sillas", "El banquete", "Mesas largas con mantel blanco y sillas de cuerda."),
            ("mesa-numero-4", "Los detalles", "Flores, números de mesa y un recuerdo en cada plato."),
            ("mesa-para-dos", "Mesas para todos", "Desde la mesa larga hasta la mesa para dos."),
        ]
        montajes_html = "".join(
            f'<li class="espacio" data-revelar style="--i:{i}" data-tilt><figure>{self.foto(f, sizes="(min-width: 900px) 30vw, 90vw")}</figure>'
            f'<h3>{t}</h3><p>{x}</p></li>' for i, (f, t, x) in enumerate(montajes))
        wa = self.wa_href()
        destino = wa or (f'mailto:{a["email"]}' if a.get("email") else None)
        if destino:
            formulario = f"""<form class="presupuesto" data-presupuesto data-destino="{e(destino)}">
  <label>¿Qué celebráis?<select name="tipo">{"".join(f"<option>{n}</option>" for _, n in TIPOS_MENU)}<option>Otro</option></select></label>
  <label>Fecha<input type="date" name="fecha" required></label>
  <label>Personas<input type="number" name="personas" min="1" inputmode="numeric" required></label>
  <label>Nombre<input name="nombre" autocomplete="name" required></label>
  <label class="ancho">Cuéntanos<textarea name="mensaje" rows="3"></textarea></label>
  <button class="boton boton--brasa" type="submit">Pedir presupuesto</button>
</form>"""
        else:
            formulario = f"""<div class="presupuesto presupuesto--llamar">
  <p>Llámanos y te preparamos la propuesta. Ten a mano la fecha, cuántos seréis y qué celebráis.</p>
  <a class="boton boton--brasa" href="{self.tel_href(a.get("telefono_eventos"))}">Llamar al {e(a.get("telefono_eventos") or a["telefono"])}</a>
</div>"""
        cuerpo = self.cabecera_pagina(
            "Celebraciones", "Celebrar en plena&nbsp;huerta",
            "Bodas, comuniones, aniversarios, comidas de empresa y todo tipo de eventos privados, con nuestros arroces a leña.",
            "mesa-larga-vertical") + f"""
<section class="espacios envoltura">
  {self.antetitulo("Los espacios")}
  <h2 class="titulo-seccion">Terraza, salón y huerta</h2>
  <ul class="espacios__lista">{esp_html}</ul>
  {self.pendiente("Aforo de la terraza y del salón")}
</section>
<section class="espacios envoltura">
  {self.antetitulo("Así se vive")}
  <h2 class="titulo-seccion">Una celebración bajo los árboles</h2>
  <ul class="espacios__lista">{montajes_html}</ul>
</section>
<section class="menus-eventos envoltura">
  {self.antetitulo("Los menús")}
  <h2 class="titulo-seccion">Un menú para cada celebración</h2>
  <div class="pestanas" role="tablist" aria-label="Tipos de celebración" data-pestanas>{"".join(pestanas)}<span class="pestanas__marca" aria-hidden="true"></span></div>
  <div class="paneles">{"".join(paneles)}</div>
</section>
<section class="presupuesto-bloque envoltura" id="presupuesto">
  {self.antetitulo("Pide presupuesto")}
  <h2 class="titulo-seccion">Cuéntanos qué celebráis</h2>
  {formulario}
</section>"""
        return self.pagina("celebraciones", f'Bodas, comuniones y eventos — {a["nombre"]}',
                           "Celebraciones en la huerta de Alboraia: bodas, comuniones, aniversarios, grupos y cóctel de pie, con arroces a leña y parking privado.",
                           cuerpo, og="paella-bajo-los-arboles")

    def agenda_partida(self):
        citas = sorted(visibles(self.d["agenda"]), key=lambda c: (c["fecha"], c.get("hora_inicio") or ""))
        hoy = self.hoy.isoformat()
        proximas = [c for c in citas if c["fecha"] >= hoy]
        pasadas = [c for c in reversed(citas) if c["fecha"] < hoy]
        return proximas, pasadas

    def fecha_larga(self, iso):
        d = dt.date.fromisoformat(iso)
        return f'{DIAS[(d.weekday() + 1) % 7]} {d.day} de {MESES[d.month - 1]}'

    def cita(self, c, pasada=False):
        horas = f' · {c["hora_inicio"]}–{c["hora_fin"]}' if c.get("hora_inicio") and c.get("hora_fin") else ""
        acceso = {"libre": "Entrada libre", "reserva": "Con reserva", "entrada": "Con entrada"}.get(c.get("acceso"), "")
        precio = f' · {e(c["precio_texto"])}' if c.get("precio_texto") else ""
        foto = f'<figure>{self.foto(c["foto_id"], sizes="(min-width: 900px) 25vw, 45vw")}</figure>' if c.get("foto_id") else ""
        return (f'<article class="cita{" cita--pasada" if pasada else ""}">{foto}<div>'
                f'<p class="cita__fecha"><time datetime="{e(c["fecha"])}">{e(self.fecha_larga(c["fecha"]))}</time>{e(horas)}</p>'
                f'<h3>{e(c["titulo"])}</h3>' + (f'<p>{e(c["descripcion"])}</p>' if c.get("descripcion") else "")
                + (f'<p class="cita__acceso">{acceso}{precio}</p>' if acceso or precio else "") + '</div></article>')

    def agenda(self):
        a = self.a
        proximas, pasadas = self.agenda_partida()
        if proximas:
            prox = "".join(self.cita(c) for c in proximas)
        else:
            prox = (f'<p class="agenda-vacia">Ahora mismo no hay fechas cerradas. Las anunciamos primero en '
                    f'<a href="https://www.instagram.com/{e(a["instagram"])}/" target="_blank" rel="noopener">Instagram · @{e(a["instagram"])}</a>.</p>')
        pas = "".join(self.cita(c, True) for c in pasadas)
        cuerpo = self.cabecera_pagina(
            "Agenda", "Markets, talleres y&nbsp;esmorzarets",
            "Artesanía local, vintage, talleres para peques y mayores, y siempre un buen almuerzo en la huerta.",
            "paella-terraza") + f"""
<section class="agenda envoltura">
  <h2 class="titulo-seccion">Próximas citas</h2>
  <div class="agenda__lista">{prox}</div>
</section>
<section class="agenda envoltura">
  <h2 class="titulo-seccion">Lo que hemos hecho</h2>
  <div class="agenda__rejilla">{pas}</div>
</section>"""
        return self.pagina("agenda", f'Agenda — {a["nombre"]}',
                           "Markets de artesanía y vintage, talleres y esmorzarets en la huerta de Alboraia.", cuerpo,
                           og="paella-terraza")

    def galeria(self):
        cats = [("arroces", "Arroces"), ("carta", "Platos"), ("almuerzos", "Almuerzos"), ("espacio", "El espacio"),
                ("eventos", "Eventos")]
        fotos = [f for f in sorted(self.d["fotos"], key=lambda f: f.get("orden", 0)) if f.get("en_galeria")]
        presentes = {f["categoria"] for f in fotos}
        filtros = '<button aria-pressed="true" data-filtro="todo">Todo</button>' + "".join(
            f'<button aria-pressed="false" data-filtro="{k}">{v}</button>' for k, v in cats if k in presentes)
        items = "".join(
            f'<li data-cat="{e(f["categoria"])}"><button class="galeria__boton" data-ampliar="{e(f["src"])}-{max(f["anchos"])}.webp" '
            f'aria-label="Ampliar: {e(f["alt"])}">{self.foto(f["id"], sizes="(min-width: 1100px) 25vw, (min-width: 700px) 33vw, 50vw")}</button></li>'
            for f in fotos)
        cuerpo = self.cabecera_pagina(
            "Galería", "La huerta, el fuego y&nbsp;la&nbsp;mesa", "Fotos de nuestra cocina, nuestros almuerzos y nuestro espacio.",
            "paella-bajo-los-arboles") + f"""
<section class="galeria envoltura">
  <div class="filtros" role="group" aria-label="Filtrar fotos" data-filtros>{filtros}</div>
  <ul class="galeria__mosaico" data-galeria>{items}</ul>
</section>
<dialog class="visor" data-visor-galeria aria-label="Foto ampliada">
  <img alt="">
  <button class="visor__cerrar" data-cerrar aria-label="Cerrar">×</button>
  <button class="visor__nav visor__nav--ant" data-ant aria-label="Anterior">←</button>
  <button class="visor__nav visor__nav--sig" data-sig aria-label="Siguiente">→</button>
</dialog>"""
        return self.pagina("galeria", f'Galería — {self.a["nombre"]}',
                           "Fotos de Sequer A Fuego Lento: arroces a leña, almuerzos a la brasa, la terraza y el salón en la huerta de Alboraia.",
                           cuerpo, og="paella-bajo-los-arboles")

    def visitanos(self):
        a = self.a
        p = a["parking"]
        datos_p = []
        if p.get("plazas"):
            datos_p.append(f'<li><strong>{int(p["plazas"])}</strong> plazas</li>')
        if p.get("gratuito") is True:
            datos_p.append('<li>Gratuito para clientes</li>')
        if p.get("autocares") is True:
            datos_p.append('<li>Apto para autocares</li>')
        faltan = [t for k, t in (("plazas", "nº de plazas"), ("gratuito", "si es gratuito"),
                                 ("autocares", "si caben autocares")) if p.get(k) is None]
        q = urllib.parse.quote(f'{a["nombre"]}, {a["direccion"]}, {a["codigo_postal"]} {a["localidad"]}')
        cuerpo = self.cabecera_pagina(
            "Visítanos", "En plena huerta, con parking&nbsp;privado",
            f"{self.direccion()}. Rodeados de acequias y plantaciones, y a un paso de Valencia.",
            "cartel-fachada") + f"""
<section class="visita envoltura">
  <div class="visita__bloque visita__parking" data-revelar>
    <p class="parking-banda__p" aria-hidden="true">P</p>
    {self.antetitulo("Parking")}
    <h2 class="titulo-seccion">Aparca dentro, sin dar vueltas</h2>
    <p>{e(p["texto"])}</p>
    {f'<ul class="visita__datos">{"".join(datos_p)}</ul>' if datos_p else ""}
    {self.pendiente("Parking: " + ", ".join(faltan) + " · foto del aparcamiento") if faltan else ""}
  </div>
  <div class="visita__bloque" data-revelar style="--i:1">
    {self.antetitulo("Horario")}
    {self.horario_lista()}
    <p class="visita__estado" data-estado-hoy></p>
  </div>
  <div class="visita__bloque" data-revelar style="--i:2">
    {self.antetitulo("Contacto")}
    <p class="visita__tel"><a href="{self.tel_href()}">{e(a["telefono"])}</a></p>
    {f'<p>Eventos y celebraciones: <a href="{self.tel_href(a["telefono_eventos"])}">{e(a["telefono_eventos"])}</a></p>' if a.get("telefono_eventos") else ""}
    {f'<p><a href="mailto:{e(a["email"])}">{e(a["email"])}</a></p>' if a.get("email") else ""}
    <p><a href="https://www.instagram.com/{e(a["instagram"])}/" target="_blank" rel="noopener">@{e(a["instagram"])}</a></p>
    <p>{self.direccion()}</p>
    <a class="boton boton--brasa" href="{e(a["maps_url"])}" target="_blank" rel="noopener">Abrir en Google Maps</a>
  </div>
</section>
<section class="mapa envoltura">
  <iframe title="Mapa: {e(a["nombre"])}" src="https://www.google.com/maps?q={q}&amp;output=embed" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
</section>"""
        return self.pagina("visitanos", f'Cómo llegar y parking — {a["nombre"]}',
                           f"Sequer A Fuego Lento, {a['direccion']}, Alboraia. Parking privado, horario y teléfono de reservas {a['telefono']}.",
                           cuerpo, og="paella-terraza")


def escribir(nombre, texto):
    ruta = os.path.join(RAIZ, nombre)
    if os.path.exists(ruta) and open(ruta, encoding="utf-8").read() == texto:
        return False
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(texto)
    return True


def main():
    d = cargar()
    w = Web(d)
    paginas = {
        "index.html": w.inicio(), "carta.html": w.carta(), "almuerzos.html": w.almuerzos(),
        "celebraciones.html": w.celebraciones(), "agenda.html": w.agenda(), "galeria.html": w.galeria(),
        "visitanos.html": w.visitanos(),
    }
    cambiadas = [n for n, t in paginas.items() if escribir(n, t)]
    escribir("version.json", json.dumps({"version": d.get("version", 0), "actualizado": d.get("actualizado")}) + "\n")
    print(f"{len(paginas)} páginas · {len(cambiadas)} cambiadas: {', '.join(cambiadas) or 'ninguna'}")


if __name__ == "__main__":
    main()
