// Muro — prototipo. Lee el mismo catalogo.json que usa la app Android.
const CATALOGO = '../catalogo/';
const $ = (s) => document.querySelector(s);
const app = $('#app');

let fondos = [];
let categoria = 'Todos';
let actual = null;
let favoritos = new Set(leer('muro.favoritos', []));

function leer(clave, def) {
  try { return JSON.parse(localStorage.getItem(clave)) ?? def; } catch { return def; }
}
function guardar(clave, valor) {
  try { localStorage.setItem(clave, JSON.stringify(valor)); } catch { /* sin almacenamiento */ }
}

async function iniciar() {
  try {
    const res = await fetch(CATALOGO + 'catalogo.json');
    const datos = await res.json();
    fondos = datos.fondos;
    pintarChips(['Todos', ...datos.categorias]);
    pintarRejilla();
  } catch {
    $('#vacio').hidden = false;
    $('#vacio').innerHTML = 'No se pudo cargar el catálogo.<br>Ábrelo desde un servidor (ver README).';
  }
}

function pintarChips(categorias) {
  const nav = $('#chips');
  nav.innerHTML = '';
  for (const c of categorias) {
    const b = document.createElement('button');
    b.className = 'chip';
    b.textContent = c;
    b.setAttribute('aria-pressed', c === categoria);
    b.onclick = () => {
      categoria = c;
      nav.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', x === b));
      pintarRejilla();
    };
    nav.append(b);
  }
}

function visibles() {
  if (app.dataset.pantalla === 'favoritos') return fondos.filter((f) => favoritos.has(f.id));
  return categoria === 'Todos' ? fondos : fondos.filter((f) => f.categoria === categoria);
}

function pintarRejilla() {
  const rejilla = $('#rejilla');
  const lista = visibles();
  rejilla.innerHTML = '';
  rejilla.scrollTop = 0;
  lista.forEach((f, i) => {
    const b = document.createElement('button');
    b.className = 'tarjeta';
    b.style.background = f.color;
    b.style.animationDelay = `${i * 35}ms`;
    b.setAttribute('aria-label', `${f.nombre}, ${f.categoria}`);
    b.innerHTML = `<img src="${CATALOGO + f.miniatura}" alt="" loading="lazy">` +
      (favoritos.has(f.id) ? '<span class="tarjeta__fav"><svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg></span>' : '');
    b.onclick = () => abrir(f);
    rejilla.append(b);
  });
  const enFavoritos = app.dataset.pantalla === 'favoritos';
  $('#vacio').hidden = !(enFavoritos && lista.length === 0);
  if (enFavoritos) $('#vacio').innerHTML = 'Aún no tienes favoritos.<br>Toca el corazón en cualquier fondo.';
}

let pantallaLista = 'explorar';
function ir(pantalla) {
  pantallaLista = pantalla;
  app.dataset.pantalla = pantalla;
  $('#titulo').textContent = pantalla === 'favoritos' ? 'Favoritos' : 'Muro';
  document.querySelectorAll('.navegacion__item').forEach((b) =>
    b.classList.toggle('activo', b.dataset.ir === pantalla));
  pintarRejilla();
}

function abrir(f) {
  actual = f;
  const img = $('#detalle-img');
  img.src = CATALOGO + f.miniatura;          // muestra la miniatura al instante
  const alta = new Image();
  alta.onload = () => { if (actual === f) img.src = alta.src; };
  alta.src = CATALOGO + f.imagen;
  $('.pantalla--detalle').style.background = f.color;
  $('#detalle-nombre').textContent = f.nombre;
  $('#detalle-cat').textContent = f.categoria;
  $('#btn-descargar').href = CATALOGO + f.imagen;
  $('#btn-descargar').setAttribute('download', `muro-${f.id}.webp`);
  $('#btn-fav').setAttribute('aria-pressed', favoritos.has(f.id));
  $('.pantalla--detalle').classList.remove('vista-bloqueo');
  $('.pantalla--detalle').setAttribute('aria-hidden', 'false');
  app.dataset.pantalla = 'detalle';
}

function cerrar() {
  $('#hoja').hidden = true;
  $('.pantalla--detalle').setAttribute('aria-hidden', 'true');
  ir(pantallaLista);
}

let temporizador;
function avisar(texto) {
  const a = $('#aviso');
  a.textContent = texto;
  a.classList.add('visible');
  clearTimeout(temporizador);
  temporizador = setTimeout(() => a.classList.remove('visible'), 2200);
}

function actualizarReloj() {
  const ahora = new Date();
  $('#reloj-hora').textContent = ahora.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false });
  $('#reloj-fecha').textContent = ahora.toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
}

// Eventos
document.querySelectorAll('.navegacion__item').forEach((b) => (b.onclick = () => ir(b.dataset.ir)));
$('#btn-volver').onclick = cerrar;
$('#btn-vista').onclick = () => { actualizarReloj(); $('.pantalla--detalle').classList.toggle('vista-bloqueo'); };
$('#btn-fav').onclick = () => {
  const activo = !favoritos.has(actual.id);
  activo ? favoritos.add(actual.id) : favoritos.delete(actual.id);
  guardar('muro.favoritos', [...favoritos]);
  $('#btn-fav').setAttribute('aria-pressed', activo);
  avisar(activo ? 'Añadido a favoritos' : 'Quitado de favoritos');
};
$('#btn-descargar').addEventListener('click', () => avisar('Guardado en Imágenes/Muro'));
$('#btn-aplicar').onclick = () => { $('#hoja').hidden = false; };
$('#hoja').addEventListener('click', (e) => {
  const opcion = e.target.closest('[data-destino]');
  if (opcion) avisar(`Aplicado en ${opcion.dataset.destino.toLowerCase()}`);
  if (opcion || e.target.hasAttribute('data-cerrar')) $('#hoja').hidden = true;
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!$('#hoja').hidden) $('#hoja').hidden = true;
  else if (app.dataset.pantalla === 'detalle') cerrar();
});

$('#btn-tema').onclick = () => {
  const oscuro = matchMedia('(prefers-color-scheme: dark)').matches;
  const actualTema = document.documentElement.dataset.theme || (oscuro ? 'dark' : 'light');
  const nuevo = actualTema === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = nuevo;
  guardar('muro.tema', nuevo);
};
const temaGuardado = leer('muro.tema', null);
if (temaGuardado) document.documentElement.dataset.theme = temaGuardado;

iniciar();
