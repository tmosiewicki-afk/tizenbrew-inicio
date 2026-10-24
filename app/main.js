// Pantalla de inicio. La página no tiene acceso a `tizen`, así que lanza las
// apps a través del servicio del módulo (service.js) en 127.0.0.1:8090.
// ES5 a propósito: el motor web de Tizen 5.0 es un Chromium viejo.
(function () {
  'use strict';

  var VERSION = '1.2.0';
  var SERVICE = 'http://127.0.0.1:8090';
  var STAGE_W = 1920;
  var STAGE_H = 1080;
  var STORAGE_KEY = 'inicio.focused';
  var RETRY_MS = 1500;
  var STATUS_RETRIES = 10;
  var BACK_WINDOW_MS = 2000;

  // Tamaño de los logos: todos ocupan la misma superficie (así un logo ancho
  // y uno alto pesan lo mismo a la vista), sin pasarse de su caja.
  var CARD_LOGO = { area: 7000, maxW: 150, maxH: 70 };
  var HERO_LOGO = { area: 56000, maxW: 560, maxH: 180 };
  var WATERMARK = { area: 150000, maxW: 620, maxH: 320 };

  // Abierto como archivo local (file://) no hay servicio: los lanzamientos
  // se simulan. `?focus=N` elige la app con foco para las capturas.
  var PREVIEW = location.protocol === 'file:';

  var KEY = { LEFT: 37, RIGHT: 39, ENTER: 13, BACK: 10009 };
  var DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  var items = [];
  var focused = -1;
  var launching = false;
  var toastTimer = null;
  var lastBack = 0;

  var stageEl = document.getElementById('stage');
  var ambientEl = document.getElementById('ambient');
  var heroesEl = document.getElementById('heroes');
  var shelfEl = document.getElementById('shelf');
  var openingTextEl = document.getElementById('opening-text');
  var rowEl = document.getElementById('row');
  var greetingEl = document.getElementById('greeting');
  var timeEl = document.getElementById('time');
  var dateEl = document.getElementById('date');
  var toastEl = document.getElementById('toast');

  // El diseño está hecho a 1920x1080: se escala entero al tamaño real de la
  // pantalla, así no depende de cómo la tele defina el viewport.
  function fitStage() {
    var scale = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    stageEl.style.transform = 'scale(' + scale + ')';
  }

  function rgba(hex, alpha) {
    var n = parseInt(hex.slice(1), 16);
    return 'rgba(' + ((n >> 16) & 255) + ', ' + ((n >> 8) & 255) + ', ' + (n & 255) + ', ' + alpha + ')';
  }

  function logoSize(aspect, box) {
    var w = Math.sqrt(box.area * aspect);
    var h = w / aspect;
    if (w > box.maxW) { w = box.maxW; h = w / aspect; }
    if (h > box.maxH) { h = box.maxH; w = h * aspect; }
    return { w: Math.round(w), h: Math.round(h) };
  }

  function logoImg(app, size) {
    var img = document.createElement('img');
    img.src = 'logos/' + app.logo;
    img.alt = app.name;
    img.style.width = size.w + 'px';
    img.style.height = size.h + 'px';
    return img;
  }

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function updateClock() {
    var now = new Date();
    var h = now.getHours();
    timeEl.textContent = pad(h) + ':' + pad(now.getMinutes());
    dateEl.textContent = DAYS[now.getDay()] + ' ' + now.getDate() + ' de ' + MONTHS[now.getMonth()];
    greetingEl.textContent = h >= 6 && h < 12 ? 'Buen día' : (h >= 12 && h < 20 ? 'Buenas tardes' : 'Buenas noches');
  }

  function showToast(text) {
    toastEl.textContent = text;
    toastEl.className = 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.className = ''; }, 6000);
  }

  // GET al servicio. callback(err, data): err es un texto listo para mostrar.
  function request(path, timeoutMs, callback) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', SERVICE + path, true);
    xhr.timeout = timeoutMs;
    xhr.onload = function () {
      var data;
      try {
        data = JSON.parse(xhr.responseText);
      } catch (e) {
        return callback('respuesta inválida del servicio (' + xhr.status + ')');
      }
      if (xhr.status !== 200) return callback(data.error || ('HTTP ' + xhr.status), data);
      callback(null, data);
    };
    xhr.onerror = function () { callback('no se pudo conectar con el servicio'); };
    xhr.ontimeout = function () { callback('el servicio no respondió a tiempo'); };
    xhr.send();
  }

  // Cada app tiene su resplandor de fondo, su franja destacada y su tarjeta.
  function build(app, index) {
    var glow = el('div', 'glow');
    glow.style.background =
      'radial-gradient(ellipse 55% 50% at 72% 30%, ' + rgba(app.color, 0.22) + ' 0%, ' + rgba(app.color, 0) + ' 70%)';
    ambientEl.appendChild(glow);

    var hero = el('div', 'hero');
    hero.style.background =
      'radial-gradient(ellipse 60% 85% at 82% 40%, ' + rgba(app.color, 0.55) + ' 0%, ' + rgba(app.color, 0.12) + ' 45%, ' + rgba(app.color, 0) + ' 75%), ' +
      'linear-gradient(120deg, #161a25 0%, #0c0e15 100%)';

    var watermark = logoImg(app, logoSize(app.aspect, WATERMARK));
    watermark.className = 'watermark';
    hero.appendChild(watermark);
    hero.appendChild(el('div', 'shade'));

    var content = el('div', 'content');
    var logo = el('div', 'logo');
    logo.appendChild(logoImg(app, logoSize(app.aspect, HERO_LOGO)));
    content.appendChild(logo);
    content.appendChild(el('div', 'tagline', app.tagline));
    hero.appendChild(content);
    heroesEl.appendChild(hero);

    var card = el('div', 'card');
    card.appendChild(logoImg(app, logoSize(app.aspect, CARD_LOGO)));
    rowEl.appendChild(card);

    items[index] = { app: app, glow: glow, hero: hero, card: card };
  }

  function setFocus(index) {
    index = Math.max(0, Math.min(items.length - 1, index));
    if (index === focused) return;
    if (focused >= 0) {
      var prev = items[focused];
      prev.card.classList.remove('focus');
      prev.hero.classList.remove('active');
      prev.glow.classList.remove('active');
    }
    focused = index;
    var item = items[focused];
    item.card.classList.add('focus');
    item.hero.classList.add('active');
    item.glow.classList.add('active');
    try {
      localStorage.setItem(STORAGE_KEY, String(focused));
    } catch (e) {}
  }

  function restoreFocus() {
    var saved = 0;
    var match = PREVIEW && /[?&]focus=(\d+)/.exec(location.search);
    if (match) {
      saved = parseInt(match[1], 10);
    } else {
      try {
        saved = parseInt(localStorage.getItem(STORAGE_KEY), 10) || 0;
      } catch (e) {}
    }
    setFocus(saved);
  }

  function launch(index) {
    var item = items[index];
    if (!item || launching) return;
    launching = true;
    openingTextEl.textContent = 'Abriendo ' + item.app.name + '…';
    shelfEl.classList.add('launching');

    function done(err) {
      launching = false;
      shelfEl.classList.remove('launching');
      if (err) showToast('No se pudo abrir ' + item.app.name + ': ' + err);
    }

    if (PREVIEW) {
      setTimeout(function () { done(); showToast('Vista previa: acá se abriría ' + item.app.name); }, 900);
      return;
    }

    request('/launch?id=' + encodeURIComponent(item.app.id), 15000, function (err, result) {
      if (err) return done(err);
      if (!result.ok) {
        var last = result.attempts[result.attempts.length - 1];
        return done(last ? last.error : 'error desconocido');
      }
      // Se deja el "Abriendo…" un momento: la app tarda en tomar la pantalla.
      setTimeout(done, 1500);
    });
  }

  // Si el servicio que responde es de otra versión, es porque una instancia
  // anterior sigue ocupando el puerto hasta que se reinicia la tele.
  function checkService(attempt) {
    request('/status', 3000, function (err, status) {
      if (err) {
        if (attempt < STATUS_RETRIES) {
          setTimeout(function () { checkService(attempt + 1); }, RETRY_MS);
        } else {
          showToast('El servicio del menú no responde: ' + err);
        }
        return;
      }
      if (status.version !== VERSION) {
        showToast('El servicio en uso es v' + status.version + ' (el menú es v' + VERSION +
          '). Reiniciá la tele para actualizarlo.');
      }
    });
  }

  // TizenBrew abre el módulo navegando su propia ventana, así que su interfaz
  // es la entrada anterior del historial. No se usa "mantener Atrás" porque en
  // los Samsung esa pulsación la toma el sistema para cerrar la app.
  function onBack() {
    var now = Date.now();
    if (now - lastBack > BACK_WINDOW_MS) {
      lastBack = now;
      showToast('Apretá Atrás otra vez para volver a TizenBrew');
      return;
    }
    lastBack = 0;
    if (PREVIEW) {
      showToast('Vista previa: acá se volvería a TizenBrew');
    } else if (history.length > 1) {
      history.back();
    } else {
      showToast('No hay una pantalla de TizenBrew a la que volver');
    }
  }

  function onKey(ev) {
    var key = ev.keyCode;

    // Teclas numéricas del control: 1 a 7 abren la app de esa posición.
    if (key >= 49 && key <= 57) {
      var n = key - 49;
      if (n < items.length) {
        setFocus(n);
        launch(n);
      }
      ev.preventDefault();
      return;
    }

    switch (key) {
      case KEY.LEFT: setFocus(focused - 1); break;
      case KEY.RIGHT: setFocus(focused + 1); break;
      case KEY.ENTER: launch(focused); break;
      case KEY.BACK: onBack(); break;
      default:
        return;
    }
    ev.preventDefault();
  }

  fitStage();
  window.addEventListener('resize', fitStage);
  for (var i = 0; i < APPS.length; i++) build(APPS[i], i);
  updateClock();
  setInterval(updateClock, 10000);
  restoreFocus();
  document.addEventListener('keydown', onKey);
  if (!PREVIEW) checkService(1);
})();
