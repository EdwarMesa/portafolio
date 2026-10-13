// Motor de efectos. Reglas: solo transform/opacity, un único bucle rAF que se detiene
// cuando no hay trabajo, y nada se anima fuera de pantalla.
import { conPunteroFino, efectosActivos } from './rendimiento.js';

/* ---------- Revelado progresivo ---------- */
const observadorRevelar = new IntersectionObserver((entradas) => {
  for (const e of entradas) {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observadorRevelar.unobserve(e.target);
    }
  }
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.01 });

export function revelar(raiz) {
  raiz.querySelectorAll('.revelar:not(.visible)').forEach((el) => observadorRevelar.observe(el));
}

/* ---------- Luz ambiental por sección ---------- */
const observadorAmbiente = new IntersectionObserver((entradas) => {
  const activa = entradas.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
  if (activa) fijarAmbiente(activa.target.dataset.ambiente);
}, { threshold: [0.25, 0.5, 0.75] });

export function ambiente(raiz) {
  raiz.querySelectorAll('[data-ambiente]').forEach((el) => observadorAmbiente.observe(el));
}
const capaAmbiente = document.querySelector('.ambiente');
export function fijarAmbiente(color) {
  if (!color) return;
  capaAmbiente.style.setProperty('--ambiente', color);         // animado, sin herencia
  document.documentElement.style.setProperty('--tono', color); // sombras y brillos, sin transición
}

/* ---------- Bucle de animación compartido ---------- */
const tareas = new Set();
let pendiente = false;
function pedirCuadro() {
  if (pendiente) return;
  pendiente = true;
  requestAnimationFrame(() => {
    pendiente = false;
    tareas.forEach((t) => t());
  });
}
addEventListener('scroll', pedirCuadro, { passive: true });
addEventListener('resize', pedirCuadro, { passive: true });

/* ---------- Parallax de títulos y hero al hacer scroll ---------- */
const parallaxVisibles = new Set();
const observadorParallax = new IntersectionObserver((entradas) => {
  entradas.forEach((e) => (e.isIntersecting ? parallaxVisibles.add(e.target) : parallaxVisibles.delete(e.target)));
});
tareas.add(() => {
  if (!efectosActivos()) return;
  const alto = innerHeight;
  for (const el of parallaxVisibles) {
    const r = el.getBoundingClientRect();
    const centro = (r.top + r.height / 2 - alto / 2) / alto;
    el.style.transform = `translate3d(0, ${(-centro * parseFloat(el.dataset.parallax) * 100).toFixed(2)}px, 0)`;
  }
});
export function parallax(raiz) {
  raiz.querySelectorAll('[data-parallax]').forEach((el) => observadorParallax.observe(el));
  pedirCuadro();
}

/** Progreso de salida del hero (0 arriba, 1 cuando ha salido) en la variable --salida. */
export function progresoHero(hero) {
  const tarea = () => {
    if (!hero.isConnected) return tareas.delete(tarea);
    const p = Math.min(Math.max(scrollY / (hero.offsetHeight * 0.9), 0), 1);
    hero.style.setProperty('--salida', p.toFixed(3));
  };
  tareas.add(tarea);
  tarea();
  return () => tareas.delete(tarea);
}

/* ---------- Inclinación 3D con reflejo que sigue al puntero ---------- */
let marcoActivo = null;
document.addEventListener('pointermove', (e) => {
  if (!efectosActivos() || !conPunteroFino()) return;
  const marco = e.target.closest?.('.tarjeta__marco, [data-inclinar]');
  if (marco !== marcoActivo) {
    marcoActivo?.style.removeProperty('--rx');
    marcoActivo?.style.removeProperty('--ry');
    marcoActivo?.classList.remove('inclinado');
    marcoActivo = marco;
  }
  if (!marco) return;
  const r = marco.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  marco.classList.add('inclinado');
  marco.style.setProperty('--rx', `${((0.5 - y) * 10).toFixed(2)}deg`);
  marco.style.setProperty('--ry', `${((x - 0.5) * 12).toFixed(2)}deg`);
  marco.style.setProperty('--gx', `${(x * 100).toFixed(1)}%`);
  marco.style.setProperty('--gy', `${(y * 100).toFixed(1)}%`);
}, { passive: true });

/* ---------- Parallax multicapa (puntero o giroscopio) ---------- */
let objetivo = { x: 0, y: 0 };
let actual = { x: 0, y: 0 };
const escenasActivas = new Set();
const observadorEscenas = new IntersectionObserver((entradas) => {
  entradas.forEach((e) => (e.isIntersecting ? escenasActivas.add(e.target) : escenasActivas.delete(e.target)));
  if (escenasActivas.size) animarEscenas();
});

