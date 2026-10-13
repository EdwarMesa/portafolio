"""Genera el catálogo de fondos de Muro.

Todos los fondos son originales y se crean por código, así que no hay
problemas de derechos de autor al publicarlos en Play Store.

Uso:
    python3 muro/herramientas/generar_fondos.py
Requiere: Pillow y numpy.
"""

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image

ANCHO, ALTO = 1080, 2400          # 9:20, cubre la mayoría de móviles
MINI_ANCHO, MINI_ALTO = 360, 800
RAIZ = Path(__file__).resolve().parent.parent / "catalogo"


def hex_rgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i:i + 2], 16) for i in (0, 2, 4)], dtype=np.float32)


def rejilla():
    y, x = np.mgrid[0:ALTO, 0:ANCHO].astype(np.float32)
    return x / ANCHO, y / ALTO


def mezcla(a, b, t):
    t = np.clip(t, 0, 1)[..., None]
    return a * (1 - t) + b * t


def suave(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def grano(img, semilla, fuerza=2.5):
    rng = np.random.default_rng(semilla)
    return img + rng.normal(0, fuerza, img.shape[:2])[..., None]


def lienzo(color):
    return np.broadcast_to(hex_rgb(color), (ALTO, ANCHO, 3)).copy()


def pintar(img, mascara, color):
    """Pinta `color` sobre img usando una máscara 0..1 (antialias incluido)."""
    return mezcla(img, hex_rgb(color), mascara)


def borde(d, px=1.5):
    """Convierte una distancia con signo (en px, negativa dentro) en máscara suave."""
    return np.clip(0.5 - d / px, 0, 1)


# ---------- estilos ----------

def degradado(c, semilla):
    x, y = rejilla()
    a, b, d = (hex_rgb(h) for h in c["colores"])
    t = suave(y * 0.85 + x * 0.15)
    img = mezcla(a, b, t)
    r = np.hypot((x - 0.75) * ANCHO / ALTO, y - 0.2)
    img = mezcla(img, d, suave(1 - r / 0.55) * 0.55)
    return grano(img, semilla)


def sol(c, semilla):
    x, y = rejilla()
    fondo, sol_c, suelo = c["colores"]
    img = mezcla(hex_rgb(fondo), hex_rgb(fondo) * 0.92, y)
    cx, cy, radio = 0.5 * ANCHO, 0.47 * ALTO, 0.27 * ANCHO
    d = np.hypot(x * ANCHO - cx, y * ALTO - cy) - radio
    img = pintar(img, borde(d), sol_c)
    horizonte = 0.6 * ALTO
    img = pintar(img, borde(horizonte - y * ALTO), suelo)
    return grano(img, semilla)


def ondas(c, semilla):
    x, y = rejilla()
    colores = c["colores"]
    img = lienzo(colores[0])
    n = len(colores) - 1
    for i, col in enumerate(colores[1:]):
        base = 0.42 + i * (0.5 / n)
        amp = 0.018 + 0.006 * i
        fase = semilla * 0.7 + i * 1.3
        curva = base + amp * np.sin(x * math.tau * (1.1 + 0.25 * i) + fase)
        img = pintar(img, borde((curva - y) * ALTO), col)
    return grano(img, semilla)


def noche(c, semilla):
    x, y = rejilla()
    alto_c, bajo_c, luna = c["colores"]
    img = mezcla(hex_rgb(alto_c), hex_rgb(bajo_c), suave(y))
    rng = np.random.default_rng(semilla)
    for _ in range(70):
        sx, sy = rng.uniform(0, ANCHO), rng.uniform(0, ALTO * 0.75)
        r = rng.uniform(1.0, 2.6)
        x0, x1 = int(max(sx - 6, 0)), int(min(sx + 6, ANCHO))
        y0, y1 = int(max(sy - 6, 0)), int(min(sy + 6, ALTO))
        d = np.hypot(x[y0:y1, x0:x1] * ANCHO - sx, y[y0:y1, x0:x1] * ALTO - sy) - r
        img[y0:y1, x0:x1] = pintar(img[y0:y1, x0:x1], borde(d) * rng.uniform(0.4, 0.9), luna)
    cx, cy, radio = 0.68 * ANCHO, 0.24 * ALTO, 0.11 * ANCHO
    d_luna = np.hypot(x * ANCHO - cx, y * ALTO - cy) - radio
    d_sombra = np.hypot(x * ANCHO - cx - radio * 0.45, y * ALTO - cy + radio * 0.2) - radio
    creciente = np.maximum(d_luna, -d_sombra)
    img = pintar(img, borde(creciente), luna)
    return grano(img, semilla, 2.0)


def dunas(c, semilla):
    x, y = rejilla()
    colores = c["colores"]
    img = mezcla(hex_rgb(colores[0]), hex_rgb(colores[0]) * 1.04, y)
    for i, col in enumerate(colores[1:]):
        base = 0.55 + i * 0.13
        curva = base + 0.07 * np.sin((x + 0.3 * i + semilla * 0.11) * math.pi * (1.2 - 0.15 * i))
        img = pintar(img, borde((curva - y) * ALTO), col)
    return grano(img, semilla, 3.0)


def arcos(c, semilla):
    x, y = rejilla()
    fondo, *anillos = c["colores"]
    img = lienzo(fondo)
    cx, cy = 0.5 * ANCHO, 0.66 * ALTO
    d = np.hypot(x * ANCHO - cx, y * ALTO - cy)
    paso = 0.11 * ANCHO
    for i, col in reversed(list(enumerate(anillos))):
        radio = paso * (i + 1)
        mascara = borde(d - radio) * borde(y * ALTO - cy)
        img = pintar(img, mascara, col)
    return grano(img, semilla)


ESTILOS = {
    "degradado": degradado, "sol": sol, "ondas": ondas,
    "noche": noche, "dunas": dunas, "arcos": arcos,
}

CATALOGO = [
    # id, nombre, categoría, estilo, colores
    ("aurora", "Aurora", "Degradados", "degradado", ["#1d2b64", "#f8cdda", "#7ee8fa"]),
    ("melocoton", "Melocotón", "Degradados", "degradado", ["#ffd3a5", "#fd6585", "#fff1d6"]),
    ("menta", "Menta", "Degradados", "degradado", ["#d4fc79", "#2f8f83", "#e7fff6"]),
    ("brasa", "Brasa", "Formas", "sol", ["#f3e9dc", "#d9572b", "#2b2d42"]),
    ("limon", "Limón", "Formas", "sol", ["#e9f0e6", "#f2c94c", "#3a5a40"]),
    ("lavanda", "Lavanda", "Formas", "sol", ["#ece6f5", "#8e7dbe", "#2d2a4a"]),
    ("marea", "Marea", "Ondas", "ondas", ["#e8f1f2", "#a9d6e5", "#61a5c2", "#2c7da0", "#013a63"]),
    ("coral", "Coral", "Ondas", "ondas", ["#fff4ec", "#ffcdb2", "#e5989b", "#b5838d", "#6d6875"]),
    ("bosque", "Bosque", "Ondas", "ondas", ["#f1f4ea", "#cad2c5", "#84a98c", "#52796f", "#2f3e46"]),
    ("vigilia", "Vigilia", "Noche", "noche", ["#0b0c1a", "#2a2350", "#f5ecd7"]),
    ("abismo", "Abismo", "Noche", "noche", ["#020b13", "#0f3443", "#d9f1ff"]),
    ("ciruela", "Ciruela", "Noche", "noche", ["#140816", "#4a1942", "#ffd6e0"]),
    ("sahara", "Sahara", "Tierra", "dunas", ["#f6e7d0", "#e9c49a", "#d39b6a", "#a5643b"]),
    ("arcilla", "Arcilla", "Tierra", "dunas", ["#efe3d6", "#c8a593", "#a26e5a", "#5e3a2e"]),
    ("salvia", "Salvia", "Tierra", "dunas", ["#eef0e5", "#c2c5aa", "#a4ac86", "#656d4a"]),
    ("bauhaus", "Bauhaus", "Formas", "arcos", ["#f2ede4", "#e63946", "#f1a208", "#1d3557", "#457b9d"]),
    ("terracota", "Terracota", "Tierra", "arcos", ["#f7efe5", "#c65d3b", "#e09f7d", "#7a3b2e", "#3d2b24"]),
    ("grafito", "Grafito", "Noche", "arcos", ["#111111", "#2b2b2b", "#444444", "#6b6b6b", "#d8d8d8"]),
]


def main():
    entradas = []
    for n, (id_, nombre, categoria, estilo, colores) in enumerate(CATALOGO):
        datos = ESTILOS[estilo]({"colores": colores}, semilla=n + 1)
        img = Image.fromarray(np.clip(datos, 0, 255).astype(np.uint8), "RGB")
        img.save(RAIZ / "fondos" / f"{id_}.webp", "WEBP", quality=88, method=6)
        img.resize((MINI_ANCHO, MINI_ALTO), Image.LANCZOS).save(
            RAIZ / "miniaturas" / f"{id_}.webp", "WEBP", quality=80, method=6)
        entradas.append({
            "id": id_,
            "nombre": nombre,
            "categoria": categoria,
            "color": colores[0],
            "imagen": f"fondos/{id_}.webp",
            "miniatura": f"miniaturas/{id_}.webp",
            "ancho": ANCHO,
            "alto": ALTO,
            "autor": "Muro",
        })
        print("✓", id_)

    catalogo = {
        "version": 1,
        "categorias": ["Degradados", "Formas", "Ondas", "Noche", "Tierra"],
        "fondos": entradas,
    }
    (RAIZ / "catalogo.json").write_text(
        json.dumps(catalogo, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
