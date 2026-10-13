import { CONFIG } from './config.js';

let catalogo = null;

export async function cargarCatalogo() {
  const res = await fetch(CONFIG.catalogo + 'catalogo.json');
  if (!res.ok) throw new Error(`Catálogo: HTTP ${res.status}`);
  catalogo = await res.json();
  catalogo.porId = new Map(catalogo.fondos.map((f) => [f.id, f]));
  catalogo.categoriaPorId = new Map(catalogo.categorias.map((c) => [c.id, c]));
  catalogo.coleccionPorId = new Map(catalogo.colecciones.map((c) => [c.id, c]));
  return catalogo;
}

export const cat = () => catalogo;
export const fondo = (id) => catalogo.porId.get(id);
export const categoria = (id) => catalogo.categoriaPorId.get(id);
export const coleccion = (id) => catalogo.coleccionPorId.get(id);
export const url = (ruta) => (ruta ? CONFIG.catalogo + ruta : null);

/** Fecha de hoy fijable en pruebas con ?hoy=AAAA-MM-DD. */
export function hoy() {
  const p = new URLSearchParams(location.search).get('hoy');
  return p ? new Date(p + 'T12:00:00') : new Date();
}

export const publicado = (f) => new Date(f.publicado + 'T00:00:00') <= hoy();
export const visibles = () => catalogo.fondos.filter(publicado);
export const deCategoria = (id) => visibles().filter((f) => f.categoria === id);
export const deColeccion = (id) => catalogo.fondos.filter((f) => f.coleccion === id);

export function novedades(n = 10) {
  return [...visibles()].sort((a, b) => b.publicado.localeCompare(a.publicado)).slice(0, n);
}

export const destacados = () => visibles().filter((f) => f.destacado);
export const premium = () => visibles().filter((f) => f.acceso === 'premium');

export const proximas = () =>
  catalogo.colecciones.filter((c) => c.tipo === 'lanzamiento' && deColeccion(c.id).some((f) => !publicado(f)));

/**
 * "Tendencias" necesita datos reales de uso (servidor). Mientras tanto se ordena con una
 * puntuación fija de demostración y la interfaz lo indica.
 */
export function tendenciasDemo(n = 5) {
  const puntuar = (f) => [...f.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 997, 7) + (f.destacado ? 400 : 0);
  return [...visibles()].sort((a, b) => puntuar(b) - puntuar(a)).slice(0, n);
}

const moneda = new Intl.NumberFormat('es', { style: 'currency', currency: 'USD' });
export const precio = (v) => moneda.format(v);

/** Etiqueta corta de acceso que se muestra en tarjetas y detalle. */
export function etiquetaAcceso(f) {
  if (!publicado(f)) return { clase: 'pronto', texto: 'Pronto' };
  if (f.acceso === 'gratis') return { clase: 'gratis', texto: 'Gratis' };
  if (f.acceso === 'suscripcion') return { clase: 'plus', texto: 'Muro+' };
  return { clase: 'premium', texto: precio(f.precio) };
}

export function fechaLarga(iso) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('es', { day: 'numeric', month: 'long', year: 'numeric' });
}
