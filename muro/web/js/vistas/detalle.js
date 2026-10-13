import { almacen } from '../almacen.js';
import {
  categoria, coleccion, deColeccion, fechaLarga, fondo, precio, publicado, url, visibles,
} from '../datos.js';
import { tieneAcceso, urlDescarga, PagoNoDisponible } from '../comercio.js';
import { carril, esc, escena, favorito, icono, insignia } from '../componentes.js';
import { coverflow, escenas, revelar } from '../efectos.js';
import { avisar } from '../utilidades.js';
import { compraColeccion, compraFondo, hojaPlus } from './hojas.js';

const RATIO_FONDO = 1080 / 2400;
const PROPORCIONES = [
  { id: 'tuya', nombre: 'Tu pantalla' },
  { id: '20:9', nombre: '20:9', r: 9 / 20 },
  { id: '19.5:9', nombre: '19,5:9', r: 9 / 19.5 },
  { id: '16:9', nombre: '16:9', r: 9 / 16 },
];

function ratioPantalla() {
  const w = Math.min(screen.width, screen.height);
  const h = Math.max(screen.width, screen.height);
  return w / h;
}

/** Texto de recorte: cuánto se pierde del fondo con esa proporción de pantalla. */
function recorte(r) {
  if (Math.abs(r - RATIO_FONDO) < 0.004) return 'Encaje exacto, sin recorte';
  if (r > RATIO_FONDO) return `Se recorta un ${Math.round((1 - RATIO_FONDO / r) * 50)} % arriba y abajo`;
  return `Se recorta un ${Math.round((1 - r / RATIO_FONDO) * 50)} % a cada lado`;
}

function acciones(f) {
  const col = f.coleccion && coleccion(f.coleccion);
  if (!publicado(f)) {
    return `<p class="estado-acceso">Disponible el ${fechaLarga(f.publicado)}</p>
      <button class="boton boton--vidrio" data-recordar="${esc(f.coleccion)}" data-fecha="${f.publicado}"
        data-nombre="${esc(col?.nombre ?? f.nombre)}">${icono.calendario}Añadir a mi calendario</button>`;
  }
  if (tieneAcceso(f)) {
    return `<button class="boton boton--claro" data-descargar>${icono.descargar}Descargar original</button>`;
  }
  if (f.acceso === 'suscripcion') {
    return `<button class="boton boton--claro" data-plus>${icono.estrella}Incluido en Muro+</button>`;
  }
  const pack = col && col.tipo !== 'gratis' && col.precio
    ? `<button class="boton boton--vidrio" data-comprar-coleccion="${esc(col.id)}">
         Colección completa · ${precio(col.precio)} <small>(${deColeccion(col.id).length} fondos)</small></button>` : '';
  return `<button class="boton boton--claro" data-comprar>${icono.candado}Comprar · ${precio(f.precio)}</button>${pack}`;
}

function relacionados(f) {
  const lista = visibles().filter((x) => x.id !== f.id && (x.coleccion === f.coleccion || x.categoria === f.categoria));
  return lista.sort((a, b) => (b.coleccion === f.coleccion) - (a.coleccion === f.coleccion)).slice(0, 8);
}

