import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const TEAMS_PATH = resolve(ROOT, "site/config/teams.json");
const OUTPUT_PATH = resolve(ROOT, "site/data/news.json");
const EDITION = { hl: "ko", gl: "KR", ceid: "KR:ko" };
const MAX_ITEMS = 40;
const CONCURRENCY = 3;
const TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 2;

function decodeXml(value = "") {
  return String(value)
    .replace(/^<!\[CDATA\[([\s\S]*?)\]\]>$/i, "$1")
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function readTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? decodeXml(match[1]) : "";
}

function stripMarkup(value) {
  return decodeXml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " "));
}

function parseRss(xml) {
  const items = [];
  for (const match of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const block = match[1];
    const title = stripMarkup(readTag(block, "title"));
    const link = readTag(block, "link");
    const pubDate = readTag(block, "pubDate");
    const description = stripMarkup(readTag(block, "description"));
    const sourceBlock = block.match(/<source\b([^>]*)>([\s\S]*?)<\/source>/i);
    const source = sourceBlock ? stripMarkup(sourceBlock[2]) : "Google News";
    if (!title || !/^https?:\/\//i.test(link)) continue;
    items.push({ title, link, pubDate, description, source });
    if (items.length >= MAX_ITEMS) break;
  }
  const channelTitle = readTag(xml, "title");
  const lastBuildDate = readTag(xml, "lastBuildDate");
  return { channelTitle, lastBuildDate, items };
}

function makeFeedUrl(query) {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  for (const [key, value] of Object.entries(EDITION)) url.searchParams.set(key, value);
  return url;
}

const sleep = (ms) => new Promise((resolvePromise) => setTimeout(resolvePromise, ms));

async function fetchFeed(query) {
  const url = makeFeedUrl(query);
  let lastError;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          "Accept": "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.8",
          "User-Agent": "KBO-Club-News/1.0 (GitHub Actions RSS reader)"
        },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const xml = await response.text();
      if (!xml.includes("<rss") && !xml.includes("<feed")) throw new Error("RSS/XML 응답이 아닙니다.");
      return parseRss(xml);
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) await sleep(600 * attempt);
    }
  }
  throw lastError || new Error("RSS 요청 실패");
}

async function mapLimit(items, limit, callback) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = nextIndex++;
      if (index >= items.length) return;
      results[index] = await callback(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function uniqueItems(items) {
  const seen = new Set();
  return items.filter((item) => {
    const key = item.link.replace(/[?#].*$/, "").replace(/\/$/, "");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function main() {
  const teams = JSON.parse(await readFile(TEAMS_PATH, "utf8"));
  const tasks = teams.flatMap((team) => [
    { team, source: "news", query: `"${team.name}" 야구 when:7d` },
    { team, source: "official", query: `site:${team.officialDomain} "${team.name}" when:30d` }
  ]);

  let successfulFeeds = 0;
  const errors = [];
  const collected = await mapLimit(tasks, CONCURRENCY, async (task) => {
    try {
      const result = await fetchFeed(task.query);
      successfulFeeds += 1;
      console.log(`OK ${task.team.name} [${task.source}]: ${result.items.length} items`);
      return {
        teamId: task.team.id,
        source: task.source,
        feed: {
          total: result.items.length,
          display: result.items.length,
          lastBuildDate: result.lastBuildDate,
          items: uniqueItems(result.items)
        }
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push({ team: task.team.id, source: task.source, message });
      console.warn(`WARN ${task.team.name} [${task.source}]: ${message}`);
      return {
        teamId: task.team.id,
        source: task.source,
        feed: { total: 0, display: 0, lastBuildDate: "", items: [], error: message }
      };
    }
  });

  if (successfulFeeds === 0) {
    throw new Error("모든 RSS 수집에 실패해 기존 사이트 데이터를 덮어쓰지 않았습니다.");
  }

  const byTeam = Object.fromEntries(teams.map((team) => [team.id, {
    news: { total: 0, display: 0, lastBuildDate: "", items: [] },
    official: { total: 0, display: 0, lastBuildDate: "", items: [] },
    officialUrl: team.officialUrl,
    officialDomain: team.officialDomain
  }]));

  for (const entry of collected) {
    byTeam[entry.teamId][entry.source] = entry.feed;
  }

  const output = {
    generatedAt: new Date().toISOString(),
    provider: "Google News RSS",
    note: "RSS 검색 결과는 30분마다 GitHub Actions에서 수집됩니다. Google News RSS는 공식 보장 API가 아니므로 결과나 피드 형식이 바뀔 수 있습니다.",
    successfulFeeds,
    failedFeeds: errors.length,
    errors,
    teams: byTeam
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(output, null, 2) + "\n", "utf8");
  console.log(`Wrote ${OUTPUT_PATH}; successful feeds: ${successfulFeeds}; failed feeds: ${errors.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
