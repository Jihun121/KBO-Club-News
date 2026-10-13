const TEAM_CONFIG_URL = "./config/teams.json";
const AUTO_REFRESH_MS = 30 * 60 * 1000;
const NEWS_DATA_URL = "./data/news.json";
const elements = {
  teamSelect: document.querySelector("#teamSelect"),
  refreshButton: document.querySelector("#refreshButton"),
  refreshHelp: document.querySelector("#refreshHelp"),
  newsTab: document.querySelector("#newsTab"),
  officialTab: document.querySelector("#officialTab"),
  linksTab: document.querySelector("#linksTab"),
  newsPanel: document.querySelector("#newsPanel"),
  officialPanel: document.querySelector("#officialPanel"),
  linksPanel: document.querySelector("#linksPanel"),
  newsList: document.querySelector("#newsList"),
  officialList: document.querySelector("#officialList"),
  teamLinks: document.querySelector("#teamLinks"),
  newsMeta: document.querySelector("#newsMeta"),
  officialMeta: document.querySelector("#officialMeta"),
  feedTitle: document.querySelector("#feedTitle"),
  updatedAt: document.querySelector("#updatedAt"),
  statusDot: document.querySelector("#statusDot")
};
let teams = [];
let activeTab = "news";
let loading = false;
let lastRequestedKey = "";
let refreshTimer = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
}

// The provider returns <b> tags around matching words. Preserve that emphasis,
// while escaping any other markup before writing to the page.
function safeProviderMarkup(value) {
  const segments = String(value ?? "").split(/(<\/?b>)/gi);
  let bold = false;
  return segments.map((segment) => {
    if (/^<b>$/i.test(segment)) {
      if (bold) return "";
      bold = true;
      return "<strong>";
    }
    if (/^<\/b>$/i.test(segment)) {
      if (!bold) return "";
      bold = false;
      return "</strong>";
    }
    return escapeHtml(segment);
  }).join("") + (bold ? "</strong>" : "");
}

function safeUrl(value) {
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : "";
  } catch {
    return "";
  }
}

function getSelectedTeam() {
  return teams.find((team) => team.id === elements.teamSelect.value) || null;
}

function makeEmpty(title, description) {
  const box = document.createElement("div");
  box.className = "empty-state";
  const heading = document.createElement("strong");
  heading.textContent = title;
  const detail = document.createElement("p");
  detail.textContent = description;
  box.append(heading, detail);
  return box;
}

function populateTeams() {
  for (const team of teams) {
    const option = document.createElement("option");
    option.value = team.id;
    option.textContent = team.name;
    elements.teamSelect.append(option);
  }
  const saved = localStorage.getItem("club-news-selected-team");
  if (teams.some((team) => team.id === saved)) elements.teamSelect.value = saved;
}

function renderTeamLinks() {
  elements.teamLinks.replaceChildren();
  for (const team of teams) {
    const card = document.createElement("article");
    card.className = "official-card";
    const copy = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = team.name;
    const description = document.createElement("p");
    description.textContent = team.officialDomain;
    copy.append(title, description);
    const anchor = document.createElement("a");
    anchor.href = safeUrl(team.officialUrl) || "#";
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.textContent = "공식 사이트 ↗";
    card.append(copy, anchor);
    elements.teamLinks.append(card);
  }
}

