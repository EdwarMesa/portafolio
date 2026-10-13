// Pruebas de regresión de la web de Muro (Playwright, Chromium sin interfaz).
// Uso: cd muro/web/pruebas && npm install && npm test
// Levanta su propio servidor estático sobre muro/ y no necesita red externa
// (las fuentes de Google se bloquean para que las métricas no dependan de la red).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const RAIZ = fileURLToPath(new URL('../../', import.meta.url));
const TIPOS = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png' };
const servidor = http.createServer(async (req, res) => {
  const ruta = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^(\.\.[/\\])+/, '');
  const archivo = join(RAIZ, ruta.endsWith('/') ? ruta + 'index.html' : ruta);
  try {
    const datos = await readFile(archivo);
    res.writeHead(200, { 'content-type': TIPOS[extname(archivo)] ?? 'application/octet-stream' });
    res.end(datos);
  } catch {
    res.writeHead(404).end('no encontrado');
  }
});
await new Promise((r) => servidor.listen(0, r));
const BASE = `http://localhost:${servidor.address().port}/web/`;

const resultados = [];
let fallos = 0;
async function prueba(nombre, fn) {
  const t = performance.now();
  try {
    const nota = await fn();
    resultados.push(`  ✓ ${nombre}${nota ? ` — ${nota}` : ''} (${Math.round(performance.now() - t)} ms)`);
  } catch (e) {
    fallos++;
    resultados.push(`  ✗ ${nombre}\n      ${e.message.split('\n')[0]}`);
  }
}
const afirmar = (cond, msg) => { if (!cond) throw new Error(msg); };

const navegador = await chromium.launch();
async function pagina(opciones = {}, ruta = '') {
  const ctx = await navegador.newContext({ viewport: { width: 1280, height: 860 }, acceptDownloads: true, ...opciones });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.abort());
  const p = await ctx.newPage();
  p.errores = [];
  p.on('pageerror', (e) => p.errores.push(e.message));
  p.on('console', (m) => m.type() === 'error' && !/ERR_FAILED|fonts/.test(m.text()) && p.errores.push(m.text()));
  await p.goto(BASE + ruta);
  await p.waitForSelector('html.listo');
  return p;
}
const abrir = async (p, id) => {
  await p.evaluate((id) => (location.hash = `#/fondo/${id}`), id);
  await p.waitForSelector(`.detalle[aria-label]`);
  await p.waitForTimeout(400);
};

await prueba('La portada carga todas las secciones sin errores', async () => {
  const p = await pagina();
  for (const s of ['.hero', '#novedades', '#categorias', '#colecciones', '#premium', '#para-ti', '#tendencias', '#gratis', '#lanzamiento', '.plus']) {
    afirmar(await p.$(s), `falta la sección ${s}`);
  }
  afirmar(p.errores.length === 0, `errores: ${p.errores.join(' | ')}`);
  await p.context().close();
});

await prueba('Los fondos programados no aparecen antes de su fecha', async () => {
  const p = await pagina({}, '?hoy=2026-10-13');
  const ids = await p.$$eval('[data-fondo]', (els) => els.map((e) => e.dataset.fondo));
  afirmar(!ids.includes('orbita-cero') && !ids.includes('ciudad-lluvia'), 'se muestran fondos no publicados');
  await p.goto(BASE + '?hoy=2026-11-02#/coleccion/lanzamiento-noviembre');
  await p.waitForSelector('.coleccion');
  const tras = await p.$$eval('.mosaico [data-fondo]', (els) => els.map((e) => e.dataset.fondo));
  afirmar(tras.includes('orbita-cero'), 'tras la fecha la colección debería mostrarse');
  await p.context().close();
});

