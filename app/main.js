// Diagnóstico para la pantalla de inicio: muestra si la API de Tizen está
// disponible dentro del módulo, lista las apps instaladas y prueba lanzarlas.
// ES5 a propósito: el motor web de Tizen 5.0 es un Chromium viejo.
(function () {
  'use strict';

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009 };
  var PAGE = 8;
  var TARGETS = /netflix|flow|disney|prime|amazon|apple|youtube|hbo|\bmax\b/i;

  var apps = [];
  var focused = 0;

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

  function errText(e) {
    if (!e) return 'error desconocido';
    return (e.name || 'Error') + ': ' + (e.message || String(e));
  }

  function hasTizenApp() {
    return typeof tizen !== 'undefined' && !!tizen.application;
  }

  function showEnv() {
    addEnv('URL', location.href);
    addEnv('typeof tizen', typeof tizen, typeof tizen !== 'undefined' ? 'ok' : 'bad');
    addEnv('tizen.application', hasTizenApp() ? 'disponible' : 'NO disponible',
      hasTizenApp() ? 'ok' : 'bad');

    if (typeof tizen !== 'undefined' && tizen.systeminfo) {
      try {
        addEnv('Versión de plataforma',
          tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version'));
      } catch (e) {
        addEnv('Versión de plataforma', errText(e), 'bad');
      }
    }

    if (hasTizenApp()) {
      try {
        var info = tizen.application.getCurrentApplication().appInfo;
        addEnv('App actual', info.id + ' (' + info.name + ')');
      } catch (e) {
        addEnv('App actual', errText(e), 'bad');
      }
    }

    addEnv('User agent', navigator.userAgent);
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
    if (!hasTizenApp()) {
      setStatus('tizen.application no está disponible: no se pueden listar ni lanzar apps desde la página.', 'bad');
      return;
    }
    try {
      tizen.application.getAppsInfo(function (infos) {
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
      }, function (e) {
        setStatus('getAppsInfo falló: ' + errText(e), 'bad');
      });
    } catch (e) {
      setStatus('getAppsInfo lanzó una excepción: ' + errText(e), 'bad');
    }
  }

  // Prueba launch() y, si falla, launchAppControl() con el mismo ID,
  // para saber cuál de los dos caminos sirve en esta tele.
  function launchApp(app) {
    setStatus('Lanzando ' + app.name + ' (' + app.id + ') con launch()…');
    try {
      tizen.application.launch(app.id, function () {
        setStatus('launch() OK: ' + app.id, 'ok');
      }, function (e) {
        tryAppControl(app, 'launch() falló: ' + errText(e));
      });
    } catch (e) {
      tryAppControl(app, 'launch() lanzó una excepción: ' + errText(e));
    }
  }

  function tryAppControl(app, previous) {
    setStatus(previous + ' · probando launchAppControl()…', 'bad');
    try {
      var control = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/view');
      tizen.application.launchAppControl(control, app.id, function () {
        setStatus(previous + ' · launchAppControl() OK', 'ok');
      }, function (e) {
        setStatus(previous + ' · launchAppControl() falló: ' + errText(e), 'bad');
      });
    } catch (e) {
      setStatus(previous + ' · launchAppControl() lanzó una excepción: ' + errText(e), 'bad');
    }
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

  showEnv();
  loadApps();
})();