function renderRawSearchResults(container, items, sourceKind) {
  container.replaceChildren();
  if (!Array.isArray(items) || items.length === 0) {
    container.append(makeEmpty("검색 결과가 없습니다.", "검색 API에서 반환한 결과가 없습니다. 구단명을 확인하거나 잠시 후 다시 조회해 주세요."));
    return;
  }

  // Do not re-sort, categorize, rewrite, deduplicate, or persist provider results.
  // Render only the returned items in the exact order supplied by the API.
  for (const item of items) {
    const card = document.createElement("article");
    card.className = "news-card";
    const title = document.createElement("h3");
    title.className = "news-title";
    const suppliedTitle = String(item.title || "제목 없음");
    const primaryLink = safeUrl(item.link);
    if (primaryLink) {
      const anchor = document.createElement("a");
      anchor.href = primaryLink;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      anchor.innerHTML = safeProviderMarkup(suppliedTitle);
      title.append(anchor);
    } else {
      title.textContent = suppliedTitle;
    }

    const description = document.createElement("p");
    description.className = "news-description";
    description.innerHTML = safeProviderMarkup(String(item.description || ""));
    const metadata = document.createElement("div");
    metadata.className = "news-meta";
    if (item.source) {
      const publisher = document.createElement("span");
      publisher.textContent = String(item.source);
      metadata.append(publisher);
    }
    if (item.pubDate) {
      const published = document.createElement("time");
      published.textContent = String(item.pubDate);
      metadata.append(published);
    }
    const actions = document.createElement("div");
    actions.className = "card-actions";
    const sourceName = document.createElement("span");
    sourceName.className = "source-name";
    sourceName.textContent = sourceKind === "news" ? "Google News RSS · 뉴스 검색" : "Google News RSS · 공식 도메인 검색";
    const links = document.createElement("div");
    links.className = "article-links";
    if (primaryLink) {
      const primary = document.createElement("a");
      primary.href = primaryLink;
      primary.target = "_blank";
      primary.rel = "noopener noreferrer";
      primary.textContent = sourceKind === "news" ? "기사 열기 ↗" : "공식 페이지 열기 ↗";
      links.append(primary);
    }
    if (sourceKind === "news" && item.originallink) {
      const originalUrl = safeUrl(item.originallink);
      if (originalUrl && originalUrl !== primaryLink) {
        const original = document.createElement("a");
        original.href = originalUrl;
        original.target = "_blank";
        original.rel = "noopener noreferrer";
        original.textContent = "언론사 원문 ↗";
        links.append(original);
      }
    }
    actions.append(sourceName, links);
    card.append(metadata, title, description, actions);
    container.append(card);
  }
}

function renderResponseMeta(container, result) {
  const parts = [];
  if (Number.isFinite(Number(result?.total))) parts.push(`검색 API 제공 총 ${result.total}건`);
  if (Number.isFinite(Number(result?.display))) parts.push(`현재 ${result.display}건 표시`);
  if (result?.lastBuildDate) parts.push(String(result.lastBuildDate));
  container.textContent = parts.join(" · ");
}

function setStatus(message, kind = "idle") {
  elements.updatedAt.textContent = message;
  elements.statusDot.classList.toggle("stale", kind !== "ok");
}

function setTab(tab) {
  activeTab = tab;
  const selectedButton = tab === "news" ? elements.newsTab : tab === "official" ? elements.officialTab : elements.linksTab;
  for (const button of [elements.newsTab, elements.officialTab, elements.linksTab]) {
    const selected = button === selectedButton;
    button.classList.toggle("active", selected);
    button.setAttribute("aria-selected", String(selected));
  }
  elements.newsPanel.hidden = tab !== "news";
  elements.officialPanel.hidden = tab !== "official";
  elements.linksPanel.hidden = tab !== "links";
  const team = getSelectedTeam();
  elements.feedTitle.textContent = tab === "news" ? (team ? `${team.name} · 뉴스 검색` : "국내 언론 기사")
    : tab === "official" ? (team ? `${team.name} · 공식 도메인 검색` : "구단 공식 도메인 검색")
      : "KBO 구단 공식 홈페이지";
  if (tab !== "links" && team) loadActiveFeed(true);
}

