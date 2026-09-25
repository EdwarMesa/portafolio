// ESTRATO — interacciones de la página (sin 3D)

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Navegación: fondo sólido al desplazar, se oculta al bajar
const nav = document.getElementById('nav');
let lastY = scrollY;
addEventListener('scroll', () => {
  const y = scrollY;
  nav.classList.toggle('is-solid', y > 40);
  if (!nav.classList.contains('is-open')) nav.classList.toggle('is-hidden', y > lastY && y > 400);
  lastY = y;
}, { passive: true });

const toggle = nav.querySelector('.nav__toggle');
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', String(open));
});
nav.querySelectorAll('.nav__links a').forEach((a) => a.addEventListener('click', () => {
  nav.classList.remove('is-open');
  toggle.setAttribute('aria-expanded', 'false');
}));

// Aparición progresiva
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) {
      e.target.classList.add('is-in');
      io.unobserve(e.target);
    }
  }
}, { rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.reveal').forEach((el, i) => {
  if (!el.closest('.hero')) el.style.transitionDelay = `${(i % 4) * 90}ms`;
  io.observe(el);
});

// Pausar videos fuera de pantalla
document.querySelectorAll('video').forEach((v) => {
  new IntersectionObserver(([e]) => {
    if (e.isIntersecting && !reduced) v.play().catch(() => {});
    else v.pause();
  }).observe(v);
});

// Detección IA: rejilla que se analiza por barrido
const grid = document.getElementById('scanGrid');
const pct = document.getElementById('scanPct');
if (grid) {
  const cols = matchMedia('(max-width: 560px)').matches ? 16 : 24;
  const rows = 12;
  const cells = [];
  // Campo de probabilidad con dos anomalías
  const blobs = [[0.28, 0.4, 0.12], [0.72, 0.62, 0.09], [0.55, 0.2, 0.06]];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = document.createElement('i');
      const x = (c + 0.5) / cols, y = (r + 0.5) / rows;
      let p = 0;
      for (const [bx, by, s] of blobs) p = Math.max(p, Math.exp(-((x - bx) ** 2 + ((y - by) * 0.5) ** 2) / (2 * s * s)));
      p = Math.min(1, p + 0.08 * Math.sin(c * 1.7 + r * 2.3));
      i.dataset.p = p.toFixed(3);
      const t = Math.max(0, p);
      i.style.setProperty('--v', `rgba(${185 + 40 * t | 0}, ${164 - 20 * t | 0}, ${136 - 60 * t | 0}, ${0.12 + 0.5 * t})`);
      grid.appendChild(i);
      cells.push({ el: i, c, p });
    }
  }
  let started = false;
  const run = () => {
    if (started) return;
    started = true;
    let col = 0;
    const step = () => {
      for (const cell of cells) {
        if (cell.c === col) {
          cell.el.classList.add('s');
          if (cell.p > 0.8) cell.el.classList.add('hit');
        }
      }
      col++;
      pct.textContent = Math.round((col / cols) * 100);
      if (col < cols) setTimeout(step, reduced ? 0 : 90);
      else setTimeout(() => {
        // reinicia el barrido en bucle suave
        cells.forEach((c) => c.el.classList.remove('s', 'hit'));
        started = false;
        setTimeout(run, 900);
      }, 5000);
    };
    step();
  };
  new IntersectionObserver(([e]) => { if (e.isIntersecting) run(); }, { threshold: 0.35 }).observe(grid);
}

// Corte geológico
const cut = document.getElementById('cut');
if (cut) {
  const out = document.getElementById('cutReadout');
  const show = (s) => {
    cut.querySelectorAll('.stratum').forEach((b) => b.classList.toggle('is-active', b === s));
    cut.classList.toggle('has-active', !!s);
    out.querySelector('b').textContent = s ? s.dataset.sensor : 'Selecciona una capa';
    out.querySelector('em').textContent = s ? `${s.querySelector('span').textContent} · profundidad ${s.dataset.depth}` : '';
  };
  cut.querySelectorAll('.stratum').forEach((s) => {
    s.addEventListener('mouseenter', () => show(s));
    s.addEventListener('focus', () => show(s));
    s.addEventListener('click', () => show(s));
  });
  cut.addEventListener('mouseleave', () => show(null));
}

// Formulario: abre el cliente de correo con los datos
const form = document.getElementById('contactForm');
form?.addEventListener('submit', (e) => {
  e.preventDefault();
  const d = new FormData(form);
  const body = `Nombre: ${d.get('nombre')}\nCorreo: ${d.get('correo')}\nProyecto: ${d.get('proyecto')}\n\n${d.get('mensaje')}`;
  location.href = `mailto:contacto@estrato.ai?subject=${encodeURIComponent('Solicitud de levantamiento · ' + d.get('proyecto'))}&body=${encodeURIComponent(body)}`;
  document.getElementById('formNote').textContent = 'Abriendo tu cliente de correo…';
});

document.getElementById('year').textContent = new Date().getFullYear();
