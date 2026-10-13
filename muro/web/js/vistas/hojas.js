// Hojas modales con <dialog>: foco atrapado, Esc para cerrar y fondo inerte de serie.
import { cat, categoria, deColeccion, fondo, precio, url } from '../datos.js';
import { comprar, nombreProveedor, PagoNoDisponible, restaurarCompras } from '../comercio.js';
import { esc, favorito, icono, insignia } from '../componentes.js';

function abrirHoja(html, clase = '') {
  const d = document.createElement('dialog');
  d.className = `hoja ${clase}`;
  d.innerHTML = `<div class="hoja__panel">
    <button class="hoja__cerrar icono-boton" data-cerrar aria-label="Cerrar">${icono.cerrar}</button>
    ${html}</div>`;
  document.body.append(d);
  d.addEventListener('click', (e) => {
    if (e.target === d || e.target.closest('[data-cerrar]')) cerrar();
  });
  d.addEventListener('close', () => d.remove());
  const cerrar = () => {
    d.classList.add('saliendo');
    setTimeout(() => d.close(), 220);
  };
  d.showModal();
  return { d, cerrar };
}

const AVISO_DEMO = `<p class="aviso-demo">${icono.candado}<span><strong>Demo:</strong> no se cobra nada ni se desbloquea contenido.
  Los pagos se conectarán con Google Play Billing (app) y Stripe (web).</span></p>`;

function estadoNoDisponible(panel) {
  panel.querySelector('.hoja__cuerpo').innerHTML = `
    <div class="estado-pago">
      <span class="estado-pago__icono">${icono.candado}</span>
      <h2>Pagos todavía no integrados</h2>
      <p>No se ha realizado ningún cargo y el contenido sigue bloqueado.
      Cuando se conecte el proveedor de pagos, aquí verás la confirmación del pedido.</p>
      <button class="boton boton--claro" data-cerrar>Entendido</button>
    </div>`;
}

/** Confirmación previa al pago: precio visible y qué incluye, antes de cualquier cargo. */
export function hojaCompra(producto) {
  const miniaturas = producto.fondos.slice(0, 4)
    .map((f, i) => `<img src="${url(f.miniatura)}" alt="" style="--i:${i}">`).join('');
  const { d } = abrirHoja(`
    <div class="hoja__cuerpo">
      <p class="eyebrow">Confirmar compra</p>
      <div class="resumen">
        <div class="resumen__pila">${miniaturas}</div>
        <div>
          <h2 class="resumen__titulo">${esc(producto.nombre)}</h2>
          <p class="resumen__tipo">${producto.tipo === 'coleccion' ? `Colección · ${producto.fondos.length} fondos` : 'Fondo individual'}</p>
        </div>
      </div>
      <ul class="incluye">
        <li>Original en 1080×2400 sin marcas, descargas ilimitadas</li>
        <li>Licencia de uso personal</li>
        <li>Se recupera en cualquier dispositivo con tu cuenta</li>
      </ul>
      <div class="total"><span>Total</span><strong>${precio(producto.precio)}</strong></div>
      <p class="letra-pequena">Precio en USD. Los impuestos y la moneda final los muestra la pasarela antes de pagar.
        Proveedor actual: ${esc(nombreProveedor())}.</p>
      ${AVISO_DEMO}
      <button class="boton boton--claro boton--ancho" data-pagar>Confirmar y pagar ${precio(producto.precio)}</button>
      <button class="boton-texto" data-restaurar>Restaurar compras</button>
    </div>`, 'hoja--compra');

  d.querySelector('[data-pagar]').addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    e.currentTarget.textContent = 'Conectando con el proveedor…';
    try {
      await comprar({ tipo: producto.tipo, id: producto.id });
    } catch (err) {
      if (err instanceof PagoNoDisponible) estadoNoDisponible(d);
      else throw err;
    }
  });
  d.querySelector('[data-restaurar]').addEventListener('click', () => restaurar(d));
}

