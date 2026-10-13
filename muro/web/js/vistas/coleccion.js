// Colecciones y categorías comparten vista; cada tema tiene su propia entrada visual.
import { cat, categoria, coleccion, deCategoria, deColeccion, fechaLarga, precio, publicado } from '../datos.js';
import { esc, icono, tarjeta } from '../componentes.js';
import { ambiente, fijarAmbiente, parallax, particulas, revelar } from '../efectos.js';
import { compraColeccion, hojaPlus } from './hojas.js';

const TEMA_COLECCION = {
  'neon-nocturno': 'neon', orbitas: 'orbital', cumbres: 'organico', horizontes: 'panoramico',
  geometria: 'perspectiva', 'oro-negro': 'contenido', bienvenida: 'organico', 'lanzamiento-noviembre': 'orbital',
};

const FILTROS = [
  { id: 'todos', nombre: 'Todos' }, { id: 'gratis', nombre: 'Gratis' },
  { id: 'premium', nombre: 'Prémium' }, { id: 'suscripcion', nombre: 'Muro+' },
];

function datos(tipo, id) {
  if (tipo === 'categoria') {
    const c = categoria(id);
    if (!c) return null;
    return { titulo: c.nombre, desc: `${deCategoria(id).length} fondos originales`, tema: c.tema, acento: c.acento,
      fondos: deCategoria(id), eyebrow: 'Categoría' };
  }
  const c = coleccion(id);
  if (!c) return null;
  const fs = deColeccion(id);
  const tema = TEMA_COLECCION[id] ?? 'contenido';
  const acento = categoria(fs[0].categoria).acento;
  return { titulo: c.nombre, desc: c.descripcion, tema, acento, fondos: fs.filter(publicado), col: c,
    eyebrow: { gratis: 'Colección gratuita', pack: 'Paquete', exclusiva: 'Solo en Muro', lanzamiento: 'Próximo lanzamiento' }[c.tipo] };
}

function decoracion(tema) {
  return {
    neon: '<div class="deco deco--neon"><i></i><i></i><i></i></div>',
    orbital: '<canvas class="deco deco--orbital"></canvas>',
    organico: '<div class="deco deco--organico"><i></i><i></i></div>',
    panoramico: '<div class="deco deco--panoramico"><i></i><i></i></div>',
    perspectiva: '<div class="deco deco--perspectiva"></div>',
    contenido: '<div class="deco deco--contenido"><i></i></div>',
    fluido: '<div class="deco deco--fluido"><i></i><i></i><i></i></div>',
  }[tema] ?? '';
}

function accionColeccion(c, n) {
  if (!c) return '';
  if (c.tipo === 'gratis') return '<p class="estado-acceso">Gratis para siempre</p>';
  if (c.tipo === 'lanzamiento') {
    const f = deColeccion(c.id)[0];
    return `<button class="boton boton--vidrio" data-recordar="${c.id}" data-fecha="${f.publicado}" data-nombre="${esc(c.nombre)}">
      ${icono.calendario}Disponible el ${fechaLarga(f.publicado)}</button>`;
  }
  return `<button class="boton boton--claro" data-comprar-coleccion>${icono.candado}Comprar colección · ${precio(c.precio)}</button>
    <span class="estado-acceso">${n} fondos · también disponibles por separado</span>`;
}

export function render(tipo, id) {
  const d = datos(tipo, id);
  if (!d) return null;
  const muestra = d.fondos[0] ?? deColeccion(id)[0];
  return `
  <div class="coleccion" data-tema="${d.tema}" style="--acento:${d.acento}">
    <header class="coleccion__cabecera" data-ambiente="${esc(muestra.color)}">
      ${decoracion(d.tema)}
      <a class="enlace-volver" href="#/">${icono.atras}Descubrir</a>
      <p class="eyebrow eyebrow--acento">${esc(d.eyebrow)}</p>
      <h1 class="coleccion__titulo">${esc(d.titulo)}</h1>
      <p class="coleccion__desc">${esc(d.desc)}</p>
      <div class="coleccion__acciones">${accionColeccion(d.col, d.fondos.length)}</div>
    </header>
    ${tipo === 'categoria' ? `<div class="filtros" role="radiogroup" aria-label="Filtrar por acceso">
      ${FILTROS.map((f, i) => `<button role="radio" aria-checked="${i === 0}" data-filtro="${f.id}">${f.nombre}</button>`).join('')}
    </div>` : ''}
    <div class="mosaico mosaico--coleccion">
      ${d.fondos.length ? d.fondos.map((f, i) => tarjeta(f, { tam: i % 5 === 0 ? 'grande' : '', i })).join('')
        : '<p class="vacio">Esta colección se publica pronto.</p>'}
    </div>
    ${tipo !== 'categoria' ? '' : `<button class="boton-texto plus-enlace" data-plus>
      ${icono.estrella}Muchos fondos de ${esc(d.titulo)} están incluidos en ${esc(cat().suscripcion.nombre)}</button>`}
  </div>`;
}

export function montar(raiz, tipo, id) {
  const d = datos(tipo, id);
  const limpiezas = [];
  fijarAmbiente(d.acento);
  requestAnimationFrame(() => raiz.querySelector('.coleccion').classList.add('entrando'));
  const lienzo = raiz.querySelector('.deco--orbital');
  if (lienzo) limpiezas.push(particulas(lienzo, d.acento));
  raiz.querySelector('[data-comprar-coleccion]')?.addEventListener('click', () => compraColeccion(d.col));
  raiz.querySelector('[data-plus]')?.addEventListener('click', hojaPlus);

  raiz.querySelector('.filtros')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-filtro]');
    if (!b) return;
    raiz.querySelectorAll('[data-filtro]').forEach((x) => x.setAttribute('aria-checked', x === b));
    const lista = b.dataset.filtro === 'todos' ? d.fondos : d.fondos.filter((f) => f.acceso === b.dataset.filtro);
    const mosaico = raiz.querySelector('.mosaico');
    mosaico.innerHTML = lista.length
      ? lista.map((f, i) => tarjeta(f, { tam: i % 5 === 0 ? 'grande' : '', i })).join('')
      : '<p class="vacio">No hay fondos con este filtro.</p>';
    revelar(mosaico);
  });

  revelar(raiz);
  ambiente(raiz);
  parallax(raiz);
  return () => limpiezas.forEach((f) => f());
}
