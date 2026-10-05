/* Sequer A Fuego Lento — movimiento y pequeñas utilidades.
   Todo es mejora progresiva: sin este archivo la web se ve y funciona entera. */
(function () {
  'use strict';
  window.SEQUER = 1;
  var raiz = document.documentElement;
  var quieto = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var escritorio = window.matchMedia('(min-width: 861px)');
  var punteroFino = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ── scroll suave ── */
  var lenis = null;
  if (!quieto && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.1, smoothWheel: true });
    (function bucle(t) { lenis.raf(t); requestAnimationFrame(bucle); })(performance.now());
  }
  function alturaCabecera() {
    var c = $('[data-cabecera]'); var i = $('[data-indice]');
    return (c ? c.offsetHeight : 0) + (i ? i.offsetHeight : 0) + 16;
  }
  function irA(destino) {
    if (lenis) lenis.scrollTo(destino, { offset: -alturaCabecera(), duration: 1.2 });
    else destino.scrollIntoView({ behavior: quieto ? 'auto' : 'smooth' });
  }
  document.addEventListener('click', function (ev) {
    var a = ev.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    var d = document.getElementById(a.getAttribute('href').slice(1));
    if (!d) return;
    ev.preventDefault(); irA(d);
    history.replaceState(null, '', a.getAttribute('href'));
  });

  /* ── bucle de scroll compartido ── */
  var alScroll = [];
  var pendiente = false;
  function tick() { pendiente = false; var y = window.scrollY; alScroll.forEach(function (f) { f(y); }); }
  function pedir() { if (!pendiente) { pendiente = true; requestAnimationFrame(tick); } }
  window.addEventListener('scroll', pedir, { passive: true });
  window.addEventListener('resize', pedir);

  /* ── cabecera ── */
  var cab = $('[data-cabecera]');
  var yAnterior = 0;
  if (cab) alScroll.push(function (y) {
    cab.classList.toggle('cabecera--solida', y > 40);
    var bajando = y > yAnterior && y > 420;
    if (!raiz.classList.contains('menu-abierto')) cab.classList.toggle('cabecera--oculta', bajando);
    yAnterior = y;
  });

  /* ── menú móvil ── */
  var boton = $('[data-abrir-menu]'); var menu = $('[data-menu-movil]');
  function menuAbierto(abrir) {
    raiz.classList.toggle('menu-abierto', abrir);
    boton.setAttribute('aria-expanded', abrir);
    if (abrir) { menu.hidden = false; requestAnimationFrame(function () { menu.classList.add('abierto'); }); if (lenis) lenis.stop(); }
    else { menu.classList.remove('abierto'); setTimeout(function () { if (!menu.classList.contains('abierto')) menu.hidden = true; }, 700); if (lenis) lenis.start(); }
  }
  if (boton && menu) {
    boton.addEventListener('click', function () { menuAbierto(!raiz.classList.contains('menu-abierto')); });
    menu.addEventListener('click', function (ev) { if (ev.target.closest('a')) menuAbierto(false); });
    document.addEventListener('keydown', function (ev) { if (ev.key === 'Escape' && raiz.classList.contains('menu-abierto')) { menuAbierto(false); boton.focus(); } });
  }

  /* ── revelado al bajar ── */
  /* Se comprueba en cada fotograma de scroll, no con IntersectionObserver: así todo lo que
     ya está a la vista o por encima (si se salta de golpe al final) se revela siempre. */
  var revelar = $$('[data-revelar]');
  alScroll.push(function () {
    if (!revelar.length) return;
    var limite = window.innerHeight * 0.92;
    revelar = revelar.filter(function (el) {
      if (el.getBoundingClientRect().top < limite) { el.classList.add('visto'); return false; }
      return true;
    });
  });

  /* ── parallax ── */
  if (!quieto) {
    var capas = $$('[data-parallax]').map(function (el) {
      var hijo = el.matches('.portadilla__foto, .bloque-partido__foto') ? el.querySelector('img') : el;
      return { el: el, objetivo: hijo, f: parseFloat(el.getAttribute('data-parallax')) || 0 };
    });
    if (capas.length) alScroll.push(function () {
      var vh = window.innerHeight;
      capas.forEach(function (c) {
        var r = c.el.getBoundingClientRect();
        if (r.bottom < -100 || r.top > vh + 100) return;
        var d = (r.top + r.height / 2 - vh / 2) * c.f;
        c.objetivo.style.transform = 'translate3d(0,' + d.toFixed(1) + 'px,0)';
      });
    });
  }

  /* ── inclinación 3D en tarjetas ── */
  if (!quieto && punteroFino) $$('[data-tilt]').forEach(function (el) {
    el.addEventListener('pointermove', function (ev) {
      var r = el.getBoundingClientRect();
      var x = (ev.clientX - r.left) / r.width - 0.5, y = (ev.clientY - r.top) / r.height - 0.5;
      el.style.transform = 'perspective(900px) rotateY(' + (x * 5).toFixed(2) + 'deg) rotateX(' + (-y * 5).toFixed(2) + 'deg)';
    });
    el.addEventListener('pointerleave', function () { el.style.transform = ''; });
  });

  /* ── un día en el Sequer: recorrido horizontal fijado ── */
  var dia = $('[data-dia]'); var pista = $('[data-dia-pista]');
  if (dia && pista && !quieto) {
    var barra = $('.dia__progreso', dia);
    var distancia = 0;
    var montar = function () {
      var horizontal = escritorio.matches;
      dia.classList.toggle('dia--horizontal', horizontal);
      if (!horizontal) { dia.style.height = ''; pista.style.transform = ''; return; }
      distancia = Math.max(0, pista.scrollWidth - window.innerWidth);
      dia.style.height = (distancia + window.innerHeight) + 'px';
      pedir();
    };
    alScroll.push(function () {
      if (!dia.classList.contains('dia--horizontal')) return;
      var p = Math.min(1, Math.max(0, -dia.getBoundingClientRect().top / (distancia || 1)));
      pista.style.transform = 'translate3d(' + (-p * distancia).toFixed(1) + 'px,0,0)';
      if (barra) barra.style.setProperty('--p', p.toFixed(4));
    });
    montar();
    window.addEventListener('resize', montar);
    window.addEventListener('load', montar);
  }

  /* ── carta: índice deslizante, seguimiento y visor de fotos ── */
  var indice = $('[data-indice]');
  if (indice) {
    var lista = $('ul', indice); var marca = $('.indice__marca', indice);
    var enlaces = $$('a', indice);
    var activo = null;
    var mover = function (a) {
      if (!a) return;
      marca.style.width = a.offsetWidth + 'px';
      marca.style.transform = 'translateX(' + (a.offsetLeft - lista.scrollLeft + lista.offsetLeft) + 'px)';
    };
    var activar = function (id) {
      var a = enlaces.filter(function (x) { return x.getAttribute('href') === '#' + id; })[0];
      if (!a || a === activo) return;
      enlaces.forEach(function (x) { x.classList.toggle('activo', x === a); });
      activo = a; mover(a);
      var izq = a.offsetLeft - lista.clientWidth / 2 + a.offsetWidth / 2;
      lista.scrollTo({ left: izq, behavior: quieto ? 'auto' : 'smooth' });
      var primera = $('#' + id + ' [data-foto]');
      if (primera) verFoto(primera.getAttribute('data-foto'));
    };
    lista.addEventListener('scroll', function () { mover(activo); }, { passive: true });
    window.addEventListener('resize', function () { mover(activo); });
    var secciones = $$('[data-categoria]');
    var obs = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) activar(x.target.id); });
    }, { rootMargin: '-35% 0px -60% 0px' });
    secciones.forEach(function (s) { obs.observe(s); });
    if (secciones[0]) activar(secciones[0].id);
  }
  var visor = $('[data-visor]'); var plantilla = $('#fotos-carta');
  var fotoActual = null;
  function verFoto(id) {
    if (!visor || !plantilla || id === fotoActual) return;
    var nodo = plantilla.content.querySelector('[data-id="' + id + '"] img');
    if (!nodo) return;
    fotoActual = id;
    var nueva = nodo.cloneNode(true); nueva.loading = 'eager'; nueva.classList.add('saliendo');
    var viejas = $$('img', visor);
    visor.appendChild(nueva);
    requestAnimationFrame(function () { requestAnimationFrame(function () {
      nueva.classList.remove('saliendo');
      viejas.forEach(function (v) { v.classList.add('saliendo'); setTimeout(function () { v.remove(); }, 700); });
    }); });
  }
  if (visor && punteroFino) $$('.plato[data-foto]').forEach(function (p) {
    p.addEventListener('pointerenter', function () { verFoto(p.getAttribute('data-foto')); });
  });

  /* ── pestañas de celebraciones ── */
  var pestanas = $('[data-pestanas]');
  if (pestanas) {
    var botones = $$('[data-tab]', pestanas); var marcaP = $('.pestanas__marca', pestanas);
    var abrir = function (tipo, foco) {
      botones.forEach(function (b) {
        var si = b.getAttribute('data-tab') === tipo;
        b.setAttribute('aria-selected', si); b.tabIndex = si ? 0 : -1;
        if (si) {
          marcaP.style.width = b.offsetWidth + 'px'; marcaP.style.height = b.offsetHeight + 'px';
          marcaP.style.transform = 'translate(' + b.offsetLeft + 'px,' + (b.offsetTop - 4) + 'px)';
          if (foco) b.focus();
        }
      });
      $$('[data-panel]').forEach(function (p) { p.classList.toggle('activo', p.getAttribute('data-panel') === tipo); });
    };
    botones.forEach(function (b, i) {
      b.addEventListener('click', function () { abrir(b.getAttribute('data-tab')); });
      b.addEventListener('keydown', function (ev) {
        var d = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
        if (d) { ev.preventDefault(); abrir(botones[(i + d + botones.length) % botones.length].getAttribute('data-tab'), true); }
      });
    });
    var inicial = (location.hash || '').slice(1);
    var conocido = botones.some(function (b) { return b.getAttribute('data-tab') === inicial; });
    abrir(conocido ? inicial : botones[0].getAttribute('data-tab'));
    window.addEventListener('resize', function () { var s = botones.filter(function (b) { return b.getAttribute('aria-selected') === 'true'; })[0]; if (s) abrir(s.getAttribute('data-tab')); });
  }

  /* ── formulario de presupuesto (WhatsApp o email) ── */
  var form = $('[data-presupuesto]');
  if (form) form.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var f = new FormData(form);
    var texto = 'Hola, quería pedir presupuesto.\n' +
      'Celebración: ' + f.get('tipo') + '\nFecha: ' + f.get('fecha') + '\nPersonas: ' + f.get('personas') +
      '\nNombre: ' + f.get('nombre') + (f.get('mensaje') ? '\n' + f.get('mensaje') : '');
    var destino = form.getAttribute('data-destino');
    var url = destino.indexOf('mailto:') === 0
      ? destino + '?subject=' + encodeURIComponent('Presupuesto: ' + f.get('tipo')) + '&body=' + encodeURIComponent(texto)
      : destino + '?text=' + encodeURIComponent(texto);
    window.open(url, '_blank', 'noopener');
  });

  /* ── galería: filtros y visor que amplía desde la miniatura ── */
  var galeria = $('[data-galeria]');
  if (galeria) {
    var items = $$('li', galeria);
    $$('[data-filtro]').forEach(function (b) {
      b.addEventListener('click', function () {
        var cat = b.getAttribute('data-filtro');
        $$('[data-filtro]').forEach(function (x) { x.setAttribute('aria-pressed', x === b); });
        items.forEach(function (li) {
          var ver = cat === 'todo' || li.getAttribute('data-cat') === cat;
          li.hidden = !ver;
          if (ver && !quieto) li.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 500, easing: 'cubic-bezier(.2,.7,.1,1)' });
        });
      });
    });
    var dlg = $('[data-visor-galeria]'); var grande = $('img', dlg);
    var indiceFoto = -1;
    var visibles = function () { return items.filter(function (li) { return !li.hidden; }); };
    var mostrar = function (li, desde) {
      var b = $('button', li); var mini = $('img', b);
      grande.src = b.getAttribute('data-ampliar'); grande.alt = mini.alt;
      if (!dlg.open) { dlg.showModal(); if (lenis) lenis.stop(); }
      indiceFoto = visibles().indexOf(li);
      if (desde && !quieto) {
        var anima = function () {
          var a = mini.getBoundingClientRect(), z = grande.getBoundingClientRect();
          if (!z.width) return;
          grande.animate([
            { transform: 'translate(' + (a.left - z.left) + 'px,' + (a.top - z.top) + 'px) scale(' + (a.width / z.width) + ',' + (a.height / z.height) + ')', transformOrigin: '0 0', opacity: .6 },
            { transform: 'none', transformOrigin: '0 0', opacity: 1 }
          ], { duration: 550, easing: 'cubic-bezier(.2,.7,.1,1)' });
        };
        if (grande.complete) requestAnimationFrame(anima); else grande.onload = function () { grande.onload = null; anima(); };
      }
    };
    var paso = function (d) { var v = visibles(); if (!v.length) return; mostrar(v[(indiceFoto + d + v.length) % v.length]); };
    galeria.addEventListener('click', function (ev) { var b = ev.target.closest('.galeria__boton'); if (b) mostrar(b.parentElement, true); });
    $('[data-cerrar]', dlg).addEventListener('click', function () { dlg.close(); });
    $('[data-ant]', dlg).addEventListener('click', function () { paso(-1); });
    $('[data-sig]', dlg).addEventListener('click', function () { paso(1); });
    dlg.addEventListener('click', function (ev) { if (ev.target === dlg) dlg.close(); });
    dlg.addEventListener('close', function () { if (lenis) lenis.start(); });
    dlg.addEventListener('keydown', function (ev) { if (ev.key === 'ArrowRight') paso(1); if (ev.key === 'ArrowLeft') paso(-1); });
    var x0 = null;
    dlg.addEventListener('pointerdown', function (ev) { x0 = ev.clientX; });
    dlg.addEventListener('pointerup', function (ev) { if (x0 !== null && Math.abs(ev.clientX - x0) > 50) paso(ev.clientX < x0 ? 1 : -1); x0 = null; });
  }

  /* ── «abierto ahora», con la hora de Valencia y su horario real ── */
  var nodoHorario = $('#horarios');
  if (nodoHorario) {
    try {
      var horarios = JSON.parse(nodoHorario.textContent);
      var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
      var ahora = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
      var min = function (hhmm) { var p = hhmm.split(':'); return +p[0] * 60 + +p[1]; };
      var m = ahora.getHours() * 60 + ahora.getMinutes(); var hoy = ahora.getDay();
      var texto = null;
      horarios.forEach(function (h) {
        if (!texto && h.dias.indexOf(hoy) > -1 && m >= min(h.desde) && m < min(h.hasta)) texto = 'Abierto ahora · ' + h.nombre.toLowerCase() + ' hasta las ' + h.hasta;
      });
      if (!texto) {
        for (var d = 0; d < 8 && !texto; d++) {
          var dia_ = (hoy + d) % 7;
          var siguientes = horarios.filter(function (h) { return h.dias.indexOf(dia_) > -1 && (d > 0 || min(h.desde) > m); })
            .sort(function (a, b) { return min(a.desde) - min(b.desde); });
          if (siguientes.length) {
            var cuando = d === 0 ? 'hoy' : d === 1 ? 'mañana' : 'el ' + DIAS[dia_];
            texto = 'Ahora cerrado · abrimos ' + cuando + ' a las ' + siguientes[0].desde + ' (' + siguientes[0].nombre.toLowerCase() + ')';
          }
        }
      }
      if (texto) $$('[data-estado-hoy]').forEach(function (el) { el.textContent = texto; });
    } catch (err) { /* si falla, se queda el horario escrito */ }
  }

  /* ── aviso temporal caducado ── */
  var aviso = $('.aviso[data-hasta]');
  if (aviso && aviso.getAttribute('data-hasta') && aviso.getAttribute('data-hasta') < new Date().toISOString().slice(0, 10)) aviso.remove();

  tick();
})();
