import { almacen } from './almacen.js';
import { cargarCatalogo, fondo, url } from './datos.js';
import { iniciarComercio } from './comercio.js';
import { icono } from './componentes.js';
import { precargar } from './efectos.js';
import { aplicarModo, efectosActivos } from './rendimiento.js';
import { avisar, descargarRecordatorio } from './utilidades.js';
import * as inicio from './vistas/inicio.js';
import * as detalle from './vistas/detalle.js';
import * as coleccion from './vistas/coleccion.js';
import * as perfil from './vistas/perfil.js';
import { hojaDemo, hojaPlus, vistaRapida } from './vistas/hojas.js';

const pagina = document.getElementById('pagina');
const capa = document.getElementById('capa');
let claveActual = null;
let desmontarPagina = () => {};
let desmontarDetalle = null;
const scrollGuardado = new Map();
let origenTransicion = null;
let scrollAntesDetalle = 0;
history.scrollRestoration = 'manual';

const conTransicion = (fn) =>
  document.startViewTransition && efectosActivos() ? document.startViewTransition(fn).finished : Promise.resolve(fn());

function ruta() {
  const [tipo = '', id = ''] = location.hash.replace(/^#\/?/, '').split('/');
  return { tipo, id: decodeURIComponent(id) };
}

function renderPagina(tipo, id) {
  switch (tipo) {
    case '': return { html: inicio.render(), montar: (r) => inicio.montar(r) };
    case 'categoria':
    case 'coleccion': {
      const html = coleccion.render(tipo, id);
      return html && { html, montar: (r) => coleccion.montar(r, tipo, id) };
    }
    case 'perfil': return { html: perfil.render(), montar: (r) => perfil.montar(r, rerenderPerfil) };
    default: return null;
  }
}

function rerenderPerfil() {
  const y = scrollY;
  desmontarPagina();
  pagina.innerHTML = perfil.render();
  desmontarPagina = perfil.montar(pagina, rerenderPerfil);
  scrollTo(0, y);
}

async function mostrarPagina(tipo, id) {
  const clave = `${tipo}/${id}`;
  if (clave === claveActual) return;
  const vista = renderPagina(tipo, id) ?? renderPagina('', '');
  if (claveActual !== null) scrollGuardado.set(claveActual, scrollY);
  await conTransicion(() => {
    desmontarPagina();
    pagina.innerHTML = vista.html;
    claveActual = clave;
    desmontarPagina = vista.montar(pagina) ?? (() => {});
    scrollTo({ top: scrollGuardado.get(clave) ?? 0, behavior: 'instant' });
  });
  actualizarNavegacion(tipo);
}

async function abrirDetalle(id) {
  const html = detalle.render(id);
  if (!html) return (location.hash = '#/');
  // Con un detalle ya abierto no hay elemento compartido (evita nombres de transición duplicados).
  const img = !desmontarDetalle && origenTransicion?.isConnected ? origenTransicion : null;
  if (img) img.style.viewTransitionName = 'fondo-activo';
  if (!desmontarDetalle) scrollAntesDetalle = scrollY;
  document.documentElement.classList.add('con-detalle');
  await conTransicion(() => {
    if (img) img.style.viewTransitionName = '';
    desmontarDetalle?.();
    capa.innerHTML = html;
    capa.hidden = false;
    capa.scrollTop = 0;
    desmontarDetalle = detalle.montar(capa, id);
  });
  capa.querySelector('[data-cerrar-detalle]')?.focus({ preventScroll: true });
}

async function cerrarDetalle() {
  if (!desmontarDetalle) return;
  await conTransicion(() => {
    desmontarDetalle();
    desmontarDetalle = null;
    capa.innerHTML = '';
    capa.hidden = true;
    document.documentElement.classList.remove('con-detalle');
    scrollTo({ top: scrollAntesDetalle, behavior: 'instant' });
  });
}

async function navegar() {
  const { tipo, id } = ruta();
  if (tipo === 'fondo') {
    if (claveActual === null) await mostrarPagina('', '');
    await abrirDetalle(id);
  } else {
    await cerrarDetalle();
    await mostrarPagina(tipo, id);
  }
}

function actualizarNavegacion(tipo) {
  document.querySelectorAll('[data-nav]').forEach((a) =>
    a.setAttribute('aria-current', a.dataset.nav === (tipo || 'inicio') ? 'page' : 'false'));
}

/* ---------- Eventos globales (delegados) ---------- */
function alternarFavorito(boton) {
  const id = boton.dataset.fav;
  const activo = almacen.alternarFavorito(id);
  document.querySelectorAll(`[data-fav="${CSS.escape(id)}"]`).forEach((b) => {
    b.setAttribute('aria-pressed', activo);
    b.setAttribute('aria-label', activo ? 'Quitar de favoritos' : 'Guardar en favoritos');
  });
  if (activo && efectosActivos()) {
    boton.classList.remove('latido');
    void boton.offsetWidth;
    boton.classList.add('latido');
  }
  avisar(activo ? `${fondo(id).nombre} guardado en favoritos` : 'Quitado de favoritos');
}

document.addEventListener('click', (e) => {
  const fav = e.target.closest('[data-fav]');
  if (fav) { e.preventDefault(); return alternarFavorito(fav); }

  const enlace = e.target.closest('a[href^="#/fondo/"]');
  if (enlace) origenTransicion = enlace.querySelector('img');

  if (e.target.closest('[data-cerrar-detalle]')) {
    e.preventDefault();
    return history.length > 1 && claveActual !== null ? history.back() : (location.hash = '#/');
  }
  if (e.target.closest('[data-plus]')) return hojaPlus();
  if (e.target.closest('[data-demo]')) return hojaDemo();
  const recordar = e.target.closest('[data-recordar]');
  if (recordar) {
    descargarRecordatorio({ id: recordar.dataset.recordar, nombre: recordar.dataset.nombre, fecha: recordar.dataset.fecha });
    if (!almacen.get().recordatorios.includes(recordar.dataset.recordar)) almacen.alternarRecordatorio(recordar.dataset.recordar);
    recordar.lastChild.textContent = 'Recordatorio añadido';
    return avisar('Evento de calendario descargado');
  }
  if (e.target.closest('[data-activar-personalizar]')) {
    almacen.pref('personalizar', true);
    avisar('Personalización activada en este dispositivo');
    e.target.closest('.invitacion').innerHTML = '<p class="eyebrow">Para ti</p><h2 class="seccion__titulo">Listo</h2><p>Abre o guarda algunos fondos y aquí aparecerán sugerencias.</p>';
  }
});

// Precarga selectiva: la vista grande se pide cuando hay intención (hover o primer toque).
document.addEventListener('pointerover', (e) => {
  const t = e.target.closest?.('.tarjeta');
  if (t) precargar(url(fondo(t.dataset.fondo)?.vista));
}, { passive: true });

// Pulsación larga en táctil: vista rápida.
let pulsacion = 0;
document.addEventListener('pointerdown', (e) => {
  if (e.pointerType !== 'touch') return;
  const t = e.target.closest('.tarjeta');
  if (!t || e.target.closest('[data-fav]')) return;
  pulsacion = setTimeout(() => {
    pulsacion = -1;
    navigator.vibrate?.(8);
    vistaRapida(t.dataset.fondo);
  }, 480);
}, { passive: true });
const cancelarPulsacion = () => { if (pulsacion > 0) clearTimeout(pulsacion); };
['pointerup', 'pointercancel', 'pointermove'].forEach((ev) => document.addEventListener(ev, (e) => {
  if (ev === 'pointermove' && Math.hypot(e.movementX, e.movementY) < 4) return;
  cancelarPulsacion();
}, { passive: true }));
document.addEventListener('click', (e) => {
  if (pulsacion === -1 && e.target.closest('.tarjeta')) { e.preventDefault(); pulsacion = 0; }
}, true);
document.addEventListener('contextmenu', (e) => { if (e.target.closest('.tarjeta') && pulsacion === -1) e.preventDefault(); });

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && desmontarDetalle && !document.querySelector('dialog[open]')) {
    e.preventDefault();
    capa.querySelector('[data-cerrar-detalle]').click();
  }
});

// Cabecera de vidrio solo cuando hay contenido debajo.
new IntersectionObserver(([e]) => document.documentElement.classList.toggle('desplazado', !e.isIntersecting))
  .observe(document.getElementById('centinela'));

/* ---------- Arranque ---------- */
async function arrancar() {
  aplicarModo();
  document.querySelector('[data-icono-perfil]').innerHTML = icono.usuario;
  try {
    await cargarCatalogo();
    await iniciarComercio();
  } catch (err) {
    pagina.innerHTML = `<div class="error-carga"><h1>No se pudo cargar el catálogo</h1>
      <p>Abre la web desde un servidor (ver README) y comprueba la conexión.</p></div>`;
    console.error(err);
    return;
  }
  addEventListener('hashchange', navegar);
  await navegar();
  document.documentElement.classList.add('listo');
}

arrancar();
