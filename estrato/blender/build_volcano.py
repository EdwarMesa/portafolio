"""ESTRATO - volcan procedural para el explorador web.

Genera de forma determinista un estratovolcan (crater, carcavas radiales,
cono secundario y canal de lava), guarda el .blend editable y exporta un GLB
para Three.js.

Capas de datos horneadas en el atributo de color COLOR_0 (0..1):
  R = anomalia termica
  G = anomalia magnetica (campo total reducido)
  B = probabilidad de anomalia detectada por IA

Uso:
  blender -b --factory-startup --python estrato/blender/build_volcano.py -- \
      --out estrato/assets
"""

import argparse
import math
import sys
from pathlib import Path

import bpy
import numpy as np
from mathutils import Vector

SEED = 453
RES = 256          # segmentos por lado
SIZE = 20.0        # metros de escena (lado)
PEAK = 5.2         # altura maxima de la cumbre

# Posiciones compartidas con el sitio web (coordenadas XZ de Three.js;
# Blender Y = -Z de Three.js al exportar con +Y arriba).
CRATER = (0.0, 0.0)
SECONDARY = (4.6, 3.2)      # cono parasito (x, z web)
LAVA_DIR = math.radians(-35)  # direccion del canal de lava (angulo en XZ web)
MAG_BODIES = [(-4.8, -2.4, 1.6, 1.0), (3.0, -5.2, 1.2, -0.7), (-1.5, 5.4, 1.4, 0.8)]
AI_TARGETS = [(-4.6, -2.1, 1.3), (5.6, 5.8, 1.1), (2.2, -1.6, 0.9)]


def parse_args():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "assets"))
    p.add_argument("--render", action="store_true", help="renderiza tambien un poster con Cycles")
    return p.parse_args(argv)


# --- ruido determinista (value noise fBm con numpy) -----------------------------
rng = np.random.default_rng(SEED)
_PERM = rng.random((256, 256))


def value_noise(x, y):
    xi = np.floor(x).astype(int)
    yi = np.floor(y).astype(int)
    xf = x - xi
    yf = y - yi
    u = xf * xf * (3 - 2 * xf)
    v = yf * yf * (3 - 2 * yf)
    a = _PERM[xi % 256, yi % 256]
    b = _PERM[(xi + 1) % 256, yi % 256]
    c = _PERM[xi % 256, (yi + 1) % 256]
    d = _PERM[(xi + 1) % 256, (yi + 1) % 256]
    return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v


def fbm(x, y, octaves=6, lac=2.03, gain=0.5):
    total = np.zeros_like(x)
    amp, freq = 0.5, 1.0
    for i in range(octaves):
        total += amp * (value_noise(x * freq + 17.3 * i, y * freq - 9.1 * i) * 2 - 1)
        freq *= lac
        amp *= gain
    return total


def ridged(x, y, octaves=5):
    total = np.zeros_like(x)
    amp, freq = 0.5, 1.0
    for i in range(octaves):
        n = 1 - np.abs(value_noise(x * freq + 3.7 * i, y * freq + 1.3 * i) * 2 - 1)
        total += amp * n * n
        freq *= 2.1
        amp *= 0.5
    return total


def gauss(x, z, cx, cz, s):
    return np.exp(-((x - cx) ** 2 + (z - cz) ** 2) / (2 * s * s))


def build_fields():
    lin = np.linspace(-SIZE / 2, SIZE / 2, RES + 1)
    X, Z = np.meshgrid(lin, lin)  # X = x web, Z = z web
    r = np.hypot(X - CRATER[0], Z - CRATER[1])
    theta = np.arctan2(Z, X)

    # Cono principal con perfil concavo de estratovolcan
    cone = PEAK * np.exp(-(r / 4.3) ** 1.35)
    # Base ondulada y llanura
    base = 0.35 * fbm(X * 0.18, Z * 0.18, 5) + 0.25
    # Carcavas radiales (mas marcadas a media ladera)
    gully_mask = np.clip(r / 2.0, 0, 1) * np.exp(-((r - 4.5) / 4.0) ** 2)
    # Muestreo polar sin costura: radio constante en el espacio del ruido
    pr = 4.2
    px = np.cos(theta) * pr + r * 0.22
    pz = np.sin(theta) * pr - r * 0.17
    streaks = ridged(px * 1.3, pz * 1.3, 4)
    gullies = -0.55 * gully_mask * np.clip(streaks - 0.18, 0, None)
    # Rugosidad tipo roca (suave cerca de la cumbre, mas en laderas)
    rough = 0.10 * ridged(X * 0.45, Z * 0.45) * np.clip(1.2 - np.abs(r - 3.0) / 6.0, 0.2, 1)
    rough += 0.06 * fbm(X * 1.4, Z * 1.4, 4)
    # Crater: borde elevado y depresion interior
    rim = 0.35 * np.exp(-((r - 1.05) / 0.28) ** 2)
    pit = -1.35 * np.exp(-(r / 0.78) ** 2.2)
    # Cono secundario
    sec_r = np.hypot(X - SECONDARY[0], Z - SECONDARY[1])
    secondary = 1.1 * np.exp(-(sec_r / 1.2) ** 1.6) - 0.35 * np.exp(-(sec_r / 0.35) ** 2)
    # Canal de lava (valle suave que baja desde el crater)
    along = X * math.cos(LAVA_DIR) + Z * math.sin(LAVA_DIR)
    across = -X * math.sin(LAVA_DIR) + Z * math.cos(LAVA_DIR)
    meander = 0.45 * np.sin(along * 0.9) + 0.25 * fbm(along * 0.3, 2.0 + 0 * along, 3)
    channel_w = 0.35 + 0.05 * along
    channel = np.exp(-((across - meander) / channel_w) ** 2) * np.clip(along - 0.9, 0, 1) * np.exp(-along / 8.0)
    lava = -0.18 * channel

    H = cone + base + gullies + rough + rim + pit + secondary + lava
    # Atenuar bordes para que el terreno "flote" limpio
    edge = np.clip((SIZE / 2 - np.maximum(np.abs(X), np.abs(Z))) / 1.2, 0, 1)
    H = H * (0.35 + 0.65 * edge) - (1 - edge) * 0.6

    # --- capas de datos ---
    thermal = np.clip(
        1.0 * np.exp(-(r / 0.9) ** 2)
        + 0.85 * channel * np.clip(1.3 - along / 7.0, 0, 1)
        + 0.45 * np.exp(-(sec_r / 0.5) ** 2)
        + 0.08 * fbm(X * 0.8, Z * 0.8, 3),
        0, 1)
    mag = 0.5 + 0.18 * fbm(X * 0.22 + 40, Z * 0.22 - 12, 5)
    for cx, cz, s, amp in MAG_BODIES:
        # dipolo simplificado: lobulo positivo al sur, negativo al norte
        mag += 0.32 * amp * (gauss(X, Z, cx, cz + 0.4 * s, s) - 0.55 * gauss(X, Z, cx, cz - 0.9 * s, s * 0.9))
    mag += 0.22 * np.exp(-(r / 2.2) ** 2)  # conducto magmatico
    mag = np.clip(mag, 0, 1)
    ai = np.zeros_like(X)
    for cx, cz, s in AI_TARGETS:
        ai = np.maximum(ai, gauss(X, Z, cx, cz, s))
    ai = np.clip(ai + 0.05 * fbm(X * 1.2, Z * 1.2, 2), 0, 1)
    return X, Z, H, thermal, mag, ai


