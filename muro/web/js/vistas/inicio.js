import { almacen } from '../almacen.js';
import {
  cat, categoria, coleccion, deCategoria, deColeccion, destacados, fechaLarga, novedades, precio,
  premium, proximas, tendenciasDemo, url,
} from '../datos.js';
import { carril, esc, escena, icono, insignia, tarjeta } from '../componentes.js';
import { ambiente, coverflow, escenas, fijarAmbiente, parallax, progresoHero, revelar } from '../efectos.js';
import { efectosActivos } from '../rendimiento.js';
import { recomendaciones } from '../recomendador.js';
import { cuentaAtras } from '../utilidades.js';

const DURACION = 8000;

function hero(lista) {
  const f = lista[0];
  return `
  <section class="hero" data-ambiente="${esc(f.color)}" aria-roledescription="carrusel" aria-label="Destacados">
    <div class="hero__fondo"><img src="${url(f.vista)}" alt="" fetchpriority="high"></div>
    <div class="hero__velo"></div>
    <div class="hero__contenido">${heroTexto(f)}</div>
    <div class="hero__movil" data-inclinar>
      <div class="movil-marco">${escena(f, { prioridad: true })}</div>
    </div>
    <nav class="hero__puntos" aria-label="Elegir destacado">
      ${lista.map((d, i) => `<button class="hero__punto" data-ir="${i}" aria-label="${esc(d.nombre)}"
         aria-current="${i === 0}"><span></span></button>`).join('')}
    </nav>
    <p class="hero__desliza" aria-hidden="true"><span></span>Desliza</p>
  </section>`;
}

function heroTexto(f) {
  const col = f.coleccion && coleccion(f.coleccion);
  const palabras = f.nombre.split(' ')
    .map((p, i) => `<span class="palabra"><span style="--i:${i}">${esc(p)}</span></span>`).join(' ');
  return `
    <p class="eyebrow">${col ? `Colección ${esc(col.nombre)}` : esc(categoria(f.categoria).nombre)} · Destacado</p>
    <h1 class="hero__titulo">${palabras}</h1>
    <p class="hero__desc">${esc(f.descripcion)}</p>
    <div class="hero__acciones">
      <a class="boton boton--claro" href="#/fondo/${esc(f.id)}">Ver fondo</a>
      ${col ? `<a class="boton boton--vidrio" href="#/coleccion/${esc(col.id)}">Colección · ${precio(col.precio)}</a>` : ''}
    </div>
    <div class="hero__meta">${insignia(f)}${f.capas.length ? `<span class="chip-dato">${icono.capas}Profundidad 3D</span>` : ''}</div>`;
}

function categorias() {
  return `
  <section class="seccion" id="categorias" data-ambiente="#2a2a3a">
    <header class="seccion__cabecera revelar">
      <div><p class="eyebrow">Explora por estilo</p><h2 class="seccion__titulo" data-parallax="0.06">Categorías</h2></div>
    </header>
    <div class="categorias">
      ${cat().categorias.map((c, i) => {
        const fs = deCategoria(c.id).slice(0, 3);
        return `<a class="cat cat--${c.tema} revelar" href="#/categoria/${c.id}" style="--acento:${c.acento};--i:${i}">
          <span class="cat__pila">${fs.map((f, j) => `<img src="${url(f.miniatura)}" alt="" loading="lazy" style="--j:${j}">`).join('')}</span>
          <span class="cat__texto"><strong>${esc(c.nombre)}</strong><small>${deCategoria(c.id).length} fondos</small></span>
        </a>`;
      }).join('')}
    </div>
  </section>`;
}

function colecciones() {
  // Paquetes primero (el primero en grande) y la exclusiva como banda ancha al final.
  const lista = [...cat().colecciones.filter((c) => c.tipo === 'pack'), ...cat().colecciones.filter((c) => c.tipo === 'exclusiva')];
  return `
  <section class="seccion" id="colecciones" data-ambiente="#3a2c18">
    <header class="seccion__cabecera revelar">
      <div><p class="eyebrow">Paquetes temáticos</p>
        <h2 class="seccion__titulo" data-parallax="0.06">Colecciones <em>exclusivas</em></h2></div>
    </header>
    <div class="bento">
      ${lista.map((c, i) => {
        const fs = deColeccion(c.id);
        return `<a class="coleccion-tarjeta revelar ${i === 0 ? 'coleccion-tarjeta--grande' : ''} ${c.tipo === 'exclusiva' ? 'coleccion-tarjeta--ancha' : ''}" href="#/coleccion/${c.id}"
            style="--color:${fs[0].color};--i:${i}">
          <span class="coleccion-tarjeta__abanico">
            ${fs.slice(0, 3).map((f, j) => `<img src="${url(i === 0 || c.tipo === 'exclusiva' ? f.vista : f.miniatura)}" alt="" loading="lazy" style="--j:${j}">`).join('')}
          </span>
          <span class="coleccion-tarjeta__texto">
            ${c.tipo === 'exclusiva' ? '<span class="insignia insignia--oro">Solo en Muro</span>' : ''}
            <strong>${esc(c.nombre)}</strong>
            <small>${esc(c.descripcion)}</small>
            <span class="coleccion-tarjeta__precio">${fs.length} fondos · ${precio(c.precio)}</span>
          </span>
        </a>`;
      }).join('')}
    </div>
  </section>`;
}