async function requestFeed(source, team) {
  const url = NEWS_DATA_URL + "?cache=" + Date.now();
  const response = await fetch(url, { cache: "no-store", headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error(`뉴스 데이터를 불러오지 못했습니다. (HTTP ${response.status})`);
  const data = await response.json();
  const feed = data?.teams?.[team.id]?.[source];
  if (!feed || !Array.isArray(feed.items)) throw new Error("수집된 뉴스 데이터가 없습니다. GitHub Actions에서 RSS 갱신이 완료됐는지 확인해 주세요.");
  return feed;
}

async function loadActiveFeed(force = false) {
  const team = getSelectedTeam();
  elements.refreshButton.disabled = !team || loading;
  if (!team || activeTab === "links") return;
  const requestedTab = activeTab;
  const key = `${requestedTab}:${team.id}`;
  if (loading || (!force && key === lastRequestedKey)) return;
  loading = true;
  lastRequestedKey = key;
  elements.refreshButton.disabled = true;
  elements.refreshHelp.textContent = "검색 결과를 불러오는 중…";
  setStatus("검색 중…");
  elements.feedTitle.textContent = requestedTab === "news" ? `${team.name} · 뉴스 검색` : `${team.name} · 공식 도메인 검색`;
  try {
    const result = await requestFeed(requestedTab, team);
    if (requestedTab === "news") {
      renderResponseMeta(elements.newsMeta, result);
      renderRawSearchResults(elements.newsList, result.items, "news");
    } else {
      renderResponseMeta(elements.officialMeta, result);
      renderRawSearchResults(elements.officialList, result.items, "official");
    }
    if (getSelectedTeam()?.id === team.id && activeTab === requestedTab) {
      setStatus(result.lastBuildDate ? `검색 결과 갱신 · ${result.lastBuildDate}` : `검색 결과 갱신 · ${new Date().toLocaleTimeString("ko-KR")}`, "ok");
      elements.refreshHelp.textContent = "페이지가 열려 있으면 30분마다 자동 새로고침합니다.";
    }
  } catch (error) {
    const container = requestedTab === "news" ? elements.newsList : elements.officialList;
    container.replaceChildren(makeEmpty("검색 결과를 불러오지 못했습니다.", error.message || "Cloudflare Worker와 NAVER API HUB 설정을 확인해 주세요."));
    if (getSelectedTeam()?.id === team.id && activeTab === requestedTab) {
      setStatus("검색 오류", "error");
      elements.refreshHelp.textContent = "Worker 주소, API 키, 구단 검색 권한을 확인해 주세요.";
    }
  } finally {
    loading = false;
    elements.refreshButton.disabled = !getSelectedTeam();
    const currentTeam = getSelectedTeam();
    if (currentTeam && activeTab !== "links" && `${activeTab}:${currentTeam.id}` !== key) {
      lastRequestedKey = "";
      queueMicrotask(() => loadActiveFeed(true));
    }
  }
}

async function initialize() {
  try {
    const response = await fetch(TEAM_CONFIG_URL, { cache: "no-store" });
    if (!response.ok) throw new Error("구단 목록을 불러오지 못했습니다.");
    teams = await response.json();
    populateTeams();
    renderTeamLinks();
    const selected = getSelectedTeam();
    if (selected) {
      elements.refreshButton.disabled = false;
      elements.refreshHelp.textContent = "페이지가 열려 있으면 30분마다 자동 새로고침합니다.";
      setTab("news");
    } else {
      setStatus("구단 선택 대기");
    }
  } catch (error) {
    setStatus("초기화 오류", "error");
    elements.newsList.replaceChildren(makeEmpty("화면을 초기화하지 못했습니다.", error.message || "설정 파일을 확인해 주세요."));
  }
  refreshTimer = window.setInterval(() => {
    if (document.visibilityState === "visible" && getSelectedTeam() && activeTab !== "links") {
      lastRequestedKey = "";
      loadActiveFeed(true);
    }
  }, AUTO_REFRESH_MS);
}

elements.teamSelect.addEventListener("change", () => {
  const team = getSelectedTeam();
  if (team) localStorage.setItem("club-news-selected-team", team.id);
  else localStorage.removeItem("club-news-selected-team");
  elements.refreshButton.disabled = !team;
  lastRequestedKey = "";
  const headline = activeTab === "news" ? "뉴스 검색" : activeTab === "official" ? "공식 도메인 검색" : "공식 홈페이지";
  elements.feedTitle.textContent = team ? `${team.name} · ${headline}` : "구단을 선택해 주세요";
  if (activeTab !== "links") loadActiveFeed(true);
});
elements.refreshButton.addEventListener("click", () => loadActiveFeed(true));
elements.newsTab.addEventListener("click", () => setTab("news"));
elements.officialTab.addEventListener("click", () => setTab("official"));
elements.linksTab.addEventListener("click", () => setTab("links"));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && getSelectedTeam() && activeTab !== "links") {
    lastRequestedKey = "";
    loadActiveFeed(true);
  }
});

initialize();