def build_mesh(X, Z, H, thermal, mag, ai):
    n = RES + 1
    # Blender: Z arriba; web Z -> Blender -Y
    verts = np.stack([X.ravel(), -Z.ravel(), H.ravel()], axis=1)
    idx = np.arange(n * n).reshape(n, n)
    a = idx[:-1, :-1].ravel()
    b = idx[:-1, 1:].ravel()
    c = idx[1:, 1:].ravel()
    d = idx[1:, :-1].ravel()
    faces = np.stack([a, d, c, b], axis=1)

    mesh = bpy.data.meshes.new("VolcanTerrain")
    mesh.vertices.add(len(verts))
    mesh.vertices.foreach_set("co", verts.astype(np.float32).ravel())
    mesh.loops.add(faces.size)
    mesh.loops.foreach_set("vertex_index", faces.astype(np.int32).ravel())
    mesh.polygons.add(len(faces))
    mesh.polygons.foreach_set("loop_start", np.arange(0, faces.size, 4, dtype=np.int32))
    mesh.polygons.foreach_set("loop_total", np.full(len(faces), 4, dtype=np.int32))
    mesh.update()
    mesh.validate()
    mesh.polygons.foreach_set("use_smooth", np.ones(len(faces), dtype=bool))

    attr = mesh.color_attributes.new("datos", "FLOAT_COLOR", "POINT")
    cols = np.stack([thermal.ravel(), mag.ravel(), ai.ravel(), np.ones(n * n)], axis=1)
    attr.data.foreach_set("color", cols.astype(np.float32).ravel())
    mesh.color_attributes.active_color = attr

    obj = bpy.data.objects.new("VolcanTerrain", mesh)
    bpy.context.scene.collection.objects.link(obj)

    mat = bpy.data.materials.new("Basalto")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.16, 0.13, 0.11, 1)
    bsdf.inputs["Roughness"].default_value = 0.92
    mesh.materials.append(mat)
    return obj


def setup_render(out):
    scene = bpy.context.scene
    cam_data = bpy.data.cameras.new("Cam")
    cam_data.lens = 38
    cam = bpy.data.objects.new("Cam", cam_data)
    scene.collection.objects.link(cam)
    cam.location = (15.5, -17.5, 9.0)
    d = Vector((0, 0, 1.6)) - cam.location
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()
    scene.camera = cam
    sun_data = bpy.data.lights.new("Sol", "SUN")
    sun_data.energy = 3.5
    sun_data.angle = math.radians(3)
    sun = bpy.data.objects.new("Sol", sun_data)
    sun.rotation_euler = (math.radians(58), 0, math.radians(35))
    scene.collection.objects.link(sun)
    world = bpy.data.worlds.new("Cielo")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs[0].default_value = (0.72, 0.66, 0.58, 1)
    world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
    scene.world = world
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 48
    scene.cycles.use_denoising = False
    scene.render.resolution_x = 1600
    scene.render.resolution_y = 900
    scene.render.filepath = str(out / "volcan-poster.png")
    bpy.ops.render.render(write_still=True)


def main():
    args = parse_args()
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    fields = build_fields()
    build_mesh(*fields)
    bpy.ops.wm.save_as_mainfile(filepath=str(out.parent / "blender" / "volcan.blend"))
    bpy.ops.export_scene.gltf(
        filepath=str(out / "volcan.glb"),
        export_format="GLB",
        export_yup=True,
        export_normals=False,  # se recalculan en el navegador
        export_colors=True,
        export_texcoords=False,
        export_materials="NONE",
        export_apply=True,
    )
    H = fields[2]
    print(f"ESTRATO_OK verts={(RES + 1) ** 2} hmin={H.min():.2f} hmax={H.max():.2f}")
    if args.render:
        setup_render(out)


main()
