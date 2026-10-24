# tizenbrew-inicio

Módulo de [TizenBrew](https://github.com/reisxd/TizenBrew) que funciona como pantalla de inicio en una Samsung Tizen.

## Versión actual: diagnóstico (v0.1.0)

Muestra si la API `tizen.application` está disponible dentro del módulo, lista las apps instaladas con su ID (las buscadas, marcadas con ★, primero) y prueba lanzar la elegida con `launch()` y, si falla, con `launchAppControl()`.

Control remoto: ↑ ↓ moverse · ◀ ▶ saltar de a 8 · OK lanzar · Atrás salir.

## Instalar en TizenBrew

En el Module Manager de TizenBrew, elegir la opción de módulo de GitHub y escribir:

```
tmosiewicki-afk/tizenbrew-inicio@v0.1.0
```

TizenBrew le agrega el prefijo `gh/` y lo carga desde jsDelivr.
