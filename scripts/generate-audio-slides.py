#!/usr/bin/env python3
"""
用 ChatTTS 生成幻灯片旁白语音（PPT+语音模式）。
逐页生成语音 → 测量时长 → 回写 duration。

用法：
  source .venv/bin/activate
  ACCOUNT=laodong python scripts/generate-audio-slides.py
  # 兼容旧用法：
  SLIDES_FILE=src/data/laodong/ai-slides.ts python scripts/generate-audio-slides.py
"""

import os
import re
import subprocess
import sys
import math
import numpy as np

os.environ["TOKENIZERS_PARALLELISM"] = "false"

import ChatTTS
import soundfile as sf
import torch

FPS = 30
PAD_FRAMES = 20

PUNCT_MAP = str.maketrans({
    '！': '!', '？': '?', '，': ',', '。': '.', '；': ';',
    '：': ':', '"': '"', '"': '"', '（': '(', '）': ')',
    '、': ',', '…': '...', '—': '-',
})

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)

from config_loader import get_data_file_path

ACCOUNT_ID = os.environ.get("ACCOUNT", "example")
SLIDES_FILE, _voice_seeds = get_data_file_path(
    ACCOUNT_ID, "slides",
    fallback_default="src/data/example/slides.example.ts",
)
NARRATOR_SEED = _voice_seeds.get("narrator", 2024)


def _int_to_chinese(n):
    digits = '零一二三四五六七八九'
    if n == 0:
        return '零'
    result = ''
    if n >= 1000:
        result += digits[n // 1000] + '千'
        n %= 1000
        if 0 < n < 100:
            result += '零'
    if n >= 100:
        result += digits[n // 100] + '百'
        n %= 100
        if 0 < n < 10:
            result += '零'
    if n >= 10:
        if n // 10 == 1 and not result:
            result += '十'
        else:
            result += digits[n // 10] + '十'
        n %= 10
    if n > 0:
        result += digits[n]
    return result


def _convert_numbers(text):
    def replace_num(m):
        num_str = m.group(0)
        try:
            n = int(num_str)
            return _int_to_chinese(n)
        except ValueError:
            return num_str
    return re.sub(r'\d+', replace_num, text)


def normalize_text(text):
    text = text.translate(PUNCT_MAP)
    text = _convert_numbers(text)
    return text


def parse_slides_ts(filepath):
    """从 ai-slides.ts 提取旁白文本列表。"""
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    match = re.search(r"export const \w+Slides.*?=\s*\[(.*?)\];", content, re.DOTALL)
    if not match:
        raise ValueError(f"找不到 slides 数据（\w+Slides）in {filepath}")
    slides = []
    for obj_match in re.finditer(
        r'\{[^{}]*?narration:\s*"([^"]*)"[^{}]*?duration:\s*(\d+)',
        match.group(1), re.DOTALL,
    ):
        slides.append({
            "narration": obj_match.group(1),
            "duration": int(obj_match.group(2)),
        })
    return slides


def update_durations_in_ts(filepath, new_durations):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    idx = 0
    def replace_duration(m):
        nonlocal idx
        if idx < len(new_durations):
            result = f"duration: {new_durations[idx]}"
            idx += 1
            return result
        return m.group(0)
    updated = re.sub(r"duration:\s*\d+", replace_duration, content)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(updated)


def get_audio_duration(filepath):
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", filepath],
        capture_output=True, text=True,
    )
    return float(result.stdout.strip())


def main():
    output_path = os.path.join(PROJECT_DIR, "out/slides-audio.wav")

    print("[info] 加载 ChatTTS 模型...")
    chat = ChatTTS.Chat()
    chat.load(compile=False)
    print("[info] 模型加载完成")

    print(f"\n[info] 读取幻灯片: {SLIDES_FILE}")
    slides = parse_slides_ts(SLIDES_FILE)
    print(f"[info] 共 {len(slides)} 页幻灯片")

    # 旁白使用固定音色
    torch.manual_seed(NARRATOR_SEED)
    narrator_spk = chat.sample_random_speaker()
    print(f"[info] 旁白 seed={NARRATOR_SEED}")

    clips_dir = os.path.join(PROJECT_DIR, "out/slide-clips")
    os.makedirs(clips_dir, exist_ok=True)

    clip_durations = []
    sample_rate = 24000

    for i, slide in enumerate(slides):
        clip_path = os.path.join(clips_dir, f"slide_{i:03d}.wav")
        narration = slide["narration"]

        # 语气控制：讲解风格，带轻微停顿
        params_infer = ChatTTS.Chat.InferCodeParams(
            spk_emb=narrator_spk,
            prompt="[speed_9]",
            temperature=0.3,
            top_P=0.6,
            top_K=20,
        )
        params_refine = ChatTTS.Chat.RefineTextParams(
            prompt="[oral_1][laugh_0][break_2]",
        )

        text = normalize_text(narration)
        wavs = chat.infer(
            [text],
            params_infer_code=params_infer,
            params_refine_text=params_refine,
        )
        audio_arr = np.array(wavs[0]).flatten()
        sf.write(clip_path, audio_arr, sample_rate, format="WAV", subtype="PCM_16")

        dur_s = get_audio_duration(clip_path)
        frames = math.ceil(dur_s * FPS) + PAD_FRAMES
        clip_durations.append(frames)
        print(f"  [{i+1}/{len(slides)}] 第{i+1}页 {dur_s:.1f}s → {frames}帧")

    # 合并所有页的语音，中间加空白停顿
    print("\n[step] 合并幻灯片音轨...")
    combined = []
    for i, slide in enumerate(slides):
        clip_path = os.path.join(clips_dir, f"slide_{i:03d}.wav")
        audio_data, sr = sf.read(clip_path)
        combined.append(audio_data)
        # 末尾补充静音（PAD_FRAMES 对应的时长）
        pad_samples = int(PAD_FRAMES / FPS * sample_rate)
        combined.append(np.zeros(pad_samples, dtype=np.float32))

    full_audio = np.concatenate(combined)
    sf.write(output_path, full_audio, sample_rate, format="WAV", subtype="PCM_16")
    total_s = len(full_audio) / sample_rate
    print(f"[done] 音轨: {output_path} ({total_s:.1f}秒)")

    # 回写 duration 到 ai-slides.ts
    print(f"\n[step] 回写 duration 到 {os.path.basename(SLIDES_FILE)}...")
    update_durations_in_ts(SLIDES_FILE, clip_durations)
    print("[done] duration 已更新")

    print(f"\n[next] 运行: cd engine && VIDPILOT_PROJECT=$PWD npx remotion render {ACCOUNT_ID}-slides ../out/{ACCOUNT_ID}-slides.mp4 --codec h264")


if __name__ == "__main__":
    main()
