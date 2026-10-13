# Muro — fondos minimalistas para Android

App de personalización para descargar y aplicar fondos de pantalla. La idea es simple: pocas
pantallas, cero distracciones, y que el color lo pongan los fondos.

| Carpeta | Qué contiene |
|---|---|
| `android/` | App nativa: Kotlin + Jetpack Compose + Material 3 |
| `prototipo/` | Prototipo web interactivo del diseño, con el mismo catálogo que la app |
| `catalogo/` | `catalogo.json` + 18 fondos originales (1080×2400 WebP) y sus miniaturas |
| `herramientas/` | Scripts que generan los fondos y los gráficos de Play Store |
| `play-store/` | Icono 512, gráfico destacado y capturas listos para subir |
| `privacidad.html` | Política de privacidad (Play la exige) |

## Diseño

**Principios:** contenido a pantalla completa, controles en "vidrio" que no tapan el fondo,
una sola acción principal (Aplicar) y nada de cuentas, anuncios ni pop-ups.

**Pantallas**

1. **Explorar**: título, chips de categoría (Todos, Degradados, Formas, Ondas, Noche, Tierra) y una
   rejilla escalonada de dos columnas con tarjetas 9:20 de esquinas de 20 dp.
2. **Detalle**: el fondo a pantalla completa. Abajo, una barra translúcida con nombre, favorito,
   descargar y **Aplicar**. Arriba, el botón de reloj simula la pantalla de bloqueo para ver
   cómo queda la hora encima.
3. **Aplicar**: hoja inferior con *Pantalla de inicio*, *Pantalla de bloqueo* o *Ambas*.
4. **Favoritos**: la misma rejilla, filtrada. Se guardan solo en el teléfono.

La navegación es una píldora flotante con dos secciones. Hay tema claro y oscuro (sigue al sistema).

**Tokens** (compartidos entre `prototipo/prototipo.css` y `ui/tema/Tema.kt`)

| Token | Claro | Oscuro |
|---|---|---|
| Fondo | `#F6F4F0` | `#0F0F0F` |
| Superficie | `#FFFFFF` | `#1A1A1A` |
| Tinta | `#141414` | `#F2F0EC` |
| Tinta secundaria | `#6B6966` | `#9A9792` |
| Chip | `#EBE8E2` | `#222222` |

Radios: tarjetas 20 dp, hoja y barra 28 dp, chips y botones en píldora. Iconos de trazo de 1,8.

## Ver el prototipo

```sh
python3 -m http.server 8000      # desde la raíz del repositorio
# abre http://localhost:8000/muro/prototipo/
```

Con GitHub Pages activo queda en `https://edwarmesa.github.io/portafolio/muro/prototipo/`.

## Catálogo de fondos

La app lee `catalogo/catalogo.json` desde GitHub Pages (`CATALOGO_URL` en `android/app/build.gradle.kts`).
Así puedes añadir fondos **sin publicar otra versión** de la app: subes las imágenes, actualizas el
JSON y listo.

```json
{ "id": "brasa", "nombre": "Brasa", "categoria": "Formas", "color": "#f3e9dc",
  "imagen": "fondos/brasa.webp", "miniatura": "miniaturas/brasa.webp" }
```

Los 18 fondos incluidos los genera `herramientas/generar_fondos.py` por código, así que son
originales y puedes publicarlos sin problemas de derechos. **No subas imágenes de otros
sin licencia**: es la causa más común de que Google retire apps de fondos.

```sh
python3 muro/herramientas/generar_fondos.py   # regenera fondos, miniaturas y catalogo.json
python3 muro/herramientas/recursos_play.py    # regenera icono y gráfico destacado
```

## Compilar la app

Requisitos: Android Studio (2025.1 o más reciente) con el SDK 36.

1. Abre la carpeta `muro/android` en Android Studio y deja que sincronice Gradle.
2. Ejecuta en un emulador o móvil con Android 10 o superior.

Pila: AGP 8.13, Kotlin 2.2.20, Compose BOM 2025.09.01, Coil 3.3. `minSdk 29`, `targetSdk 36`.
Sin permisos peligrosos: solo `INTERNET` y `SET_WALLPAPER`. Las descargas usan MediaStore
(carpeta *Imágenes/Muro*), así que no hay que pedir permiso de almacenamiento.

> El proyecto se escribió sin poder compilarlo en este entorno (sin acceso al repositorio Maven de
> Google). Si Android Studio marca alguna versión de dependencia, acepta la actualización que propone.

## Publicar en Play Store

1. **Activa GitHub Pages** en el repositorio (Settings → Pages → rama principal, carpeta raíz) y
   comprueba que abre `…/muro/catalogo/catalogo.json` y `…/muro/privacidad.html`.
2. Cambia el correo de contacto en `privacidad.html` (está marcado con `TODO`).
3. **Crea la clave de firma** (guárdala fuera del repositorio; si la pierdes no podrás actualizar):
   ```sh
   keytool -genkey -v -keystore muro.jks -keyalg RSA -keysize 2048 -validity 10000 -alias muro
   ```
   y crea `android/keystore.properties` (ya está en `.gitignore`):
   ```properties
   storeFile=../muro.jks
   storePassword=…
   keyAlias=muro
   keyPassword=…
   ```
4. Genera el paquete: `./gradlew bundleRelease` → `app/build/outputs/bundle/release/app-release.aab`.
5. En [Play Console](https://play.google.com/console) crea la app y completa:
   - **Ficha**: textos de abajo + `play-store/icono-512.png`, `grafico-destacado-1024x500.png` y las 4 capturas.
   - **Política de privacidad**: la URL de `privacidad.html`.
   - **Seguridad de los datos**: "No se recogen ni comparten datos".
   - **Clasificación de contenido**: cuestionario IARC → apta para todos.
   - **Público objetivo**: 13+ es lo más sencillo (con menores aplica la política de Familias).
   - **Anuncios**: No.
6. Las cuentas personales nuevas deben hacer una **prueba cerrada con al menos 12 testers durante
   14 días** antes de pasar a producción. Sube el `.aab` a *Prueba cerrada* primero.

### Textos para la ficha

**Nombre** (máx. 30): `Muro: fondos minimalistas`

**Descripción breve** (máx. 80):
`Fondos de pantalla minimalistas y originales. Sin anuncios, sin cuenta.`

**Descripción completa:**

```
Muro es una colección de fondos de pantalla minimalistas para darle a tu móvil un aspecto limpio y tranquilo.

• Fondos originales en alta resolución: degradados, formas, ondas, noches y paisajes de tierra.
• Vista previa con el reloj de la pantalla de bloqueo antes de aplicar.
• Aplica en la pantalla de inicio, en la de bloqueo o en ambas con un toque.
• Descarga cualquier fondo a tu galería.
• Guarda tus favoritos.
• Tema claro y oscuro.
• Nuevos fondos sin necesidad de actualizar la app.

Sin anuncios. Sin cuenta. Sin rastreo: Muro no recoge ningún dato personal.
```

**Categoría:** Personalización · **Etiquetas:** fondos de pantalla, minimalista, personalización.

## Ideas para siguientes versiones

- Fondo diario automático (WorkManager) y "aplicar al azar".
- Fondos que cambian entre claro y oscuro según el tema del sistema.
- Ajustes de recorte y desenfoque antes de aplicar.
- Traducción al inglés de la app y de la ficha para llegar a más países.
