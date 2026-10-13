# Muro · arquitectura y plan técnico

## Qué tipo de producto

| Opción | A favor | En contra | Decisión |
|---|---|---|---|
| A. Web adaptable | Descubrimiento por buscadores, enlaces compartibles, despliegue inmediato | No puede aplicar fondos; pagos fuera de las tiendas | **Sí, como escaparate** |
| B. PWA instalable | Lo anterior + icono e uso sin conexión | iOS limita instalación y notificaciones; tampoco aplica fondos | Siguiente paso de la web |
| C. Nativa Android (+ iOS) | `WallpaperManager` aplica el fondo, Google Play Billing, giroscopio, fondos animados | Dos bases de código si se suma iOS | **Sí, producto principal en Play** |
| D. Híbrida (React Native / Expo) | Un código para Android e iOS | Aplicar fondo exige módulo nativo; ya existe base en Compose | Reevaluar al abordar iOS |

**Recomendación:** app nativa Android (Kotlin + Compose, ya iniciada en `android/`) como producto
en Play Store, más la web (`web/`) como escaparate y laboratorio de diseño, **ambas contra el
mismo backend**. Las compras dentro de la app usan Google Play Billing, como exige la política de
Google Play para contenido digital; la web podría vender con Stripe donde la ley y las políticas lo permitan.

## Por qué la web es JavaScript sin framework

No hay compilación ni dependencias: se sirve tal cual desde GitHub Pages, como el resto del
portafolio. Son unas 1.600 líneas en módulos ES y unas 770 de CSS. Si el equipo crece o aparecen
pantallas con mucho estado (panel de administración, cuenta), migrar a React + TypeScript con
Vite es directo: las vistas ya son funciones `render()` / `montar()` aisladas.
**Three.js / WebGL no se usa**: el parallax por capas y la perspectiva CSS consiguen la
profundidad con una fracción del coste. Queda reservado para fondos animados si llegan.

## Arquitectura

```
                ┌─────────── Supabase ─────────────────────────────┐
 App Android ──►│ Auth (JWT)                                       │
 (Compose,      │ Postgres + RLS: catálogo, compras, suscripciones,│◄── Panel admin (pendiente)
  Play Billing) │   favoritos, descargas, eventos, historial       │
 Web ──────────►│ Storage: "vistas" (público) · "originales"       │
                │   (privado, solo URLs firmadas)                  │
                │ Edge Functions: descarga-firmada,                │──► Google Play Developer API
                │   verificar-compra-google, (rtdn, stripe: pend.) │
                └──────────────────────────────────────────────────┘
```

Reglas de seguridad (validadas en `backend/supabase/pruebas`, 23 comprobaciones):
- El cliente solo lee el catálogo publicado y sus propios datos. No puede escribir compras.
- La ruta al original no es legible por el cliente (privilegios por columna).
- `tiene_derecho()` es la única fuente de verdad de acceso: gratis, compra de fondo o de
  colección completada, o suscripción activa / en gracia y no vencida.
- Los originales se entregan con URL firmada de 5 minutos tras comprobar `tiene_derecho()`.
- Ocultar un botón no protege nada: en la web pública solo hay vistas previas de 720 × 1600 de lo de pago.

## Datos

`categorias`, `colecciones`, `fondos` (con estado *borrador / programado / publicado / retirado*
y metadatos: título, descripción, autor, categoría, etiquetas, resolución, formato, fecha, precio,
licencia, colección, vista previa y original), `perfiles` (con consentimiento `personalizar`),
`favoritos`, `compras`, `suscripciones`, `descargas`, `eventos`, `historial_cambios`,
`administradores`. Esquema completo: `backend/supabase/migrations/0001_esquema.sql`.

## Personalización e IA

- **Hoy (implementado):** recomendador por contenido en el navegador (`web/js/recomendador.js`):
  afinidad por categoría, colección y etiquetas a partir de favoritos y descargas, y de lo visto
  solo con consentimiento. Nada sale del dispositivo; se borra desde Perfil.
- **Con backend:** mismo algoritmo en servidor sobre `favoritos`, `descargas` y `eventos` (solo
  si `perfiles.personalizar`), con vista "por qué te lo recomendamos" y botón de borrar.
- **Generador con IA (fase 5, pendiente):** tema, paleta, estilo, atmósfera, detalle y resolución.
  Antes de elegir proveedor: revisar su licencia comercial, quién posee la imagen generada,
  moderación de contenido y coste por imagen. Las imágenes generadas se guardarían como
  `fondos` privados del usuario, con `licencia` explícita.

## Panel de administración — pendiente

Subir fondo (original → bucket privado, vista previa y miniatura generadas en servidor),
metadatos, precio, colección, programar publicación (`estado = 'programado'`), retirar contenido,
consultar compras y estadísticas. Las políticas `*_admin` y la auditoría ya están en el esquema.

## Métricas — diseñado, pendiente de datos reales

Eventos mínimos (`vista`, `favorito`, `descarga`, `compra_iniciada`, `compra_completada`,
`compra_fallida`) sin datos personales. Indicadores: usuarios activos, retención D1/D7/D30,
fondos vistos por sesión, tasa de favoritos, conversión vista → compra, ingresos por colección,
cancelaciones de Muro+, tiempos de carga y errores. Las pruebas A/B solo cuando haya tráfico
suficiente y con la métrica de éxito definida antes de empezar.

**Objetivos de rendimiento** (web, móvil de gama media):

| Métrica | Objetivo | Medido (Chromium sin GPU, CPU 4×, 390 × 844) |
|---|---|---|
| LCP | < 2,5 s | 56–276 ms (servidor local, sin red: no representa una red móvil) |
| CLS | < 0,1 | 0 |
| Fotogramas en scroll | ≥ 55 fps de media | 30–38 fps en 5 ejecuciones (antes 11,8) — **no cumple todavía** |
| Tareas largas en scroll | 0 > 200 ms | 9–16, máx. 163–242 ms (antes 77, máx. 343 ms) — **no cumple siempre** |
| INP | < 200 ms | sin medir: necesita interacción real (pendiente en dispositivo) |

## Plan por fases

| Fase | Contenido | Estado |
|---|---|---|
| 1. Fundamentos | Identidad, catálogo, categorías, vista previa, favoritos, acceso gratis/prémium, pruebas | Web: hecho con datos de demo. Backend: esquema y RLS validados, sin proyecto real |
| 2. Experiencia inmersiva | Scroll, parallax, transiciones, tarjetas, detalle, rendimiento | Web: hecho (rendimiento por mejorar). Android: pendiente |
| 3. Comercio | Pagos, compras, descargas protegidas, historial, restaurar, suscripción | Estructura y funciones escritas; sin credenciales ni despliegue |
| 4. Personalización | Recomendaciones, preferencias, colecciones propias | Recomendador local hecho |
| 5. IA y escala | Generador, analítica, automatización, creadores | Pendiente |
