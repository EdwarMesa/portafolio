# Muro · propuesta de producto (v2)

> Estado de cada pieza: **Implementado** (funciona y tiene pruebas), **Prototipo** (se ve y se usa,
> pero con datos o servicios de demostración) o **Pendiente** (diseñado, sin construir).

## 1. Nombre

**Muro**, el nombre que ya tiene la app. Es corto, en español y describe el producto (lo que pones
en tu "muro", la pantalla). Para el nombre de la tienda: *Muro: fondos de pantalla*.

## 2. Concepto de marca

**Una galería nocturna.** Entras a oscuras y cada fondo se ilumina como una obra. La interfaz
casi no tiene color: el color lo pone cada fondo, que tiñe la luz ambiental de la página.

- Promesa: fondos originales, hechos para la pantalla de un móvil, que ves antes de tenerlos.
- Tono: sobrio, preciso y honesto. Nada de "¡oferta!", nada de cuentas atrás falsas.
- Ética comercial: lo gratis sigue siendo gratis, el precio se ve antes de pagar y "Solo en Muro"
  significa exclusivo, no escaso. Solo diremos "edición limitada" si hay un límite real
  (`colecciones.unidades_maximas`, que el servidor hace cumplir).

## 3. Sistema visual — *Implementado* (`web/css/muro.css`)

| Elemento | Decisión |
|---|---|
| Fondo | Negro profundo `#050507`, grafitos `#0c0c10 / #14141a / #1e1e26` |
| Texto | Blanco cálido `#f4f2ee` al 100 / 64 / 42 % |
| Acentos | Oro `#e2c48a` (marca y Muro+), rosa `#ff4d6d` (favorito), un acento por categoría |
| Luz ambiental | Degradado radial con el color de la sección visible, transición de 1,4 s |
| Tipografía | *Instrument Serif* en títulos grandes; *Inter* en interfaz |
| Superficies | Vidrio solo en cabecera, botones secundarios, hojas y controles del simulador |
| Radios | Tarjetas 18 px, paneles 22–32 px, botones en píldora |
| Movimiento | Curva `cubic-bezier(.2,.8,.2,1)`; solo `transform` y `opacity` |

Cada categoría tiene identidad propia (acento + forma de entrar): Cyberpunk *neón*, Espacio
*orbital*, Naturaleza *orgánico*, Paisajes *panorámico*, Arquitectura *perspectiva*, Arte
abstracto *fluido* y Lujo / Oscuro / Minimalismo *contenido*.

## 4. Página de inicio — *Implementado con datos de demostración*

1. **Hero** a pantalla completa: el fondo destacado en un teléfono 3D con parallax por capas
   (puntero o giroscopio). Rota cada 8 s y se pausa al pasar el ratón, fuera de pantalla o con
   movimiento reducido.
2. **Novedades**: carril horizontal en *coverflow*.
3. **Categorías**: 9 tarjetas con abanico de miniaturas y efecto propio al pasar el ratón.
4. **Colecciones exclusivas**: rejilla *bento* asimétrica con precio del paquete.
5. **Recomendados prémium**: mosaico tipo *masonry* con deriva vertical ligada al scroll.
6. **Para ti**: recomendaciones calculadas en el dispositivo; pide consentimiento antes de usar la actividad.
7. **Tendencias**: ranking (orden de demostración hasta tener datos de uso reales; se indica en pantalla).
8. **Gratis para siempre**: colección Bienvenida.
9. **Lanzamiento especial**: vistas desenfocadas, cuenta atrás hasta una fecha y recordatorio `.ics`.
10. **Muro+**: suscripción opcional con beneficios explícitos.

## 5. Experiencia de scroll — *Implementado*

- Revelado progresivo con `IntersectionObserver`: las tarjetas suben y su imagen se asienta de escala 1,22 a 1,06.
- Parallax: títulos de sección (bucle rAF único) y salida del hero ligada al scroll (`--salida`).
- Deriva de imágenes en el mosaico con `animation-timeline: view()` (sin JS, en el compositor).
- Luz ambiental que cambia con la sección dominante.
- Nada bloquea el scroll: listeners pasivos, sin *scroll-jacking*, el carrusel se pausa fuera de pantalla.
- **Modo ligero** automático con `prefers-reduced-motion`, poca memoria o ahorro de datos, y manual en Perfil.

## 6. Tarjetas — *Implementado*

Miniatura 9:20 con nombre, categoría, insignia de acceso (Gratis · precio · Muro+ · Pronto),
icono de profundidad y favorito. Al pasar el ratón: inclinación 3D con reflejo que sigue al
puntero, zoom suave y sombra del color del fondo. En táctil: pulsación larga → **vista rápida**.
La imagen grande se precarga cuando hay intención (hover o toque).

## 7. Vista detallada — *Implementado*

Transición de elemento compartido (View Transitions API) desde la tarjeta. **Simulador de teléfono**
con pantalla de bloqueo (hora real), pantalla de inicio (iconos, widget, dock) o solo fondo, y
proporciones *Tu pantalla* (leída del dispositivo), 20:9, 19,5:9 y 16:9 con el porcentaje de
recorte. Ficha con resolución, formato, autor, licencia, fecha y compatibilidad. Relacionados.
No promete instalación automática: explica cómo aplicarlo y que la app Android puede hacerlo.

## 8. Flujo de compra — *Prototipo honesto*

```
Detalle ─► [Comprar · 1,99 US$] ─► Hoja de confirmación
                                   · qué es y qué incluye
                                   · total visible antes de pagar
                                   · aviso: demo, no se cobra nada
                                   ─► [Confirmar y pagar] ─► proveedor de pagos
                                        demo: "Pagos todavía no integrados" (sin cargo, sin desbloqueo)
                                        real: Google Play Billing ─► verificar-compra-google ─► compras
                                              ─► tiene_derecho() ─► descarga-firmada (URL de 5 min)
```

También: **colección completa** (paquete), **Muro+** (suscripción con renovación y cancelación
explicadas) y **Restaurar compras**. Todo pasa por `web/js/comercio.js`, cuyo proveedor actual
(`ProveedorNoDisponible`) rechaza explícitamente; conectar uno real no requiere tocar la interfaz.
