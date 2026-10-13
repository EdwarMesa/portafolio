"""Genera el icono (512×512) y el gráfico destacado (1024×500) de la ficha de Play Store.

Uso: python3 muro/herramientas/recursos_play.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

SALIDA = Path(__file__).resolve().parent.parent / "play-store"
CREMA, TINTA, BRASA = "#F6F4F0", "#141414", "#D9572B"
FUENTES = ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "DejaVuSans-Bold.ttf"]


def simbolo(d, cx, cy, escala):
    """Sol sobre el horizonte, el mismo trazado que ic_launcher_foreground.xml (viewport 108)."""
    u = lambda v: v * escala
    d.pieslice([cx - u(15), cy - u(15), cx + u(15), cy + u(15)], 180, 360, fill=BRASA)
    d.rounded_rectangle([cx - u(21), cy + u(2), cx + u(21), cy + u(16)], radius=u(6), fill=TINTA)
    d.rectangle([cx - u(21), cy + u(2), cx + u(21), cy + u(8)], fill=TINTA)


def fuente(tam):
    for f in FUENTES:
        try:
            return ImageFont.truetype(f, tam)
        except OSError:
            continue
    return ImageFont.load_default(tam)


def icono():
    # Play aplica la máscara redondeada; se entrega cuadrado y sin transparencia.
    s = 4  # supermuestreo para bordes suaves
    img = Image.new("RGB", (512 * s, 512 * s), CREMA)
    simbolo(ImageDraw.Draw(img), 256 * s, 250 * s, 512 * s / 108 * 1.25)
    img.resize((512, 512), Image.LANCZOS).save(SALIDA / "icono-512.png")


def grafico():
    s = 2
    img = Image.new("RGB", (1024 * s, 500 * s), CREMA)
    d = ImageDraw.Draw(img)
    fondos = Path(__file__).resolve().parent.parent / "catalogo" / "miniaturas"
    for i, nombre in enumerate(["vigilia", "brasa", "marea", "sahara"]):
        mini = Image.open(fondos / f"{nombre}.webp").convert("RGB").resize((130 * s, 289 * s))
        mascara = Image.new("L", mini.size, 0)
        ImageDraw.Draw(mascara).rounded_rectangle([0, 0, *mini.size], radius=18 * s, fill=255)
        x, y = (440 + i * 146) * s, (85 + (i % 2) * 46) * s
        img.paste(mini, (x, y), mascara)
    simbolo(d, 118 * s, 196 * s, 1.6 * s)
    d.text((70 * s, 250 * s), "Muro", font=fuente(72 * s), fill=TINTA)
    d.text((72 * s, 340 * s), "Fondos minimalistas", font=fuente(28 * s), fill="#6B6966")
    img.resize((1024, 500), Image.LANCZOS).save(SALIDA / "grafico-destacado-1024x500.png")


if __name__ == "__main__":
    SALIDA.mkdir(exist_ok=True)
    icono()
    grafico()
    print("Listo:", SALIDA)
