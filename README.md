# Club News — KBO 구단 뉴스 모아보기 (AI 미사용)

GitHub Pages + Cloudflare Worker로 동작하는 KBO 10개 구단 뉴스 검색 페이지입니다.

## 설계상 중요한 점

네이버 검색 API는 검색 결과를 독립적으로 가공 없이 노출하고, 출처 및 원문 링크를 제공하도록 약관이 변경되었습니다. 따라서 이 프로젝트는 검색 결과를 GitHub에 저장하거나 캐싱하지 않습니다. 또한 네이버가 반환한 결과를 자체적으로 재정렬·분류·중복 제거하지 않습니다. 검색 뉴스와 공식 도메인 검색 결과는 서로 다른 탭에 그대로 표시합니다.

현재 약관: https://developers.naver.com/products/terms/
NAVER API HUB 뉴스 검색 API: https://api.ncloud-docs.com/docs/naver-api-hub-search-news
NAVER API HUB 개요: https://api.ncloud-docs.com/docs/naver-api-hub-overview

## 구성

- `site/`: 정적 웹사이트. GitHub Pages에 배포
- `site/config/teams.json`: KBO 10개 구단과 공식 도메인
- `site/config.js`: 공개 Worker 주소만 설정. 비밀 키를 넣지 않습니다.
- `worker/src/index.js`: 선택 구단에 대한 뉴스/공식 도메인 검색 API 프록시
- `worker/wrangler.toml`: Cloudflare Worker 설정
- `.github/workflows/pages.yml`: Pages 자동 배포

검색 결과는 이용자가 선택한 구단에 대해서만 요청됩니다. 페이지가 열려 있고 탭이 활성화된 동안 현재 탭 결과를 30분 간격으로 새로고침합니다. API 응답을 로컬 저장소, GitHub 파일, Cloudflare Cache에 보관하지 않습니다.

## 1. GitHub Pages 설정

저장소 **Settings → Pages → Build and deployment → Source: GitHub Actions**를 선택합니다. `.github/workflows/pages.yml`이 자동 배포합니다.

## 2. NAVER API HUB 인증 키 발급

2026년 7월 31일부터 검색 API 신규 신청은 기존 NAVER Developers가 아니라 NAVER API HUB에서 해야 합니다.

1. NAVER Cloud Platform에서 NAVER API HUB 서비스 이용 신청 및 Client ID/Client Secret을 발급받습니다.
2. Client ID와 Client Secret을 준비합니다.
3. 키는 Pages나 GitHub 저장소에 넣지 않고 Cloudflare Worker Secret으로 등록합니다.

검색 API는 하루 최대 25,000회 호출 한도로 안내되어 있습니다. 계정별 적용 조건과 과금/쿼터는 NAVER API HUB 콘솔에서 확인하세요.

## 3. Cloudflare Worker 배포 및 키 등록

Cloudflare 계정과 Node.js/npm이 필요합니다. 터미널에서 다음을 실행합니다.

```bash
cd worker
npx wrangler login
npx wrangler secret put NAVER_API_HUB_KEY_ID
npx wrangler secret put NAVER_API_HUB_KEY
npx wrangler deploy
```

각 `secret put` 명령을 실행하면 값을 입력하라는 안내가 나옵니다. `NAVER_API_HUB_KEY_ID`에는 Client ID를, `NAVER_API_HUB_KEY`에는 Client Secret을 입력합니다. 비밀 키를 `wrangler.toml`, `config.js`, JavaScript 파일 또는 GitHub에 직접 저장하지 마세요.

`worker/wrangler.toml`의 `ALLOWED_ORIGIN`은 GitHub Pages 사이트의 **origin**으로 맞춥니다. 기본값 `https://jihun121.github.io`는 이 사용자의 Pages 주소에 맞춘 값입니다. 다른 도메인을 사용하면 그 origin으로 변경합니다.

배포가 끝나면 Wrangler 출력에 표시된 Worker URL을 복사합니다.

## 4. 프런트엔드에 Worker URL 연결

`site/config.js`에서 아래 값을 실제 Worker URL로 바꿉니다.

```js
window.CLUB_NEWS_CONFIG = {
  apiBaseUrl: "https://실제-worker-주소.workers.dev"
};
```

이 URL은 공개해도 되는 주소이고 API 키가 아닙니다. `main` 브랜치에 푸시하면 GitHub Pages가 다시 배포됩니다.

## 5. 동작 확인

- 구단 선택 → `NAVER 뉴스 검색` 탭에서 뉴스 검색 결과 요청
- `공식 도메인 검색` 탭에서 `site:공식도메인 구단명` 쿼리의 웹 문서 검색 결과 요청
- `구단 홈페이지` 탭에서 KBO 10개 구단 공식 사이트 링크 확인
- `지금 새로고침` 버튼으로 즉시 재조회
- 페이지가 열려 있으면 30분마다 현재 선택한 검색 탭을 재조회

API 응답은 Worker가 본문을 그대로 전달하고 프런트엔드는 제공된 순서를 유지합니다. 검색 결과의 날짜, 제목, 설명, 링크가 없거나 부정확한 경우 검색 서비스 응답 및 원문 페이지를 확인하세요.

## 공식 공지 자동 수집의 한계

공식 도메인 검색은 NAVER 웹 문서 검색 API를 통해 해당 구단 도메인으로 제한한 검색 결과를 제공합니다. 각 구단의 모든 새 공지나 최신 게시글이 반드시 검색된다는 보장은 없습니다. 특정 구단이 RSS나 공식 API를 제공하는 경우에는 해당 소스의 이용 조건을 확인한 뒤 별도의 공식 피드 탭으로 추가할 수 있습니다.

## 중복 기사 처리

네이버 검색 API 결과에는 자체 중복 제거, 분류, 재정렬을 적용하지 않습니다. 최신 네이버 API 약관이 결과를 독립적으로 가공 없이 노출하도록 요구하기 때문입니다. 공식 RSS/API 피드를 추가할 경우에는 해당 소스의 이용 조건이 허용하는 범위에서 그 피드에 한해 중복을 줄이는 기능을 검토할 수 있습니다.
