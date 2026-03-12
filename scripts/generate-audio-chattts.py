#!/usr/bin/env python3
"""
用 ChatTTS 生成沙雕对话配音。
音频优先：先生成自然语音 → 测量时长 → 回写视频帧数。

用法：
  source .venv/bin/activate
  ACCOUNT=laodong python scripts/generate-audio-chattts.py
  # 兼容旧用法：
  DIALOGUE_FILE=src/data/stock/dialogue.ts python scripts/generate-audio-chattts.py
"""

import os
import re
import subprocess
import sys
import math
import numpy as np

# 在导入 ChatTTS 之前设置
os.environ["TOKENIZERS_PARALLELISM"] = "false"

import ChatTTS
import soundfile as sf
import torch

FPS = 30

# 全角→半角标点映射（ChatTTS 不支持全角标点）
PUNCT_MAP = str.maketrans({
    '！': '!', '？': '?', '，': ',', '。': '.', '；': ';',
    '：': ':', '"': '"', '"': '"', '（': '(', '）': ')',
    '、': ',', '…': '...', '—': '-',
})

def _int_to_chinese(n):
    """整数转中文读法（0~9999）"""
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
        # "十几" 而不是 "一十几"（仅独立使用时）
        if n // 10 == 1 and not result:
            result += '十'
        else:
            result += digits[n // 10] + '十'
        n %= 10
    if n > 0:
        result += digits[n]
    return result


def _num_to_chinese(num_str):
    """数字字符串转中文（支持小数）"""
    digits_map = '零一二三四五六七八九'
    if '.' in num_str:
        integer_part, decimal_part = num_str.split('.', 1)
        cn_int = _int_to_chinese(int(integer_part)) if integer_part else '零'
        cn_dec = ''.join(digits_map[int(d)] for d in decimal_part)
        return f"{cn_int}点{cn_dec}"
    return _int_to_chinese(int(num_str))


def _convert_numbers(text):
    """将文本中的阿拉伯数字转为中文读法"""
    # 1. 百分比: 0.7% → 百分之零点七
    text = re.sub(r'(\d+\.?\d*)%', lambda m: '百分之' + _num_to_chinese(m.group(1)), text)
    # 2. 年份: 2135年 → 二一三五年, 07年 → 零七年（逐位读）
    digits_map = '零一二三四五六七八九'
    text = re.sub(r'(\d{2,4})年', lambda m: ''.join(digits_map[int(d)] for d in m.group(1)) + '年', text)
    # 3. 带单位的数: 48块、187万、20亿、65美元、30倍、19年 等
    text = re.sub(r'(\d+\.?\d*)(块|万|亿|美元|倍|年|人|个|天|秒|岁)',
                  lambda m: _num_to_chinese(m.group(1)) + m.group(2), text)
    # 4. 剩余独立数字
    text = re.sub(r'\d+\.?\d*', lambda m: _num_to_chinese(m.group(0)), text)
    return text


def clean_text(text):
    """全角标点转半角 + 数字转中文"""
    text = text.translate(PUNCT_MAP)
    text = _convert_numbers(text)
    return text

PAD_FRAMES = 15  # 每句话后留 0.5 秒间隔

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)

# ── 账号配置：从 config.json 读取 ──────
from config_loader import get_data_file_path

ACCOUNT_ID = os.environ.get("ACCOUNT", "example")
DIALOGUE_FILE, _voice_seeds = get_data_file_path(
    ACCOUNT_ID, "dialogue",
    fallback_default="src/data/example/dialogue.example.ts",
)
SPEAKER_SEEDS = {
    "left": _voice_seeds.get("left", 42),
    "right": _voice_seeds.get("right", 2024),
}

# 角色专属语音参数（参考 narration 模式的清晰参数）
# [speed_n]: 1-9, 9=最快
# oral: 0-9, 口语化程度
# break_level: 0-7, 停顿幅度
# temperature: 越低越稳定，但过低会机械
ROLE_TTS_PARAMS = {
    "left": {   # 小李：年轻活泼，语速快
        "speed": 9,
        "oral": 1,
        "break_level": 2,
        "temperature": 0.3,
    },
    "right": {  # 老王：沉稳老练，语速稍慢
        "speed": 7,
        "oral": 1,
        "break_level": 3,
        "temperature": 0.3,
    },
}


