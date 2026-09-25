// ESTRATO — explorador 3D del volcán
// Terreno generado en Blender (estrato/blender/build_volcano.py) y exportado a GLB.
// Capas horneadas en COLOR_0: R = térmica, G = magnética, B = probabilidad IA.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const section = document.getElementById('explorar');
const canvas = document.getElementById('volcan');
const fallback = section.querySelector('.explorer__fallback');
const labelsEl = document.getElementById('labels');
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

// ---------------------------------------------------------------------------
// Configuración compartida con el script de Blender
const SIZE = 20;
const RES = 256;
const CRATER = new THREE.Vector2(0, 0);
const SURVEY = { x0: -7.6, x1: 7.6, z0: -7.2, z1: 7.2, spacing: 0.9, agl: 0.7 };

// Escala geográfica ficticia: 1 unidad = 500 m, cota base 1 200 m
const toEast = (x) => 512000 + x * 500;
const toNorth = (z) => 1623000 - z * 500;
const toElev = (h) => 1200 + h * 800;
const fmt = (n) => Math.round(n).toLocaleString('es-ES').replace(/\./g, ' ');

const LAYERS = [
  { name: 'Relieve', legend: 'linear-gradient(90deg,#3b3027,#5c4a3a,#7a6a5a,#a39888)', range: ['1 200 m', '5 100 m'], label: 'Pendiente' },
  { name: 'Topografía', legend: 'repeating-linear-gradient(90deg,#efe8dc 0 1px,#231d18 1px 12px)', range: ['Equidistancia 100 m', 'maestras 500 m'], label: 'Curva' },
  { name: 'Magnetometría', legend: 'linear-gradient(90deg,#233c47,#6f8a8c,#e9dfcf,#c77a4a,#9b3b22)', range: ['−400 nT', '+400 nT'], label: 'Anomalía' },
  { name: 'Térmico', legend: 'linear-gradient(90deg,#140c09,#4a1a10,#8f2a12,#e0772a,#f6e2a6)', range: ['15 °C', '435 °C'], label: 'Temp.' },
  { name: 'IA · anomalías', legend: 'linear-gradient(90deg,#3a332c,#6b5a45,#d6a24a,#ffd98a)', range: ['p = 0', 'p = 1'], label: 'Prob. IA' },
];

const HOTSPOTS = [
  {
    id: 'crater', x: 0, z: 0, lift: 0.35, color: '#e0772a', layer: 3,
    kicker: 'Punto 01 · Térmico', title: 'Cráter principal',
    text: 'Fumarolas activas y una superficie de más de 300 °C. La termografía aérea detecta cambios de temperatura antes de que sean visibles.',
    data: [['Temp. máxima', '≈ 420 °C'], ['Diámetro', '≈ 1 050 m'], ['Sensor', 'LWIR · dron']],
    view: { pos: [3.2, 7.6, 4.4], target: [0, 3.6, 0] },
  },
  {
    id: 'lava', x: 3.2, z: -2.45, lift: 0.2, color: '#c9542a', layer: 3,
    kicker: 'Punto 02 · Térmico', title: 'Canal de lava',
    text: 'Colada reciente que desciende por el flanco sureste. Su firma térmica residual permite estimar el volumen emitido.',
    data: [['Longitud', '≈ 4.2 km'], ['Temp. superficial', '120 – 260 °C'], ['Sensor', 'LWIR + LiDAR']],
    view: { pos: [8.6, 4.6, -6.8], target: [2.8, 1.6, -2.2] },
  },
  {
    id: 'cono', x: 4.6, z: 3.2, lift: 0.25, color: '#b9a488', layer: 1,
    kicker: 'Punto 03 · Relieve', title: 'Cono parásito',
    text: 'Centro eruptivo secundario en el flanco noreste. El LiDAR mide su deformación centímetro a centímetro entre vuelos.',
    data: [['Altura relativa', '≈ 380 m'], ['Deformación', '+2.1 cm / mes'], ['Sensor', 'LiDAR aéreo']],
    view: { pos: [9.2, 4.2, 7.4], target: [4.4, 1.2, 3.0] },
  },
  {
    id: 'mag', x: -4.8, z: -2.4, lift: 0.3, color: '#6f8a8c', layer: 2,
    kicker: 'Punto 04 · Magnetometría', title: 'Anomalía magnética M-1',
    text: 'Un dipolo intenso bajo el flanco oeste: probable intrusión de roca magnética o antiguo conducto de alimentación.',
    data: [['Amplitud', '+310 nT'], ['Profundidad estimada', '≈ 600 m'], ['Sensor', 'Magnetómetro de vapor de cesio']],
    view: { pos: [-11.5, 7.4, -8.8], target: [-4.4, 1.0, -2.0] },
  },
  {
    id: 'ia', x: 5.6, z: 5.8, lift: 0.3, color: '#d6a24a', layer: 4,
    kicker: 'Punto 05 · Inteligencia artificial', title: 'Objetivo IA A-2',
    text: 'El modelo combina magnetismo, temperatura y relieve y marca esta zona con alta probabilidad de alteración hidrotermal.',
    data: [['Probabilidad', 'p = 0.91'], ['Capas fusionadas', '4'], ['Modelo', 'Red convolucional 3D']],
    view: { pos: [10.4, 6.0, 11.2], target: [5.2, 0.8, 5.4] },
  },
];

const TOUR = [
  { view: { pos: [15, 9.5, 15], target: [0, 1.8, 0] }, layer: 0, kicker: 'Recorrido · 1/6', text: 'Un estratovolcán de 5 100 m, reconstruido a partir de vuelos de levantamiento.' },
  { hotspot: 'crater', kicker: 'Recorrido · 2/6', text: 'En el cráter, la termografía revela dónde el calor sale a la superficie.' },
  { hotspot: 'lava', kicker: 'Recorrido · 3/6', text: 'La colada aún conserva calor: su firma térmica cuenta cuándo y cuánto fluyó.' },
  { hotspot: 'mag', kicker: 'Recorrido · 4/6', text: 'Bajo la roca, el magnetómetro dibuja un cuerpo intrusivo invisible desde el aire.' },
  { view: { pos: [-4, 12.5, 13.5], target: [0, 1.0, 0] }, layer: 1, drone: true, kicker: 'Recorrido · 5/6', text: 'El dron vuela líneas paralelas a altura constante sobre el terreno.' },
  { hotspot: 'ia', kicker: 'Recorrido · 6/6', text: 'La IA fusiona todas las capas y señala dónde conviene mirar primero.' },
];

