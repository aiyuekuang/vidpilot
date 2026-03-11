#!/usr/bin/env python3
"""
发布视频到抖音。

用法：
  # 首次登录（扫码）
  python scripts/publish-douyin.py --login

  # 发布视频（立即）
  python scripts/publish-douyin.py --video out/dialogue-final.mp4 --title "三桶油集体涨停" --tags "A股,中石油,股市段子"

  # 定时发布
  python scripts/publish-douyin.py --video out/dialogue-final.mp4 --title "三桶油集体涨停" --tags "A股" --schedule "2026-03-05 16:00"
"""

import argparse
import asyncio
import os
import sys
from datetime import datetime
from pathlib import Path

# 添加 social-auto-upload 到 Python 路径
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
SAU_DIR = os.path.join(SCRIPT_DIR, "social-auto-upload")
sys.path.insert(0, SAU_DIR)

from uploader.douyin_uploader.main import douyin_setup, DouYinVideo

PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
COOKIE_DIR = os.path.join(PROJECT_DIR, "cookies")
COOKIE_FILE = os.path.join(COOKIE_DIR, "douyin_account.json")


async def login():
    """打开浏览器扫码登录，保存 Cookie"""
    os.makedirs(COOKIE_DIR, exist_ok=True)
    print("[info] 即将打开浏览器，请用抖音扫码登录")
    print("[info] 登录成功后，在 Playwright 调试器中点击 ▶ (继续) 按钮")
    await douyin_setup(COOKIE_FILE, handle=True)
    print(f"[done] Cookie 已保存到: {COOKIE_FILE}")


async def publish(video_path, title, tags, schedule_time=None, thumbnail=None):
    """发布视频到抖音"""
    if not os.path.exists(video_path):
        print(f"[error] 视频不存在: {video_path}")
        sys.exit(1)

    if not os.path.exists(COOKIE_FILE):
        print("[error] Cookie 不存在，请先运行: python scripts/publish-douyin.py --login")
        sys.exit(1)

    # 验证 Cookie
    print("[info] 验证 Cookie...")
    is_valid = await douyin_setup(COOKIE_FILE, handle=False)
    if not is_valid:
        print("[error] Cookie 已失效，请重新登录: python scripts/publish-douyin.py --login")
        sys.exit(1)

    publish_date = 0  # 立即发布
    if schedule_time:
        publish_date = datetime.strptime(schedule_time, "%Y-%m-%d %H:%M")
        print(f"[info] 定时发布: {schedule_time}")

    tag_list = [t.strip() for t in tags.split(",") if t.strip()]

    print(f"[info] 视频: {video_path}")
    print(f"[info] 标题: {title}")
    print(f"[info] 标签: {tag_list}")

    app = DouYinVideo(
        title=title,
        file_path=os.path.abspath(video_path),
        tags=tag_list,
        publish_date=publish_date,
        account_file=COOKIE_FILE,
        thumbnail_path=os.path.abspath(thumbnail) if thumbnail else None,
    )
    await app.main()
    print("[done] 视频发布成功！")


def main():
    parser = argparse.ArgumentParser(description="发布视频到抖音")
    parser.add_argument("--login", action="store_true", help="扫码登录获取 Cookie")
    parser.add_argument("--video", type=str, help="视频文件路径")
    parser.add_argument("--title", type=str, help="视频标题")
    parser.add_argument("--tags", type=str, default="", help="标签，逗号分隔")
    parser.add_argument("--schedule", type=str, help="定时发布，格式: YYYY-MM-DD HH:MM")
    parser.add_argument("--thumbnail", type=str, help="封面图路径")

    args = parser.parse_args()

    if args.login:
        asyncio.run(login())
    elif args.video and args.title:
        asyncio.run(publish(args.video, args.title, args.tags, args.schedule, args.thumbnail))
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