def parse_dialogue_ts(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    match = re.search(
        r"export const \w+.*?:\s*DialogueLine\[\]\s*=\s*\[(.*?)\];",
        content, re.DOTALL,
    )
    if not match:
        raise ValueError("找不到 sampleDialogue 数据")
    dialogues = []
    for obj_match in re.finditer(
        r'\{\s*speaker:\s*"(\w+)".*?text:\s*"([^"]*)".*?duration:\s*(\d+)',
        match.group(1), re.DOTALL,
    ):
        dialogues.append({
            "speaker": obj_match.group(1),
            "text": obj_match.group(2),
            "duration": int(obj_match.group(3)),
        })
    return dialogues


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
    output_path = os.path.join(PROJECT_DIR, "out/dialogue-audio.wav")

    print("[info] 加载 ChatTTS 模型...")
    chat = ChatTTS.Chat()
    chat.load(compile=False)
    print("[info] 模型加载完成")

    print(f"\n[info] 读取对话: {DIALOGUE_FILE}")
    dialogues = parse_dialogue_ts(DIALOGUE_FILE)
    print(f"[info] 共 {len(dialogues)} 句对话")

    # 为每个角色生成固定音色
    speakers = {}
    for role, seed in SPEAKER_SEEDS.items():
        torch.manual_seed(seed)
        spk = chat.sample_random_speaker()
        speakers[role] = spk
        print(f"[info] 角色 {role} seed={seed}")

    # === 第1步：逐句生成语音 ===
    clips_dir = os.path.join(PROJECT_DIR, "out/clips")
    os.makedirs(clips_dir, exist_ok=True)

    clip_durations = []
    sample_rate = 24000  # ChatTTS 默认采样率

    for i, d in enumerate(dialogues):
        clip_path = os.path.join(clips_dir, f"line_{i:03d}.wav")
        role = d["speaker"]
        rp = ROLE_TTS_PARAMS.get(role, ROLE_TTS_PARAMS["right"])

        # === 参数分离：RefineTextParams 控制口语化/停顿，InferCodeParams 控制语速/稳定性 ===
        # oral/laugh/break 属于文本精炼层（RefineTextParams）
        # speed 属于声学推断层（InferCodeParams.prompt）
        params_refine = ChatTTS.Chat.RefineTextParams(
            prompt=f'[oral_{rp["oral"]}][laugh_0][break_{rp["break_level"]}]',
        )
        params_infer = ChatTTS.Chat.InferCodeParams(
            spk_emb=speakers[role],
            prompt=f'[speed_{rp["speed"]}]',
            temperature=rp["temperature"],
            top_P=0.6,
            top_K=20,
        )

        print(f"  [{i+1}/{len(dialogues)}] [{role}] \"{d['text'][:30]}\"", end="")

        wavs = chat.infer(
            [clean_text(d["text"])],
            skip_refine_text=False,        # 启用文本精炼，使 oral/break 生效
            params_refine_text=params_refine,
            params_infer_code=params_infer,
        )

        if wavs and len(wavs) > 0:
            audio = np.array(wavs[0]).flatten()
            sf.write(clip_path, audio, sample_rate, format="WAV", subtype="PCM_16")

            dur = len(audio) / sample_rate
            clip_durations.append(dur)
            print(f" → {dur:.2f}s")
        else:
            print(f" → 失败，用静音")
            silence = np.zeros(sample_rate * 2, dtype=np.float32)
            sf.write(clip_path, silence, sample_rate)
            clip_durations.append(2.0)

    # === 第2步：计算帧数并回写 TS ===
    print(f"\n[step2] 根据音频时长计算帧数...")
    new_frame_durations = []
    for i, dur in enumerate(clip_durations):
        frames = math.ceil(dur * FPS) + PAD_FRAMES
        new_frame_durations.append(frames)
        print(f"  [{i+1}] {dur:.2f}s → {frames} frames")

    total_frames = sum(new_frame_durations)
    total_sec = total_frames / FPS
    print(f"  总帧数: {total_frames}, 总时长: {total_sec:.1f}s")

    print(f"\n[step3] 回写 duration 到 {os.path.basename(DIALOGUE_FILE)}...")
    update_durations_in_ts(DIALOGUE_FILE, new_frame_durations)
    print(f"  ✓ 已更新")

    # === 第3步：合成完整音轨（简单拼接，无音效）===
    print(f"\n[step4] 合成完整音轨...")

    combined = []
    pad_samples = int(PAD_FRAMES / FPS * sample_rate)
    for i in range(len(dialogues)):
        clip_path = os.path.join(clips_dir, f"line_{i:03d}.wav")
        audio_data, sr = sf.read(clip_path)
        combined.append(audio_data)
        combined.append(np.zeros(pad_samples, dtype=np.float32))

    full_audio = np.concatenate(combined)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    sf.write(output_path, full_audio, sample_rate, format="WAV", subtype="PCM_16")

    dur = get_audio_duration(output_path)
    print(f"\n[done] 音轨: {output_path} ({dur:.1f}秒)")
    print(f"\n[next] 运行: cd engine && VIDPILOT_PROJECT=$PWD npx remotion render {ACCOUNT_ID}-dialogue ../out/{ACCOUNT_ID}-dialogue.mp4 --codec h264")


if __name__ == "__main__":
    main()