// ---------------------------------------------------------------------------
// Renderizador
let renderer;
try {
  renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
} catch (err) {
  showFallback();
}

function showFallback() {
  canvas.hidden = true;
  fallback.hidden = false;
  section.querySelectorAll('#enterBtn, #tourBtn, .hint').forEach((el) => (el.hidden = true));
}

if (renderer) init();

function init() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.05, 400);
  camera.position.set(15, 9.5, 15);

  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1.8, 0);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 2.2;
  controls.maxDistance = 34;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.rotateSpeed = 0.55;
  controls.zoomSpeed = 0.8;
  controls.autoRotateSpeed = 0.35;
  controls.enabled = false;
  controls.autoRotate = !reduced;
  controls.update();

  const sunDir = new THREE.Vector3(-0.55, 0.62, 0.55).normalize();
  const FOG = new THREE.Color('#a39482');

  // ---- Cielo ---------------------------------------------------------------
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(200, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: { uSun: { value: sunDir }, uFog: { value: null } },
      vertexShader: /* glsl */`
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uSun, uFog;
        varying vec3 vDir;
        void main() {
          float y = vDir.y;
          vec3 horizon = uFog;
          vec3 below = uFog * 0.8;
          vec3 up = pow(vec3(0.56, 0.58, 0.58), vec3(2.2));
          vec3 zenith = pow(vec3(0.33, 0.38, 0.41), vec3(2.2));
          vec3 c = y < 0.0 ? mix(horizon, below, smoothstep(0.0, -0.25, y))
                           : mix(mix(horizon, up, smoothstep(0.0, 0.25, y)), zenith, smoothstep(0.25, 0.9, y));
          float s = max(dot(vDir, uSun), 0.0);
          c += vec3(1.0, 0.72, 0.45) * (pow(s, 10.0) * 0.28 + pow(s, 300.0) * 0.9);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  sky.material.uniforms.uFog.value = FOG;
  sky.renderOrder = -1;
  scene.add(sky);

  // ---- Muestreo del campo de alturas --------------------------------------
  const N = RES + 1;
  const heights = new Float32Array(N * N);
  const dataField = new Float32Array(N * N * 3);

  function cell(x, z) {
    const fx = THREE.MathUtils.clamp(((x + SIZE / 2) / SIZE) * RES, 0, RES - 1e-4);
    const fz = THREE.MathUtils.clamp(((z + SIZE / 2) / SIZE) * RES, 0, RES - 1e-4);
    const i = Math.floor(fx), j = Math.floor(fz);
    return { i, j, u: fx - i, v: fz - j };
  }
  function heightAt(x, z) {
    const { i, j, u, v } = cell(x, z);
    const a = heights[j * N + i], b = heights[j * N + i + 1];
    const c = heights[(j + 1) * N + i], d = heights[(j + 1) * N + i + 1];
    return (a * (1 - u) + b * u) * (1 - v) + (c * (1 - u) + d * u) * v;
  }
  function dataAt(x, z, k) {
    const { i, j, u, v } = cell(x, z);
    const g = (ii, jj) => dataField[(jj * N + ii) * 3 + k];
    return (g(i, j) * (1 - u) + g(i + 1, j) * u) * (1 - v) + (g(i, j + 1) * (1 - u) + g(i + 1, j + 1) * u) * v;
  }
  const inside = (x, z) => Math.abs(x) < SIZE / 2 && Math.abs(z) < SIZE / 2;

  // Intersección rayo–terreno por marcha sobre el campo de alturas
  function rayTerrain(origin, dir) {
    let t = 0, prev = null;
    const p = new THREE.Vector3();
    for (let s = 0; s < 400; s++) {
      p.copy(dir).multiplyScalar(t).add(origin);
      if (inside(p.x, p.z)) {
        const above = p.y - heightAt(p.x, p.z);
        if (above < 0) {
          // refinamiento binario
          let lo = prev ?? t - 0.1, hi = t;
          for (let k = 0; k < 10; k++) {
            const mid = (lo + hi) / 2;
            p.copy(dir).multiplyScalar(mid).add(origin);
            if (p.y - heightAt(p.x, p.z) < 0) hi = mid; else lo = mid;
          }
          return p.copy(dir).multiplyScalar(hi).add(origin);
        }
      } else if (t > 80) break;
      prev = t;
      t += Math.max(0.03, t * 0.012);
    }
    return null;
  }

  function occluded(from, to) {
    const steps = 28;
    const p = new THREE.Vector3();
    for (let s = 2; s < steps - 1; s++) {
      p.lerpVectors(from, to, s / steps);
      if (inside(p.x, p.z) && heightAt(p.x, p.z) > p.y + 0.02) return true;
    }
    return false;
  }

  // ---- Terreno -------------------------------------------------------------
  const uniforms = {
    uTime: { value: 0 },
    uLayerA: { value: 0 },
    uLayerB: { value: 0 },
    uMix: { value: 1 },
    uSun: { value: sunDir },
    uFog: { value: FOG },
    uCam: { value: camera.position },
    uHover: { value: new THREE.Vector3(0, -99, 0) },
    uDrone: { value: new THREE.Vector3(0, -99, 0) },
    uSurvey: { value: 1 },
    uSurveyProgress: { value: -99 },
    uScan: { value: 0 },
  };

  const terrainMat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */`
      attribute vec4 color;
      varying vec3 vPos;
      varying vec3 vNormal;
      varying vec4 vData;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vPos = wp.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        vData = color;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime, uLayerA, uLayerB, uMix, uSurvey, uSurveyProgress, uScan;
      uniform vec3 uSun, uFog, uCam, uHover, uDrone;
      varying vec3 vPos;
      varying vec3 vNormal;
      varying vec4 vData;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float a = 0.5, s = 0.0;
        for (int i = 0; i < 4; i++) { s += a * vnoise(p); p *= 2.03; a *= 0.5; }
        return s;
      }
      float isoline(float v, float width) {
        float d = abs(fract(v - 0.5) - 0.5) / max(fwidth(v), 1e-4);
        return 1.0 - smoothstep(width - 0.5, width + 0.5, d);
      }
      vec3 ramp3(float t, vec3 a, vec3 b, vec3 c) {
        return t < 0.5 ? mix(a, b, t * 2.0) : mix(b, c, t * 2.0 - 1.0);
      }
      vec3 ramp5(float t, vec3 a, vec3 b, vec3 c, vec3 d, vec3 e) {
        t = clamp(t, 0.0, 1.0) * 4.0;
        if (t < 1.0) return mix(a, b, t);
        if (t < 2.0) return mix(b, c, t - 1.0);
        if (t < 3.0) return mix(c, d, t - 2.0);
        return mix(d, e, t - 3.0);
      }

      vec3 lighting(vec3 n) {
        float diff = max(dot(n, uSun), 0.0);
        vec3 amb = mix(vec3(0.16, 0.12, 0.09), vec3(0.50, 0.52, 0.52), n.y * 0.5 + 0.5) * 0.62;
        return amb + vec3(1.0, 0.88, 0.72) * diff * 1.15;
      }

      vec3 relief(vec3 p, vec3 n, vec4 d, out vec3 glow) {
        float h = p.y;
        float slope = 1.0 - n.y;
        float r = length(p.xz);
        float nz = fbm(p.xz * 1.1);
        float fine = vnoise(p.xz * 11.0);
        vec3 low = vec3(0.30, 0.28, 0.21);
        vec3 mid = vec3(0.27, 0.21, 0.16);
        vec3 ash = vec3(0.50, 0.46, 0.41);
        vec3 dark = vec3(0.12, 0.10, 0.09);
        vec3 c = mix(low, mid, smoothstep(0.1, 1.3, h + (nz - 0.5) * 0.7));
        c = mix(c, ash, smoothstep(1.7, 3.6, h + (nz - 0.5) * 0.9));
        float streak = vnoise(vec2(atan(p.z, p.x) * 22.0, r * 0.5));
        c = mix(c, ash * 1.12, smoothstep(0.55, 0.9, streak) * smoothstep(0.8, 2.6, h) * 0.55);
        c = mix(c, dark, smoothstep(0.22, 0.6, slope) * 0.75);
        float rim = smoothstep(0.55, 1.0, r) * (1.0 - smoothstep(1.05, 1.6, r));
        c = mix(c, vec3(0.62, 0.50, 0.30), rim * smoothstep(0.45, 0.7, nz) * 0.8);
        c = mix(c, vec3(0.19, 0.11, 0.08), 1.0 - smoothstep(0.55, 0.95, r));
        float lava = smoothstep(0.32, 0.6, d.r) * smoothstep(1.1, 1.5, r);
        c = mix(c, vec3(0.07, 0.06, 0.05), lava);
        c *= 0.82 + 0.32 * fine;
        float cracks = smoothstep(0.78, 0.97, 1.0 - abs(vnoise(p.xz * 7.0 + uTime * 0.03) * 2.0 - 1.0));
        float heat = smoothstep(0.62, 0.98, d.r);
        float pulse = 0.75 + 0.25 * sin(uTime * 1.7 + nz * 6.0);
        glow = vec3(1.0, 0.33, 0.07) * heat * (0.25 + cracks * 1.6) * pulse;
        return c;
      }

      vec3 layer(float L, vec3 p, vec3 n, vec4 d, vec3 lit, out vec3 emit) {
        vec3 glow;
        vec3 base = relief(p, n, d, glow);
        emit = vec3(0.0);
        if (L < 0.5) {
          emit = glow;
          return base * lit;
        }
        if (L < 1.5) {
          float minor = isoline(p.y / 0.125, 0.6);
          float major = isoline(p.y / 0.625, 1.1);
          vec3 c = mix(vec3(0.11, 0.09, 0.075), base * 0.9, 0.35) * (0.45 + 0.55 * lit);
          c = mix(c, vec3(0.91, 0.87, 0.80), minor * 0.38);
          c = mix(c, vec3(0.96, 0.92, 0.84), major * 0.9);
          return c;
        }
        if (L < 2.5) {
          vec3 c = ramp5(d.g, vec3(0.12, 0.22, 0.26), vec3(0.36, 0.46, 0.46), vec3(0.64, 0.58, 0.50), vec3(0.72, 0.42, 0.24), vec3(0.58, 0.20, 0.11));
          c *= 0.3 + 0.7 * lit;
          c = mix(c, vec3(0.09, 0.08, 0.07), isoline(d.g / 0.05, 0.5) * 0.35);
          return c;
        }
        if (L < 3.5) {
          vec3 c = ramp5(d.r, vec3(0.17, 0.12, 0.10), vec3(0.33, 0.13, 0.08), vec3(0.56, 0.16, 0.07), vec3(0.88, 0.47, 0.16), vec3(0.96, 0.89, 0.65));
          c *= 0.55 + 0.45 * lit;
          emit = c * smoothstep(0.45, 1.0, d.r) * 0.9;
          return c;
        }
        // IA
        float gray = dot(base * lit, vec3(0.3, 0.59, 0.11));
        vec3 c = mix(vec3(gray) * vec3(1.0, 0.94, 0.86), base * lit, 0.25) * 0.72;
        float pr = d.b;
        float hatch = step(0.5, fract((p.x + p.z) * 7.0 - uTime * 0.4));
        float fill = smoothstep(0.45, 0.85, pr);
        vec3 amber = vec3(0.84, 0.63, 0.29);
        c = mix(c, amber * (0.55 + 0.45 * lit), fill * (0.35 + 0.25 * hatch));
        c = mix(c, vec3(1.0, 0.85, 0.54), isoline(pr / 0.2, 0.7) * smoothstep(0.3, 0.6, pr));
        float r = length(p.xz);
        float ring = 1.0 - smoothstep(0.0, 0.12, abs(r - uScan));
        c += vec3(1.0, 0.8, 0.45) * ring * 0.45;
        emit = amber * fill * (0.25 + 0.2 * sin(uTime * 3.0 + r)) + vec3(1.0, 0.85, 0.5) * ring * smoothstep(0.4, 0.8, pr) * 0.8;
        return c;
      }

      void main() {
        vec3 n = normalize(vNormal);
        vec3 lit = lighting(n);
        vec3 eA, eB;
        vec3 cA = layer(uLayerA, vPos, n, vData, lit, eA);
        vec3 cB = layer(uLayerB, vPos, n, vData, lit, eB);
        // la nueva capa se expande desde el cráter
        float r = length(vPos.xz);
        float front = uMix * 18.0;
        float w = smoothstep(front - 1.2, front, r);
        vec3 col = mix(cB, cA, w) + mix(eB, eA, w);
        float edge = (1.0 - smoothstep(0.0, 0.25, abs(r - front))) * step(uMix, 0.999);
        col += vec3(0.95, 0.8, 0.55) * edge * 0.6;

        // líneas de vuelo del levantamiento
        if (uSurvey > 0.0) {
          float inArea = step(-7.6, vPos.x) * step(vPos.x, 7.6) * step(-7.25, vPos.z) * step(vPos.z, 7.25);
          float line = isoline((vPos.z + 7.2) / 0.9, 0.6);
          float tie = isoline((vPos.x + 7.6) / 3.8, 0.5) * 0.5;
          float flown = step(vPos.z, uSurveyProgress);
          float dash = 0.55 + 0.45 * step(0.5, fract(vPos.x * 1.2 - uTime * 0.8));
          vec3 lc = mix(vec3(0.93, 0.89, 0.82), vec3(0.98, 0.72, 0.36), flown);
          col = mix(col, lc, max(line * dash, tie) * inArea * uSurvey * (0.28 + 0.4 * flown));
        }

        // huella del sensor del dron
        float dd = length(vPos.xz - uDrone.xz);
        float foot = (1.0 - smoothstep(0.34, 0.4, dd)) * uSurvey;
        col = mix(col, vec3(1.0, 0.8, 0.5), foot * 0.18 + (1.0 - smoothstep(0.0, 0.04, abs(dd - 0.38))) * uSurvey * 0.6);

        // cursor
        float hd = length(vPos.xz - uHover.xz);
        float cur = 1.0 - smoothstep(0.0, 0.035, abs(hd - 0.3));
        cur += 1.0 - smoothstep(0.03, 0.05, hd);
        col = mix(col, vec3(1.0, 0.95, 0.88), clamp(cur, 0.0, 1.0) * 0.85);

        col = pow(max(col, 0.0), vec3(2.2));
        // niebla atmosférica y bordes del terreno
        float dist = length(uCam - vPos);
        float fog = smoothstep(16.0, 62.0, dist);
        float border = smoothstep(7.0, 9.8, max(abs(vPos.x), abs(vPos.z)));
        col = mix(col, uFog * 0.8, border);
        col = mix(col, uFog, fog);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });

  // Plano lejano que continúa el paisaje hasta el horizonte
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(400, 400).rotateX(-Math.PI / 2),
    new THREE.ShaderMaterial({
      uniforms: { uFog: { value: FOG }, uCam: { value: camera.position } },
      vertexShader: /* glsl */`
        varying vec3 vPos;
        void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vPos = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }`,
      fragmentShader: /* glsl */`
        uniform vec3 uFog, uCam;
        varying vec3 vPos;
        void main() {
          float f = smoothstep(10.0, 90.0, length(uCam - vPos));
          vec3 c = mix(uFog * 0.8, uFog, f);
          gl_FragColor = vec4(c, 1.0);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    }),
  );
  ground.position.y = -0.62;
  scene.add(ground);

  // ---- Texturas suaves para humo y nubes -----------------------------------
  function puffTexture() {
    const s = 128;
    const c = document.createElement('canvas');
    c.width = c.height = s;
    const g = c.getContext('2d');
    const grd = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.45, 'rgba(255,255,255,0.55)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    // grumos
    for (let i = 0; i < 28; i++) {
      const x = s / 2 + (Math.random() - 0.5) * s * 0.5, y = s / 2 + (Math.random() - 0.5) * s * 0.5;
      const r = s * (0.08 + Math.random() * 0.16);
      const gg = g.createRadialGradient(x, y, 0, x, y, r);
      gg.addColorStop(0, 'rgba(255,255,255,0.35)');
      gg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gg;
      g.fillRect(0, 0, s, s);
    }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.NoColorSpace;
    return t;
  }
  const puff = puffTexture();

  const particleVS = /* glsl */`
    attribute vec4 seed;
    uniform float uTime, uScale, uPixel;
    uniform vec3 uOrigin;
    uniform float uMode; // 0 = fumarola, 1 = nubes
    varying float vAlpha;
    varying float vAge;
    varying float vRot;
    void main() {
      vec3 p;
      float size;
      if (uMode < 0.5) {
        float life = 14.0 + seed.w * 8.0;
        float age = fract((uTime + seed.z * life) / life);
        vAge = age;
        float rise = pow(age, 0.8) * 7.5;
        vec2 wind = vec2(1.0, 0.35) * pow(age, 1.6) * 5.5;
        float swirl = age * 6.0 + seed.x * 6.283;
        p = uOrigin + vec3(wind.x + cos(swirl) * (0.2 + age * 0.9) * seed.y, rise, wind.y + sin(swirl) * (0.2 + age * 0.9) * seed.y);
        size = mix(0.7, 4.4, pow(age, 0.55)) * (0.7 + seed.y * 0.6);
        vAlpha = smoothstep(0.0, 0.08, age) * (1.0 - smoothstep(0.55, 1.0, age));
      } else {
        float drift = uTime * (0.03 + seed.w * 0.04);
        float ang = seed.x * 6.283 + drift * 0.08;
        float rad = 12.5 + seed.y * 22.0;
        p = vec3(cos(ang) * rad, -0.3 + seed.z * 1.6 + sin(uTime * 0.1 + seed.x * 9.0) * 0.1, sin(ang) * rad);
        size = 6.0 + seed.w * 8.0;
        vAge = 0.5;
        vAlpha = 0.5 * smoothstep(3.0, 10.0, length((modelViewMatrix * vec4(p, 1.0)).xyz));
      }
      vRot = seed.x * 6.283 + uTime * 0.05 * (seed.y - 0.5);
      vec4 mv = modelViewMatrix * vec4(p, 1.0);
      gl_Position = projectionMatrix * mv;
      gl_PointSize = size * uScale * uPixel / -mv.z;
      vAlpha *= smoothstep(0.3, 2.0, -mv.z);
    }`;
  const particleFS = /* glsl */`
    uniform sampler2D uMap;
    uniform vec3 uSun, uFog;
    uniform float uMode, uOpacity;
    varying float vAlpha;
    varying float vAge;
    varying float vRot;
    void main() {
      vec2 c = gl_PointCoord - 0.5;
      float cs = cos(vRot), sn = sin(vRot);
      vec2 uv = vec2(c.x * cs - c.y * sn, c.x * sn + c.y * cs) + 0.5;
      float a = texture2D(uMap, uv).a * vAlpha * uOpacity;
      if (a < 0.004) discard;
      float light = 0.72 + 0.4 * (0.5 - c.y) + 0.2 * (c.x * uSun.x);
      vec3 base = uMode < 0.5 ? mix(vec3(0.42, 0.36, 0.31), vec3(0.93, 0.90, 0.85), smoothstep(0.0, 0.35, vAge)) : vec3(0.92, 0.9, 0.86);
      vec3 col = base * light;
      col = pow(col, vec3(2.2));
      if (uMode > 0.5) col = mix(col, uFog * 1.1, 0.4);
      gl_FragColor = vec4(col, a);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`;

  function particles(count, mode, opacity) {
    const g = new THREE.BufferGeometry();
    const seeds = new Float32Array(count * 4);
    for (let i = 0; i < seeds.length; i++) seeds[i] = Math.random();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seeds, 4));
    const m = new THREE.ShaderMaterial({
      uniforms: {
        uTime: uniforms.uTime, uMap: { value: puff }, uSun: { value: sunDir }, uFog: { value: FOG },
        uScale: { value: 300 }, uPixel: { value: renderer.getPixelRatio() },
        uOrigin: { value: new THREE.Vector3(0, 3.6, 0) }, uMode: { value: mode }, uOpacity: { value: opacity },
      },
      vertexShader: particleVS,
      fragmentShader: particleFS,
      transparent: true,
      depthWrite: false,
    });
    const pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    return pts;
  }
  const smoke = particles(reduced ? 180 : 520, 0, 0.62);
  smoke.renderOrder = 3;
  const clouds = particles(90, 1, 0.42);
  clouds.renderOrder = 2;
  scene.add(clouds, smoke);

  // ---- Dron de levantamiento ------------------------------------------------
  const drone = new THREE.Group();
  const matBody = new THREE.MeshStandardMaterial({ color: '#e9e2d6', roughness: 0.5, metalness: 0.2 });
  const matDark = new THREE.MeshStandardMaterial({ color: '#2a2520', roughness: 0.6 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.05, 0.22), matBody);
  drone.add(body);
  const rotors = [];
  for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.015, 0.02), matDark);
    arm.position.set(x * 0.09, 0.01, z * 0.09);
    arm.rotation.y = Math.atan2(z, x) * -1;
    drone.add(arm);
    const rotor = new THREE.Mesh(new THREE.CircleGeometry(0.075, 20).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#efe8dc', transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
    rotor.position.set(x * 0.16, 0.035, z * 0.16);
    drone.add(rotor);
    rotors.push(rotor);
  }
  // sensor remolcado (magnetómetro tipo "bird")
  const bird = new THREE.Mesh(new THREE.CapsuleGeometry(0.018, 0.12, 4, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#c9a574', roughness: 0.4 }));
  bird.position.set(0, -0.3, 0.05);
  drone.add(bird);
  const tether = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -0.02, 0), new THREE.Vector3(0, -0.3, 0.05)]), new THREE.LineBasicMaterial({ color: '#efe8dc', transparent: true, opacity: 0.6 }));
  drone.add(tether);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 8), new THREE.MeshBasicMaterial({ color: '#ff8a3c' }));
  beacon.position.set(0, 0.04, -0.11);
  drone.add(beacon);
  // cono del sensor
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.38, 1, 32, 1, true), new THREE.MeshBasicMaterial({ color: '#f3c77e', transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
  scene.add(cone);
  drone.scale.setScalar(1.6);
  scene.add(drone);
  scene.add(new THREE.HemisphereLight('#b8b0a4', '#3a2e24', 1.4));
  const sunLight = new THREE.DirectionalLight('#ffe2bf', 2.2);
  sunLight.position.copy(sunDir).multiplyScalar(20);
  scene.add(sunLight);

  // Trayectoria en "cortacésped" que sigue el relieve
  const surveyPath = [];
  {
    let row = 0;
    for (let z = SURVEY.z0; z <= SURVEY.z1 + 1e-6; z += SURVEY.spacing, row++) {
      const a = row % 2 === 0 ? SURVEY.x0 : SURVEY.x1;
      const b = row % 2 === 0 ? SURVEY.x1 : SURVEY.x0;
      surveyPath.push(new THREE.Vector2(a, z), new THREE.Vector2(b, z));
    }
  }
  const segLen = [];
  let pathLength = 0;
  for (let i = 0; i < surveyPath.length - 1; i++) {
    const l = surveyPath[i].distanceTo(surveyPath[i + 1]);
    segLen.push(l);
    pathLength += l;
  }
  const droneState = { s: 0, speed: 1.5, pos: new THREE.Vector3(), prevY: 3 };
  function dronePoint(s, out) {
    s = ((s % pathLength) + pathLength) % pathLength;
    let i = 0;
    while (s > segLen[i]) { s -= segLen[i]; i++; }
    const a = surveyPath[i], b = surveyPath[i + 1];
    const t = s / segLen[i];
    out.set(a.x + (b.x - a.x) * t, 0, a.y + (b.y - a.y) * t);
    return out;
  }

  // ---- Carga del terreno ---------------------------------------------------
  let terrain = null;
  new GLTFLoader().load('assets/volcan.glb', (gltf) => {
    gltf.scene.traverse((o) => { if (o.isMesh && !terrain) terrain = o; });
    const geo = terrain.geometry;
    geo.computeVertexNormals();
    const pos = geo.attributes.position;
    const col = geo.attributes.color;
    for (let k = 0; k < pos.count; k++) {
      const i = Math.round(((pos.getX(k) + SIZE / 2) / SIZE) * RES);
      const j = Math.round(((pos.getZ(k) + SIZE / 2) / SIZE) * RES);
      heights[j * N + i] = pos.getY(k);
      if (col) {
        dataField[(j * N + i) * 3] = col.getX(k);
        dataField[(j * N + i) * 3 + 1] = col.getY(k);
        dataField[(j * N + i) * 3 + 2] = col.getZ(k);
      }
    }
    terrain.material = terrainMat;
    scene.add(gltf.scene);
    // ubicar humo en el fondo del cráter y los hotspots sobre el relieve
    smoke.material.uniforms.uOrigin.value.set(CRATER.x, heightAt(0, 0) + 0.1, CRATER.y);
    for (const h of HOTSPOTS) h.pos = new THREE.Vector3(h.x, heightAt(h.x, h.z) + h.lift, h.z);
    section.classList.add('is-ready');
  }, undefined, () => showFallback());

  // ---- Hotspots HTML -------------------------------------------------------
  for (const h of HOTSPOTS) {
    const b = document.createElement('button');
    b.className = 'hotspot';
    b.style.setProperty('--c', h.color);
    b.innerHTML = `<span class="hotspot__dot"></span><span class="hotspot__label">${h.title}</span>`;
    b.setAttribute('aria-label', `${h.title}: ver detalle`);
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      stopTour();
      if (!active) enter();
      focusHotspot(h);
    });
    labelsEl.appendChild(b);
    h.el = b;
  }

  // ---- Estado de capas -----------------------------------------------------
  const layerButtons = [...section.querySelectorAll('.layers button')];
  const legend = document.getElementById('legend');
  let currentLayer = 0;
  let mixAnim = null;
  function setLayer(L) {
    if (L === currentLayer) return;
    uniforms.uLayerA.value = currentLayer;
    uniforms.uLayerB.value = L;
    uniforms.uMix.value = 0;
    mixAnim = { t0: performance.now(), dur: reduced ? 1 : 1500 };
    currentLayer = L;
    layerButtons.forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.layer === L)));
    const info = LAYERS[L];
    legend.querySelector('.legend__name').textContent = info.name;
    legend.style.setProperty('--legend', info.legend);
    const ems = legend.querySelectorAll('.legend__range em');
    ems[0].textContent = info.range[0];
    ems[1].textContent = info.range[1];
    document.getElementById('rLabel').textContent = info.label;
    if (L === 4) uniforms.uScan.value = 0;
    pointerDirty = true;
  }
  layerButtons.forEach((b) => b.addEventListener('click', () => setLayer(+b.dataset.layer)));
  section.querySelector('.layers').addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const dir = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1;
    const L = (currentLayer + dir + LAYERS.length) % LAYERS.length;
    setLayer(L);
    layerButtons[L].focus();
  });

  const optSurvey = document.getElementById('optSurvey');
  const optDrone = document.getElementById('optDrone');
  const optSmoke = document.getElementById('optSmoke');
  const optRotate = document.getElementById('optRotate');
  optSurvey.addEventListener('change', () => (uniforms.uSurvey.value = optSurvey.checked ? 1 : 0));
  optDrone.addEventListener('change', () => { drone.visible = cone.visible = optDrone.checked; });
  optSmoke.addEventListener('change', () => (smoke.visible = optSmoke.checked));
  optRotate.addEventListener('change', () => (controls.autoRotate = optRotate.checked));

  // ---- Panel de información ------------------------------------------------
  const panel = document.getElementById('panel');
  function openPanel(h) {
    document.getElementById('panelKicker').textContent = h.kicker;
    document.getElementById('panelTitle').textContent = h.title;
    document.getElementById('panelText').textContent = h.text;
    const dl = document.getElementById('panelData');
    dl.innerHTML = '';
    const rows = [...h.data, ['Coordenadas', `${fmt(toEast(h.x))} E · ${fmt(toNorth(h.z))} N`], ['Elevación', `${fmt(toElev(h.pos.y - h.lift))} m`]];
    for (const [k, v] of rows) {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      dl.append(dt, dd);
    }
    const note = document.createElement('dt');
    note.style.gridColumn = '1 / -1';
    note.style.fontSize = '10px';
    note.textContent = 'Datos simulados con fines demostrativos.';
    dl.append(note);
    panel.hidden = false;
    HOTSPOTS.forEach((x) => x.el.classList.toggle('is-current', x === h));
  }
  function closePanel() {
    panel.hidden = true;
    HOTSPOTS.forEach((x) => x.el.classList.remove('is-current'));
  }
  document.getElementById('panelClose').addEventListener('click', closePanel);

  // ---- Vuelos de cámara ----------------------------------------------------
  let flight = null;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function flyTo(view, dur = 2400) {
    const toPos = new THREE.Vector3(...view.pos);
    const toTarget = new THREE.Vector3(...view.target);
    if (reduced) dur = 1;
    flight = {
      t0: performance.now(), dur,
      fromPos: camera.position.clone(), fromTarget: controls.target.clone(),
      toPos, toTarget,
      // arco: se eleva a mitad de camino para "sobrevolar"
      lift: Math.min(4, camera.position.distanceTo(toPos) * 0.18),
    };
  }
  function focusHotspot(h) {
    setLayer(h.layer);
    flyTo(h.view);
    openPanel(h);
  }

  // ---- Entrar / salir ------------------------------------------------------
  let active = false;
  function enter() {
    active = true;
    section.classList.add('is-active');
    lockOnSection();
    controls.enabled = true;
    controls.autoRotate = optRotate.checked;
    document.getElementById('hud').setAttribute('aria-hidden', 'false');
    document.getElementById('nav').classList.add('is-hidden');
    setTimeout(() => layerButtons[currentLayer].focus({ preventScroll: true }), 50);
  }
  // Desplaza hasta el explorador y bloquea el scroll de la página al terminar
  // (bloquear durante un scroll suave lo interrumpe a mitad de camino).
  function lockOnSection() {
    const lock = () => {
      if (!active) return;
      window.scrollTo({ top: section.offsetTop, behavior: 'instant' });
      document.body.classList.add('is-locked');
    };
    if (Math.abs(section.getBoundingClientRect().top) < 2 || reduced) return lock();
    let done = false;
    const finish = () => { if (!done) { done = true; removeEventListener('scrollend', finish); lock(); } };
    addEventListener('scrollend', finish);
    setTimeout(finish, 1200);
    window.scrollTo({ top: section.offsetTop, behavior: 'smooth' });
  }

  function exit() {
    active = false;
    stopTour();
    section.classList.remove('is-active');
    document.body.classList.remove('is-locked');
    controls.enabled = false;
    controls.autoRotate = !reduced;
    closePanel();
    uniforms.uHover.value.set(0, -99, 0);
    document.getElementById('hud').setAttribute('aria-hidden', 'true');
    document.getElementById('enterBtn').focus({ preventScroll: true });
  }
  document.getElementById('enterBtn').addEventListener('click', () => { enter(); flyTo({ pos: [11, 7.5, 12], target: [0, 1.8, 0] }); });
  document.getElementById('exitBtn').addEventListener('click', exit);
  document.getElementById('resetBtn').addEventListener('click', () => { closePanel(); flyTo({ pos: [15, 9.5, 15], target: [0, 1.8, 0] }); });
  addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (tour) stopTour();
      else if (!panel.hidden) closePanel();
      else if (active) exit();
    }
  });

  // ---- Recorrido guiado ----------------------------------------------------
  const caption = document.getElementById('caption');
  let tour = null;
  function startTour() {
    stopTour();
    if (!active) enter();
    section.classList.add('is-touring');
    tour = { i: -1, timer: 0 };
    optDrone.checked = true; drone.visible = cone.visible = true;
    nextStop();
  }
  function nextStop() {
    if (!tour) return;
    tour.i++;
    if (tour.i >= TOUR.length) {
      stopTour();
      flyTo({ pos: [15, 9.5, 15], target: [0, 1.8, 0] }, 3000);
      return;
    }
    const stop = TOUR[tour.i];
    closePanel();
    if (stop.hotspot) {
      const h = HOTSPOTS.find((x) => x.id === stop.hotspot);
      setLayer(h.layer);
      flyTo(h.view, 3000);
      HOTSPOTS.forEach((x) => x.el.classList.toggle('is-current', x === h));
    } else {
      setLayer(stop.layer);
      flyTo(stop.view, 3000);
    }
    caption.classList.remove('is-on');
    setTimeout(() => {
      if (!tour) return;
      caption.innerHTML = `<small>${stop.kicker}</small>${stop.text}`;
      caption.classList.add('is-on');
    }, 900);
    tour.timer = setTimeout(nextStop, 7600);
  }
  function stopTour() {
    if (!tour) return;
    clearTimeout(tour.timer);
    tour = null;
    section.classList.remove('is-touring');
    caption.classList.remove('is-on');
    HOTSPOTS.forEach((x) => x.el.classList.remove('is-current'));
  }
  document.getElementById('tourBtn').addEventListener('click', startTour);
  document.getElementById('tourBtn2').addEventListener('click', startTour);
  canvas.addEventListener('pointerdown', () => { if (tour && active) stopTour(); flight = null; });

  // ---- Puntero: lectura de coordenadas y doble clic para volar -------------
  const ndc = new THREE.Vector2();
  const ray = new THREE.Raycaster();
  let pointerDirty = false;
  canvas.addEventListener('pointermove', (e) => {
    if (!active) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    pointerDirty = true;
  });
  canvas.addEventListener('pointerleave', () => uniforms.uHover.value.set(0, -99, 0));
  canvas.addEventListener('dblclick', (e) => {
    if (!active) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = rayTerrain(ray.ray.origin, ray.ray.direction);
    if (!hit) return;
    const offset = camera.position.clone().sub(controls.target).setLength(5.5);
    offset.y = Math.max(offset.y, 2.4);
    flyTo({ pos: hit.clone().add(offset).toArray(), target: hit.toArray() }, 1800);
  });
  const rE = document.getElementById('rE'), rN = document.getElementById('rN'), rZ = document.getElementById('rZ'), rV = document.getElementById('rV');
  function updateReadout() {
    ray.setFromCamera(ndc, camera);
    const hit = rayTerrain(ray.ray.origin, ray.ray.direction);
    if (!hit) { uniforms.uHover.value.set(0, -99, 0); return; }
    uniforms.uHover.value.copy(hit);
    rE.textContent = fmt(toEast(hit.x));
    rN.textContent = fmt(toNorth(hit.z));
    rZ.textContent = `${fmt(toElev(hit.y))} m`;
    let v;
    switch (currentLayer) {
      case 0: {
        const e = 0.08;
        const dx = (heightAt(hit.x + e, hit.z) - heightAt(hit.x - e, hit.z)) / (2 * e);
        const dz = (heightAt(hit.x, hit.z + e) - heightAt(hit.x, hit.z - e)) / (2 * e);
        v = `${Math.round((Math.atan(Math.hypot(dx, dz) * 800 / 500) * 180) / Math.PI)}°`;
        break;
      }
      case 1: v = `${fmt(Math.round(toElev(hit.y) / 100) * 100)} m`; break;
      case 2: v = `${Math.round((dataAt(hit.x, hit.z, 1) - 0.5) * 800)} nT`; break;
      case 3: v = `${Math.round(15 + dataAt(hit.x, hit.z, 0) * 420)} °C`; break;
      default: v = `p = ${dataAt(hit.x, hit.z, 2).toFixed(2)}`;
    }
    rV.textContent = v;
  }

  // ---- Tamaño y visibilidad -----------------------------------------------
  function resize() {
    const w = section.clientWidth, h = section.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < 700 ? 52 : 40;
    camera.updateProjectionMatrix();
    const px = renderer.getPixelRatio();
    const scale = Math.min(h, w * 1.1) * 0.9;
    smoke.material.uniforms.uScale.value = scale;
    clouds.material.uniforms.uScale.value = scale;
    smoke.material.uniforms.uPixel.value = px;
    clouds.material.uniforms.uPixel.value = px;
  }
  new ResizeObserver(resize).observe(section);
  resize();

  let visible = false;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) loop.start();
  }, { rootMargin: '100px' }).observe(section);
  document.addEventListener('visibilitychange', () => { if (!document.hidden && visible) loop.start(); });
  canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); showFallback(); });

  // ---- Bucle ---------------------------------------------------------------
  let last = performance.now();
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3(), proj = new THREE.Vector3();
  let frame = 0;
  const loop = {
    running: false,
    start() { if (!this.running) { this.running = true; last = performance.now(); requestAnimationFrame(tick); } },
  };

  function tick(now) {
    if (!visible || document.hidden) { loop.running = false; return; }
    requestAnimationFrame(tick);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const t = (uniforms.uTime.value += reduced ? dt * 0.3 : dt);
    frame++;

    // transición de capa
    if (mixAnim) {
      const k = Math.min(1, (now - mixAnim.t0) / mixAnim.dur);
      uniforms.uMix.value = ease(k);
      if (k >= 1) { mixAnim = null; uniforms.uLayerA.value = uniforms.uLayerB.value; uniforms.uMix.value = 1; }
    }
    if (currentLayer === 4) uniforms.uScan.value = (uniforms.uScan.value + dt * 3.2) % 14;

    // vuelo de cámara
    if (flight) {
      const k = Math.min(1, (now - flight.t0) / flight.dur);
      const e = ease(k);
      camera.position.lerpVectors(flight.fromPos, flight.toPos, e);
      camera.position.y += Math.sin(Math.PI * e) * flight.lift;
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, e);
      if (k >= 1) flight = null;
    } else {
      controls.update();
    }
    // no atravesar el terreno
    if (inside(camera.position.x, camera.position.z)) {
      const minY = heightAt(camera.position.x, camera.position.z) + 0.45;
      if (camera.position.y < minY) camera.position.y = minY;
    }
    if (flight) camera.lookAt(controls.target);

    // dron
    if (drone.visible && terrain) {
      droneState.s += dt * droneState.speed;
      dronePoint(droneState.s, tmp);
      dronePoint(droneState.s + 0.25, tmp2);
      const ground = inside(tmp.x, tmp.z) ? heightAt(tmp.x, tmp.z) : 0;
      // siguiendo el relieve con suavizado
      const targetY = ground + SURVEY.agl;
      droneState.prevY += (targetY - droneState.prevY) * Math.min(1, dt * 3);
      drone.position.set(tmp.x, Math.max(droneState.prevY, ground + 0.35), tmp.z);
      tmp2.y = drone.position.y;
      drone.lookAt(tmp2);
      drone.rotateY(Math.PI);
      rotors.forEach((r, i) => (r.rotation.y += dt * (i % 2 ? 40 : -40)));
      beacon.visible = Math.sin(t * 8) > 0.4;
      const hAbove = drone.position.y - ground;
      cone.scale.set(1, hAbove, 1);
      cone.position.set(tmp.x, ground + hAbove / 2, tmp.z);
      uniforms.uDrone.value.copy(drone.position);
      uniforms.uSurveyProgress.value = tmp.z + 0.45;
    } else {
      uniforms.uDrone.value.set(0, -99, 999);
    }

    if (pointerDirty && active && terrain) { pointerDirty = false; updateReadout(); }

    renderer.render(scene, camera);

    // etiquetas
    if (terrain) {
      const w = canvas.clientWidth, h = canvas.clientHeight;
      for (const hs of HOTSPOTS) {
        proj.copy(hs.pos).project(camera);
        const behind = proj.z > 1;
        if (frame % 8 === 0) hs.hidden = behind || occluded(camera.position, hs.pos);
        const x = (proj.x * 0.5 + 0.5) * w, y = (-proj.y * 0.5 + 0.5) * h;
        hs.el.style.transform = `translate(${x - 9}px, ${y - 9}px)`;
        hs.el.classList.toggle('is-hidden', !!hs.hidden || x < -40 || x > w + 40 || y < -40 || y > h + 40);
      }
    }
  }

  // exponer para depuración y pruebas
  window.__estrato = { setLayer, startTour, stopTour, enter, exit, focusHotspot: (id) => focusHotspot(HOTSPOTS.find((h) => h.id === id)), camera, controls };
}
