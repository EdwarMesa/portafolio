import { almacen } from './almacen.js';

const movimientoReducido = matchMedia('(prefers-reduced-motion: reduce)');
const punteroFino = matchMedia('(hover: hover) and (pointer: fine)');

/** Dispositivo modesto: poca memoria, pocos núcleos o ahorro de datos activado. */
function equipoModesto() {
  const mem = navigator.deviceMemory ?? 8;
  const nucleos = navigator.hardwareConcurrency ?? 8;
  return mem <= 2 || nucleos <= 2 || navigator.connection?.saveData === true;
}

/** 'completo' o 'ligero'. Ligero desactiva parallax, inclinación 3D, partículas y coverflow. */
export function modo() {
  const pref = almacen.pref('rendimiento');
  if (pref === 'ligero' || movimientoReducido.matches) return 'ligero';
  if (pref === 'completo') return 'completo';
  return equipoModesto() ? 'ligero' : 'completo';
}

export const efectosActivos = () => modo() === 'completo';
export const conPunteroFino = () => punteroFino.matches;

export function aplicarModo() {
  document.documentElement.dataset.rendimiento = modo();
}

movimientoReducido.addEventListener('change', aplicarModo);
