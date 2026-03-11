#!/usr/bin/env node
/**
 * 抓取 A 股财经热点，筛选值得做视频的话题。
 *
 * 数据源：
 *   1. 新浪财经滚动新闻（A股/财经）
 *   2. 东方财富人气股排名
 *
 * 输出：JSON 格式的热点列表到 stdout
 *
 * 用法：
 *   node scripts/fetch-stock-hot.mjs                 # 输出所有热点
 *   node scripts/fetch-stock-hot.mjs --pick           # 自动选一个最佳话题
 *   node scripts/fetch-stock-hot.mjs --exclude-file data/published.json  # 排除已发布
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = path.dirname(__dirname);

// === 沙雕视频适合的关键词（越多命中越值得做）===
const HOT_KEYWORDS = [
  // 暴涨暴跌
  '涨停', '跌停', '暴涨', '暴跌', '崩盘', '熔断', '闪崩',
  // 散户相关
  '散户', '韭菜', '割肉', '抄底', '梭哈', '套牢', '站岗', '亏损',
  // 情绪性
  '疯狂', '恐慌', '狂飙', '炸裂', '离谱', '刷屏', '刷新', '史上',
  // 大事件
  '退市', '爆雷', 'ST', '财务造假', '重组', '收购', '停牌',
  // 行业热点
  'AI', '芯片', '新能源', '光伏', '锂电', '军工', '白酒',
  '中石油', '茅台', '宁德', '比亚迪',
  // 政策
  '降息', '降准', '印花税', '注册制', 'IPO', '国九条',
  // 国际
  '美股', '纳斯达克', '美联储', '关税', '贸易战',
];

// === 不适合做视频的关键词 ===
const SKIP_KEYWORDS = [
  '研报', '评级', '目标价', '维持', '推荐', '增持', '中性',
  '港元', '美元/桶', '基点', '期货', '债券',
];

/**
 * 抓取新浪财经新闻
 */
async function fetchSinaNews() {
  const res = await fetch(
    'https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=50&page=1&r=' + Math.random()
  );
  const data = await res.json();
  return (data.result?.data || []).map(item => ({
    title: item.title,
    url: item.url,
    time: new Date(item.ctime * 1000).toISOString(),
    source: 'sina',
  }));
}

/**
 * 抓取东方财富人气股排名
 */
async function fetchEastmoneyRank() {
  const res = await fetch('https://emappdata.eastmoney.com/stockrank/getAllCurrentList', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId: 'appId01',
      globalId: '786e4c21-70dc-435a-93bb-38',
      marketType: '',
      pageNo: 1,
      pageSize: 20,
    }),
  });
  const data = await res.json();
  return (data.data || []).map(item => ({
    code: item.sc,
    rank: item.rk,
    rankChange: item.hisRc,
  }));
}

/**
 * 给新闻标题打分（越高越适合做沙雕视频）
 */
function scoreTitle(title) {
  let score = 0;

  // 命中热门关键词 +3 分/个
  for (const kw of HOT_KEYWORDS) {
    if (title.includes(kw)) score += 3;
  }

  // 命中跳过关键词 -10 分/个
  for (const kw of SKIP_KEYWORDS) {
    if (title.includes(kw)) score -= 10;
  }

  // 有数字（百分比、金额）更有话题性 +2
  if (/\d+%/.test(title)) score += 2;
  if (/\d+亿|\d+万/.test(title)) score += 2;

  // 标题含感叹号/问号更情绪化 +1
  if (/[！!？?]/.test(title)) score += 1;

  // 标题太短不够料 -2
  if (title.length < 10) score -= 2;

  // 标题太长说明是分析文 -2
  if (title.length > 40) score -= 2;

  return score;
}

/**
 * 检查标题是否已发布过（模糊匹配）
 */
function isPublished(title, publishedList) {
  const titleClean = title.replace(/[，。！？、：""（）\s]/g, '');
  for (const pub of publishedList) {
    const pubClean = (pub.title || '').replace(/[，。！？、：""（）\s]/g, '');
    // 包含关系或相似度高则认为重复
    if (titleClean.includes(pubClean) || pubClean.includes(titleClean)) return true;
    // 关键词重叠度 > 60% 认为重复
    const titleWords = new Set(titleClean.match(/.{2}/g) || []);
    const pubWords = new Set(pubClean.match(/.{2}/g) || []);
    const overlap = [...titleWords].filter(w => pubWords.has(w)).length;
    const similarity = overlap / Math.max(titleWords.size, pubWords.size);
    if (similarity > 0.6) return true;
  }
  return false;
}

async function main() {
  const args = process.argv.slice(2);
  const pickMode = args.includes('--pick');
  const excludeIdx = args.indexOf('--exclude-file');
  const excludeFile = excludeIdx >= 0 ? args[excludeIdx + 1] : path.join(PROJECT_DIR, 'data/published.json');

  // 加载已发布记录
  let published = [];
  if (fs.existsSync(excludeFile)) {
    try {
      published = JSON.parse(fs.readFileSync(excludeFile, 'utf-8'));
    } catch { }
  }

  // 抓取数据
  const [news, stocks] = await Promise.all([
    fetchSinaNews(),
    fetchEastmoneyRank(),
  ]);

  // 打分 + 去重
  const scored = news
    .map(item => ({
      ...item,
      score: scoreTitle(item.title),
      isPublished: isPublished(item.title, published),
    }))
    .filter(item => item.score > 0 && !item.isPublished)
    .sort((a, b) => b.score - a.score);

  if (pickMode) {
    // 自动选最佳话题
    if (scored.length === 0) {
      console.error('[warn] 没有找到合适的新话题');
      process.exit(1);
    }
    const pick = scored[0];
    console.log(JSON.stringify({
      title: pick.title,
      score: pick.score,
      url: pick.url,
      time: pick.time,
      hotStocks: stocks.slice(0, 5).map(s => s.code),
    }));
  } else {
    // 输出所有候选
    console.log(JSON.stringify({
      candidates: scored.slice(0, 15),
      hotStocks: stocks.slice(0, 10),
      totalNews: news.length,
      filtered: scored.length,
      publishedCount: published.length,
    }, null, 2));
  }
}

main().catch(e => {
  console.error('[error]', e.message);
  process.exit(1);
});
