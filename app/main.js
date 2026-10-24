// Pantalla de inicio. La página no tiene acceso a `tizen`, así que lanza las
// apps y pide sus íconos al servicio del módulo (service.js) en 127.0.0.1:8090.
// ES5 a propósito: el motor web de Tizen 5.0 es un Chromium viejo.
(function () {
  'use strict';

  var VERSION = '1.0.0';
  var SERVICE = 'http://127.0.0.1:8090';
  var COLUMNS = 4;
  var STORAGE_KEY = 'inicio.focused';
  var RETRY_MS = 1500;
  var ICON_RETRIES = 6;
  var STATUS_RETRIES = 10;

  // Abierto como archivo local (file://) no hay servicio: se muestra el
  // diseño con las tarjetas de respaldo y los lanzamientos se simulan.
  var PREVIEW = location.protocol === 'file:';

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009 };
  var DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  var MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

  var cards = [];
  var focused = 0;
  var launching = false;
  var toastTimer = null;

  var gridEl = document.getElementById('grid');
  var timeEl = document.getElementById('time');
  var dateEl = document.getElementById('date');
  var toastEl = document.getElementById('toast');

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function updateClock() {
    var now = new Date();
    timeEl.textContent = pad(now.getHours()) + ':' + pad(now.getMinutes());
    dateEl.textContent = DAYS[now.getDay()] + ' ' + now.getDate() + ' de ' + MONTHS[now.getMonth()];
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

  function buildCard(app, index) {
    var card = document.createElement('div');
    card.className = 'card';

    var tile = document.createElement('div');
    tile.className = 'tile';
    tile.style.background = app.bg;

    var wordmark = document.createElement('div');
    wordmark.className = 'wordmark';
    wordmark.style.color = app.fg;
    wordmark.textContent = app.name;

    var label = document.createElement('div');
    label.className = 'label';
    label.textContent = app.name;

    tile.appendChild(wordmark);

    if (!PREVIEW) {
      // El servicio arranca casi a la vez que la página: si el ícono falla,
      // reintenta unas veces antes de quedarse con la tarjeta de respaldo.
      var img = document.createElement('img');
      var iconUrl = SERVICE + '/icon?id=' + encodeURIComponent(app.id);
      var iconRetries = 0;
      img.onload = function () { card.classList.add('has-icon'); };
      img.onerror = function () {
        if (++iconRetries <= ICON_RETRIES) {
          setTimeout(function () { img.src = iconUrl + '&r=' + iconRetries; }, RETRY_MS);
        }
      };
      img.src = iconUrl;
      tile.appendChild(img);
    }

    card.appendChild(tile);
    card.appendChild(label);
    gridEl.appendChild(card);
    cards[index] = { el: card, label: label, app: app };
  }

  function setFocus(index) {
    if (cards[focused]) cards[focused].el.classList.remove('focus');
    focused = Math.max(0, Math.min(cards.length - 1, index));
    cards[focused].el.classList.add('focus');
    try {
      localStorage.setItem(STORAGE_KEY, String(focused));
    } catch (e) {}
  }

  function restoreFocus() {
    var saved = 0;
    try {
      saved = parseInt(localStorage.getItem(STORAGE_KEY), 10) || 0;
    } catch (e) {}
    setFocus(saved);
  }

  function launch(index) {
    var card = cards[index];
    if (!card || launching) return;
    launching = true;
    card.el.classList.add('launching');
    card.label.textContent = 'Abriendo…';

    function done(err) {
      launching = false;
      card.el.classList.remove('launching');
      card.label.textContent = card.app.name;
      if (err) showToast('No se pudo abrir ' + card.app.name + ': ' + err);
    }

    if (PREVIEW) {
      setTimeout(function () { done(); showToast('Vista previa: acá se abriría ' + card.app.name); }, 600);
      return;
    }

    request('/launch?id=' + encodeURIComponent(card.app.id), 15000, function (err, result) {
      if (err) return done(err);
      if (!result.ok) {
        var last = result.attempts[result.attempts.length - 1];
        return done(last ? last.error : 'error desconocido');
      }
      done();
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

  function onKey(ev) {
    var col = focused % COLUMNS;
    var key = ev.keyCode;

    // Teclas numéricas del control: 1 a 7 abren la app de esa posición.
    if (key >= 49 && key <= 57) {
      var n = key - 49;
      if (n < cards.length) {
        setFocus(n);
        launch(n);
      }
      ev.preventDefault();
      return;
    }

    switch (key) {
      case KEY.LEFT:
        if (col > 0) setFocus(focused - 1);
        break;
      case KEY.RIGHT:
        if (col < COLUMNS - 1 && focused + 1 < cards.length) setFocus(focused + 1);
        break;
      case KEY.UP:
        if (focused - COLUMNS >= 0) setFocus(focused - COLUMNS);
        break;
      case KEY.DOWN:
        if (focused + COLUMNS < cards.length) setFocus(focused + COLUMNS);
        else if (Math.floor(focused / COLUMNS) < Math.floor((cards.length - 1) / COLUMNS)) setFocus(cards.length - 1);
        break;
      case KEY.ENTER:
        launch(focused);
        break;
      case KEY.BACK:
        // Es la pantalla de inicio: Atrás no hace nada. Volver a TizenBrew
        // con autolaunch activo volvería a abrir este menú.
        break;
      default:
        return;
    }
    ev.preventDefault();
  }

  for (var i = 0; i < APPS.length; i++) buildCard(APPS[i], i);
  updateClock();
  setInterval(updateClock, 10000);
  restoreFocus();
  document.addEventListener('keydown', onKey);
  if (!PREVIEW) checkService(1);
})();
