"""生成 PWA 图标（需要 Pillow + numpy，工程里只跑一次）。

用法：
    python tools/gen_icons.py
输出：
    icons/icon-192.png
    icons/icon-512.png
    icons/maskable-512.png
    icons/apple-touch-icon.png
"""

from __future__ import annotations

import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "icons"

STOPS = [
    (0.0, (255, 154, 176)),
    (0.52, (255, 107, 138)),
    (1.0, (216, 60, 102)),
]


def gradient(size: int) -> Image.Image:
    y, x = np.mgrid[0:size, 0:size]
    t = np.clip((x / size) * 0.62 + (y / size) * 0.38, 0.0, 1.0)

    channels = []
    positions = [stop[0] for stop in STOPS]
    for channel in range(3):
        values = [stop[1][channel] for stop in STOPS]
        channels.append(np.interp(t, positions, values))

    # 左上角柔光
    dist = np.sqrt((x - size * 0.18) ** 2 + (y - size * 0.14) ** 2) / (size * 0.72)
    glow = np.clip(1.0 - dist, 0.0, 1.0) ** 2 * 42
    rgb = np.stack([np.clip(c + glow, 0, 255) for c in channels], axis=-1)
    return Image.fromarray(rgb.astype(np.uint8), "RGB").convert("RGBA")


def heart_points(center: tuple[float, float], height: float, steps: int = 360) -> list[tuple[float, float]]:
    raw = []
    for index in range(steps):
        t = 2 * math.pi * index / steps
        x = 16 * math.sin(t) ** 3
        y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
        raw.append((x, y))

    xs = [p[0] for p in raw]
    ys = [p[1] for p in raw]
    width = max(xs) - min(xs)
    high = max(ys) - min(ys)
    scale = height / high
    offset_x = center[0] - (max(xs) + min(xs)) / 2 * scale
    offset_y = center[1] + (max(ys) + min(ys)) / 2 * scale
    # 屏幕坐标 y 向下，所以翻转 y
    return [(offset_x + x * scale, offset_y - y * scale) for x, y in raw]


def draw_icon(size: int, heart_ratio: float) -> Image.Image:
    supersample = 3
    canvas = gradient(size * supersample)
    draw = ImageDraw.Draw(canvas, "RGBA")

    height = size * heart_ratio * supersample
    center = (size * supersample / 2, size * supersample / 2)
    shadow_points = heart_points((center[0], center[1] + size * supersample * 0.012), height)
    draw.polygon(shadow_points, fill=(150, 28, 58, 70))

    points = heart_points(center, height)
    draw.polygon(points, fill=(255, 255, 255, 255))

    # 左上角高光，让纯白心形有一点层次
    highlight = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    highlight_draw = ImageDraw.Draw(highlight)
    highlight_draw.ellipse(
        [
            center[0] - height * 0.42,
            center[1] - height * 0.48,
            center[0] + height * 0.18,
            center[1] - height * 0.02,
        ],
        fill=(255, 255, 255, 44),
    )
    canvas = Image.alpha_composite(canvas, highlight)

    return canvas.convert("RGB").resize((size, size), Image.LANCZOS)


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    draw_icon(512, 0.60).save(OUT / "icon-512.png", optimize=True)
    draw_icon(192, 0.60).save(OUT / "icon-192.png", optimize=True)
    draw_icon(512, 0.46).save(OUT / "maskable-512.png", optimize=True)
    draw_icon(180, 0.60).save(OUT / "apple-touch-icon.png", optimize=True)
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
