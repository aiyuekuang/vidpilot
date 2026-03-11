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

import json
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

# 角色专属语音参数
# [speed_n]: 1-9, 5=默认速度, 数字越大越快
# oral: 0-9, 口语化程度（越高越多"嗯啊"）
# break_level: 0-7, 停顿幅度
# temperature: 越低越稳定清晰
ROLE_TTS_PARAMS = {
    "left": {   # 小李：年轻活泼，语速稍快，语气有弹性
        "speed": 5,
        "oral": 2,
        "break_level": 4,
        "temperature": 0.1,
    },
    "right": {  # 老王：沉稳老练，语速稍慢，停顿感更强
        "speed": 3,
        "oral": 1,
        "break_level": 5,
        "temperature": 0.05,
    },
}


def parse_dialogue_ts(filepath):
    with open(filepath, "r", encoding="utf-8") as f:
        content = f.read()
    match = re.search(
        r"export const \w+Dialogue.*?=\s*\[(.*?)\];",
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
            prompt=f'[speed_{rp["speed"]}]',   # 语速控制必须在 InferCodeParams
            temperature=rp["temperature"],       # 低温度 = 发音更稳定清晰
            top_P=0.7,
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
            audio = wavs[0]
            if isinstance(audio, torch.Tensor):
                audio = audio.numpy()
            audio = audio.flatten()

            # 归一化音量（RMS 归一化，比 peak 归一化听感更均匀）
            rms = np.sqrt(np.mean(audio ** 2))
            if rms > 0:
                audio = audio / rms * 0.25   # 目标 RMS ~0.25
            # 限幅防止过载
            audio = np.clip(audio, -0.95, 0.95)

            sf.write(clip_path, audio, sample_rate)

            # === ffmpeg 后处理：去高频噪音 + 动态均衡 ===
            # ChatTTS 官方有意加入高频噪音，lowpass 可大幅改善清晰度
            cleaned_path = clip_path + ".clean.wav"
            ffmpeg_af = ",".join([
                "highpass=f=150",          # 去低频噪音/底噪
                "lowpass=f=8000",          # 去 ChatTTS 高频噪音
                "equalizer=f=3000:width_type=o:width=2:g=2",  # 提升人声中频（3kHz）
                "dynaudnorm=g=5:m=2.0:r=0.9",  # 动态音量均衡，让安静段更清晰
            ])
            clean_result = subprocess.run(
                ["ffmpeg", "-y", "-i", clip_path, "-af", ffmpeg_af, cleaned_path],
                capture_output=True,
            )
            if clean_result.returncode == 0:
                os.replace(cleaned_path, clip_path)

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

    # === 第3步：合成完整音轨（含音效）===
    print(f"\n[step4] 合成完整音轨...")

    timings = []
    current_frame = 0
    for frames in new_frame_durations:
        timings.append({"start_sec": current_frame / FPS})
        current_frame += frames

    # --- 音效映射：line_index → [(sfx_file, delay_from_line_start_sec, volume)] ---
    SFX_DIR = os.path.join(PROJECT_DIR, "engine/public/sfx")
    SFX_MAP = {
        0:  [("ding.wav", 0.0, 0.3)],                         # 开场：叮~
        1:  [("slap.wav", 0.0, 0.4)],                         # 花呗炒股→打脸
        3:  [("suspense.wav", 0.0, 0.25)],                    # 设悬念：油价涨1美元…
        5:  [("shock.wav", 0.0, 0.35)],                       # 0.7%数据轰炸→震惊
        8:  [("shock.wav", 0.0, 0.35)],                       # 啥？国家拿走一半→震惊
        9:  [("slap.wav", 0.0, 0.35)],                        # 继续打脸：左手赚右手亏
        11: [("suspense.wav", 0.0, 0.25)],                    # 设悬念：07年48块…
        13: [("shock.wav", 0.0, 0.35),                        # 13块→震惊
             ("sad_trombone.wav", 1.5, 0.3)],                  # 站岗19年→悲伤长号
        16: [("cry.wav", 0.0, 0.3)],                          # 主力跑了→哭
        17: [("slap.wav", 0.3, 0.35)],                        # 逻辑打脸：还用当博主？
        18: [("sad_trombone.wav", 0.0, 0.3)],                  # 绝望：价值投资…
        19: [("suspense.wav", 0.0, 0.25)],                    # 又设套：芯片大消息
        20: [("ding.wav", 0.0, 0.3), ("mock.wav", 1.0, 0.3)], # 结尾：叮+嘲讽
    }

    inputs = []
    filter_parts = []
    input_idx = 0

    # 对话音频
    clip_files = [os.path.join(clips_dir, f"line_{i:03d}.wav")
                  for i in range(len(dialogues))]
    dialogue_labels = []
    for i, (cf, t) in enumerate(zip(clip_files, timings)):
        inputs.extend(["-i", cf])
        delay_ms = int(t["start_sec"] * 1000)
        label = f"d{input_idx}"
        filter_parts.append(
            f"[{input_idx}]asetpts=PTS-STARTPTS,adelay={delay_ms}|{delay_ms}[{label}]"
        )
        dialogue_labels.append(label)
        input_idx += 1

    # 音效
    sfx_labels = []
    for line_idx, sfx_list in SFX_MAP.items():
        if line_idx >= len(timings):
            continue
        line_start = timings[line_idx]["start_sec"]
        for sfx_file, offset_sec, vol in sfx_list:
            sfx_path = os.path.join(SFX_DIR, sfx_file)
            if not os.path.exists(sfx_path):
                continue
            inputs.extend(["-i", sfx_path])
            delay_ms = int((line_start + offset_sec) * 1000)
            label = f"s{input_idx}"
            filter_parts.append(
                f"[{input_idx}]asetpts=PTS-STARTPTS,adelay={delay_ms}|{delay_ms},"
                f"volume={vol}[{label}]"
            )
            sfx_labels.append(label)
            input_idx += 1

    all_labels = dialogue_labels + sfx_labels
    mix_inputs = "".join(f"[{l}]" for l in all_labels)
    n = len(all_labels)
    # 对话数量用来补偿 amix 的音量衰减（音效音量已通过 volume 控制）
    boost = len(dialogue_labels)
    filter_parts.append(
        f"{mix_inputs}amix=inputs={n}"
        f":duration=longest:dropout_transition=0:normalize=0[mixed];"
        f"[mixed]volume={boost}[out]"
    )
    print(f"  对话 {len(dialogue_labels)} 条 + 音效 {len(sfx_labels)} 个")

    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    cmd = [
        "ffmpeg", "-y",
        *inputs,
        "-filter_complex", ";".join(filter_parts),
        "-map", "[out]",
        "-ar", "44100", "-ac", "1",
        "-t", str(total_sec),
        output_path,
    ]
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"[error] ffmpeg 错误:\n{result.stderr[-500:]}")
        sys.exit(1)

    dur = get_audio_duration(output_path)
    print(f"\n[done] 音轨: {output_path} ({dur:.1f}秒)")
    print(f"[next] 运行 npm run build 渲染视频")


if __name__ == "__main__":
    main()
