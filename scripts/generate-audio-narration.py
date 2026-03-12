#!/usr/bin/env python3
"""
用 ChatTTS 生成图文解说旁白语音。

用法：
  source .venv/bin/activate
  ACCOUNT=laodong python scripts/generate-audio-narration.py
"""

import json
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
LEAD_FRAMES = 25   # silence before speech (let entrance animations finish)
PAD_FRAMES = 20    # silence after speech (breathing room before next segment)

PUNCT_MAP = str.maketrans({
    '\uff01': '!', '\uff1f': '?', '\uff0c': ',', '\u3002': '.', '\uff1b': ';',
    '\uff1a': ':', '\u201c': '"', '\u201d': '"', '\uff08': '(', '\uff09': ')',
    '\u3001': ',', '\u2026': '...', '\u2014': '-',
})

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)

from config_loader import get_data_file_path

ACCOUNT_ID = os.environ.get("ACCOUNT", "example")
DATA_FILE, _voice_seeds = get_data_file_path(
    ACCOUNT_ID, "narration",
    fallback_default="src/data/example/narration.example.ts",
)
NARRATOR_SEED = _voice_seeds.get("narrator", 2024)


def _int_to_chinese(n):
    digits = '\u96f6\u4e00\u4e8c\u4e09\u56db\u4e94\u516d\u4e03\u516b\u4e5d'
    if n == 0:
        return '\u96f6'
    result = ''
    if n >= 1000:
        result += digits[n // 1000] + '\u5343'
        n %= 1000
        if 0 < n < 100:
            result += '\u96f6'
    if n >= 100:
        result += digits[n // 100] + '\u767e'
        n %= 100
        if 0 < n < 10:
            result += '\u96f6'
    if n >= 10:
        if n // 10 == 1 and not result:
            result += '\u5341'
        else:
            result += digits[n // 10] + '\u5341'
        n %= 10
    if n > 0:
        result += digits[n]
    return result


def _convert_numbers(text):
    def replace_num(m):
        try:
            return _int_to_chinese(int(m.group(0)))
        except ValueError:
            return m.group(0)
    return re.sub(r'\d+', replace_num, text)


def normalize_text(text):
    text = text.translate(PUNCT_MAP)
    text = _convert_numbers(text)
    return text


def parse_data_ts(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    match = re.search(r"export const \w+.*?:\s*NarrationSegment\[\]\s*=\s*\[(.*?)\];", content, re.DOTALL)
    if not match:
        raise ValueError(f"找不到 NarrationSegment[] 数据 in {filepath}")
    segments = []
    # Match each { ... } block
    for block in re.finditer(r'\{([^}]+)\}', match.group(1), re.DOTALL):
        block_text = block.group(1)
        narr = re.search(r'narration:\s*"([^"]*)"', block_text)
        dur = re.search(r'duration:\s*(\d+)', block_text)
        if narr and dur:
            segments.append({
                "narration": narr.group(1),
                "duration": int(dur.group(1)),
            })
    return segments


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
    output_path = os.path.join(PROJECT_DIR, "out/narration-audio.wav")

    print("[info] 加载 ChatTTS 模型...")
    chat = ChatTTS.Chat()
    chat.load(compile=False)
    print("[info] 模型加载完成")

    print(f"\n[info] 读取图文解说: {DATA_FILE}")
    segments = parse_data_ts(DATA_FILE)
    print(f"[info] 共 {len(segments)} 段")

    torch.manual_seed(NARRATOR_SEED)
    narrator_spk = chat.sample_random_speaker()
    print(f"[info] 旁白 seed={NARRATOR_SEED}")

    clips_dir = os.path.join(PROJECT_DIR, "out/narration-clips")
    os.makedirs(clips_dir, exist_ok=True)

    clip_durations = []
    sample_rate = 24000

    for i, seg in enumerate(segments):
        clip_path = os.path.join(clips_dir, f"narr_{i:03d}.wav")
        params_infer = ChatTTS.Chat.InferCodeParams(
            spk_emb=narrator_spk, temperature=0.3, top_P=0.6, top_K=20,
            prompt="[speed_9]",
        )
        params_refine = ChatTTS.Chat.RefineTextParams(
            prompt="[oral_1][laugh_0][break_2]",
        )
        text = normalize_text(seg["narration"])
        wavs = chat.infer([text], params_infer_code=params_infer, params_refine_text=params_refine)
        audio_arr = np.array(wavs[0]).flatten()
        sf.write(clip_path, audio_arr, sample_rate, format="WAV", subtype="PCM_16")

        dur_s = get_audio_duration(clip_path)
        frames = LEAD_FRAMES + math.ceil(dur_s * FPS) + PAD_FRAMES
        clip_durations.append(frames)
        print(f"  [{i+1}/{len(segments)}] {dur_s:.1f}s -> {frames}帧")

    print("\n[step] 合并音轨...")
    combined = []
    lead_samples = int(LEAD_FRAMES / FPS * sample_rate)
    pad_samples = int(PAD_FRAMES / FPS * sample_rate)
    for i in range(len(segments)):
        clip_path = os.path.join(clips_dir, f"narr_{i:03d}.wav")
        audio_data, sr = sf.read(clip_path)
        combined.append(np.zeros(lead_samples, dtype=np.float32))  # lead silence
        combined.append(audio_data)
        combined.append(np.zeros(pad_samples, dtype=np.float32))   # trailing pad

    full_audio = np.concatenate(combined)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    sf.write(output_path, full_audio, sample_rate, format="WAV", subtype="PCM_16")
    total_s = len(full_audio) / sample_rate
    print(f"[done] 音轨: {output_path} ({total_s:.1f}秒)")

    print(f"\n[step] 回写 duration 到 {os.path.basename(DATA_FILE)}...")
    update_durations_in_ts(DATA_FILE, clip_durations)
    print("[done] duration 已更新")

    print(f"\n[next] 运行: cd engine && VIDPILOT_PROJECT=$PWD npx remotion render {ACCOUNT_ID}-narration ../out/{ACCOUNT_ID}-narration.mp4 --codec h264")


if __name__ == "__main__":
    main()