function mosaicoPremium() {
  const fs = premium().slice(0, 7);
  return `
  <section class="seccion" id="premium" data-ambiente="#1d1530">
    <header class="seccion__cabecera revelar">
      <div><p class="eyebrow">Selección prémium</p>
        <h2 class="seccion__titulo" data-parallax="0.06">Recomendados <em>prémium</em></h2></div>
    </header>
    <div class="mosaico">${fs.map((f, i) => tarjeta(f, { tam: i % 3 === 0 ? 'grande' : '', i })).join('')}</div>
  </section>`;
}

function paraTi() {
  const { motivo, fondos } = recomendaciones();
  const consentido = almacen.pref('personalizar');
  if (!fondos.length) {
    return `
    <section class="seccion" id="para-ti">
      <div class="invitacion revelar">
        <p class="eyebrow">Para ti</p>
        <h2 class="seccion__titulo">Recomendaciones a tu medida</h2>
        <p>Guarda fondos con ${icono.corazon} y te sugeriremos otros parecidos.
          ${consentido ? '' : 'Si quieres, también podemos tener en cuenta lo que miras. Todo se calcula y guarda solo en este dispositivo.'}</p>
        ${consentido ? '' : '<button class="boton boton--vidrio" data-activar-personalizar>Usar mi actividad en este dispositivo</button>'}
      </div>
    </section>`;
  }
  return carril({
    id: 'para-ti', eyebrow: 'Para ti', titulo: 'Porque te gustó <em>' + esc(motivo.nombre) + '</em>',
    nota: 'Calculado en este dispositivo con tus favoritos' + (consentido ? ' y lo que has visto.' : '.'), fondos,
  });
}

function tendencias() {
  return `
  <section class="seccion" id="tendencias" data-ambiente="#14202a">
    <header class="seccion__cabecera revelar">
      <div><p class="eyebrow">Esta semana</p><h2 class="seccion__titulo" data-parallax="0.06">Tendencias</h2>
      <p class="seccion__nota">Orden de demostración: aún no hay datos de uso reales.</p></div>
    </header>
    <ol class="ranking">
      ${tendenciasDemo(5).map((f, i) => `
        <li class="revelar" style="--i:${i}">
          <a href="#/fondo/${esc(f.id)}" class="ranking__fila">
            <span class="ranking__num">${i + 1}</span>
            <img src="${url(f.miniatura)}" alt="" loading="lazy">
            <span class="ranking__texto"><strong>${esc(f.nombre)}</strong><small>${esc(categoria(f.categoria).nombre)}</small></span>
            ${insignia(f)}
          </a>
        </li>`).join('')}
    </ol>
  </section>`;
}

function lanzamientos() {
  return proximas().map((c) => {
    const fs = deColeccion(c.id);
    const fecha = fs[0].publicado;
    const t = cuentaAtras(fecha);
    const guardado = almacen.get().recordatorios.includes(c.id);
    return `
    <section class="seccion lanzamiento revelar" id="lanzamiento" data-ambiente="#2b0f3a">
      <div class="lanzamiento__previas" aria-hidden="true">
        ${fs.map((f, i) => `<img src="${url(f.vista)}" alt="" loading="lazy" style="--i:${i}">`).join('')}
      </div>
      <div class="lanzamiento__texto">
        <p class="eyebrow eyebrow--acento">Lanzamiento especial</p>
        <h2 class="seccion__titulo">${esc(c.nombre)}</h2>
        <p>${fs.length} fondos nuevos el ${fechaLarga(fecha)}. ${esc(c.descripcion)}</p>
        <div class="cuenta" data-cuenta="${fecha}" role="timer" aria-label="Tiempo restante">
          <span><strong>${t.d}</strong>días</span><span><strong>${t.h}</strong>horas</span><span><strong>${t.m}</strong>min</span>
        </div>
        <button class="boton boton--vidrio" data-recordar="${c.id}" data-fecha="${fecha}" data-nombre="${esc(c.nombre)}">
          ${icono.calendario}${guardado ? 'Recordatorio añadido' : 'Añadir a mi calendario'}</button>
      </div>
    </section>`;
  }).join('');
}

