import asyncio
from pathlib import Path

from conf import BASE_DIR
from uploader.douyin_article_uploader.main import douyin_setup, DouYinArticle


if __name__ == '__main__':
    account_file = Path(BASE_DIR / "cookies" / "douyin_uploader" / "account.json")

    # 确保已登录（复用视频发布的 cookie）
    cookie_setup = asyncio.run(douyin_setup(account_file, handle=False))
    if not cookie_setup:
        print("cookie 失效，请先运行 get_douyin_cookie.py 登录")
        exit(1)

    # 文章内容
    title = "这是一篇测试文章标题"
    content = """这是文章的正文内容。

抖音现在支持发布长文了，可以写 300-8000 字的文章。

优质文章还可以获得丰富流量奖励！
"""
    tags = ["测试", "抖音文章"]

    # 封面图片（可选）
    cover_path = None  # 如需封面，设置图片路径，如: Path(BASE_DIR) / "covers" / "cover.png"

    # 定时发布（0 表示立即发布）
    publish_date = 0

    app = DouYinArticle(
        title=title,
        content=content,
        tags=tags,
        publish_date=publish_date,
        account_file=account_file,
        cover_path=cover_path,
    )
    asyncio.run(app.main(), debug=False)