export function render(id) {
  const f = fondo(id);
  if (!f) return null;
  const cat = categoria(f.categoria);
  const col = f.coleccion && coleccion(f.coleccion);
  const original = tieneAcceso(f)
    ? 'Original 1080 × 2400' : 'Vista previa 720 × 1600 · original 1080 × 2400 tras desbloquear';
  return `
  <div class="detalle" role="dialog" aria-modal="true" aria-label="${esc(f.nombre)}" style="--color:${esc(f.color)};--acento:${cat.acento}">
    <div class="detalle__ambiente" aria-hidden="true"><img src="${url(f.miniatura)}" alt=""></div>
    <button class="detalle__cerrar icono-boton icono-boton--vidrio" data-cerrar-detalle aria-label="Cerrar">${icono.cerrar}</button>
    <div class="detalle__cuerpo">
      <div class="detalle__escenario">
        <div class="simulador" data-modo="bloqueo">
          <div class="simulador__pantalla" style="view-transition-name: fondo-activo">
            ${escena(f, { prioridad: true })}
            <div class="sim sim--bloqueo" aria-hidden="true">
              <span class="sim__fecha"></span><span class="sim__hora"></span>
              <span class="sim__accesos"><i></i><i></i></span>
            </div>
            <div class="sim sim--inicio" aria-hidden="true">
              <span class="sim__widget"></span>
              <span class="sim__apps">${'<i></i>'.repeat(8)}</span>
              <span class="sim__dock">${'<i></i>'.repeat(4)}</span>
            </div>
            <span class="sim__isla" aria-hidden="true"></span>
          </div>
        </div>
        <div class="controles">
          <div class="segmentado" role="radiogroup" aria-label="Pantalla simulada">
            <button role="radio" aria-checked="true" data-modo="bloqueo">Bloqueo</button>
            <button role="radio" aria-checked="false" data-modo="inicio">Inicio</button>
            <button role="radio" aria-checked="false" data-modo="limpio">Solo fondo</button>
          </div>
          <div class="segmentado segmentado--chico" role="radiogroup" aria-label="Proporción de pantalla">
            ${PROPORCIONES.map((p, i) => `<button role="radio" aria-checked="${i === 0}" data-ratio="${p.id}">${p.nombre}</button>`).join('')}
          </div>
          <p class="controles__nota" data-recorte></p>
        </div>
      </div>

      <div class="detalle__info">
        <p class="eyebrow"><a href="#/categoria/${cat.id}">${esc(cat.nombre)}</a>${col ? ` · <a href="#/coleccion/${col.id}">${esc(col.nombre)}</a>` : ''}</p>
        <h1 class="detalle__titulo">${esc(f.nombre)}</h1>
        ${f.descripcion ? `<p class="detalle__desc">${esc(f.descripcion)}</p>` : ''}
        <div class="detalle__precio">${insignia(f)}${f.capas.length ? `<span class="chip-dato">${icono.capas}Profundidad 3D</span>` : ''}</div>
        <div class="detalle__acciones">${acciones(f)}${favorito(f.id, 'fav--grande')}</div>
        <dl class="ficha">
          <div><dt>Resolución</dt><dd>${original}</dd></div>
          <div><dt>Formato</dt><dd>${esc(f.formato.toUpperCase())}</dd></div>
          <div><dt>Autor</dt><dd>${esc(f.autor)}</dd></div>
          <div><dt>Licencia</dt><dd>${esc(f.licencia)}</dd></div>
          <div><dt>Publicado</dt><dd>${fechaLarga(f.publicado)}</dd></div>
          <div><dt>Compatibilidad</dt><dd>Android e iOS, cualquier proporción</dd></div>
        </dl>
        <p class="letra-pequena">Para usarlo como fondo: descárgalo y elígelo en Ajustes › Fondo de pantalla.
          La app de Android puede aplicarlo directamente.</p>
      </div>
    </div>
    ${carril({ id: 'relacionados', eyebrow: 'Sigue explorando', titulo: 'Relacionados', fondos: relacionados(f), coverflow: true })}
  </div>`;
}

export function montar(raiz, id) {
  const f = fondo(id);
  almacen.registrarVisto(id);
  const sim = raiz.querySelector('.simulador');
  const pantalla = raiz.querySelector('.simulador__pantalla');

  const reloj = () => {
    const ahora = new Date();
    raiz.querySelector('.sim__hora').textContent = ahora.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false });
    raiz.querySelector('.sim__fecha').textContent = ahora.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
  };
  reloj();
  const intervalo = setInterval(reloj, 15000);

  const fijarRatio = (idRatio) => {
    const p = PROPORCIONES.find((x) => x.id === idRatio);
    const r = p.r ?? ratioPantalla();
    sim.style.setProperty('--ratio', r.toFixed(4));
    raiz.querySelector('[data-recorte]').textContent = `${p.id === 'tuya' ? `Tu pantalla (${(1 / r).toFixed(2)}:1). ` : ''}${recorte(r)}.`;
  };
  fijarRatio('tuya');

  raiz.querySelectorAll('.segmentado').forEach((grupo) => grupo.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    grupo.querySelectorAll('button').forEach((x) => x.setAttribute('aria-checked', x === b));
    if (b.dataset.modo) sim.dataset.modo = b.dataset.modo;
    if (b.dataset.ratio) fijarRatio(b.dataset.ratio);
  }));

  raiz.querySelector('[data-descargar]')?.addEventListener('click', async () => {
    try {
      const enlace = document.createElement('a');
      enlace.href = await urlDescarga(f);
      enlace.download = `muro-${f.id}.webp`;
      enlace.click();
      almacen.registrarDescarga(f.id);
      avisar('Descarga iniciada');
    } catch (err) {
      avisar(err instanceof PagoNoDisponible ? err.message : 'No se pudo descargar');
    }
  });
  raiz.querySelector('[data-comprar]')?.addEventListener('click', () => compraFondo(f));
  raiz.querySelector('[data-comprar-coleccion]')?.addEventListener('click', (e) =>
    compraColeccion(coleccion(e.currentTarget.dataset.comprarColeccion)));
  raiz.querySelector('[data-plus]')?.addEventListener('click', hojaPlus);

  revelar(raiz);
  escenas(raiz);
  const quitarCoverflow = coverflow(raiz);
  pantalla.focus?.();
  return () => { clearInterval(intervalo); quitarCoverflow(); };
}

