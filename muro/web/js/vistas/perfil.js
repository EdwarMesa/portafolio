import { almacen } from '../almacen.js';
import { fondo } from '../datos.js';
import { historialCompras, nombreProveedor, PagoNoDisponible, restaurarCompras } from '../comercio.js';
import { esc, tarjeta } from '../componentes.js';
import { revelar } from '../efectos.js';
import { aplicarModo, modo } from '../rendimiento.js';
import { avisar } from '../utilidades.js';

const lista = (registros) => registros.map((r) => fondo(r.id)).filter(Boolean);

export function render() {
  const { favoritos, vistos, descargas, prefs } = almacen.get();
  const favs = favoritos.map(fondo).filter(Boolean);
  return `
  <div class="perfil">
    <header class="perfil__cabecera">
      <p class="eyebrow">Tu espacio</p>
      <h1 class="coleccion__titulo">Perfil</h1>
      <p class="coleccion__desc">Sin cuenta por ahora: todo lo de esta página se guarda solo en este navegador.</p>
    </header>

    <section class="perfil__bloque">
      <h2 class="perfil__titulo">Favoritos <span>${favs.length}</span></h2>
      ${favs.length ? `<div class="mosaico mosaico--compacto">${favs.map((f, i) => tarjeta(f, { i })).join('')}</div>`
        : '<p class="vacio">Toca el corazón de cualquier fondo para guardarlo aquí.</p>'}
    </section>

    <section class="perfil__bloque">
      <h2 class="perfil__titulo">Descargas <span>${descargas.length}</span></h2>
      ${descargas.length ? `<div class="mosaico mosaico--compacto">${lista(descargas).map((f, i) => tarjeta(f, { i })).join('')}</div>`
        : '<p class="vacio">Aún no has descargado fondos.</p>'}
    </section>

    ${prefs.personalizar && vistos.length ? `<section class="perfil__bloque">
      <h2 class="perfil__titulo">Vistos recientemente</h2>
      <div class="mosaico mosaico--compacto">${lista(vistos).slice(0, 8).map((f, i) => tarjeta(f, { i })).join('')}</div>
    </section>` : ''}

    <section class="perfil__bloque">
      <h2 class="perfil__titulo">Compras y suscripción</h2>
      <div class="panel" data-compras>
        <p>Proveedor de pagos: <strong>${esc(nombreProveedor())}</strong>. Las compras aparecerán aquí cuando se integren
          los pagos y las cuentas.</p>
        <button class="boton boton--vidrio" data-restaurar>Restaurar compras</button>
      </div>
    </section>

    <section class="perfil__bloque">
      <h2 class="perfil__titulo">Preferencias y privacidad</h2>
      <div class="panel ajustes">
        <label class="ajuste">
          <span><strong>Personalizar con mi actividad</strong>
            <small>Usa los fondos que abres para mejorar "Para ti". Se calcula y guarda solo en este dispositivo.
              Al desactivarlo se borra ese historial.</small></span>
          <input type="checkbox" role="switch" data-pref="personalizar" ${prefs.personalizar ? 'checked' : ''}>
        </label>
        <label class="ajuste">
          <span><strong>Efectos visuales</strong>
            <small>Ahora: ${modo() === 'completo' ? 'completos' : 'modo ligero'}. El modo ligero quita parallax,
              inclinación 3D y partículas. Se activa solo si tu sistema pide reducir movimiento.</small></span>
          <select data-pref="rendimiento">
            <option value="auto" ${prefs.rendimiento === 'auto' ? 'selected' : ''}>Automático</option>
            <option value="completo" ${prefs.rendimiento === 'completo' ? 'selected' : ''}>Completos</option>
            <option value="ligero" ${prefs.rendimiento === 'ligero' ? 'selected' : ''}>Ligero</option>
          </select>
        </label>
        <div class="ajuste">
          <span><strong>Borrar mis datos</strong><small>Favoritos, descargas, historial y preferencias de este navegador.</small></span>
          <button class="boton boton--peligro" data-borrar>Borrar todo</button>
        </div>
      </div>
    </section>
  </div>`;
}

export function montar(raiz, rerender) {
  raiz.querySelectorAll('[data-pref]').forEach((el) => el.addEventListener('change', () => {
    almacen.pref(el.dataset.pref, el.type === 'checkbox' ? el.checked : el.value);
    if (el.dataset.pref === 'rendimiento') aplicarModo();
    rerender();
  }));
  raiz.querySelector('[data-borrar]').addEventListener('click', () => {
    if (!confirm('¿Borrar favoritos, descargas, historial y preferencias de este navegador?')) return;
    almacen.borrarTodo();
    aplicarModo();
    avisar('Datos borrados');
    rerender();
  });
  raiz.querySelector('[data-restaurar]').addEventListener('click', async () => {
    try {
      await restaurarCompras();
    } catch (err) {
      if (err instanceof PagoNoDisponible) avisar(err.message);
    }
  });
  historialCompras();
  revelar(raiz);
  return () => {};
}
