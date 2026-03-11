# -*- coding: utf-8 -*-
import os
import asyncio
import tempfile

from playwright.async_api import Playwright, async_playwright, Page

from conf import LOCAL_CHROME_PATH, LOCAL_CHROME_HEADLESS
from utils.base_social_media import set_init_script
from utils.log import douyin_logger


# ---------------------------------------------------------------------------
# 封面图自动生成
# ---------------------------------------------------------------------------

def generate_cover_image(title: str, output_path: str) -> str:
    """用 Pillow 生成一张文章封面图（16:9，1280x720）。"""
    try:
        from PIL import Image, ImageDraw, ImageFont
    except ImportError:
        douyin_logger.warning('  [-] Pillow 未安装，跳过封面自动生成 (pip install Pillow)')
        return None

    W, H = 1280, 720
    img = Image.new('RGB', (W, H))
    draw = ImageDraw.Draw(img)

    # 渐变背景：深蓝 → 深紫
    for y in range(H):
        r = int(15 + (30 - 15) * y / H)
        g = int(20 + (15 - 20) * y / H)
        b = int(60 + (80 - 60) * y / H)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    draw.rectangle([60, 60, W - 60, H - 60], outline=(255, 255, 255, 30), width=2)
    draw.line([(80, H // 2 + 80), (W - 80, H // 2 + 80)], fill=(100, 140, 255), width=2)

    font_candidates = [
        '/System/Library/Fonts/PingFang.ttc',
        '/System/Library/Fonts/STHeiti Medium.ttc',
        '/Library/Fonts/Arial Unicode MS.ttf',
        '/usr/share/fonts/truetype/wqy/wqy-zenhei.ttc',
        '/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc',
    ]
    title_font = None
    for fp in font_candidates:
        if os.path.exists(fp):
            try:
                title_font = ImageFont.truetype(fp, 56)
                break
            except Exception:
                continue
    if title_font is None:
        title_font = ImageFont.load_default()

    max_chars = 16
    lines = []
    t = title
    while len(t) > max_chars:
        lines.append(t[:max_chars])
        t = t[max_chars:]
    lines.append(t)

    line_h = 70
    total_h = len(lines) * line_h
    start_y = (H - total_h) // 2 - 20

    for i, line in enumerate(lines):
        bbox = draw.textbbox((0, 0), line, font=title_font)
        text_w = bbox[2] - bbox[0]
        x = (W - text_w) // 2
        y = start_y + i * line_h
        draw.text((x + 2, y + 2), line, font=title_font, fill=(0, 0, 0, 120))
        draw.text((x, y), line, font=title_font, fill=(255, 255, 255))

    img.save(output_path, 'PNG')
    douyin_logger.info(f'  [-] 已自动生成封面图: {output_path}')
    return output_path


# ---------------------------------------------------------------------------
# Cookie 管理
# ---------------------------------------------------------------------------

async def cookie_auth(account_file):
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=LOCAL_CHROME_HEADLESS)
        context = await browser.new_context(storage_state=account_file)
        context = await set_init_script(context)
        page = await context.new_page()
        await page.goto("https://creator.douyin.com/creator-micro/content/upload")
        try:
            await page.wait_for_url("https://creator.douyin.com/creator-micro/content/upload", timeout=5000)
        except:
            await context.close()
            await browser.close()
            return False
        if await page.get_by_text('手机号登录').count() or await page.get_by_text('扫码登录').count():
            print("[+] cookie 失效")
            return False
        print("[+] cookie 有效")
        return True


async def douyin_setup(account_file, handle=False):
    if not os.path.exists(account_file) or not await cookie_auth(account_file):
        if not handle:
            return False
        douyin_logger.info('[+] cookie文件不存在或已失效，即将自动打开浏览器，请扫码登录')
        await douyin_cookie_gen(account_file)
    return True


async def douyin_cookie_gen(account_file):
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=LOCAL_CHROME_HEADLESS)
        context = await browser.new_context()
        context = await set_init_script(context)
        page = await context.new_page()
        await page.goto("https://creator.douyin.com/")
        await page.pause()
        await context.storage_state(path=account_file)


# ---------------------------------------------------------------------------
# 文章发布类
# ---------------------------------------------------------------------------

class DouYinArticle(object):
    def __init__(self, title, content, tags=None, summary='', publish_date=0,
                 account_file=None, cover_path=None, auto_publish=True):
        self.title = title
        self.content = content
        self.tags = tags or []
        self.summary = summary          # 文章摘要，最多30字
        self.publish_date = publish_date
        self.account_file = account_file
        self.local_executable_path = LOCAL_CHROME_PATH
        self.headless = LOCAL_CHROME_HEADLESS
        self.cover_path = cover_path
        self.auto_publish = auto_publish
        self._tmp_cover = None

    # ------------------------------------------------------------------
    # 内部工具
    # ------------------------------------------------------------------

    def _get_cover_path(self) -> str | None:
        if self.cover_path and os.path.exists(self.cover_path):
            return self.cover_path
        tmp = tempfile.NamedTemporaryFile(suffix='.png', delete=False)
        tmp.close()
        result = generate_cover_image(self.title, tmp.name)
        if result:
            self._tmp_cover = tmp.name
            return tmp.name
        os.unlink(tmp.name)
        return None

    def _cleanup_tmp_cover(self):
        if self._tmp_cover and os.path.exists(self._tmp_cover):
            os.unlink(self._tmp_cover)
            self._tmp_cover = None

    async def _dismiss_guide_popups(self, page: Page):
        """关闭新手引导弹窗（shepherd.js）。"""
        for btn_text in ['我知道了', '知道了', '跳过']:
            btn = page.get_by_text(btn_text, exact=True)
            if await btn.count():
                try:
                    await btn.first.click(timeout=2000)
                    douyin_logger.info(f'  [-] 已关闭引导弹窗（{btn_text}）')
                    await asyncio.sleep(0.5)
                except:
                    pass

    # ------------------------------------------------------------------
    # 各字段填写
    # ------------------------------------------------------------------

    async def _fill_title(self, page: Page):
        douyin_logger.info(f'  [-] 正在填写标题: {self.title}')
        # placeholder 已通过 DOM 分析确认
        inp = page.locator('input[placeholder*="请输入文章标题"]')
        if await inp.count():
            await inp.first.fill(self.title[:30])
            douyin_logger.info('  [+] 标题已填写')
        else:
            douyin_logger.warning('  [-] 未找到标题输入框')

    async def _fill_content(self, page: Page):
        douyin_logger.info(f'  [-] 正在填写正文 ({len(self.content)} 字)')
        # DOM 分析确认：正文编辑器为 .tiptap.ProseMirror
        editor = page.locator('.tiptap.ProseMirror, .ProseMirror')
        if await editor.count():
            await editor.first.click()
            await page.keyboard.type(self.content)
            douyin_logger.info('  [+] 正文已填写')
            return
        # 兜底：取所有 contenteditable 的最后一个
        editors = await page.locator('[contenteditable="true"]').all()
        if editors:
            await editors[-1].click()
            await page.keyboard.type(self.content)
            douyin_logger.info('  [+] 正文已填写（兜底）')
        else:
            douyin_logger.error('  [-] 未找到正文编辑器')

    async def _fill_summary(self, page: Page):
        if not self.summary:
            return
        douyin_logger.info(f'  [-] 正在填写摘要: {self.summary[:30]}')
        # DOM 分析确认：摘要 input 的 placeholder 包含"摘要"
        inp = page.locator('input[placeholder*="摘要"]')
        if await inp.count():
            await inp.first.fill(self.summary[:30])
            douyin_logger.info('  [+] 摘要已填写')
        else:
            douyin_logger.warning('  [-] 未找到摘要输入框，跳过')

    async def _set_cover(self, page: Page, cover_path: str):
        """
        主动点击"点击上传封面图"触发 filechooser，
        然后注入封面文件，关闭引导弹窗，点击"完成"。
        """
        douyin_logger.info(f'  [-] 正在上传封面图片')
        try:
            # DOM 分析确认：封面上传触发元素为 span.mycard-info-uBuPL9 "点击上传封面图"
            trigger = page.get_by_text("点击上传封面图", exact=True)
            async with page.expect_file_chooser(timeout=5000) as fc_info:
                await trigger.click()
            fc = await fc_info.value
            await fc.set_files(cover_path)
            douyin_logger.info('  [-] 封面图片已注入，等待编辑器加载...')
            await asyncio.sleep(2)

            # 关闭可能出现的引导弹窗（会遮挡"完成"按钮）
            await self._dismiss_guide_popups(page)

            # 点击封面编辑器的"完成"按钮
            done_btn = page.locator('button:has-text("完成")').last
            if await done_btn.count():
                await done_btn.click()
                douyin_logger.info('  [+] 封面已确认（点击完成）')
                await asyncio.sleep(2)
        except Exception as e:
            douyin_logger.warning(f'  [-] 封面上传遇到问题: {e}，将在发布时由拦截器处理')
            # 注册兜底拦截器：如果发布时抖音弹出文件选择框，自动注入
            async def _fallback_chooser(chooser):
                douyin_logger.info('  [-] 兜底拦截器：自动注入封面图')
                await chooser.set_files(cover_path)
                await asyncio.sleep(2)
                await self._dismiss_guide_popups(page)
                done_btn = page.locator('button:has-text("完成")').last
                if await done_btn.count():
                    await done_btn.click()
                    await asyncio.sleep(2)
            page.on('filechooser', lambda fc: asyncio.ensure_future(_fallback_chooser(fc)))

    async def _add_tags(self, page: Page):
        if not self.tags:
            return
        douyin_logger.info(f'  [-] 正在添加话题: {self.tags}')

        # 第一步：点击话题区域，打开话题选择器 Modal
        topic_area = page.locator('[class*="topicSelector"]')
        if not await topic_area.count():
            topic_area = page.get_by_text("点击添加话题", exact=False)
        if not await topic_area.count():
            douyin_logger.warning('  [-] 未找到话题输入区域，跳过')
            return

        await topic_area.first.click()
        await asyncio.sleep(1)

        # 第二步：在 Modal 内依次搜索并选择话题
        # 截图确认：placeholder = "搜索或输入你想添加的话题"
        modal_input = page.get_by_placeholder("搜索或输入你想添加的话题")
        if not await modal_input.count():
            modal_input = page.locator('.semi-modal-content input').first

        added = 0
        for tag in self.tags[:5]:
            await modal_input.fill('')
            await modal_input.type(tag)
            await asyncio.sleep(1)

            # 等待话题列表出现，点第一个
            suggestion = page.locator('[class*="topicItem"], [class*="listItem"]')
            if await suggestion.count():
                await suggestion.first.click()
                added += 1
                douyin_logger.info(f'  [-] 已选择话题: {tag}')
                await asyncio.sleep(0.3)
                await modal_input.fill('')  # 清空输入框，准备下一个
            else:
                douyin_logger.warning(f'  [-] 未找到话题建议: {tag}，跳过')

        # 第三步：截图确认按钮文字为"确认添加"
        confirm_btn = page.get_by_text("确认添加", exact=False)
        if await confirm_btn.count():
            await confirm_btn.first.click()
            await asyncio.sleep(1)
            douyin_logger.info(f'  [+] 已添加 {added} 个话题')
        else:
            await page.keyboard.press('Escape')
            await asyncio.sleep(0.5)
            douyin_logger.info(f'  [+] 话题 modal 已关闭，添加了 {added} 个话题')

    async def _set_schedule_time(self, page: Page):
        label_element = page.locator("[class^='radio']:has-text('定时发布')")
        await label_element.click()
        await asyncio.sleep(1)
        publish_date_hour = self.publish_date.strftime("%Y-%m-%d %H:%M")
        await page.locator('.semi-input[placeholder="日期和时间"]').click()
        await page.keyboard.press("Control+KeyA")
        await page.keyboard.type(publish_date_hour)
        await page.keyboard.press("Enter")
        await asyncio.sleep(1)

    # ------------------------------------------------------------------
    # 主流程
    # ------------------------------------------------------------------

    async def upload(self, playwright: Playwright) -> None:
        if self.local_executable_path:
            browser = await playwright.chromium.launch(
                headless=self.headless, executable_path=self.local_executable_path)
        else:
            browser = await playwright.chromium.launch(headless=self.headless)

        context = await browser.new_context(storage_state=f"{self.account_file}")
        context = await set_init_script(context)
        page = await context.new_page()

        try:
            # 1. 进入创作者中心
            await page.goto("https://creator.douyin.com/creator-micro/content/upload")
            douyin_logger.info(f'[+] 正在发布文章: {self.title}')
            await page.wait_for_url("https://creator.douyin.com/creator-micro/content/upload")
            await asyncio.sleep(2)

            # 2. 切换到"发布文章" tab
            tab = page.get_by_text("发布文章", exact=True)
            if await tab.count():
                await tab.click()
                douyin_logger.info('  [-] 已切换到"发布文章"标签')
            else:
                await page.goto("https://creator.douyin.com/creator-micro/content/article")
            await asyncio.sleep(2)

            # 3. 点击"我要发文"
            for btn in [page.get_by_text("我要发文", exact=True),
                        page.locator('button:has-text("我要发文")')]:
                if await btn.count():
                    await btn.first.click()
                    douyin_logger.info('  [-] 已点击"我要发文"')
                    break
            else:
                douyin_logger.error('  [-] 未找到"我要发文"按钮')
                return
            await asyncio.sleep(3)

            # 4. 等待编辑器页面加载
            try:
                await page.wait_for_url("**/article**", timeout=10000)
            except:
                pass
            await asyncio.sleep(2)

            # 5. 关闭初始引导弹窗
            await self._dismiss_guide_popups(page)

            # 6. 填写标题
            await self._fill_title(page)
            await asyncio.sleep(1)

            # 7. 填写正文
            await self._fill_content(page)
            await asyncio.sleep(1)

            # 8. 填写摘要
            await self._fill_summary(page)
            await asyncio.sleep(0.5)

            # 9. 上传封面（主动点击"点击上传封面图"）
            cover_path = self._get_cover_path()
            if cover_path:
                await self._set_cover(page, cover_path)

            # 10. 添加话题（暂时跳过，话题 Modal 交互待后续完善）
            # await self._add_tags(page)

            # 11. 定时发布
            if self.publish_date != 0:
                await self._set_schedule_time(page)

            # 12. 关闭发布前可能出现的引导弹窗
            await self._dismiss_guide_popups(page)

            if self.auto_publish:
                # 13a. 自动发布
                douyin_logger.info('  [-] 正在发布文章...')
                attempt = 0
                while True:
                    attempt += 1
                    publish_button = page.locator('button[type="submit"]:has-text("发布")')
                    if not await publish_button.count():
                        publish_button = page.get_by_role('button', name="发布", exact=True)
                    if await publish_button.count():
                        await publish_button.first.click()
                        await asyncio.sleep(3)

                    try:
                        await page.wait_for_url("**/content/manage**", timeout=4000)
                        douyin_logger.success("  [+] 文章发布成功！")
                        break
                    except:
                        pass

                    for err_text in ['请填写标题', '内容不能为空', '违规']:
                        if await page.get_by_text(err_text, exact=False).count():
                            douyin_logger.error(f'  [-] 发布失败：{err_text}')
                            return

                    if attempt > 15:
                        douyin_logger.error('  [-] 超过最大重试次数，发布失败')
                        return

                    douyin_logger.info(f'  [-] 等待发布结果... (第{attempt}次)')
                    await asyncio.sleep(2)
            else:
                # 13b. 不自动发布，暂存离开（保存草稿）
                douyin_logger.success('  [+] 内容已全部填写完毕，暂存草稿...')
                save_btn = page.locator('button:has-text("暂存离开")')
                if await save_btn.count():
                    await save_btn.first.click()
                    await asyncio.sleep(2)
                    douyin_logger.success('  [+] 已暂存草稿，请手动前往创作者中心发布')

        finally:
            self._cleanup_tmp_cover()
            await context.storage_state(path=self.account_file)
            douyin_logger.success('  [-] cookie 已更新')
            await asyncio.sleep(2)
            await context.close()
            await browser.close()

    async def main(self):
        async with async_playwright() as playwright:
            await self.upload(playwright)
