const TEAMS = {
  lg: { name: "LG 트윈스", officialDomain: "lgtwins.com" },
  doosan: { name: "두산 베어스", officialDomain: "doosanbears.com" },
  kt: { name: "KT 위즈", officialDomain: "ktwiz.co.kr" },
  ssg: { name: "SSG 랜더스", officialDomain: "ssglanders.com" },
  nc: { name: "NC 다이노스", officialDomain: "ncdinos.com" },
  lotte: { name: "롯데 자이언츠", officialDomain: "giantsclub.com" },
  samsung: { name: "삼성 라이온즈", officialDomain: "samsunglions.com" },
  kia: { name: "KIA 타이거즈", officialDomain: "tigers.co.kr" },
  hanwha: { name: "한화 이글스", officialDomain: "hanwhaeagles.co.kr" },
  kiwoom: { name: "키움 히어로즈", officialDomain: "heroesbaseball.co.kr" }
};
const API_BASE = "https://naverapihub.apigw.ntruss.com/search/v1";

function jsonError(status, message, origin, allowedOrigin) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff"
  });
  if (origin && origin === allowedOrigin) headers.set("Access-Control-Allow-Origin", allowedOrigin);
  return new Response(JSON.stringify({ error: message }), { status, headers });
}

export default {
  async fetch(request, env) {
    const requestUrl = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = String(env.ALLOWED_ORIGIN || "https://jihun121.github.io").replace(/\/$/, "");
    const corsHeaders = {
      "Access-Control-Allow-Origin": allowedOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Accept",
      "Access-Control-Max-Age": "86400",
      "Vary": "Origin"
    };

    if (request.method === "OPTIONS") {
      if (origin && origin !== allowedOrigin) return new Response(null, { status: 403 });
      return new Response(null, { status: 204, headers: corsHeaders });
    }
    if (origin !== allowedOrigin) {
      return jsonError(403, "허용된 GitHub Pages 사이트에서만 요청할 수 있습니다.", origin, allowedOrigin);
    }
    if (request.method !== "GET") return jsonError(405, "GET 요청만 허용됩니다.", origin, allowedOrigin);

    const route = requestUrl.pathname.replace(/\/+$/, "") || "/";
    const teamId = requestUrl.searchParams.get("team") || "";
    const team = TEAMS[teamId];
    if (!team) return jsonError(400, "지원하지 않는 구단입니다.", origin, allowedOrigin);
    if (!env.NAVER_API_HUB_KEY_ID || !env.NAVER_API_HUB_KEY) {
      return jsonError(503, "NAVER API HUB 인증 정보가 Worker Secret에 설정되지 않았습니다.", origin, allowedOrigin);
    }

    let apiPath;
    let query;
    if (route === "/news") {
      apiPath = "news";
      query = team.name;
    } else if (route === "/official") {
      apiPath = "webkr";
      query = `site:${team.officialDomain} ${team.name}`;
    } else {
      return jsonError(404, "지원하지 않는 API 경로입니다.", origin, allowedOrigin);
    }

    const apiUrl = new URL(`${API_BASE}/${apiPath}`);
    apiUrl.searchParams.set("query", query);
    apiUrl.searchParams.set("display", "30");
    apiUrl.searchParams.set("sort", "date");

    try {
      // Pass the provider response body through without caching, sorting,
      // classifying, deduplicating, or persisting the search results.
      const upstream = await fetch(apiUrl.toString(), {
        method: "GET",
        headers: {
          "X-NCP-APIGW-API-KEY-ID": env.NAVER_API_HUB_KEY_ID,
          "X-NCP-APIGW-API-KEY": env.NAVER_API_HUB_KEY,
          "Accept": "application/json",
          "Cache-Control": "no-cache"
        },
        cf: { cacheTtl: 0, cacheEverything: false }
      });
      const headers = new Headers(upstream.headers);
      for (const [name, value] of Object.entries(corsHeaders)) headers.set(name, value);
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
      headers.set("Pragma", "no-cache");
      headers.set("X-Content-Type-Options", "nosniff");
      headers.delete("Set-Cookie");
      return new Response(upstream.body, { status: upstream.status, statusText: upstream.statusText, headers });
    } catch {
      return jsonError(502, "NAVER API HUB에 연결하지 못했습니다. 잠시 후 다시 시도해 주세요.", origin, allowedOrigin);
    }
  }
};
