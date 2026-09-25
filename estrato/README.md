# ESTRATO — Geofísica aérea e IA

Sitio web inmersivo para ESTRATO con un explorador 3D de un volcán navegable.

## Ver en local

Los módulos ES y el GLB requieren un servidor (no funciona abriendo el archivo directamente):

```sh
cd estrato
python3 -m http.server 8000
# abre http://localhost:8000
```

No necesita `npm install`: Three.js (r186) está incluido en `vendor/three` con su licencia.

## Qué incluye

- **Hero** con el video del volcán y el título ESTRATO animado letra a letra.
- **Explorador 3D** (`js/explorer.js`): orbitar, acercar, doble clic para volar a un punto,
  5 capas de datos (relieve, topografía, magnetometría, térmico, IA) con transición radial,
  líneas de vuelo, dron de levantamiento siguiendo el relieve, fumarola, puntos de interés
  con panel de datos, lectura de coordenadas y recorrido guiado.
- **Tecnología, IA (con el video topográfico), corte geológico interactivo, aplicaciones y contacto.**
- Respaldo con imagen fija si no hay WebGL; pausa del render fuera de pantalla; respeta
  `prefers-reduced-motion`.

## Volcán (Blender)

`blender/build_volcano.py` genera el terreno de forma determinista y hornea las capas de datos
en el color de vértice (R = térmica, G = magnética, B = probabilidad IA). Regenerar:

```sh
blender -b --factory-startup --python blender/build_volcano.py -- --out assets
```

Probado con Blender 4.0.2. El `.blend` se regenera con el script y no se versiona.

## Pendiente de personalizar

- Correo de contacto en `js/main.js` (`contacto@estrato.ai` es un marcador).
- Los datos del explorador son **simulados** con fines demostrativos.
