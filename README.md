# tizenbrew-inicio

Módulo de [TizenBrew](https://github.com/reisxd/TizenBrew) que funciona como pantalla de inicio en una Samsung Tizen: un menú oscuro y minimalista con reloj, fecha y tarjetas grandes de tus apps, que las abre con el control.

## Uso

- Flechas: mover el foco · OK: abrir la app · 1 a 7: abrir la app de esa posición.
- Atrás no hace nada: es la pantalla de inicio.
- Recuerda la última app elegida.

## Cómo funciona

La página de un módulo no tiene acceso a la API `tizen`, así que el módulo trae un servicio (`service.js`) que corre dentro del servicio Node.js de TizenBrew, donde sí está. El servicio escucha en `127.0.0.1:8090`:

- `GET /launch?id=<id>`: abre la app con `launch()` y, si falla, con `launchAppControl()`.
- `GET /icon?id=<id>`: el ícono que la app instalada trae en la tele. Si no se puede leer, la tarjeta muestra el nombre con los colores de la marca.
- `GET /status` y `GET /apps`: estado del servicio y apps instaladas, para diagnóstico.

Las apps y su orden están en `app/apps.js`. Abrir `app/index.html` como archivo local muestra una vista previa con lanzamientos simulados.

## Instalar en TizenBrew

En el Module Manager de TizenBrew, elegir la opción de módulo de GitHub y escribir:

```
tmosiewicki-afk/tizenbrew-inicio@v1.0.0
```

TizenBrew le agrega el prefijo `gh/` y lo carga desde jsDelivr. Al actualizar desde otra versión: quitar el módulo viejo, agregar el nuevo y reiniciar la tele (el servicio anterior sigue ocupando el puerto 8090 hasta que TizenBrew se reinicia).

Para que el menú se abra al entrar a TizenBrew, elegirlo en Settings → autolaunch.