await prueba('Abrir una tarjeta lleva al detalle con simulador', async () => {
  const p = await pagina();
  await p.click('#novedades .tarjeta__enlace');
  await p.waitForSelector('.detalle .simulador');
  afirmar(/#\/fondo\//.test(p.url()), 'la URL no cambió al detalle');
  await p.click('.segmentado [data-modo="inicio"]');
  afirmar(await p.$eval('.simulador', (e) => e.dataset.modo) === 'inicio', 'no cambia a pantalla de inicio');
  await p.click('[data-ratio="16:9"]');
  const recorte = await p.$eval('[data-recorte]', (e) => e.textContent);
  afirmar(/arriba y abajo/.test(recorte), `recorte 16:9 inesperado: ${recorte}`);
  await p.keyboard.press('Escape');
  await p.waitForFunction(() => document.getElementById('capa').hidden);
  await p.context().close();
  return recorte;
});

await prueba('Un fondo gratuito se descarga con su original', async () => {
  const p = await pagina();
  await abrir(p, 'cumbres');
  const [descarga] = await Promise.all([p.waitForEvent('download'), p.click('[data-descargar]')]);
  afirmar(descarga.suggestedFilename() === 'muro-cumbres.webp', `nombre: ${descarga.suggestedFilename()}`);
  await p.context().close();
});

await prueba('Un fondo prémium no se puede descargar ni "comprar" en la demo', async () => {
  const p = await pagina();
  await abrir(p, 'neon-sur');
  afirmar(!(await p.$('[data-descargar]')), 'no debe haber botón de descarga');
  await p.click('[data-comprar]');
  await p.waitForSelector('dialog.hoja--compra');
  const total = await p.$eval('.total strong', (e) => e.textContent);
  afirmar(/1,99/.test(total), `precio no visible antes de pagar: ${total}`);
  await p.click('[data-pagar]');
  await p.waitForSelector('.estado-pago');
  afirmar(/no integrados/.test(await p.textContent('.estado-pago h2')), 'falta el estado honesto de pago');
  await p.click('.estado-pago [data-cerrar]');
  await p.waitForFunction(() => !document.querySelector('dialog[open]'));
  afirmar(!(await p.$('[data-descargar]')), 'el contenido no debe desbloquearse');
  await p.context().close();
  return `total mostrado ${total}`;
});

await prueba('Los originales prémium no están publicados en la web', async () => {
  const p = await pagina();
  const estados = await p.evaluate(async () => {
    const r = await (await fetch('../catalogo/v2/catalogo.json')).json();
    const pagados = r.fondos.filter((f) => f.acceso !== 'gratis');
    const s = await Promise.all(pagados.map((f) => fetch(`../catalogo/v2/fondos/${f.id}.webp`).then((x) => x.status)));
    return { n: pagados.length, publicos: s.filter((x) => x === 200).length, conOriginal: pagados.filter((f) => f.original).length };
  });
  afirmar(estados.publicos === 0 && estados.conOriginal === 0, `originales pagados expuestos: ${JSON.stringify(estados)}`);
  await p.context().close();
  return `${estados.n} originales pagados, 0 accesibles`;
});

await prueba('Favoritos persisten tras recargar y aparecen en Perfil', async () => {
  const p = await pagina();
  await p.click('#gratis .tarjeta__fav');
  const id = await p.$eval('#gratis .tarjeta', (e) => e.dataset.fondo);
  await p.reload();
  await p.waitForSelector('html.listo');
  afirmar(await p.$eval(`[data-fav="${id}"]`, (b) => b.getAttribute('aria-pressed')) === 'true', 'el favorito no persistió');
  await p.evaluate(() => (location.hash = '#/perfil'));
  await p.waitForSelector('.perfil');
  afirmar(await p.$(`.perfil [data-fondo="${id}"]`), 'no aparece en Perfil');
  await p.context().close();
});

await prueba('Sin consentimiento no se guarda actividad; con él, hay recomendaciones', async () => {
  const p = await pagina();
  await abrir(p, 'saturnia');
  let vistos = await p.evaluate(() => JSON.parse(localStorage.getItem('muro.v2'))?.vistos?.length ?? 0);
  afirmar(vistos === 0, 'se guardó actividad sin consentimiento');
  await p.evaluate(() => (location.hash = '#/'));
  await p.waitForSelector('[data-activar-personalizar]');
  await p.click('[data-activar-personalizar]');
  await abrir(p, 'saturnia');
  vistos = await p.evaluate(() => JSON.parse(localStorage.getItem('muro.v2')).vistos.length);
  afirmar(vistos === 1, 'no se registró la vista con consentimiento');
  await p.reload();
  await p.waitForSelector('html.listo');
  await p.evaluate(() => (location.hash = '#/'));
  await p.waitForSelector('#para-ti');
  const titulo = await p.textContent('#para-ti .seccion__titulo');
  afirmar(/Porque te gustó/.test(titulo), `sin recomendaciones: ${titulo}`);
  await p.context().close();
  return titulo.trim();
});

await prueba('El filtro de categoría muestra solo el acceso elegido', async () => {
  const p = await pagina({}, '#/categoria/espacio');
  await p.waitForSelector('.filtros');
  await p.click('[data-filtro="gratis"]');
  const insignias = await p.$$eval('.mosaico .insignia', (els) => els.map((e) => e.textContent.trim()));
  afirmar(insignias.length > 0 && insignias.every((t) => t === 'Gratis'), `insignias: ${insignias}`);
  await p.context().close();
});

await prueba('Movimiento reducido activa el modo ligero', async () => {
  const p = await pagina({ reducedMotion: 'reduce' });
  afirmar(await p.evaluate(() => document.documentElement.dataset.rendimiento) === 'ligero', 'no se activó el modo ligero');
  await p.context().close();
});

await prueba('Volver del detalle conserva la posición en la portada', async () => {
  const p = await pagina();
  await p.evaluate(() => document.querySelector('#premium').scrollIntoView());
  await p.waitForTimeout(500);
  const antes = await p.evaluate(() => scrollY);
  // Clic por JS: p.click() desplazaría la página antes de pulsar y falsearía la medida.
  await p.$eval('#premium .tarjeta__enlace', (a) => a.click());
  await p.waitForSelector('.detalle');
  await p.goBack();
  await p.waitForFunction(() => document.getElementById('capa').hidden);
  const despues = await p.evaluate(() => scrollY);
  afirmar(Math.abs(antes - despues) < 4, `scroll ${antes} → ${despues}`);
  await p.context().close();
});

// ---------- Rendimiento (medido, CPU ralentizada 4×) ----------
let metricas = null;
await prueba('Rendimiento: CLS < 0,1 y scroll sin tirones largos', async () => {
  const p = await pagina({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await p.evaluate(() => {
    window.__cls = 0; window.__largas = [];
    new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) window.__cls += e.value; }))
      .observe({ type: 'layout-shift', buffered: true });
    new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__largas.push(e.duration)))
      .observe({ type: 'longtask', buffered: false });
  });
  const lcp = await p.evaluate(() => new Promise((r) => new PerformanceObserver((l) => {
    const e = l.getEntries(); r(Math.round(e[e.length - 1].startTime));
  }).observe({ type: 'largest-contentful-paint', buffered: true })));
  const cuadros = await p.evaluate(async () => {
    const tiempos = [];
    let ultimo = performance.now();
    let activo = true;
    const medir = (t) => { tiempos.push(t - ultimo); ultimo = t; if (activo) requestAnimationFrame(medir); };
    requestAnimationFrame(medir);
    const alto = document.documentElement.scrollHeight;
    for (let y = 0; y < alto; y += 60) { scrollTo(0, y); await new Promise((r) => requestAnimationFrame(r)); }
    activo = false;
    return tiempos;
  });
  const res = await p.evaluate(() => ({ cls: window.__cls, largas: window.__largas }));
  const media = cuadros.reduce((a, b) => a + b, 0) / cuadros.length;
  const p95 = [...cuadros].sort((a, b) => a - b)[Math.floor(cuadros.length * 0.95)];
  metricas = {
    lcp_ms: lcp, cls: +res.cls.toFixed(4), cuadros: cuadros.length,
    fps_medio: +(1000 / media).toFixed(1), cuadro_p95_ms: +p95.toFixed(1),
    cuadros_mayores_50ms: cuadros.filter((c) => c > 50).length,
    tareas_largas: res.largas.length, tarea_larga_max_ms: Math.round(Math.max(0, ...res.largas)),
  };
  afirmar(res.cls < 0.1, `CLS ${res.cls}`);
  await p.context().close();
  return JSON.stringify(metricas);
});

await navegador.close();
servidor.close();
console.log(`\nMuro web · pruebas de regresión\n${resultados.join('\n')}\n\n${fallos ? `${fallos} fallo(s)` : 'Todo correcto'}`);
process.exit(fallos ? 1 : 0);
