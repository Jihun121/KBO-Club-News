# Club News — KBO 구단 기사 모아보기 (AI 미사용)

GitHub Pages + GitHub Actions만으로 운영하는 KBO 10개 구단 기사 모음 사이트입니다. **Cloudflare Worker, API 인증키, 별도 서버가 필요하지 않습니다.**

## 동작 방식

1. GitHub Actions가 30분마다 KBO 구단별 뉴스 RSS 검색 피드를 가져옵니다.
2. 구단별 뉴스 검색 결과와 구단 공식 도메인 한정 검색 결과를 구분해 JSON을 생성합니다.
3. 생성된 JSON을 GitHub Pages 배포 파일에 포함합니다.
4. 웹사이트는 배포된 JSON만 읽어 기사 제목, 출처, 게시 시각, 원문 링크를 표시합니다.
5. 기사 링크는 새 탭에서 원문으로 열립니다.

## 데이터 출처

- **뉴스 검색:** Google News RSS 검색 URL을 사용해 팀명과 야구 관련 기사를 찾습니다.
- **공식 소식:** 같은 RSS 검색 기능에서 구단 공식 홈페이지 도메인으로 범위를 제한합니다.
- **공식 홈페이지:** 각 구단의 공식 웹사이트 바로가기 링크를 별도 제공합니다.

### 반드시 알아둘 점

Google News RSS 검색 주소는 Google이 안정성을 보장하는 정식 개발자 API가 아닙니다. RSS 형식, 검색 결과, 제공 범위가 바뀌거나 특정 피드가 실패할 수 있습니다. 이 경우 GitHub Actions 로그에 실패한 피드가 기록되며, 나머지 구단의 검색은 계속 반영됩니다.

구단 공식 도메인 검색은 모든 공식 공지를 빠짐없이 수집하는 것이 아닙니다. 각 구단에서 RSS 또는 공식 API를 제공하는지 확인되면 별도로 연동할 수 있습니다.

이 프로젝트는 기사 전문을 복사하지 않고 RSS 제목, 설명, 출처, 원문 링크를 중심으로 표시합니다. Google News 검색 결과가 제공하는 기사 제목·설명은 출처 표시와 함께 보여주며, 별도의 AI 요약은 생성하지 않습니다.

## 갱신 주기

- GitHub Actions schedule: 30분 간격 (17분, 47분)
- 사이트를 다시 배포할 때마다 `site/data/news.json`을 빌드 과정에서 생성합니다.
- 수동 갱신: 저장소 **Actions → Deploy Club News to GitHub Pages → Run workflow**
- RSS 결과는 저장소의 소스 브랜치에 커밋하지 않고 Pages 배포용 임시 아티팩트에만 포함합니다.

GitHub Actions 정기 실행은 부하 상황에 따라 지연될 수 있으므로, 반드시 정확히 30분마다 배포된다고 보장할 수는 없습니다.

## 구단

LG 트윈스, 두산 베어스, KT 위즈, SSG 랜더스, NC 다이노스, 롯데 자이언츠, 삼성 라이온즈, KIA 타이거즈, 한화 이글스, 키움 히어로즈.

## 파일 구성

- `site/index.html`: 페이지 구조
- `site/styles.css`: 반응형 디자인
- `site/app.js`: 구단 선택, 탭 전환, 기사 표시, 자동 재조회
- `site/config/teams.json`: 구단 이름과 공식 홈페이지 도메인
- `scripts/collect-news.mjs`: RSS 수집 및 JSON 생성
- `.github/workflows/pages.yml`: 정기 수집 및 GitHub Pages 배포

## 배포

저장소 **Settings → Pages → Build and deployment → Source**가 **GitHub Actions**로 설정되어 있어야 합니다. 별도의 비밀 키나 환경변수는 필요하지 않습니다.
