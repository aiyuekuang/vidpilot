"""
Generate video thumbnail: black background + yellow title text.
Douyin: 1080x1920, safe area 1080x1464 (center).
"""

import textwrap
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

WIDTH = 1080
HEIGHT = 1920
SAFE_TOP = (HEIGHT - 1464) // 2  # 228px

# Try multiple font paths
_FONT_CANDIDATES = [
    Path.home() / "Library/Fonts/NotoSansCJKsc-Bold.otf",
    Path("/System/Library/Fonts/STHeiti Medium.ttc"),
    Path("/System/Library/Fonts/PingFang.ttc"),
]

TITLE_FONT_SIZE = 96
SUBTITLE_FONT_SIZE = 48

BG_COLOR = (0, 0, 0)
TITLE_COLOR = (255, 220, 0)
SUBTITLE_COLOR = (200, 200, 200)


def _find_font():
    for p in _FONT_CANDIDATES:
        if p.exists():
            return str(p)
    return None


def wrap_title(text, max_chars=8):
    if len(text) <= max_chars:
        return [text]
    return textwrap.wrap(text, width=max_chars)


def generate_thumbnail(title, output_path, subtitle=None):
    font_path = _find_font()
    if not font_path:
        print("[!] No CJK font found, skipping thumbnail generation")
        return None

    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    title_font = ImageFont.truetype(font_path, TITLE_FONT_SIZE)
    lines = wrap_title(title)

    line_spacing = 20
    line_heights = []
    line_widths = []
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=title_font)
        line_widths.append(bbox[2] - bbox[0])
        line_heights.append(bbox[3] - bbox[1])

    total_title_height = sum(line_heights) + line_spacing * (len(lines) - 1)

    subtitle_height = 0
    subtitle_width = 0
    subtitle_font = None
    if subtitle:
        subtitle_font = ImageFont.truetype(font_path, SUBTITLE_FONT_SIZE)
        bbox = draw.textbbox((0, 0), subtitle, font=subtitle_font)
        subtitle_width = bbox[2] - bbox[0]
        subtitle_height = bbox[3] - bbox[1]

    gap = 40 if subtitle else 0
    total_height = total_title_height + gap + subtitle_height

    start_y = SAFE_TOP + (1464 - total_height) // 2

    y = start_y
    for i, line in enumerate(lines):
        x = (WIDTH - line_widths[i]) // 2
        draw.text((x, y), line, font=title_font, fill=TITLE_COLOR)
        y += line_heights[i] + line_spacing

    if subtitle and subtitle_font:
        y += gap - line_spacing
        x = (WIDTH - subtitle_width) // 2
        draw.text((x, y), subtitle, font=subtitle_font, fill=SUBTITLE_COLOR)

    img.save(output_path, "PNG")
    print(f"[+] Thumbnail generated: {output_path}")
    return output_path
