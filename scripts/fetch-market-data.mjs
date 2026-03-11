#!/usr/bin/env node
/**
 * 收盘数据抓取 — 供 market_close 类型视频使用
 *
 * 数据源：
 *   1. 新浪实时行情 (上证/深证/创业板)
 *   2. 东方财富涨跌停统计
 *   3. 东方财富北向资金
 *   4. 东方财富板块涨幅排名
 *
 * 输出：JSON 到 stdout
 * 用法：node scripts/fetch-market-data.mjs
 */

/**
 * 解析新浪行情数据
 * 格式: var hq_str_sh000001="上证指数,3000.00,3010.00,...";
 */
function parseSinaQuote(raw, symbol) {
  const match = raw.match(new RegExp(`hq_str_${symbol}="([^"]+)"`));
  if (!match) return null;
  const parts = match[1].split(",");
  return {
    name: parts[0],
    open: parseFloat(parts[1]),
    prevClose: parseFloat(parts[2]),
    price: parseFloat(parts[3]),
    high: parseFloat(parts[4]),
    low: parseFloat(parts[5]),
    volume: parseFloat(parts[8]),   // 成交量(手)
    turnover: parseFloat(parts[9]), // 成交额(元)
  };
}

/**
 * 抓取A股三大指数
 */
async function fetchIndices() {
  const symbols = ["sh000001", "sz399001", "sz399006"]; // 上证、深证、创业板
  const url = `https://hq.sinajs.cn/list=${symbols.join(",")}`;
  const res = await fetch(url, {
    headers: {
      "Referer": "https://finance.sina.com.cn",
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
    },
  });
  const text = await res.text();

  const indices = {};
  for (const sym of symbols) {
    const data = parseSinaQuote(text, sym);
    if (data) {
      const change = data.price - data.prevClose;
      const changePct = ((change / data.prevClose) * 100).toFixed(2);
      indices[sym] = {
        ...data,
        change: change.toFixed(2),
        changePct: `${changePct}%`,
        turnoverYi: (data.turnover / 1e8).toFixed(0) + "亿",
      };
    }
  }
  return indices;
}

/**
 * 抓取涨跌停统计 (东方财富)
 */
async function fetchLimitStats() {
  try {
    const res = await fetch("https://push2ex.eastmoney.com/getTopicZTPool?ut=7eea3edcaed734bea9cb&dpt=wz.ztzt&Ession=0&_=" + Date.now(), {
      headers: { "Referer": "https://quote.eastmoney.com" },
    });
    const data = await res.json();
    const upLimit = data.data?.pool?.length || 0;

    const res2 = await fetch("https://push2ex.eastmoney.com/getTopicDTPool?ut=7eea3edcaed734bea9cb&dpt=wz.ztzt&Ession=0&_=" + Date.now(), {
      headers: { "Referer": "https://quote.eastmoney.com" },
    });
    const data2 = await res2.json();
    const downLimit = data2.data?.pool?.length || 0;

    return { upLimit, downLimit };
  } catch {
    return { upLimit: "N/A", downLimit: "N/A" };
  }
}

/**
 * 抓取北向资金 (东方财富)
 */
async function fetchNorthbound() {
  try {
    const res = await fetch(
      "https://push2his.eastmoney.com/api/qt/kamt.klt/get?fields1=f1,f2,f3,f4&fields2=f51,f52,f53,f54,f55,f56&ut=b2884a393a59ad64002292a3e90d46a5&_=" + Date.now(),
      { headers: { "Referer": "https://data.eastmoney.com" } }
    );
    const data = await res.json();
    const latest = data.data?.s2n?.slice(-1)?.[0];
    if (!latest) return { netBuy: "N/A" };
    const parts = latest.split(",");
    // f52=沪股通净买入, f53=深股通净买入, f54=北向合计
    const netBuy = parseFloat(parts[3]) || 0;
    return { netBuy: (netBuy / 1e4).toFixed(2) + "亿" };
  } catch {
    return { netBuy: "N/A" };
  }
}

/**
 * 抓取板块涨幅排名 (东方财富)
 */
async function fetchSectorRanking() {
  try {
    const res = await fetch(
      "https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=10&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=f2,f3,f12,f14&_=" + Date.now(),
      { headers: { "Referer": "https://quote.eastmoney.com" } }
    );
    const data = await res.json();
    const top = (data.data?.diff || []).slice(0, 5).map(item => ({
      name: item.f14,
      changePct: item.f3 + "%",
    }));

    // 跌幅前5
    const res2 = await fetch(
      "https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=5&po=0&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f3&fs=m:90+t:2&fields=f2,f3,f12,f14&_=" + Date.now(),
      { headers: { "Referer": "https://quote.eastmoney.com" } }
    );
    const data2 = await res2.json();
    const bottom = (data2.data?.diff || []).slice(0, 5).map(item => ({
      name: item.f14,
      changePct: item.f3 + "%",
    }));

    return { top, bottom };
  } catch {
    return { top: [], bottom: [] };
  }
}

async function main() {
  const [indices, limitStats, northbound, sectors] = await Promise.all([
    fetchIndices(),
    fetchLimitStats(),
    fetchNorthbound(),
    fetchSectorRanking(),
  ]);

  const result = {
    date: new Date().toISOString().slice(0, 10),
    time: new Date().toTimeString().slice(0, 5),
    indices,
    limitStats,
    northbound,
    sectors,
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch(e => {
  console.error("[error]", e.message);
  process.exit(1);
});
