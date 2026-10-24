// Servicio del módulo: corre dentro del servicio Node.js de TizenBrew, que
// le pasa el objeto `tizen`. La página no tiene acceso a `tizen`, así que le
// pide todo a este servidor HTTP local.
// ES5 a propósito: TizenBrew contempla Node v4.4.3 en algunas teles.
'use strict';

var http = require('http');
var url = require('url');
var fs = require('fs');

var VERSION = '1.0.0';
var HOST = '127.0.0.1';
var PORT = 8090;

var errors = [];

function logError(where, e) {
  errors.push({
    time: new Date().toISOString(),
    where: where,
    error: errText(e)
  });
  if (errors.length > 20) errors.shift();
}

function errText(e) {
  if (!e) return 'error desconocido';
  return (e.name || 'Error') + ': ' + (e.message || String(e));
}

function hasTizenApp() {
  return typeof tizen !== 'undefined' && !!tizen && !!tizen.application;
}

function send(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store'
  });
  res.end(JSON.stringify(body));
}

function handleStatus(res) {
  var platform = null;
  try {
    platform = tizen.systeminfo.getCapability('http://tizen.org/feature/platform.version');
  } catch (e) {
    platform = errText(e);
  }
  send(res, 200, {
    version: VERSION,
    tizen: typeof tizen,
    tizenApplication: hasTizenApp(),
    platform: platform,
    node: process.version,
    errors: errors
  });
}

function handleApps(res) {
  if (!hasTizenApp()) return send(res, 500, { error: 'tizen.application no está disponible en el servicio' });
  try {
    tizen.application.getAppsInfo(function (infos) {
      send(res, 200, infos.map(function (info) {
        return { id: info.id, name: info.name, show: info.show };
      }));
    }, function (e) {
      logError('getAppsInfo', e);
      send(res, 500, { error: 'getAppsInfo falló: ' + errText(e) });
    });
  } catch (e) {
    logError('getAppsInfo', e);
    send(res, 500, { error: 'getAppsInfo lanzó una excepción: ' + errText(e) });
  }
}

var ICON_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };
var iconCache = {};

function sendIcon(res, icon) {
  res.writeHead(200, {
    'Content-Type': icon.type,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'max-age=86400'
  });
  res.end(icon.data);
}

// Sirve el ícono que la app instalada ya trae en la tele (iconPath), así el
// menú no depende de imágenes de las marcas alojadas afuera.
function handleIcon(res, id) {
  if (!id) return send(res, 400, { error: 'falta el parámetro id' });
  if (iconCache[id]) return sendIcon(res, iconCache[id]);
  if (!hasTizenApp()) return send(res, 500, { error: 'tizen.application no está disponible en el servicio' });

  var iconPath;
  try {
    iconPath = tizen.application.getAppInfo(id).iconPath;
  } catch (e) {
    logError('getAppInfo ' + id, e);
    return send(res, 404, { error: 'getAppInfo falló: ' + errText(e) });
  }
  if (!iconPath) return send(res, 404, { error: 'la app no tiene iconPath' });

  var file = String(iconPath).replace(/^file:\/\//, '');
  var ext = (file.match(/\.[a-z]+$/i) || [''])[0].toLowerCase();
  fs.readFile(file, function (e, data) {
    if (e) {
      logError('icono ' + id + ' (' + file + ')', e);
      return send(res, 404, { error: 'no se pudo leer el ícono: ' + errText(e) });
    }
    iconCache[id] = { type: ICON_TYPES[ext] || 'image/png', data: data };
    sendIcon(res, iconCache[id]);
  });
}

// Prueba launch() y, si falla, launchAppControl() con el mismo ID,
// para saber cuál de los dos caminos sirve en esta tele.
function handleLaunch(res, id) {
  if (!id) return send(res, 400, { error: 'falta el parámetro id' });
  if (!hasTizenApp()) return send(res, 500, { error: 'tizen.application no está disponible en el servicio' });

  var attempts = [];

  function tryAppControl() {
    try {
      var control = new tizen.ApplicationControl('http://tizen.org/appcontrol/operation/view');
      tizen.application.launchAppControl(control, id, function () {
        attempts.push({ method: 'launchAppControl', ok: true });
        send(res, 200, { id: id, ok: true, attempts: attempts });
      }, function (e) {
        logError('launchAppControl ' + id, e);
        attempts.push({ method: 'launchAppControl', ok: false, error: errText(e) });
        send(res, 200, { id: id, ok: false, attempts: attempts });
      });
    } catch (e) {
      logError('launchAppControl ' + id, e);
      attempts.push({ method: 'launchAppControl', ok: false, error: 'excepción: ' + errText(e) });
      send(res, 200, { id: id, ok: false, attempts: attempts });
    }
  }

  try {
    tizen.application.launch(id, function () {
      attempts.push({ method: 'launch', ok: true });
      send(res, 200, { id: id, ok: true, attempts: attempts });
    }, function (e) {
      logError('launch ' + id, e);
      attempts.push({ method: 'launch', ok: false, error: errText(e) });
      tryAppControl();
    });
  } catch (e) {
    logError('launch ' + id, e);
    attempts.push({ method: 'launch', ok: false, error: 'excepción: ' + errText(e) });
    tryAppControl();
  }
}

var server = http.createServer(function (req, res) {
  var parsed = url.parse(req.url, true);
  try {
    switch (parsed.pathname) {
      case '/status': return handleStatus(res);
      case '/apps': return handleApps(res);
      case '/launch': return handleLaunch(res, parsed.query.id);
      case '/icon': return handleIcon(res, parsed.query.id);
      default: return send(res, 404, { error: 'ruta desconocida: ' + parsed.pathname });
    }
  } catch (e) {
    logError(parsed.pathname, e);
    send(res, 500, { error: errText(e) });
  }
});

// Si el puerto está ocupado es porque una instancia anterior del servicio
// sigue atendiendo: no hace falta otra.
server.on('error', function (e) {
  logError('listen', e);
});

server.listen(PORT, HOST);
