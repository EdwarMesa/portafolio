"""Genera el catálogo v2 de Muro (datos de demostración).

Todos los fondos son originales y se crean por código. Las escenas con
profundidad se exportan además por capas para el parallax de la web.

Salida (muro/catalogo/v2/):
    vistas/<id>.webp        720×1600, vista previa pública (todos)
    miniaturas/<id>.webp    360×800 (todos)
    capas/<id>-<n>.webp     720×1600 RGBA, solo escenas con profundidad
    fondos/<id>.webp        1080×2400, original descargable (SOLO gratuitos)
    catalogo.json
Los originales prémium se escriben en herramientas/salida-privada/ (ignorada
por git): en producción se suben al bucket privado, nunca a la web pública.

Uso: python3 muro/herramientas/generar_catalogo_v2.py
"""

import json
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generar_fondos as v1  # noqa: E402  (estilos minimalistas de la v1)

W, H = 1080, 2400
VISTA = (720, 1600)
MINI = (360, 800)
RAIZ = Path(__file__).resolve().parent.parent
SALIDA = RAIZ / "catalogo" / "v2"
PRIVADA = Path(__file__).resolve().parent / "salida-privada"

Y, X = np.mgrid[0:H, 0:W].astype(np.float32)
XN, YN = X / W, Y / H


# ---------- utilidades ----------

def rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def suave(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def borde(d, px=1.5):
    return np.clip(0.5 - d / px, 0, 1)


def degradado(paradas):
    """Degradado vertical: paradas = [(posición 0..1, '#hex'), ...]."""
    img = np.empty((H, W, 3), np.float32)
    img[:] = rgb(paradas[0][1])
    for (p0, c0), (p1, c1) in zip(paradas, paradas[1:]):
        t = suave((YN - p0) / max(p1 - p0, 1e-6))[..., None]
        img = np.where((YN >= p0)[..., None], rgb(c0) * (1 - t) + rgb(c1) * t, img)
    return img


def ruido(rng, escala, octavas=4):
    """Ruido suave (value noise) en 0..1."""
    total = np.zeros((H, W), np.float32)
    amp, peso = 1.0, 0.0
    for o in range(octavas):
        n = max(2, int(escala * 2 ** o))
        base = rng.random((n * 3, n), dtype=np.float32) * 255
        capa = Image.fromarray(base.astype(np.uint8)).resize((W, H), Image.BICUBIC)
        total += np.asarray(capa, np.float32) / 255 * amp
        peso += amp
        amp *= 0.5
    return total / peso


def cresta(rng, base, amplitud, frecuencia, rugosidad=0.35):
    """Altura (en fracción de H) de una cresta montañosa por columna."""
    x = XN[0]
    h = np.zeros(W, np.float32)
    amp, f = amplitud, frecuencia
    for _ in range(6):
        fase = rng.uniform(0, math.tau)
        h += amp * np.sin(x * math.tau * f + fase)
        amp *= rugosidad + 0.2
        f *= 2.1
    return base - h


class Escena:
    """Acumula capas RGBA y produce la imagen plana."""

    def __init__(self, fondo):
        self.capas = [(fondo.astype(np.float32), np.ones((H, W), np.float32))]

    def nueva(self):
        self.capas.append((np.zeros((H, W, 3), np.float32), np.zeros((H, W), np.float32)))

    def pintar(self, mascara, color):
        """Pinta en la capa actual (color: '#hex' o array HxWx3)."""
        img, a = self.capas[-1]
        c = rgb(color) if isinstance(color, str) else color
        m = np.clip(mascara, 0, 1)[..., None]
        img[:] = img * (1 - m) + c * m
        a[:] = a + (1 - a) * m[..., 0]

    def plana(self):
        out = np.zeros((H, W, 3), np.float32)
        for img, a in self.capas:
            out = out * (1 - a[..., None]) + img * a[..., None]
        return out


def grano(img, rng, fuerza=2.4):
    return img + rng.normal(0, fuerza, (H, W))[..., None]


# ---------- escenas por categoría ----------

def cyberpunk(p, rng):
    e = Escena(degradado([(0, p["cielo"][0]), (0.45, p["cielo"][1]), (0.7, p["cielo"][2])]))
    # sol sintético con franjas
    cx, cy, r = 0.5 * W, 0.43 * H, 0.3 * W
    d = np.hypot(X - cx, Y - cy)
    halo = np.exp(-((d - r).clip(0) / (0.18 * W)) ** 2) * 0.35
    e.pintar(halo, p["sol"][1])
    t = suave((Y - (cy - r)) / (2 * r))
    color_sol = rgb(p["sol"][0]) * (1 - t[..., None]) + rgb(p["sol"][1]) * t[..., None]
    franja = np.ones_like(Y)
    for i in range(7):
        y0 = cy + r * (0.05 + i * 0.13)
        grosor = 3 + i * 4.5
        franja *= 1 - borde(np.abs(Y - y0) - grosor / 2)
    e.pintar(borde(d - r) * franja, color_sol)
    # estrellas tenues
    est = rng.random((H, W)) > 0.9994
    e.pintar(est * (YN < 0.4) * 0.7, "#ffffff")

    def horizonte(base, alto_max, ancho_min, ancho_max, color, ventanas, semilla_luz):
        h = np.zeros(W, np.float32)
        x = 0
        while x < W:
            ancho = int(rng.uniform(ancho_min, ancho_max))
            h[x:x + ancho] = base - rng.uniform(0.15, 1) * alto_max
            if rng.random() < 0.25:  # antena
                c = x + ancho // 2
                h[c:c + 3] -= 0.025
            x += ancho
        edificio = Y > h[None, :] * H
        e.pintar(edificio.astype(np.float32), color)
        celda_x, celda_y = (X // 16).astype(np.int64), (Y // 24).astype(np.int64)
        azar = ((celda_x * 73856093) ^ (celda_y * 19349663) ^ semilla_luz) % 1000 / 1000
        ventana = edificio & (X % 16 < 7) & (Y % 24 < 11) & (azar > 1 - ventanas) & (Y > h[None, :] * H + 18)
        tono = np.where((azar * 7 % 1 > 0.5)[..., None], rgb(p["neon"][0]), rgb(p["neon"][1]))
        e.pintar(ventana * 0.85, tono)

    e.nueva()
    horizonte(0.66, 0.2, 40, 110, p["ciudad"][0], 0.08, 11)
    e.nueva()
    horizonte(0.74, 0.3, 70, 180, p["ciudad"][1], 0.16, 29)
    # suelo con rejilla en perspectiva
    suelo = YN > 0.74
    e.pintar(suelo.astype(np.float32), p["ciudad"][1])
    prof = (YN - 0.74).clip(1e-4)
    filas = np.abs(np.sin(1 / (prof * 9 + 0.05) * 6)) < 0.08 + prof * 0.4
    cols = np.abs(((XN - 0.5) / (prof + 0.02) * 0.6) % 1 - 0.5) < 0.02 + prof * 0.05
    e.pintar(suelo * (filas | cols) * suave(prof * 5) * 0.8, p["neon"][0])
    return e


def espacio(p, rng):
    fondo = degradado([(0, p["fondo"][0]), (1, p["fondo"][1])])
    n = ruido(rng, 3, 5)
    n2 = ruido(rng, 2, 4)
    neb = suave((n - 0.42) * 3)[..., None]
    fondo = fondo * (1 - neb * 0.75) + (rgb(p["nebulosa"][0]) * (1 - n2[..., None]) + rgb(p["nebulosa"][1]) * n2[..., None]) * neb * 0.75
    e = Escena(fondo)
    est = np.zeros((H, W), np.float32)
    pos = rng.integers(0, [H, W], size=(900, 2))
    est[pos[:, 0], pos[:, 1]] = rng.uniform(0.3, 1, 900)
    brillo = np.asarray(Image.fromarray((est * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.1)), np.float32) / 255
    e.pintar(np.clip(brillo * 4 + est, 0, 1), "#ffffff")

    e.nueva()
    cx, cy, r = p["planeta"][0] * W, p["planeta"][1] * H, p["planeta"][2] * W
    dx, dy = (X - cx) / r, (Y - cy) / r
    d2 = dx * dx + dy * dy
    dentro = d2 < 1
    nz = np.sqrt(np.clip(1 - d2, 0, 1))
    luz = np.clip(-0.55 * dx - 0.45 * dy + 0.7 * nz, 0, 1)
    bandas = 0.5 + 0.5 * np.sin(dy * 9 + np.sin(dx * 3) * 0.6)
    base = rgb(p["superficie"][0]) * (1 - bandas[..., None]) + rgb(p["superficie"][1]) * bandas[..., None]
    color = base * (0.08 + 0.92 * luz[..., None])
    # anillo inclinado (la mitad trasera queda tapada por el planeta)
    rx, ry = (X - cx) / (r * 2.1), (Y - cy) / (r * 0.42)
    da = np.sqrt(rx * rx + ry * ry)
    anillo = (borde(np.abs(da - 0.8) * r * 0.4 - 0.12 * r * 0.4)) * 0.85
    detras = (Y < cy) & dentro
    e.pintar(anillo * ~detras, p["anillo"])
    e.pintar(borde((np.sqrt(d2) - 1) * r), color)
    e.pintar(anillo * (Y >= cy) * dentro * 0.9, p["anillo"])
    # atmósfera
    e.pintar(np.exp(-((np.sqrt(d2) - 1).clip(0) * 9) ** 2) * (~dentro) * 0.5 * luz.max(), p["superficie"][1])

    e.nueva()
    mx, my, mr = (1 - p["planeta"][0]) * W, 0.8 * H, 0.06 * W
    md = np.hypot(X - mx, Y - my)
    mluz = np.clip(-(X - mx) / mr * 0.6 + 0.5, 0.1, 1)
    e.pintar(borde(md - mr), rgb(p["anillo"]) * mluz[..., None] * 0.9)
    return e


def naturaleza(p, rng):
    e = Escena(degradado([(0, p["cielo"][0]), (0.55, p["cielo"][1])]))
    sx, sy = p["sol"][0] * W, p["sol"][1] * H
    ds = np.hypot(X - sx, Y - sy)
    e.pintar(np.exp(-(ds / (0.35 * W)) ** 2) * 0.55, p["luz"])
    e.pintar(borde(ds - 0.06 * W), p["luz"])
    crestas = p["montes"]
    n = len(crestas)
    for i, color in enumerate(crestas):
        if i in (2, n - 1):
            e.nueva()
        h = cresta(rng, 0.42 + i * 0.12, 0.05 - i * 0.004, 0.6 + i * 0.25)
        if i == n - 1:  # pinos en la cresta más cercana
            dientes = np.abs((XN[0] * 46 + rng.random()) % 1 - 0.5) * 2
            alturas = np.repeat(rng.uniform(0.01, 0.045, 47), W // 46 + 1)[:W]
            h = h - (1 - dientes) * alturas
        e.pintar(borde((h[None, :] - YN) * H), color)
        niebla = np.exp(-(((YN - (h.mean() + 0.06)) / 0.05) ** 2)) * 0.28
        if i < n - 1:
            e.pintar(niebla, p["cielo"][1])
    return e


def cinematico(p, rng):
    horiz = 0.58
    e = Escena(degradado([(0, p["cielo"][0]), (0.35, p["cielo"][1]), (horiz, p["cielo"][2])]))
    sx, sy, sr = 0.5 * W, (horiz - 0.035) * H, 0.1 * W
    ds = np.hypot(X - sx, Y - sy)
    e.pintar(np.exp(-(ds / (0.45 * W)) ** 2) * 0.5, p["sol"])
    e.pintar(borde(ds - sr) * (YN < horiz), p["sol"])
    e.nueva()
    mar = degradado([(horiz, p["mar"][0]), (1, p["mar"][1])])
    e.pintar((YN >= horiz).astype(np.float32), mar)
    prof = (YN - horiz).clip(0)
    destello = (np.sin(Y / (2 + prof * 60) * 3 + np.sin(X / 40) * 2) > 0.55) * np.exp(-((X - sx) / (sr * (1 + prof * 6))) ** 2)
    e.pintar(destello * (YN > horiz + 0.003) * np.exp(-prof * 4) * 0.7, p["sol"])
    e.nueva()
    dx = np.abs(XN[0] - p["lado"])
    h = 0.4 + 1.6 * dx ** 1.5 + (cresta(rng, 0, 0.006, 4) * (1 - dx * 2).clip(0))
    e.pintar(borde((h[None, :] - YN) * H), p["roca"])
    return e


def arquitectura(p, rng):
    fondo = degradado([(0, p["luz"][0]), (1, p["luz"][1])])
    e = Escena(fondo)
    vx, vy = 0.5 * W, 0.56 * H
    n = 8
    for k in reversed(range(n)):
        if k == 2 or k == 0:
            e.nueva()
        s = 0.8 ** k
        r = 0.36 * W * s
        yc = vy - 0.08 * H * s
        dx = np.abs(X - vx)
        d = np.where(Y >= yc, dx - r, np.hypot(X - vx, Y - yc) - r)
        t = k / (n - 1)
        muro = rgb(p["muro"][0]) * (1 - t) + rgb(p["muro"][1]) * t
        sombra = 0.82 + 0.18 * (1 - np.clip(np.abs(X - vx) / (W * 0.6), 0, 1))
        suelo = Y > vy + 0.42 * H * s
        color = muro * sombra[..., None]
        color = np.where(suelo[..., None], color * 0.82, color)
        e.pintar(borde(-d), color)
        # canto interior iluminado
        e.pintar(borde(np.abs(d) - 2.5 * s - 1) * 0.5, p["canto"])
    return e


def lujo(p, rng):
    base = degradado([(0, p["fondo"][0]), (1, p["fondo"][1])])
    d0 = np.hypot(X - 0.3 * W, Y - 0.25 * H)
    base += (np.exp(-(d0 / (0.6 * W)) ** 2) * 18)[..., None]
    e = Escena(base)
    cx, cy = p["centro"][0] * W, p["centro"][1] * H
    d = np.hypot(X - cx, Y - cy)
    ang = np.arctan2(Y - cy, X - cx)
    brillo = 0.5 + 0.5 * np.cos(ang - 2.3)
    oro = rgb(p["oro"][0]) * (1 - brillo[..., None]) + rgb(p["oro"][1]) * brillo[..., None]
    for i, (r, g) in enumerate([(0.42, 2.2), (0.36, 1.1), (0.305, 0.8)]):
        e.pintar(borde(np.abs(d - r * W) - g) * (0.95 - i * 0.2), oro)
    luna = borde(d - 0.25 * W) * (1 - borde(np.hypot(X - cx - 0.08 * W, Y - cy + 0.05 * W) - 0.25 * W))
    e.pintar(luna * 0.92, oro)
    e.pintar(borde(np.abs(Y - 0.86 * H) - 0.6) * (np.abs(XN - 0.5) < 0.18) * 0.7, oro)
    return e


def abstracto(p, rng):
    e = Escena(degradado([(0, p["fondo"][0]), (1, p["fondo"][1])]))
    campo = np.zeros((H, W), np.float32)
    acum = np.zeros((H, W, 3), np.float32)
    for i, color in enumerate(p["manchas"]):
        bx, by = rng.uniform(0.25, 0.75) * W, rng.uniform(0.3, 0.7) * H
        br = rng.uniform(0.22, 0.32) * W
        f = br * br / ((X - bx) ** 2 + (Y - by) ** 2 + 1)
        campo += f
        acum += f[..., None] * rgb(color)
    color = acum / campo[..., None].clip(1e-6)
    e.nueva()
    e.pintar(suave((campo - 0.9) * 2.2), color)
    brillo = suave((campo - 1.6) * 0.8) * 0.18
    e.pintar(brillo, "#ffffff")
    return e


def oscuro(p, rng):
    e = Escena(degradado([(0, p["fondo"][0]), (1, p["fondo"][1])]))
    lx, ly = p["luz_pos"][0] * W, p["luz_pos"][1] * H
    d = np.hypot((X - lx) * 1.0, (Y - ly) * 0.55)
    e.pintar(np.exp(-(d / (0.42 * W)) ** 2) * 0.55, p["luz"])
    e.pintar(borde(np.abs(X - lx) - 0.6) * suave(1 - np.abs(YN - p["luz_pos"][1]) * 3) * 0.6, p["luz"])
    return e


def minimal(p, rng, semilla):
    datos = v1.ESTILOS[p["estilo"]]({"colores": p["colores"]}, semilla=semilla)
    return Escena(np.asarray(datos, np.float32))


ESCENAS = {
    "cyberpunk": cyberpunk, "espacio": espacio, "naturaleza": naturaleza,
    "cinematico": cinematico, "arquitectura": arquitectura, "lujo": lujo,
    "abstracto": abstracto, "oscuro": oscuro,
}


# ---------- catálogo de demostración ----------
# precio en USD; acceso: gratis | premium | suscripcion. DATOS DE DEMOSTRACIÓN.

def F(id_, nombre, categoria, escena, paleta, acceso="gratis", precio=0, coleccion=None,
      etiquetas=(), publicado="2026-10-01", destacado=False, descripcion=""):
    return dict(id=id_, nombre=nombre, categoria=categoria, escena=escena, paleta=paleta,
                acceso=acceso, precio=precio, coleccion=coleccion, etiquetas=list(etiquetas),
                publicado=publicado, destacado=destacado, descripcion=descripcion)


FONDOS = [
    # Cyberpunk
    F("neon-sur", "Neón Sur", "cyberpunk", "cyberpunk", dict(
        cielo=["#0b0221", "#3b0a57", "#ff3d7f"], sol=["#ffe66d", "#ff2bd6"],
        ciudad=["#1a0b2e", "#07020f"], neon=["#00e5ff", "#ff2bd6"]),
      "premium", 1.99, "neon-nocturno", ["neón", "ciudad", "synthwave"], "2026-10-10", True,
      "Un sol sintético se hunde tras la ciudad. Tres capas de profundidad."),
    F("distrito-9", "Distrito 9", "cyberpunk", "cyberpunk", dict(
        cielo=["#020617", "#0c2a4d", "#16c7c7"], sol=["#b8fff9", "#00b3ff"],
        ciudad=["#05162b", "#010711"], neon=["#00ffd0", "#ffb000"]),
      "premium", 1.99, "neon-nocturno", ["neón", "ciudad", "azul"], "2026-10-08"),
    F("aurora-roja", "Aurora Roja", "cyberpunk", "cyberpunk", dict(
        cielo=["#12000a", "#5a0014", "#ff6a3d"], sol=["#ffd36e", "#ff2e2e"],
        ciudad=["#24000c", "#0a0004"], neon=["#ff4d6d", "#ffd36e"]),
      "suscripcion", 0, "neon-nocturno", ["neón", "rojo"], "2026-09-28"),
    F("pulso", "Pulso", "cyberpunk", "cyberpunk", dict(
        cielo=["#050505", "#1d0b3a", "#8a2be2"], sol=["#ff00ff", "#5b00ff"],
        ciudad=["#0f0620", "#030108"], neon=["#c77dff", "#00f5d4"]),
      "gratis", 0, "bienvenida", ["neón", "violeta"], "2026-09-20"),
    # Espacio
    F("saturnia", "Saturnia", "espacio", "espacio", dict(
        fondo=["#03040b", "#0b1026"], nebulosa=["#4b2a8a", "#1f6fb2"],
        planeta=[0.42, 0.42, 0.24], superficie=["#c9a37a", "#f2e2c4"], anillo="#e8d9bd"),
      "premium", 1.49, "orbitas", ["planeta", "anillos"], "2026-10-11", True,
      "Un gigante anillado sobre una nebulosa violeta."),
    F("azul-profundo", "Azul Profundo", "espacio", "espacio", dict(
        fondo=["#000208", "#03132b"], nebulosa=["#0b3d91", "#11b5c9"],
        planeta=[0.6, 0.36, 0.2], superficie=["#1b4f8a", "#9ad7ff"], anillo="#bfe6ff"),
      "gratis", 0, "orbitas", ["planeta", "azul"], "2026-10-02"),
    F("ceniza-estelar", "Ceniza Estelar", "espacio", "espacio", dict(
        fondo=["#050304", "#1a0d0a"], nebulosa=["#8a2c14", "#d9822b"],
        planeta=[0.5, 0.5, 0.26], superficie=["#5e2a1a", "#e3a56b"], anillo="#f5cfa0"),
      "suscripcion", 0, "orbitas", ["planeta", "naranja"], "2026-09-25"),
    F("eclipse", "Eclipse", "espacio", "espacio", dict(
        fondo=["#000000", "#07070d"], nebulosa=["#1c1c3a", "#3a2a5e"],
        planeta=[0.5, 0.4, 0.22], superficie=["#2a2a35", "#8a8aa0"], anillo="#a8a8c0"),
      "premium", 0.99, "orbitas", ["oscuro", "planeta"], "2026-09-18"),
    # Naturaleza
    F("cumbres", "Cumbres", "naturaleza", "naturaleza", dict(
        cielo=["#f5d0a9", "#f7e7d3"], sol=[0.68, 0.24], luz="#fff3dc",
        montes=["#c9b6b0", "#9c8a95", "#6b5d73", "#3d3550", "#1d1a2b"]),
      "gratis", 0, "cumbres", ["montaña", "amanecer"], "2026-10-09", True,
      "Amanecer entre crestas, con niebla entre los valles."),
    F("bosque-boreal", "Bosque Boreal", "naturaleza", "naturaleza", dict(
        cielo=["#a8d5e2", "#e9f5f2"], sol=[0.3, 0.2], luz="#ffffff",
        montes=["#a9c5c0", "#7ba39a", "#4f7d72", "#2e584f", "#12302b"]),
      "gratis", 0, "cumbres", ["bosque", "pinos"], "2026-10-05"),
    F("valle-lila", "Valle Lila", "naturaleza", "naturaleza", dict(
        cielo=["#2b2350", "#d9a7c7"], sol=[0.5, 0.33], luz="#ffe1f0",
        montes=["#b48bb0", "#8a6596", "#5e4677", "#392a56", "#1b1430"]),
      "premium", 1.49, "cumbres", ["montaña", "crepúsculo"], "2026-09-30"),
    F("niebla", "Niebla", "naturaleza", "naturaleza", dict(
        cielo=["#cfd6d8", "#eef1f1"], sol=[0.5, 0.18], luz="#ffffff",
        montes=["#c3cacb", "#a3abad", "#7f888b", "#566064", "#2c3437"]),
      "suscripcion", 0, "cumbres", ["niebla", "gris"], "2026-09-22"),
    # Paisajes cinematográficos
    F("ocaso", "Ocaso", "cinematico", "cinematico", dict(
        cielo=["#1b1335", "#c2456f", "#ffb36b"], sol="#ffe4a8", mar=["#3a2141", "#0e0a1c"],
        roca="#0b0712", lado=0.15),
      "premium", 2.49, "horizontes", ["mar", "atardecer"], "2026-10-12", True,
      "El último minuto de sol sobre el mar, con acantilado en primer plano."),
    F("costa-azul", "Costa Azul", "cinematico", "cinematico", dict(
        cielo=["#0b2545", "#5f8fb0", "#f4d6a0"], sol="#fff6dc", mar=["#24486b", "#081a2c"],
        roca="#06111d", lado=0.85),
      "gratis", 0, "horizontes", ["mar", "azul"], "2026-10-03"),
    F("brasas", "Brasas", "cinematico", "cinematico", dict(
        cielo=["#120404", "#7a1a0a", "#ff7a2a"], sol="#ffd28a", mar=["#3a0d06", "#0d0302"],
        roca="#050101", lado=0.2),
      "suscripcion", 0, "horizontes", ["fuego", "mar"], "2026-09-27"),
    F("marfil", "Marfil", "cinematico", "cinematico", dict(
        cielo=["#c9c2b8", "#e9e1d4", "#f6eee2"], sol="#ffffff", mar=["#b8b0a4", "#6e675e"],
        roca="#3b362f", lado=0.82),
      "premium", 1.49, "horizontes", ["claro", "mar"], "2026-09-15"),
    # Arquitectura
    F("claustro", "Claustro", "arquitectura", "arquitectura", dict(
        luz=["#fff4e0", "#f1d3a8"], muro=["#5b4636", "#c9a98a"], canto="#ffe9c7"),
      "premium", 1.99, "geometria", ["arcos", "perspectiva"], "2026-10-07", True,
      "Ocho arcos hacia la luz. Simetría y profundidad."),
    F("galeria-blanca", "Galería Blanca", "arquitectura", "arquitectura", dict(
        luz=["#ffffff", "#e8eef2"], muro=["#8c959b", "#e6e9eb"], canto="#ffffff"),
      "gratis", 0, "geometria", ["blanco", "arcos"], "2026-10-04"),
    F("terracota-arq", "Terracota", "arquitectura", "arquitectura", dict(
        luz=["#ffe0c2", "#f59f6b"], muro=["#5c2414", "#c4613b"], canto="#ffd0a8"),
      "suscripcion", 0, "geometria", ["cálido", "arcos"], "2026-09-24"),
    F("nocturno", "Nocturno", "arquitectura", "arquitectura", dict(
        luz=["#9ad1ff", "#2b5d9c"], muro=["#05070d", "#25324a"], canto="#bfe3ff"),
      "premium", 1.49, "geometria", ["noche", "azul"], "2026-09-16"),
    # Lujo
    F("oro-negro", "Oro Negro", "lujo", "lujo", dict(
        fondo=["#0d0d0f", "#050506"], oro=["#7a5a2b", "#f3d9a0"], centro=[0.5, 0.42]),
      "premium", 2.99, "oro-negro", ["oro", "negro"], "2026-10-06", True,
      "Anillos de oro sobre grafito. Contención absoluta."),
    F("champan", "Champán", "lujo", "lujo", dict(
        fondo=["#1a1712", "#0b0a08"], oro=["#8c7a5c", "#fff1d0"], centro=[0.5, 0.5]),
      "premium", 2.49, "oro-negro", ["champán"], "2026-09-29"),
    F("platino", "Platino", "lujo", "lujo", dict(
        fondo=["#111214", "#060607"], oro=["#6d7178", "#f2f4f7"], centro=[0.5, 0.38]),
      "suscripcion", 0, "oro-negro", ["plata"], "2026-09-21"),
    F("rose", "Rosé", "lujo", "lujo", dict(
        fondo=["#140d0e", "#080505"], oro=["#7d4a4a", "#f7c9c0"], centro=[0.5, 0.46]),
      "gratis", 0, "bienvenida", ["rosa", "oro"], "2026-09-19"),
    # Arte abstracto
    F("fluido", "Fluido", "abstracto", "abstracto", dict(
        fondo=["#0e0b1a", "#1a1030"], manchas=["#ff6b6b", "#ffd93d", "#6bcBff", "#c56bff"]),
      "gratis", 0, "bienvenida", ["color", "formas"], "2026-10-01"),
    F("lava", "Lava", "abstracto", "abstracto", dict(
        fondo=["#120606", "#200a05"], manchas=["#ff3d00", "#ffb300", "#ff006e", "#ff7a00"]),
      "premium", 0.99, None, ["cálido", "formas"], "2026-09-26"),
    F("laguna", "Laguna", "abstracto", "abstracto", dict(
        fondo=["#03141a", "#06262f"], manchas=["#00c2a8", "#3dd6ff", "#0077b6", "#90f1c3"]),
      "suscripcion", 0, None, ["frío", "formas"], "2026-09-23"),
    F("pastel", "Pastel", "abstracto", "abstracto", dict(
        fondo=["#f4efe9", "#ece4dc"], manchas=["#ffc8dd", "#bde0fe", "#cdb4db", "#fde4cf"]),
      "gratis", 0, None, ["pastel", "claro"], "2026-09-17"),
    # Oscuro y minimalista
    F("umbral", "Umbral", "oscuro", "oscuro", dict(
        fondo=["#08080a", "#000000"], luz="#d8dcff", luz_pos=[0.5, 0.36]),
      "gratis", 0, "bienvenida", ["negro", "luz"], "2026-10-02"),
    F("ambar", "Ámbar", "oscuro", "oscuro", dict(
        fondo=["#0a0806", "#000000"], luz="#ffb04a", luz_pos=[0.32, 0.6]),
      "premium", 0.99, None, ["negro", "ámbar"], "2026-09-25"),
    F("menta-noche", "Menta Noche", "oscuro", "oscuro", dict(
        fondo=["#050908", "#000000"], luz="#7dffd0", luz_pos=[0.7, 0.3]),
      "suscripcion", 0, None, ["negro", "verde"], "2026-09-20"),
    F("brasa-fria", "Brasa Fría", "oscuro", "oscuro", dict(
        fondo=["#0b0607", "#000000"], luz="#ff4d6d", luz_pos=[0.5, 0.72]),
      "gratis", 0, None, ["negro", "rojo"], "2026-09-14"),
    # Minimalismo (estilos de la v1)
    F("brasa-min", "Brasa", "minimal", "minimal", dict(estilo="sol", colores=["#f3e9dc", "#d9572b", "#2b2d42"]),
      "gratis", 0, "bienvenida", ["sol", "claro"], "2026-09-12"),
    F("marea", "Marea", "minimal", "minimal", dict(
        estilo="ondas", colores=["#e8f1f2", "#a9d6e5", "#61a5c2", "#2c7da0", "#013a63"]),
      "gratis", 0, None, ["ondas", "azul"], "2026-09-11"),
    F("bauhaus", "Bauhaus", "minimal", "minimal", dict(
        estilo="arcos", colores=["#f2ede4", "#e63946", "#f1a208", "#1d3557", "#457b9d"]),
      "premium", 0.99, None, ["arcos", "color"], "2026-09-10"),
    F("sahara", "Sahara", "minimal", "minimal", dict(
        estilo="dunas", colores=["#f6e7d0", "#e9c49a", "#d39b6a", "#a5643b"]),
      "suscripcion", 0, None, ["dunas"], "2026-09-09"),
    # Lanzamiento programado (fecha futura real dentro de los datos de demo)
    F("orbita-cero", "Órbita Cero", "espacio", "espacio", dict(
        fondo=["#000000", "#020414"], nebulosa=["#2a0f5e", "#ff4fd8"],
        planeta=[0.5, 0.45, 0.28], superficie=["#2b1a5a", "#ff9ee6"], anillo="#ffd6f5"),
      "premium", 1.99, "lanzamiento-noviembre", ["planeta", "rosa"], "2026-11-01"),
    F("ciudad-lluvia", "Ciudad Lluvia", "cyberpunk", "cyberpunk", dict(
        cielo=["#01030a", "#0a1f33", "#3a6f8f"], sol=["#cfe9ff", "#4fa3ff"],
        ciudad=["#06121f", "#01050a"], neon=["#7cf9ff", "#ff6ad5"]),
      "premium", 1.99, "lanzamiento-noviembre", ["lluvia", "neón"], "2026-11-01"),
]

CATEGORIAS = [
    # id, nombre, acento, tema (identidad de la transición en la web)
    ("cyberpunk", "Cyberpunk", "#ff2bd6", "neon"),
    ("espacio", "Espacio", "#8fa8ff", "orbital"),
    ("naturaleza", "Naturaleza", "#7fd1a0", "organico"),
    ("cinematico", "Paisajes cinematográficos", "#ffb26b", "panoramico"),
    ("arquitectura", "Arquitectura", "#e3d5bf", "perspectiva"),
    ("lujo", "Lujo", "#d8b26e", "contenido"),
    ("abstracto", "Arte abstracto", "#ff7a59", "fluido"),
    ("oscuro", "Oscuro y minimalista", "#c8ccff", "contenido"),
    ("minimal", "Minimalismo", "#e9e3d6", "contenido"),
]

COLECCIONES = [
    # id, nombre, descripción, tipo (gratis | pack | exclusiva | lanzamiento), precio_pack
    ("bienvenida", "Bienvenida", "Seis fondos gratuitos para empezar.", "gratis", 0),
    ("neon-nocturno", "Neón Nocturno", "La ciudad que no duerme, en tres capas de luz.", "pack", 4.99),
    ("orbitas", "Órbitas", "Planetas, anillos y nebulosas.", "pack", 3.99),
    ("cumbres", "Cumbres", "Crestas, niebla y luz de montaña.", "pack", 2.99),
    ("horizontes", "Horizontes", "Paisajes en formato de cine.", "pack", 3.99),
    ("geometria", "Geometría", "Arcos, simetría y perspectiva.", "pack", 3.99),
    ("oro-negro", "Oro Negro", "Lujo silencioso en negro y oro.", "exclusiva", 5.99),
    ("lanzamiento-noviembre", "Lanzamiento de noviembre", "Disponible el 1 de noviembre.", "lanzamiento", 3.49),
]

CON_CAPAS = {"cyberpunk", "espacio", "naturaleza", "cinematico", "arquitectura"}


def guardar_webp(arr, ruta, tam, calidad, modo="RGB"):
    img = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), modo)
    img.resize(tam, Image.LANCZOS).save(ruta, "WEBP", quality=calidad, method=6)


def main():
    for sub in ("vistas", "miniaturas", "capas", "fondos"):
        (SALIDA / sub).mkdir(parents=True, exist_ok=True)
    PRIVADA.mkdir(exist_ok=True)
    salida = []
    for n, f in enumerate(FONDOS):
        rng = np.random.default_rng(1000 + n)
        if f["escena"] == "minimal":
            escena = minimal(f["paleta"], rng, n + 1)
        else:
            escena = ESCENAS[f["escena"]](f["paleta"], rng)
        plana = grano(escena.plana(), rng)
        guardar_webp(plana, SALIDA / "vistas" / f"{f['id']}.webp", VISTA, 82)
        guardar_webp(plana, SALIDA / "miniaturas" / f"{f['id']}.webp", MINI, 78)
        original = SALIDA / "fondos" if f["acceso"] == "gratis" else PRIVADA
        Image.fromarray(np.clip(plana, 0, 255).astype(np.uint8)).save(
            original / f"{f['id']}.webp", "WEBP", quality=90, method=6)
        capas = []
        if f["escena"] in CON_CAPAS and len(escena.capas) > 1:
            for i, (img, a) in enumerate(escena.capas):
                rgba = np.dstack([np.clip(grano(img, rng, 1.5), 0, 255), a * 255])
                nombre = f"capas/{f['id']}-{i}.webp"
                guardar_webp(rgba, SALIDA / nombre, VISTA, 80, "RGBA")
                capas.append(nombre)
        media = np.asarray(Image.fromarray(np.clip(plana, 0, 255).astype(np.uint8)).resize((1, 1), Image.BOX))[0, 0]
        salida.append({
            "id": f["id"], "nombre": f["nombre"], "descripcion": f["descripcion"],
            "categoria": f["categoria"], "coleccion": f["coleccion"], "etiquetas": f["etiquetas"],
            "acceso": f["acceso"], "precio": f["precio"], "moneda": "USD",
            "publicado": f["publicado"], "destacado": f["destacado"],
            "autor": "Estudio Muro", "licencia": "Uso personal en un dispositivo",
            "resolucion": [W, H], "formato": "webp",
            "color": "#%02x%02x%02x" % tuple(int(v) for v in media),
            "vista": f"vistas/{f['id']}.webp", "miniatura": f"miniaturas/{f['id']}.webp",
            "original": f"fondos/{f['id']}.webp" if f["acceso"] == "gratis" else None,
            "capas": capas,
        })
        print(f"✓ {f['id']:<16} {f['acceso']:<12} capas={len(capas)}")

    catalogo = {
        "version": 2,
        "demo": True,
        "aviso": "Datos de demostración: precios, colecciones y fechas no son reales.",
        "categorias": [dict(id=i, nombre=n, acento=a, tema=t) for i, n, a, t in CATEGORIAS],
        "colecciones": [dict(id=i, nombre=n, descripcion=d, tipo=t, precio=p) for i, n, d, t, p in COLECCIONES],
        "suscripcion": {"id": "muro_plus_mensual", "nombre": "Muro+", "precio": 2.99, "moneda": "USD",
                        "periodo": "mes", "beneficios": [
                            "Todos los fondos marcados como Muro+",
                            "Acceso anticipado a lanzamientos",
                            "Descargas en resolución original"]},
        "fondos": salida,
    }
    (SALIDA / "catalogo.json").write_text(json.dumps(catalogo, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
