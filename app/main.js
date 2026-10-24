// Diagnóstico para la pantalla de inicio. La página no tiene acceso a `tizen`
// (v0.1.0 lo confirmó), así que lista y lanza apps a través del servicio del
// módulo (service.js), que escucha en 127.0.0.1:8090.
// ES5 a propósito: el motor web de Tizen 5.0 es un Chromium viejo.
(function () {
  'use strict';

  var VERSION = '0.2.0';
  var SERVICE = 'http://127.0.0.1:8090';
  var RETRIES = 20;
  var RETRY_MS = 1000;

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009 };
  var PAGE = 8;
  var TARGETS = /netflix|flow|disney|prime|amazon|apple|youtube|hbo|\bmax\b/i;

  var apps = [];
  var focused = 0;
  var launching = false;

  var envEl = document.getElementById('env');
  var listEl = document.getElementById('apps');
  var titleEl = document.getElementById('apps-title');
  var statusEl = document.getElementById('status');

  function setStatus(text, kind) {
    statusEl.textContent = text;
    statusEl.className = kind || '';
  }

  function addEnv(key, value, kind) {
    var k = document.createElement('div');
    k.className = 'k';
    k.textContent = key;
    var v = document.createElement('div');
    v.className = kind || '';
    v.textContent = value;
    envEl.appendChild(k);
    envEl.appendChild(v);
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
        return callback('respuesta inválida (' + xhr.status + '): ' + xhr.responseText.slice(0, 200));
      }
      if (xhr.status !== 200) return callback(data.error || ('HTTP ' + xhr.status), data);
      callback(null, data);
    };
    xhr.onerror = function () { callback('no se pudo conectar con el servicio'); };
    xhr.ontimeout = function () { callback('el servicio no respondió a tiempo'); };
    xhr.send();
  }

  function showPageEnv() {
    addEnv('Página', 'v' + VERSION + ' · ' + location.href);
    addEnv('typeof tizen (página)', typeof tizen);
  }

  // El servicio arranca casi a la vez que la página: reintenta hasta que responda.
  function waitForService(attempt) {
    setStatus('Esperando al servicio… (intento ' + attempt + ' de ' + RETRIES + ')');
    request('/status', 2000, function (err, status) {
      if (err) {
        if (attempt < RETRIES) {
          setTimeout(function () { waitForService(attempt + 1); }, RETRY_MS);
        } else {
          addEnv('Servicio', err, 'bad');
          setStatus('El servicio no responde en ' + SERVICE + ': ' + err +
            '. Revisá en Settings de TizenBrew si el servicio quedó caído.', 'bad');
        }
        return;
      }
      showServiceEnv(status);
      if (status.tizenApplication) loadApps();
      else setStatus('El servicio responde, pero no tiene tizen.application.', 'bad');
    });
  }

  function showServiceEnv(status) {
    addEnv('Servicio', 'v' + status.version + ' · Node ' + status.node, 'ok');
    addEnv('typeof tizen (servicio)', status.tizen, status.tizen !== 'undefined' ? 'ok' : 'bad');
    addEnv('tizen.application (servicio)', status.tizenApplication ? 'disponible' : 'NO disponible',
      status.tizenApplication ? 'ok' : 'bad');
    addEnv('Versión de plataforma', String(status.platform));
    if (status.errors && status.errors.length) {
      var last = status.errors[status.errors.length - 1];
      addEnv('Último error del servicio', last.where + ' → ' + last.error, 'bad');
    }
  }

  function render() {
    listEl.innerHTML = '';
    for (var i = 0; i < apps.length; i++) {
      var app = apps[i];
      var li = document.createElement('li');
      if (app.target) li.className = 'target';

      var mark = document.createElement('span');
      mark.className = 'mark';
      mark.textContent = app.target ? '★' : '';

      var name = document.createElement('span');
      name.textContent = app.name || '(sin nombre)';

      var id = document.createElement('span');
      id.className = 'id';
      id.textContent = app.id;

      var hidden = document.createElement('span');
      hidden.className = 'hidden';
      hidden.textContent = app.show ? '' : 'oculta';

      li.appendChild(mark);
      li.appendChild(name);
      li.appendChild(id);
      li.appendChild(hidden);
      listEl.appendChild(li);
    }
    moveFocus(0);
  }

  function moveFocus(delta) {
    if (!apps.length) return;
    var items = listEl.children;
    if (items[focused]) items[focused].classList.remove('focus');
    focused = Math.max(0, Math.min(apps.length - 1, focused + delta));
    items[focused].classList.add('focus');
    items[focused].scrollIntoView({ block: 'center' });
  }

  // Primero las apps buscadas, después las visibles y al final las del sistema.
  function compareApps(a, b) {
    if (a.target !== b.target) return a.target ? -1 : 1;
    if (a.show !== b.show) return a.show ? -1 : 1;
    return (a.name || '').localeCompare(b.name || '');
  }

  function loadApps() {
    setStatus('Pidiendo la lista de apps al servicio…');
    request('/apps', 10000, function (err, infos) {
      if (err) return setStatus('No se pudo obtener la lista: ' + err, 'bad');
      apps = infos.map(function (info) {
        return {
          id: info.id,
          name: info.name,
          show: info.show,
          target: TARGETS.test(info.name || '') || TARGETS.test(info.id)
        };
      }).sort(compareApps);
      var targets = apps.filter(function (a) { return a.target; }).length;
      titleEl.textContent = 'Apps instaladas: ' + apps.length + ' (★ ' + targets + ' coincidencias)';
      setStatus('Listo. Elegí una app y apretá OK para probar lanzarla.');
      render();
    });
  }

  function describeAttempts(result) {
    return result.attempts.map(function (a) {
      return a.method + '() ' + (a.ok ? 'OK' : 'falló: ' + a.error);
    }).join(' · ');
  }

  function launchApp(app) {
    if (launching) return;
    launching = true;
    setStatus('Lanzando ' + app.name + ' (' + app.id + ')…');
    request('/launch?id=' + encodeURIComponent(app.id), 15000, function (err, result) {
      launching = false;
      if (err) return setStatus('Error al pedir el lanzamiento: ' + err, 'bad');
      setStatus(app.id + ': ' + describeAttempts(result), result.ok ? 'ok' : 'bad');
    });
  }

  function exit() {
    try {
      tizen.application.getCurrentApplication().exit();
    } catch (e) {
      history.back();
    }
  }

  document.addEventListener('keydown', function (ev) {
    switch (ev.keyCode) {
      case KEY.UP: moveFocus(-1); break;
      case KEY.DOWN: moveFocus(1); break;
      case KEY.LEFT: moveFocus(-PAGE); break;
      case KEY.RIGHT: moveFocus(PAGE); break;
      case KEY.ENTER:
        if (apps[focused]) launchApp(apps[focused]);
        break;
      case KEY.BACK: exit(); break;
      default: return;
    }
    ev.preventDefault();
  });

  showPageEnv();
  waitForService(1);
})();
