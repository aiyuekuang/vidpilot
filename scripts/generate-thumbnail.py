#!/usr/bin/env python3
"""
Generate video thumbnail: black background + yellow title text.
Douyin recommended: 1080x1920, safe area 1080x1464 (center).

Usage:
  python generate-thumbnail.py "标题文字" output.png
  python generate-thumbnail.py "标题文字" output.png --subtitle "副标题"
"""

import argparse
import textwrap
from PIL import Image, ImageDraw, ImageFont

WIDTH = 1080
HEIGHT = 1920
SAFE_TOP = (HEIGHT - 1464) // 2  # 228px
SAFE_BOTTOM = HEIGHT - SAFE_TOP

# Font config
FONT_PATH = "/Users/suconnect/Library/Fonts/NotoSansCJKsc-Bold.otf"
TITLE_FONT_SIZE = 96
SUBTITLE_FONT_SIZE = 48

# Colors
BG_COLOR = (0, 0, 0)
TITLE_COLOR = (255, 220, 0)       # Yellow
SUBTITLE_COLOR = (200, 200, 200)  # Light gray


def wrap_title(text, max_chars=8):
    """Break title into lines, max_chars per line."""
    if len(text) <= max_chars:
        return [text]
    lines = textwrap.wrap(text, width=max_chars)
    return lines


def generate_thumbnail(title, output_path, subtitle=None):
    img = Image.new("RGB", (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)

    title_font = ImageFont.truetype(FONT_PATH, TITLE_FONT_SIZE)
    lines = wrap_title(title)

    # Calculate total title block height
    line_spacing = 20
    line_heights = []
    line_widths = []
    for line in lines:
        bbox = draw.textbbox((0, 0), line, font=title_font)
        line_widths.append(bbox[2] - bbox[0])
        line_heights.append(bbox[3] - bbox[1])

    total_title_height = sum(line_heights) + line_spacing * (len(lines) - 1)

    # Subtitle measurement
    subtitle_height = 0
    subtitle_width = 0
    subtitle_font = None
    if subtitle:
        subtitle_font = ImageFont.truetype(FONT_PATH, SUBTITLE_FONT_SIZE)
        bbox = draw.textbbox((0, 0), subtitle, font=subtitle_font)
        subtitle_width = bbox[2] - bbox[0]
        subtitle_height = bbox[3] - bbox[1]

    # Total content height
    gap = 40 if subtitle else 0
    total_height = total_title_height + gap + subtitle_height

    # Center vertically in safe area
    start_y = SAFE_TOP + (1464 - total_height) // 2

    # Draw title lines
    y = start_y
    for i, line in enumerate(lines):
        x = (WIDTH - line_widths[i]) // 2
        draw.text((x, y), line, font=title_font, fill=TITLE_COLOR)
        y += line_heights[i] + line_spacing

    # Draw subtitle
    if subtitle and subtitle_font:
        y += gap - line_spacing  # replace last line_spacing with gap
        x = (WIDTH - subtitle_width) // 2
        draw.text((x, y), subtitle, font=subtitle_font, fill=SUBTITLE_COLOR)

    img.save(output_path, "PNG")
    print(f"[+] Thumbnail saved: {output_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate video thumbnail")
    parser.add_argument("title", help="Title text")
    parser.add_argument("output", help="Output PNG path")
    parser.add_argument("--subtitle", help="Subtitle text", default=None)
    args = parser.parse_args()
    generate_thumbnail(args.title, args.output, args.subtitle)
