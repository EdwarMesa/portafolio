import { almacen } from './almacen.js';
import { categoria, etiquetaAcceso, url } from './datos.js';

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" ${extra}>${d}</svg>`;
export const icono = {
  corazon: svg('<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>'),
  cerrar: svg('<path d="M6 6l12 12M18 6 6 18"/>'),
  atras: svg('<path d="M15 5l-7 7 7 7"/>'),
  flecha: svg('<path d="M5 12h14m-6-6 6 6-6 6"/>'),
  descargar: svg('<path d="M12 4v11m-5-5 5 5 5-5M5 20h14"/>'),
  candado: svg('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  estrella: svg('<path d="M12 3l2.6 5.6 6.1.7-4.5 4.1 1.2 6-5.4-3-5.4 3 1.2-6L3.3 9.3l6.1-.7z"/>'),
  calendario: svg('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4m6-4v4"/>'),
  usuario: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  capas: svg('<path d="M12 3 3 8l9 5 9-5-9-5z"/><path d="m3 13 9 5 9-5"/>'),
};

export function insignia(f) {
  const a = etiquetaAcceso(f);
  return `<span class="insignia insignia--${a.clase}">${a.clase === 'plus' ? icono.estrella : ''}${esc(a.texto)}</span>`;
}

/** Tarjeta de fondo. `tam`: '' | 'grande' | 'mini'. */
export function tarjeta(f, { tam = '', i = 0 } = {}) {
  const cat = categoria(f.categoria);
  const capas = f.capas.length ? `<span class="tarjeta__capas" title="Con profundidad">${icono.capas}</span>` : '';
  return `
  <article class="tarjeta ${tam} revelar" data-fondo="${esc(f.id)}" style="--color:${esc(f.color)};--i:${i}">
    <a class="tarjeta__enlace" href="#/fondo/${esc(f.id)}"
       aria-label="${esc(f.nombre)}, ${esc(cat.nombre)}, ${esc(etiquetaAcceso(f).texto)}">
      <span class="tarjeta__marco">
        <img src="${url(f.miniatura)}" alt="" loading="lazy" decoding="async" width="360" height="800">
        <span class="tarjeta__brillo"></span>
        ${capas}
      </span>
    </a>
    <div class="tarjeta__pie">
      <div class="tarjeta__texto">
        <h3>${esc(f.nombre)}</h3>
        <p>${esc(cat.nombre)}</p>
      </div>
      ${insignia(f)}
    </div>
    ${favorito(f.id, 'tarjeta__fav')}
  </article>`;
}

export function favorito(id, clase = '') {
  const activo = almacen.esFavorito(id);
  return `<button class="fav ${clase}" data-fav="${esc(id)}" aria-pressed="${activo}"
    aria-label="${activo ? 'Quitar de favoritos' : 'Guardar en favoritos'}">${icono.corazon}</button>`;
}

/** Carril horizontal con encabezado. */
export function carril({ id, eyebrow, titulo, nota = '', fondos, enlace = null, coverflow = false, ambiente = null }) {
  if (!fondos.length) return '';
  return `
  <section class="seccion" id="${id}" ${ambiente ? `data-ambiente="${ambiente}"` : ''}>
    <header class="seccion__cabecera revelar">
      <div>
        ${eyebrow ? `<p class="eyebrow">${esc(eyebrow)}</p>` : ''}
        <h2 class="seccion__titulo" data-parallax="0.06">${titulo}</h2>
        ${nota ? `<p class="seccion__nota">${nota}</p>` : ''}
      </div>
      ${enlace ? `<a class="enlace-flecha" href="${enlace}">Ver todo ${icono.flecha}</a>` : ''}
    </header>
    <div class="carril ${coverflow ? 'carril--coverflow' : ''}" tabindex="0" aria-label="${esc(titulo.replace(/<[^>]+>/g, ''))}">
      ${fondos.map((f, i) => tarjeta(f, { i })).join('')}
    </div>
  </section>`;
}

/** Pila de capas para parallax (o imagen simple si el fondo no tiene capas). */
export function escena(f, { prioridad = false } = {}) {
  const carga = prioridad ? 'fetchpriority="high"' : 'loading="lazy"';
  if (!f.capas.length) {
    return `<div class="escena"><img class="escena__capa" src="${url(f.vista)}" alt="" ${carga} decoding="async"></div>`;
  }
  return `<div class="escena escena--capas" data-capas="${f.capas.length}">
    ${f.capas.map((c, i) => `<img class="escena__capa" style="--z:${i}" src="${url(c)}" alt="" ${carga} decoding="async">`).join('')}
  </div>`;
}
