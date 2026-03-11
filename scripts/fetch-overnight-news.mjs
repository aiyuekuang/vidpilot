#!/usr/bin/env node
/**
 * 隔夜新闻 + 美欧亚太指数抓取 — 供 morning_brief 类型视频使用
 *
 * 数据源：
 *   1. 新浪财经滚动新闻（昨晚到今早）
 *   2. 新浪美股指数（道琼斯、纳斯达克、标普500）
 *   3. 新浪国际指数（日经225、恒生、英国富时、德国DAX）
 *
 * 输出：JSON 到 stdout
 * 用法：node scripts/fetch-overnight-news.mjs
 */

/**
 * 解析新浪行情 (美股/国际指数格式)
 *
 * 两种格式：
 *   gb_$xxx（美股）: 名称, 最新价, 涨跌幅%(数字), 时间戳, ...
 *   int_xxx / b_xxx（国际）: 名称, 最新价, 涨跌额, 涨跌幅%(数字), 昨收, ...
 */
function parseSinaIntl(raw, symbol) {
  // Bug fix: escape $ in symbol for regex (e.g. gb_$dji)
  const escapedSymbol = symbol.replace(/\$/g, "\\$");
  const match = raw.match(new RegExp(`hq_str_${escapedSymbol}="([^"]+)"`));
  if (!match) return null;
  const parts = match[1].split(",");

  if (symbol.startsWith("gb_")) {
    // 美股格式: parts[2]=涨跌幅(%), parts[3]=时间戳
    const pct = parseFloat(parts[2]);
    const price = parseFloat(parts[1]);
    const change = isNaN(pct) || isNaN(price) ? "0" : (price * pct / (100 + pct)).toFixed(2);
    return {
      name: parts[0],
      price: parts[1],
      change,
      changePct: parts[2] + "%",
    };
  } else {
    // 国际指数格式: parts[2]=涨跌额, parts[3]=涨跌幅(%)
    return {
      name: parts[0],
      price: parts[1],
      change: parts[2],
      changePct: parts[3] + "%",
    };
  }
}

/**
 * 抓取美股三大指数
 */
async function fetchUSMarkets() {
  const symbols = ["gb_$dji", "gb_$ixic", "gb_$inx"]; // 道琼斯、纳斯达克、标普500
  const url = `https://hq.sinajs.cn/list=${symbols.join(",")}`;

  try {
    const res = await fetch(url, {
      headers: {
        "Referer": "https://finance.sina.com.cn",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      },
    });
    const text = await res.text();
    const result = {};
    for (const sym of symbols) {
      const data = parseSinaIntl(text, sym);
      if (data) result[sym] = data;
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * 抓取亚太+欧洲指数
 */
async function fetchGlobalIndices() {
  // int_hangseng=恒生, int_nikkei=日经225, b_FTSE=富时100, b_DAX=德国DAX
  const symbols = ["int_hangseng", "int_nikkei", "b_FTSE", "b_DAX"];
  const url = `https://hq.sinajs.cn/list=${symbols.join(",")}`;

  try {
    const res = await fetch(url, {
      headers: {
        "Referer": "https://finance.sina.com.cn",
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      },
    });
    const text = await res.text();
    const result = {};
    for (const sym of symbols) {
      const data = parseSinaIntl(text, sym);
      if (data) result[sym] = data;
    }
    return result;
  } catch {
    return {};
  }
}

/**
 * 抓取隔夜财经新闻（昨晚18点起，无上限——兼容全天制作）
 */
async function fetchOvernightNews() {
  try {
    const res = await fetch(
      "https://feed.mix.sina.com.cn/api/roll/get?pageid=153&lid=2516&k=&num=50&page=1&r=" + Math.random(),
    );
    const data = await res.json();
    const items = data.result?.data || [];

    // Bug fix: 去掉 today9 上限，避免早于9点制作视频时返回空数组
    // 取昨晚18点到当前时刻的新闻
    const now = new Date();
    const yesterday18 = new Date(now);
    yesterday18.setDate(yesterday18.getDate() - 1);
    yesterday18.setHours(18, 0, 0, 0);

    const overnight = items
      .map(item => ({
        title: item.title,
        url: item.url,
        time: new Date(item.ctime * 1000).toISOString(),
      }))
      .filter(item => {
        const t = new Date(item.time);
        return t >= yesterday18 && t <= now;
      })
      .slice(0, 10); // 取最多10条

    return overnight;
  } catch {
    return [];
  }
}

async function main() {
  const [usMarkets, globalIndices, overnightNews] = await Promise.all([
    fetchUSMarkets(),
    fetchGlobalIndices(),
    fetchOvernightNews(),
  ]);

  const result = {
    date: new Date().toISOString().slice(0, 10),
    usMarkets,
    globalIndices,
    overnightNews,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch(e => {
  console.error("[error]", e.message);
  process.exit(1);
});
