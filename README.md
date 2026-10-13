# Club News — KBO·K리그 구단 기사 모아보기

GitHub Pages와 GitHub Actions로 운영하는 **AI·API 키·별도 서버 없는** 국내 프로스포츠 기사 모음 사이트입니다.

## 지원 리그
- KBO 리그: 10개 구단
- K리그1: 12개 구단
- K리그2: 17개 구단
- 총 39개 구단

K리그 참가 구단 수는 2026시즌 한국프로축구연맹 공식 대회 요강을 기준으로 구성했습니다.

## 동작 방식
1. GitHub Actions가 약 30분마다 구단별 Google News RSS 검색 피드를 수집합니다.
2. 기사 RSS와 K리그 공식 홈페이지 도메인 검색 결과를 구분해 정적 JSON을 생성합니다.
3. GitHub Pages가 JSON을 포함한 사이트를 배포합니다.
4. 사용자는 리그와 구단을 고르고, 기사 정렬(최신순·오래된순·제목순)을 바꾸어 원문을 확인합니다.

## 기사 출처와 제한
- 뉴스 탭: 구단명과 종목 키워드를 사용하는 Google News RSS 검색
- 공식 소식 탭: 구단 공식 도메인 또는 한국프로축구연맹 공식 홈페이지 kleague.com으로 제한한 RSS 검색
- 구단 홈페이지 탭: 각 KBO 구단 공식 사이트 및 K리그 공식 리그 소식 링크

Google News RSS는 공식적으로 안정성을 보장하는 개발자 API가 아닙니다. 검색 범위나 피드 형식이 변경될 수 있고, 구단별 기사 수가 고르지 않을 수 있습니다. 구단 공식 도메인 검색 역시 모든 공식 공지를 보장하지 않습니다.

뉴스 제목과 RSS 설명, 출처, 게시 시각, 원문 링크 중심으로 표시하며 기사 전문이나 언론사 사진을 복제하지 않습니다. AI 요약은 사용하지 않습니다.

## 갱신 주기
- GitHub Actions: 매시 17분과 47분에 실행
- 실행마다 RSS 데이터를 다시 수집하고 Pages를 배포합니다.
- Actions 탭에서 **Deploy Club News to GitHub Pages → Run workflow**를 실행해 수동 갱신할 수 있습니다.
- GitHub Actions 예약 실행은 플랫폼 부하에 따라 지연될 수 있으므로 정확히 30분마다 갱신됨을 보장하지 않습니다.

## 기사 정렬
- 최신순: 게시 시각이 최신인 기사부터
- 오래된순: 게시 시각이 오래된 기사부터
- 제목순: 제목의 가나다/문자 순서

정렬은 수집된 RSS 데이터에 대해 브라우저에서 적용합니다. 정렬을 바꿔도 원문 링크나 저장된 RSS 데이터는 바뀌지 않습니다.

## 파일 구조
- `site/index.html`: 화면 구조
- `site/styles.css`: 반응형 스타일
- `site/app.js`: 리그·구단 선택, 기사 표시 및 정렬
- `site/config/teams.json`: 39개 구단, 검색 키워드 및 링크
- `scripts/collect-news.mjs`: RSS 수집과 JSON 생성
- `.github/workflows/pages.yml`: 정기 수집과 GitHub Pages 배포

## 배포
저장소 **Settings → Pages → Build and deployment → Source**가 **GitHub Actions**로 지정되어 있어야 합니다. API 키나 Secrets를 추가할 필요가 없습니다.