addEventListener('pointermove', (e) => {
  objetivo = { x: e.clientX / innerWidth - 0.5, y: e.clientY / innerHeight - 0.5 };
  if (escenasActivas.size) animarEscenas();
}, { passive: true });

addEventListener('deviceorientation', (e) => {
  if (e.gamma == null) return;
  objetivo = { x: Math.max(-1, Math.min(1, e.gamma / 30)) / 2, y: Math.max(-1, Math.min(1, (e.beta - 45) / 30)) / 2 };
  if (escenasActivas.size) animarEscenas();
}, { passive: true });

let animando = false;
function animarEscenas() {
  if (animando || !efectosActivos()) return;
  animando = true;
  const paso = () => {
    actual.x += (objetivo.x - actual.x) * 0.08;
    actual.y += (objetivo.y - actual.y) * 0.08;
    for (const el of escenasActivas) {
      el.style.setProperty('--px', actual.x.toFixed(4));
      el.style.setProperty('--py', actual.y.toFixed(4));
    }
    const quieto = Math.abs(objetivo.x - actual.x) < 0.001 && Math.abs(objetivo.y - actual.y) < 0.001;
    if (quieto || !escenasActivas.size) { animando = false; return; }
    requestAnimationFrame(paso);
  };
  requestAnimationFrame(paso);
}

export function escenas(raiz) {
  raiz.querySelectorAll('.escena--capas').forEach((el) => observadorEscenas.observe(el));
}

/* ---------- Coverflow en carriles horizontales ---------- */
export function coverflow(raiz) {
  const limpiezas = [];
  raiz.querySelectorAll('.carril--coverflow').forEach((carril) => {
    const tarjetas = [...carril.children];
    const actualizar = () => {
      if (!efectosActivos()) return;
      const r = carril.getBoundingClientRect();
      const centro = r.left + r.width / 2;
      for (const t of tarjetas) {
        const tr = t.getBoundingClientRect();
        const d = Math.max(-1, Math.min(1, (tr.left + tr.width / 2 - centro) / (r.width / 2)));
        t.style.setProperty('--d', d.toFixed(3));
        t.style.setProperty('--ad', Math.abs(d).toFixed(3));
      }
    };
    let cuadro = 0;
    const alDesplazar = () => { cancelAnimationFrame(cuadro); cuadro = requestAnimationFrame(actualizar); };
    carril.addEventListener('scroll', alDesplazar, { passive: true });
    addEventListener('resize', alDesplazar, { passive: true });
    actualizar();
    limpiezas.push(() => removeEventListener('resize', alDesplazar));
  });
  return () => limpiezas.forEach((f) => f());
}

/* ---------- Partículas orbitales (solo colecciones de espacio) ---------- */
export function particulas(canvas, color) {
  if (!efectosActivos()) return () => {};
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(devicePixelRatio, 2);
  let ancho = 0, alto = 0, visible = true, id = 0;
  const puntos = Array.from({ length: 70 }, () => ({
    r: Math.random() ** 0.6, a: Math.random() * Math.PI * 2,
    v: (0.0006 + Math.random() * 0.0016) * (Math.random() < 0.5 ? 1 : -1), t: 0.4 + Math.random() * 1.4,
  }));
  const medir = () => {
    ancho = canvas.clientWidth; alto = canvas.clientHeight;
    canvas.width = ancho * dpr; canvas.height = alto * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const dibujar = () => {
    if (!visible || !canvas.isConnected) return;
    ctx.clearRect(0, 0, ancho, alto);
    ctx.fillStyle = color;
    const cx = ancho * 0.5, cy = alto * 0.55, rad = Math.max(ancho, alto) * 0.55;
    for (const p of puntos) {
      p.a += p.v;
      ctx.globalAlpha = 0.25 + 0.5 * p.r;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(p.a) * p.r * rad, cy + Math.sin(p.a) * p.r * rad * 0.42, p.t, 0, Math.PI * 2);
      ctx.fill();
    }
    id = requestAnimationFrame(dibujar);
  };
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    cancelAnimationFrame(id);
    if (visible) id = requestAnimationFrame(dibujar);
  });
  medir();
  io.observe(canvas);
  addEventListener('resize', medir);
  return () => { cancelAnimationFrame(id); io.disconnect(); removeEventListener('resize', medir); };
}

/** Precarga la vista grande cuando el usuario muestra intención (hover o toque). */
const precargadas = new Set();
export function precargar(src) {
  if (!src || precargadas.has(src)) return;
  precargadas.add(src);
  const l = document.createElement('link');
  l.rel = 'prefetch'; l.as = 'image'; l.href = src;
  document.head.append(l);
}
