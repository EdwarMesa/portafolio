# Registro de mejoras

Ciclo continuo: auditar → priorizar → implementar → probar → documentar → proponer el siguiente.
Prioridades: **P0** seguridad, pagos o funcionamiento crítico · **P1** navegación, rendimiento o
compra · **P2** visual, animación, descubrimiento · **P3** experimentos y futuro.

Cómo repetir las pruebas citadas:
- Web: `cd muro/web/pruebas && npm install && npm test` (12 pruebas, incluye rendimiento con CPU 4×; los fps varían ±4 entre ejecuciones).
- Base de datos: `bash muro/backend/supabase/pruebas/ejecutar.sh` (23 comprobaciones de seguridad).

## Ciclo 1 · 2026-10-13

| ID | Prior. | Problema detectado | Evidencia | Solución | Impacto esperado | Complej. | Estado | Pruebas | Resultado observado |
|---|---|---|---|---|---|---|---|---|---|
| M-001 | P0 | La app Android nunca se ha compilado | Google Maven bloqueado en el entorno de trabajo | Compilar en Android Studio y corregir lo que aparezca | Poder publicar | Media | Pendiente (propietario) | — | — |
| M-002 | P0 | No se puede comprobar si GitHub Pages está activo; sin él, app y web no cargan el catálogo | `curl` a `edwarmesa.github.io` bloqueado (403 del proxy) | Activar Pages y abrir `…/muro/catalogo/catalogo.json` | Catálogo disponible | Baja | Pendiente (propietario) | — | — |
| M-003 | P1 | La v1 era una rejilla estática: 18 fondos, 5 categorías, sin colecciones, precios ni descubrimiento | Auditoría de `prototipo/` y `android/` | Web v2 inmersiva + catálogo v2 (38 fondos, 9 categorías, 15 con capas de profundidad, 8 colecciones) | Exploración y conversión | Alta | Hecho (datos de demo) | Regresión web 12/12 | Todas las secciones cargan sin errores de consola |
| M-004 | P0 | No existía control de acceso a contenido de pago | Diseño v1 | Originales de pago fuera de la web pública; `tiene_derecho()`, RLS, privilegios por columna, URL firmada | Sin fugas de contenido de pago | Alta | Hecho (estructura); funciones sin desplegar | Web: "25 originales pagados, 0 accesibles". SQL: 23/23 | Ningún original de pago accesible; reembolso y caducidad retiran acceso |
| M-005 | P1 | Scroll lento | 11,8 fps de media, p95 267 ms, 77 tareas largas (máx. 343 ms) con CPU 4× | `--ambiente` sin herencia y solo en su capa; sin `backdrop-filter`, `will-change` ni `mix-blend-mode` permanentes por tarjeta; revelado por escala en vez de `clip-path`; hero desenfocado en capa propia; barra del carrusel con animación CSS | Scroll fluido en móvil medio | Media | Hecho | Prueba de rendimiento (5 ejecuciones) | 30,5–37,6 fps, p95 67–100 ms, 9–16 tareas largas (máx. 163–242 ms). CLS 0. La línea base es de una sola ejecución |
| M-006 | P1 | Parecía que al cerrar el detalle la portada saltaba | Scroll 3502 → 3434 px. **Evidencia no válida**: la prueba usaba `p.click()`, que desplaza la página antes de pulsar | Prueba corregida (clic por JS). Se mantiene la restauración explícita (`scrollRestoration = 'manual'` + posición guardada) como comportamiento definido; no está demostrado que fuera necesaria | Navegación predecible | Baja | Hecho | Prueba corregida, 3 ejecuciones | Diferencia < 4 px |
| M-007 | P1 | Seguridad: `verificar-compra-google` dejaba reasignar un token a otra cuenta vía `upsert` | Revisión de código antes de desplegar | Comprobar dueño previo del token antes de escribir | Evita robo de compras | Baja | Hecho (sin probar con Google) | Revisión + `esbuild` (sintaxis) | — |
| M-008 | P2 | El fondo del hero no se veía | Captura: hero negro | `isolation: isolate` en el hero (la capa ambiental lo tapaba) | Impacto inicial | Baja | Hecho | Captura escritorio y móvil | Hero con el fondo visible |
| M-009 | P2 | Favorito fuera de la tarjeta; texto de colecciones tapado; categoría huérfana; colección sola en la última fila | Capturas | Especificidad CSS, degradado bajo el texto, rejilla 3×3, banda ancha para la exclusiva | Orden visual | Baja | Hecho | Capturas | Correcto |
| M-010 | P2 | Título de Perfil invisible; el detalle dejaba ver la portada; fecha del simulador con Mayúsculas En Cada Palabra | Capturas | Selector acotado, fondo opaco en la capa de detalle, `::first-letter` | Legibilidad | Baja | Hecho | Capturas | Correcto |
| M-011 | P3 | ¿Capa de composición propia para la luz ambiental? | Experimento A/B | `will-change` + `contain` en `.ambiente` | +fps | Baja | Descartado | A/B 2 repeticiones | 35,2 vs 35,6 fps: sin efecto; revertido |
| M-012 | P1 | El scroll sigue por debajo del objetivo (55 fps) y hay tareas de más de 200 ms | 30–38 fps, máx. 242 ms; ningún efecto domina (A/B: ambiente ~+4, revelado ~+3–7 fps) | Medir en un móvil real con GPU (el Chromium de pruebas compone por software) y perfilar decodificación de imágenes | Cumplir objetivo | Media | Pendiente | — | — |
| M-013 | P1 | La app Android no tiene el diseño v2 ni comercio | Auditoría | Portar portada, detalle con simulador y parallax a Compose; Play Billing | Coherencia y ventas | Alta | Pendiente | — | — |
| M-014 | P2 | Las capturas de Play salen del prototipo web, no de la app | `play-store/` | Capturar desde la app compilada | Cumplir políticas de la ficha | Baja | Pendiente | — | — |
| M-015 | P2 | "Tendencias" usa un orden de demostración | `datos.js` | Calcular con `eventos` reales | Descubrimiento real | Media | Pendiente (backend) | — | — |
| M-016 | P3 | Faltan Anime, Automóviles, Animales, Fantasía y Tecnología | No se pueden generar por código con calidad | Encargar a artistas con licencia comercial | Catálogo completo | Alta | Pendiente | — | — |
| M-017 | P1 | No hay panel de administración | — | Fase 3 (las políticas y la auditoría ya existen) | Operar el catálogo | Alta | Pendiente | — | — |
| M-018 | P2 | La web no es instalable (PWA) | Sin manifest ni service worker | Manifest + caché de catálogo y miniaturas | Retorno y uso sin red | Media | Pendiente | — | — |

### Próximo ciclo recomendado

1. **Conectar un proyecto Supabase real** (M-002, M-004): aplicar migraciones, subir vistas y
   originales a los buckets, desplegar `descarga-firmada` y cambiar el proveedor de `comercio.js`.
   Da una base medible (eventos) y descargas protegidas reales. *Necesita: proyecto Supabase.*
2. **Compilar la app Android** (M-001) y empezar el port del detalle con simulador (M-013).
3. **Rendimiento en dispositivo real** (M-012) con Chrome DevTools remoto.
