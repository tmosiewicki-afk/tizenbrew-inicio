# tizenbrew-inicio

Módulo de [TizenBrew](https://github.com/reisxd/TizenBrew) que funciona como pantalla de inicio en una Samsung Tizen.

## Versión actual: diagnóstico (v0.2.0)

La página de un módulo no tiene acceso a la API `tizen` (lo confirmó la v0.1.0), así que el módulo trae un servicio (`service.js`) que corre dentro del servicio Node.js de TizenBrew, donde sí está `tizen`. El servicio escucha en `127.0.0.1:8090`:

- `GET /status`: versión, si hay `tizen.application`, versión de plataforma y de Node, últimos errores.
- `GET /apps`: apps instaladas (`id`, `name`, `show`).
- `GET /launch?id=<id>`: prueba `launch()` y, si falla, `launchAppControl()`.

La página espera a que el servicio responda, muestra su estado, lista las apps (las buscadas, marcadas con ★, primero) y lanza la elegida.

Control remoto: ↑ ↓ moverse · ◀ ▶ saltar de a 8 · OK lanzar · Atrás salir.

## Instalar en TizenBrew

En el Module Manager de TizenBrew, elegir la opción de módulo de GitHub y escribir:

```
tmosiewicki-afk/tizenbrew-inicio@v0.2.0
```

TizenBrew le agrega el prefijo `gh/` y lo carga desde jsDelivr. Para actualizar desde una versión anterior, quitar el módulo viejo (`…@v0.1.0`) y agregar el nuevo.