function plus() {
  const s = cat().suscripcion;
  return `
  <section class="seccion plus revelar" data-ambiente="#2e2412">
    <div class="plus__brillo" aria-hidden="true"></div>
    <p class="eyebrow eyebrow--acento">${icono.estrella} Opcional</p>
    <h2 class="seccion__titulo">${esc(s.nombre)}</h2>
    <p class="plus__texto">${s.beneficios.map(esc).join(' · ')}</p>
    <button class="boton boton--claro" data-plus>Ver Muro+ · ${precio(s.precio)}/${esc(s.periodo)}</button>
  </section>`;
}

export function render() {
  const lista = destacados();
  return `
    ${hero(lista)}
    ${carril({ id: 'novedades', eyebrow: 'Recién llegados', titulo: 'Novedades', fondos: novedades(10), coverflow: true, ambiente: '#1a1a26' })}
    ${categorias()}
    ${colecciones()}
    ${mosaicoPremium()}
    ${paraTi()}
    ${tendencias()}
    ${carril({ id: 'gratis', eyebrow: 'Para empezar', titulo: 'Gratis, <em>para siempre</em>',
      nota: 'La colección Bienvenida es gratuita y lo seguirá siendo.', fondos: deColeccion('bienvenida'),
      enlace: '#/coleccion/bienvenida', ambiente: '#10241c' })}
    ${lanzamientos()}
    ${plus()}`;
}

export function montar(raiz) {
  const lista = destacados();
  const heroEl = raiz.querySelector('.hero');
  fijarAmbiente(lista[0].color);
  revelar(raiz);
  ambiente(raiz);
  parallax(raiz);
  escenas(raiz);
  const limpiezas = [progresoHero(heroEl), coverflow(raiz)];

  // Carrusel de destacados: se pausa fuera de pantalla, con la pestaña oculta o al interactuar.
  let indice = 0;
  let inicio = performance.now();
  let pausado = false;
  let visible = true;
  const ir = (i) => {
    indice = (i + lista.length) % lista.length;
    const f = lista[indice];
    heroEl.dataset.ambiente = f.color;
    fijarAmbiente(f.color);
    heroEl.classList.add('cambiando');
    setTimeout(() => {
      heroEl.querySelector('.hero__fondo img').src = url(f.vista);
      heroEl.querySelector('.hero__contenido').innerHTML = heroTexto(f);
      heroEl.querySelector('.movil-marco').innerHTML = escena(f, { prioridad: true });
      escenas(heroEl);
      heroEl.classList.remove('cambiando');
    }, efectosActivos() ? 380 : 0);
    heroEl.querySelectorAll('.hero__punto').forEach((p, j) => p.setAttribute('aria-current', j === indice));
    inicio = performance.now();
  };
  heroEl.querySelector('.hero__puntos').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ir]');
    if (b) ir(+b.dataset.ir);
  });
  const pausar = (v) => { pausado = v; heroEl.classList.toggle('pausado', v); };
  heroEl.addEventListener('pointerenter', () => pausar(true));
  heroEl.addEventListener('pointerleave', () => pausar(false));
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; heroEl.classList.toggle('pausado', !visible || pausado); });
  io.observe(heroEl);
  const autoplay = efectosActivos();
  heroEl.style.setProperty('--duracion', `${DURACION}ms`);
  // La barra visible es una animación CSS; aquí solo se lleva la cuenta (pausada igual que la barra).
  const reloj = setInterval(() => {
    if (pausado || !visible || document.hidden) { inicio += 250; return; }
    if (autoplay && performance.now() - inicio >= DURACION) ir(indice + 1);
  }, 250);

  const cuentas = setInterval(() => {
    raiz.querySelectorAll('[data-cuenta]').forEach((el) => {
      const t = cuentaAtras(el.dataset.cuenta);
      el.innerHTML = `<span><strong>${t.d}</strong>días</span><span><strong>${t.h}</strong>horas</span><span><strong>${t.m}</strong>min</span>`;
    });
  }, 30000);

  return () => { clearInterval(reloj); clearInterval(cuentas); io.disconnect(); limpiezas.forEach((f) => f()); };
}
