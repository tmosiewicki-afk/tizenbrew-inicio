# tizenbrew-inicio

Módulo de [TizenBrew](https://github.com/reisxd/TizenBrew) que funciona como pantalla de inicio en una Samsung Tizen: una franja destacada con la app elegida en grande (al estilo del "top shelf" de Apple TV), reloj, fecha y una fila con los logos de tus apps, que las abre con el control.

## Uso

- ◀ ▶: elegir app · OK: abrirla · 1 a 7: abrir la app de esa posición.
- Atrás dos veces seguidas (dentro de 2 segundos): volver a la interfaz de TizenBrew.
- Con autolaunch activo, apretar ↑ mientras TizenBrew carga evita que abra el menú (función de TizenBrew).
- Recuerda la última app elegida.

## Cómo funciona

La página de un módulo no tiene acceso a la API `tizen`, así que el módulo trae un servicio (`service.js`) que corre dentro del servicio Node.js de TizenBrew, donde sí está. El servicio escucha en `127.0.0.1:8090`:

- `GET /launch?id=<id>`: abre la app con `launch()` y, si falla, con `launchAppControl()`.
- `GET /status` y `GET /apps`: estado del servicio y apps instaladas, para diagnóstico.

Las apps, su orden, colores y descripciones están en `app/apps.js`. Abrir `app/index.html` como archivo local muestra una vista previa con lanzamientos simulados (`?focus=N` elige la app con foco).

## Créditos

- Tipografía [Outfit](https://github.com/Outfitio/Outfit-Fonts), licencia SIL Open Font License 1.1 (`app/fonts/OFL.txt`).
- Logos de Wikimedia Commons, recoloreados para fondo oscuro donde hacía falta. Son marcas registradas de sus respectivos dueños y se usan solo para identificar cada app en el menú.

## Instalar en TizenBrew

En el Module Manager de TizenBrew, elegir la opción de módulo de GitHub y escribir:

```
tmosiewicki-afk/tizenbrew-inicio@v1.2.0
```

TizenBrew le agrega el prefijo `gh/` y lo carga desde jsDelivr. Al actualizar desde otra versión: quitar el módulo viejo, agregar el nuevo y reiniciar la tele (el servicio anterior sigue ocupando el puerto 8090 hasta que TizenBrew se reinicia).

Para que el menú se abra al entrar a TizenBrew, elegirlo en Settings → autolaunch.
