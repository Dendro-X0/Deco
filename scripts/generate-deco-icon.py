#!/usr/bin/env python3
"""Generate Deco app icon PNG (1024²) matching UI primary token hsl(167 80% 55%)."""

from __future__ import annotations

import math
import struct
import zlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "apps" / "desktop" / "src-tauri" / "icons" / "app-icon.png"
SIZE = 1024
RADIUS_RATIO = 0.22  # rounded-lg ~ 22% corner radius


def hsl_to_rgb(h: float, s: float, l: float) -> tuple[int, int, int]:
    h = h % 360
    c = (1 - abs(2 * l - 1)) * s
    x = c * (1 - abs((h / 60) % 2 - 1))
    m = l - c / 2
    if h < 60:
        r, g, b = c, x, 0
    elif h < 120:
        r, g, b = x, c, 0
    elif h < 180:
        r, g, b = 0, c, x
    elif h < 240:
        r, g, b = 0, x, c
    elif h < 300:
        r, g, b = x, 0, c
    else:
        r, g, b = c, 0, x
    return (
        int((r + m) * 255),
        int((g + m) * 255),
        int((b + m) * 255),
    )


def inside_rounded_rect(x: int, y: int, size: int, radius: int) -> bool:
    if x < 0 or y < 0 or x >= size or y >= size:
        return False
    if radius <= 0:
        return True
    corners = (
        (radius, radius),
        (size - radius - 1, radius),
        (radius, size - radius - 1),
        (size - radius - 1, size - radius - 1),
    )
    for cx, cy in corners:
        if (x < radius or x >= size - radius) and (y < radius or y >= size - radius):
            if (x - cx) ** 2 + (y - cy) ** 2 > radius**2:
                return False
    return True


def write_png(path: Path, rgba: list[tuple[int, int, int, int]]) -> None:
    width = height = SIZE
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            r, g, b, a = rgba[y * width + x]
            raw.extend((r, g, b, a))

    def chunk(tag: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(png)


def main() -> None:
    # Match apps/frontend/src/index.css --primary and --primary-foreground
    teal = hsl_to_rgb(167, 0.80, 0.55)
    ink = hsl_to_rgb(210, 0.20, 0.04)
    radius = int(SIZE * RADIUS_RATIO)
    cx, cy = SIZE // 2, int(SIZE * 0.54)
    # Italic D: stem + bowl using simple geometry
    pixels: list[tuple[int, int, int, int]] = []
    for y in range(SIZE):
        for x in range(SIZE):
            if not inside_rounded_rect(x, y, SIZE, radius):
                pixels.append((0, 0, 0, 0))
                continue
            # Stem (slanted slightly for italic feel)
            stem_x = cx - int(SIZE * 0.14) + int((y - cy) * 0.06)
            stem_w = int(SIZE * 0.11)
            in_stem = abs(x - stem_x) <= stem_w and cy - int(SIZE * 0.22) <= y <= cy + int(SIZE * 0.22)
            # Bowl (ellipse)
            bx, by = cx + int(SIZE * 0.05), cy - int(SIZE * 0.02)
            rx, ry = int(SIZE * 0.20), int(SIZE * 0.24)
            in_bowl = ((x - bx) / rx) ** 2 + ((y - by) / ry) ** 2 <= 1.0
            # Cut inner bowl hole
            inner_rx, inner_ry = int(SIZE * 0.11), int(SIZE * 0.14)
            in_hole = ((x - bx) / inner_rx) ** 2 + ((y - by) / inner_ry) ** 2 <= 1.0
            if (in_stem or in_bowl) and not in_hole:
                pixels.append((*ink, 255))
            else:
                pixels.append((*teal, 255))
    write_png(OUT, pixels)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
