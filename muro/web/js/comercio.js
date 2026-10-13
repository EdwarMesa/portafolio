// Comercio: derechos de acceso, compras y descargas.
// La interfaz habla con un proveedor. En la demo el proveedor es "NoDisponible":
// no simula cobros ni entrega archivos prémium. Ver muro/backend/README.md para conectarlo.
import { MODO_DEMO } from './config.js';
import { url, publicado } from './datos.js';

export class PagoNoDisponible extends Error {
  constructor() {
    super('Los pagos todavía no están integrados en esta demo.');
    this.name = 'PagoNoDisponible';
  }
}

/** Contrato que debe cumplir cualquier proveedor real (Google Play Billing, Stripe…). */
const ProveedorNoDisponible = {
  nombre: 'Demo (sin pagos)',
  async derechos() { return new Set(); },                 // ids de fondos/colecciones/suscripción con acceso
  async comprar(/* producto */) { throw new PagoNoDisponible(); },
  async restaurar() { throw new PagoNoDisponible(); },
  async historial() { return []; },
  async urlDescargaFirmada(/* fondoId */) { throw new PagoNoDisponible(); },
};

const proveedor = ProveedorNoDisponible;
let derechos = new Set();

export async function iniciarComercio() {
  derechos = await proveedor.derechos();
}

export const nombreProveedor = () => proveedor.nombre;
export const modoDemo = () => MODO_DEMO;

/** ¿Puede el visitante descargar el original? Lo decide el servidor; aquí solo se refleja. */
export function tieneAcceso(f) {
  if (!publicado(f)) return false;
  if (f.acceso === 'gratis') return true;
  if (f.acceso === 'suscripcion') return derechos.has('muro_plus_mensual');
  return derechos.has(f.id) || (f.coleccion && derechos.has(f.coleccion));
}

/** URL del original. Gratis: archivo público. Pagado: URL temporal firmada por el servidor. */
export async function urlDescarga(f) {
  if (f.acceso === 'gratis' && f.original) return url(f.original);
  return proveedor.urlDescargaFirmada(f.id);
}

export const comprar = (producto) => proveedor.comprar(producto);
export const restaurarCompras = () => proveedor.restaurar();
export const historialCompras = () => proveedor.historial();
