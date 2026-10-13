// Estado local del visitante. Todo vive en este navegador y se puede borrar desde Perfil.
const CLAVE = 'muro.v2';
const INICIAL = {
  favoritos: [],          // ids
  vistos: [],             // [{ id, t }] más reciente primero
  descargas: [],          // [{ id, t }]
  recordatorios: [],      // ids de colecciones
  prefs: { personalizar: false, rendimiento: 'auto' },
};

let estado = cargar();
const oyentes = new Set();

function cargar() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    return { ...INICIAL, ...guardado, prefs: { ...INICIAL.prefs, ...guardado?.prefs } };
  } catch {
    return structuredClone(INICIAL);
  }
}

function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { /* modo privado */ }
  oyentes.forEach((fn) => fn(estado));
}

export const almacen = {
  get: () => estado,
  suscribir(fn) { oyentes.add(fn); return () => oyentes.delete(fn); },

  esFavorito: (id) => estado.favoritos.includes(id),
  alternarFavorito(id) {
    const activo = !estado.favoritos.includes(id);
    estado.favoritos = activo ? [id, ...estado.favoritos] : estado.favoritos.filter((f) => f !== id);
    guardar();
    return activo;
  },

  registrarVisto(id) {
    if (!estado.prefs.personalizar) return;   // sin consentimiento no se guarda actividad
    estado.vistos = [{ id, t: Date.now() }, ...estado.vistos.filter((v) => v.id !== id)].slice(0, 60);
    guardar();
  },

  registrarDescarga(id) {
    estado.descargas = [{ id, t: Date.now() }, ...estado.descargas.filter((d) => d.id !== id)].slice(0, 100);
    guardar();
  },

  alternarRecordatorio(id) {
    const r = estado.recordatorios;
    estado.recordatorios = r.includes(id) ? r.filter((x) => x !== id) : [...r, id];
    guardar();
  },

  pref(clave, valor) {
    if (valor === undefined) return estado.prefs[clave];
    estado.prefs = { ...estado.prefs, [clave]: valor };
    if (clave === 'personalizar' && !valor) estado.vistos = [];
    guardar();
  },

  borrarTodo() {
    estado = structuredClone(INICIAL);
    guardar();
  },
};