async function restaurar(d) {
  try {
    await restaurarCompras();
  } catch (err) {
    if (err instanceof PagoNoDisponible) estadoNoDisponible(d);
  }
}

export function compraFondo(f) {
  hojaCompra({ tipo: 'fondo', id: f.id, nombre: f.nombre, precio: f.precio, fondos: [f] });
}

export function compraColeccion(c) {
  hojaCompra({ tipo: 'coleccion', id: c.id, nombre: c.nombre, precio: c.precio, fondos: deColeccion(c.id) });
}

export function hojaPlus() {
  const s = cat().suscripcion;
  const muestra = cat().fondos.filter((f) => f.acceso === 'suscripcion').slice(0, 5);
  const { d } = abrirHoja(`
    <div class="hoja__cuerpo">
      <div class="plus-cabecera">
        ${muestra.map((f, i) => `<img src="${url(f.miniatura)}" alt="" style="--i:${i}">`).join('')}
      </div>
      <p class="eyebrow eyebrow--acento">${icono.estrella} Suscripción opcional</p>
      <h2 class="hoja__titulo">${esc(s.nombre)}</h2>
      <ul class="incluye">${s.beneficios.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>
      <div class="total"><span>Mensual</span><strong>${precio(s.precio)}/${esc(s.periodo)}</strong></div>
      <p class="letra-pequena">Se renueva cada mes hasta que la canceles. Cancelación desde Google Play o tu perfil,
        en cualquier momento. Los fondos gratuitos siguen siendo gratuitos.</p>
      ${AVISO_DEMO}
      <button class="boton boton--claro boton--ancho" data-pagar>Suscribirme por ${precio(s.precio)}/${esc(s.periodo)}</button>
      <button class="boton-texto" data-restaurar>Restaurar compras</button>
    </div>`, 'hoja--plus');
  d.querySelector('[data-pagar]').addEventListener('click', async () => {
    try { await comprar({ tipo: 'suscripcion', id: s.id }); } catch (err) {
      if (err instanceof PagoNoDisponible) estadoNoDisponible(d); else throw err;
    }
  });
  d.querySelector('[data-restaurar]').addEventListener('click', () => restaurar(d));
}

/** Vista rápida (pulsación larga en móvil): vista previa grande sin salir de la página. */
export function vistaRapida(id) {
  const f = fondo(id);
  const { d } = abrirHoja(`
    <div class="rapida">
      <img class="rapida__img" src="${url(f.vista)}" alt="${esc(f.nombre)}" style="background:${esc(f.color)}">
      <div class="rapida__info">
        <div><h2>${esc(f.nombre)}</h2><p>${esc(categoria(f.categoria).nombre)}</p></div>
        ${insignia(f)}
      </div>
      <div class="rapida__acciones">
        ${favorito(f.id)}
        <a class="boton boton--claro" href="#/fondo/${esc(f.id)}" data-cerrar>Ver en detalle</a>
      </div>
    </div>`, 'hoja--rapida');
  return d;
}

/** Explica qué es real y qué es demostración. */
export function hojaDemo() {
  abrirHoja(`
    <div class="hoja__cuerpo">
      <p class="eyebrow">Sobre esta versión</p>
      <h2 class="hoja__titulo">Esto es una demo</h2>
      <ul class="incluye incluye--estado">
        <li data-estado="ok"><strong>Funciona:</strong> catálogo, exploración, vista previa con simulador, favoritos,
          recomendaciones locales, descargas de fondos gratuitos y recordatorios de calendario.</li>
        <li data-estado="demo"><strong>Datos de demostración:</strong> precios, colecciones, fechas y "tendencias".</li>
        <li data-estado="pendiente"><strong>Pendiente:</strong> cuentas, pagos, suscripción, descargas prémium protegidas e historial de compras.</li>
      </ul>
    </div>`);
}
