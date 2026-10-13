// Recomendaciones por contenido, calculadas en el navegador con datos locales.
// Solo usa actividad si el visitante activó "Personalizar" en Perfil.
import { almacen } from './almacen.js';
import { fondo, visibles } from './datos.js';

export function recomendaciones(n = 8) {
  const { favoritos, vistos, descargas, prefs } = almacen.get();
  const semillas = [
    ...favoritos.map((id) => ({ id, peso: 3 })),
    ...descargas.map((d) => ({ id: d.id, peso: 2 })),
    ...(prefs.personalizar ? vistos.slice(0, 20).map((v) => ({ id: v.id, peso: 1 })) : []),
  ].filter((s) => fondo(s.id));
  if (!semillas.length) return { motivo: null, fondos: [] };

  const afinCat = new Map();
  const afinTag = new Map();
  const afinCol = new Map();
  for (const { id, peso } of semillas) {
    const f = fondo(id);
    afinCat.set(f.categoria, (afinCat.get(f.categoria) ?? 0) + peso);
    if (f.coleccion) afinCol.set(f.coleccion, (afinCol.get(f.coleccion) ?? 0) + peso);
    f.etiquetas.forEach((t) => afinTag.set(t, (afinTag.get(t) ?? 0) + peso));
  }
  const conocidos = new Set(favoritos);
  const puntuados = visibles()
    .filter((f) => !conocidos.has(f.id))
    .map((f) => ({
      f,
      p: (afinCat.get(f.categoria) ?? 0) * 2
        + (f.coleccion ? afinCol.get(f.coleccion) ?? 0 : 0)
        + f.etiquetas.reduce((s, t) => s + (afinTag.get(t) ?? 0), 0),
    }))
    .filter((x) => x.p > 0)
    .sort((a, b) => b.p - a.p);

  const principal = fondo(semillas[0].id);
  return { motivo: principal, fondos: puntuados.slice(0, n).map((x) => x.f) };
}
