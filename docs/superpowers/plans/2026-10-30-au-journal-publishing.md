# **verygood** AU Journal Publishing — Implementation Plan

> **2026-10-30 update:** Pencil is confirmed as the authoring tool. The latest **static-first / no-Appwrite-MVP** recommendation is documented in [Pencil static-first architecture](../specs/2026-10-30-au-journal-static-first-architecture.md). Older references below to per-article React components are an earlier candidate, **not a mandatory requirement**. Favor whole exported HTML+CSS article packages with a batch asset importer and shared static shell unless an actual Pencil export shows this is insufficient.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking. This is a proposed plan; do not treat proposed product decisions or absent design exports as already confirmed.

**Goal:** Pencil/Penpot에서 완성한 글과 사진을 한 번에 가져와 AU Journal에서 미리보기·발행·갱신한다.

**Architecture:** 기존 React/Vite AU 앱에 Journal 경로와 메타데이터 목록을 추가한다. 디자인에서 가져온 글을 검토된 React/CSS/이미지 패키지로 만들고, 같은 본문을 정적 HTML과 브라우저 화면에 사용한다. 최초에는 Codex가 가져오기·검증·Git 발행을 수행하며 일반 관리자 업로드 UI는 후속 범위다.

**Tech Stack:** 저장소의 현재 React / TypeScript / Vite / Node 빌드 도구 / Sharp / Cloudflare Pages. MDX·새 CMS·새 서버는 필수 도입하지 않는다.

**Spec:** [2026-10-30-au-journal-publishing-design.md](../specs/2026-10-30-au-journal-publishing-design.md)

**Status:** 조사 기반 실행계획. 제품 코드 미작성. 대표 디자인 파일 입력 및 제작 도구 선택이 첫 구현 단계의 입력이다. 문서의 명령 중 `journal:*`는 앞으로 만들 명령이며 현재 실행 가능한 기능이 아니다.

## Global Constraints

- 기준 AU main: `47730d473da9ff537f032ad9e13e86b89d58aaad`. 실행 시 최신 main을 다시 읽고 변경분을 확인한다.
- Journal 공개 경로는 AU에서만 제공한다. KR 결과물에 글 경로·메타데이터를 생성하지 않는다.
- 첫 파일럿 추천 입력은 Pencil `HTML+CSS`와 이미지 묶음이다. 사용자 선택이 Penpot이면 Inspect/MCP export를 같은 입력 계약으로 정리한다.
- 실제 export 없이 디자인 툴 호환 검증 완료를 주장하지 않는다.
- 발행 단위는 글 전체다. 사용자에게 사진 재업로드·본문 재입력을 요구하는 관리자 에디터를 만들지 않는다.
- 예약·결제·인증·Appwrite schema/function 배포는 이 기능의 작업 범위가 아니다.
- `appwrite-functions/**`의 상품/주문 모듈을 Journal 메뉴 추가 때문에 수정하지 않는다. 프론트 내비게이션에서 Journal 링크를 합성한다.
- `brief.verygood.run`과 기존 크롤링 스케줄은 이 작업에서 수정하지 않는다.
- AU 저장소는 public이다. 비공개 원고·사진·디자인 파일을 브랜치나 PR에 올리지 않는다. 공개 가능한 샘플만 커밋한다.
- 발행본은 Git에서 검토하고 빌드한다. 임의 업로드 HTML/JS/MDX를 운영 브라우저·서버에서 실행하는 기능을 만들지 않는다.
- 자동 예약 발행은 제외한다. 날짜만 미래로 설정해도 저절로 발행되는 기능이 있는 것처럼 설명하지 않는다.
- brand text는 사용자에게 보이는 새 한글/영문 문서에서 **verygood**을 기준으로 한다. 기존 공통 헤더의 로고 체계를 별도 리디자인하지 않는다.

## Review Focus

1. HTML에는 글이 있지만 React 시작 후 404/빈 화면으로 바뀌는 직접 방문 — Task 3/4에서 JS 전후 같은 제목·본문을 확인한다.
2. export 사진의 상대경로·중복 파일명·대문자 확장자 — Task 2에서 독립된 글 두 편의 자산을 섞지 않는 일괄 가져오기를 검증한다.
3. PC 자유배치가 390px/320px에서 겹치는 경우 — Task 1/3에서 실제 export 기반으로 비교하고 지원 범위를 제한한다.
4. 재가져오기 때 같은 주소가 중복 등록되거나 다른 작성자의 변경이 소실되는 경우 — Task 2/5에서 id·slug·revision 충돌을 거절한다.
5. 초안/실패한 빌드/매거진 읽기 실패가 공개 결과를 바꾸는 경우 — Task 4/5에서 production 산출물의 published 필터와 이전 배포 유지, 매거진 런타임 비의존을 확인한다.

---

## 파일 책임 지도 — 제안 경로

| 위치 | 책임 |
| --- | --- |
| src/journal/types.ts | 글 메타데이터·route·asset 타입 |
| src/journal/catalog.ts | 목록, slug 조회, 상태/날짜/충돌 검증 |
| src/journal/registry.ts | 명시적으로 등록된 글별 지연 import. arbitrary file path 실행 금지 |
| src/journal/JournalIndexPage.tsx | 목록/대표 글/카테고리 표시 |
| src/journal/JournalArticlePage.tsx | 공통 글 shell, 목록 복귀·출처/관련 링크와 글 컴포넌트. 제목/히어로를 추가하지 않음 |
| src/journal/articles/{id}/ | 검토된 Article.tsx, scoped CSS, 공개 가능한 source metadata |
| src/content/journal/index.json | 메타데이터 원본. private draft 원고 저장소가 아님 |
| scripts/journal-import.mjs | 소유자 export 묶음 검사/자산 정리/가져오기 보고. 자동 공개 없음 |
| scripts/journal-assets.mjs | published 글의 이미지와 CSS를 웹 결과물에 준비 |
| scripts/journal-static.tsx | 브라우저와 동일한 글 컴포넌트의 정적 렌더링 |
| scripts/journal-seo.mjs | 경로별 SEO definition과 RSS/공개 경로 |
| src/lib/app-routes.ts, src/App.tsx | AU Journal route와 페이지 연결 |
| src/lib/seo.ts, scripts/generate-seo-pages.mjs | 초기 HTML·클라이언트 meta·sitemap 일치 |
| src/components/AuNavigation.tsx, src/components/AuRedesignChrome.tsx | 공통 메뉴 링크 |
| src/pages/HomePage.tsx | 최근 글 카드 및 홈 footer의 Journal 진입점 |
| tests/journal-*.test.ts 또는 .test.mjs | 사용자 동작·게시 결과 중심 검증 |

경로는 구현 제안이다. 실제 최신 트리와 충돌하면 같은 책임을 유지하며 조정하고 문서를 함께 갱신한다.

## Task 1. 실제 디자인 글 한 편으로 변환 경로 검증

**Inputs:** 대표 글의 Pencil/Penpot 원본 접근 또는 HTML+CSS+사진 묶음. 실제 export 도구/버전, 데스크톱·모바일 기준 화면.

**Produces:** 공개 가능한 테스트 글 1편의 검토된 React/CSS 패키지, 가져오기 프로필 기록, 실제 지원 범위.

- [ ] 현재 main·작업 트리·배포 환경을 읽고 이 작업용 격리 브랜치를 만든다. 다른 작업의 main이나 worktree에서 파일을 덮어쓰지 않는다.
- [ ] 사용자가 고른 도구와 실제 export 샘플을 확보한다. 아직 없다면 이 사실을 기록하고 파일럿 완료로 처리하지 않는다.
- [ ] 제목·본문·사진 3장 이상·2열 구간·강조 구간·상품 링크가 있는 글을 고른다. 내용은 사용자의 원고를 유지한다.
- [ ] HTML+CSS export 또는 디자인 구조/MCP로 문장·자산·레이아웃을 읽는다. code-only 도구가 모바일 동작을 알아서 맞춘다고 가정하지 않는다.
- [ ] 현재 AU 스타일을 재사용하며 하나의 React article과 글 범위 CSS로 정리한다. 특별한 레이아웃은 해당 글 전용 코드로 유지할 수 있다.
- [ ] 320/390/768/1440px와 200% 확대에서 원고 순서·텍스트 겹침·사진 비율·상품 링크를 확인한다. 원본 대비 차이는 무엇인지 기록한다.
- [ ] 도구 이름/버전, asset 포함 방식, 지원/수동 보정 항목, 사진 재입력 횟수(목표 0)를 파일럿 결과에 적는다.

**완료 기준:** 실제 원본을 사용한 preview가 있고 사용자에게 설명 가능한 지원 범위가 있다. 화면만 비슷한 가짜 export로 대체하지 않는다.

## Task 2. 글 패키지·일괄 자산 처리

**Create:** types.ts, catalog.ts, index.json, journal-import.mjs, journal-assets.mjs, tests/journal-content.test.ts, tests/journal-import.test.mjs.

**Interfaces:**

- `JournalStatus = 'draft' | 'published' | 'archived'`.
- `JournalLocale = 'en-AU' | 'ko'`.
- `JournalEntry`: id, slug, title, excerpt, locale, category, status, publishedAt, updatedAt, cover, sourceUrls, revision.
- `cover`: src, alt, width, height. URL은 검증된 자산 mapping에서 만든다.
- `validateJournalEntries(entries: unknown): JournalEntry[]`: 필드·slug·id·날짜·중복을 검사하고 명확한 오류를 낸다.
- `listPublishedEntries(entries: JournalEntry[]): JournalEntry[]`: status가 published인 항목을 발행일 내림차순으로 반환한다. 예약 발행을 구현하지 않으므로 미래 publishedAt은 validation에서 거절한다.
- `findPublishedEntry(entries, slug): JournalEntry | null`.
- `inspectImport({ inputDirectory, articleId, expectedRevision }): Promise<ImportReport>`: 파일 목록, 자산 mapping, 지원하지 않는 요소, 누락 파일, 충돌을 보고한다. 운영 배포를 수행하지 않는다.
- `prepareJournalAssets({ entries, sourceDirectory, outputDirectory }): Promise<AssetManifest>`: 지정된 출력 경로 아래에만 published 자산을 생성한다.

- [ ] 검증 테스트에 중복 id/slug, `../`를 포함한 slug/asset path, 타임존 없는 publishedAt, 미래 발행일, 누락 대표이미지, alt 없는 콘텐츠 사진을 넣는다. 현재 registry가 없으면 실패함을 확인한다.
- [ ] 실제 파일럿 입력을 기준으로 import profile을 구현한다. 중첩 폴더·대문자 확장자·공백/한글 파일명·같은 이름의 다른 이미지를 구별한다.
- [ ] CSS/HTML에 들어 있는 상대 자산 참조를 하나의 mapping으로 정리한다. script/event handler/form/iframe·허용하지 않은 외부 의존성은 위치를 보고하고 자동 게시하지 않는다.
- [ ] 저장소에 이미 있는 Sharp를 사용해 비율을 유지한 WebP variants를 생성한다. 작은 원본을 확대하지 않는다. width/height를 기록한다.
- [ ] 원본과 변환 결과를 분리하고 같은 id의 재가져오기는 expectedRevision이 맞을 때만 진행한다. stale revision과 slug 충돌은 기존 파일을 바꾸기 전에 실패시킨다.
- [ ] `VITE_MARKET=AU node scripts/run-bundled-tests.mjs tests/journal-content.test.ts` 및 `node --test tests/journal-import.test.mjs`를 실행한다. 유효 입력 성공, 위의 잘못된 입력 거절을 확인한다.

**완료 기준:** 사용자 사진 재업로드 없이 글 전체의 자산이 연결되고, 재가져오기가 안전하게 같은 글을 갱신한다. 임의 모든 HTML을 자동 React로 변환한다는 주장을 하지 않는다.

## Task 3. Journal 목록·글 경로·AU 메뉴

**Create:** registry.ts, JournalIndexPage.tsx, JournalArticlePage.tsx, tests/journal-routes.test.ts, tests/journal-pages.test.tsx.

**Modify:** app-routes.ts, App.tsx, AuNavigation.tsx, AuRedesignChrome.tsx, HomePage.tsx.

**Interfaces:**

- `JournalRoute = {type:'index'} | {type:'article', slug:string} | null`.
- `getJournalRoute(path: string): JournalRoute`: 경로 파싱. AU 여부와 실제 slug 존재 여부는 caller가 검사한다.
- `JournalArticleModule`: default export React component. 등록한 slug만 import할 수 있다. 글 컴포넌트가 h1·히어로·본문 배치를 소유한다.
- `loadJournalArticle(slug: string): Promise<JournalArticleModule>`: 명시적인 registry만 사용한다.
- `JournalIndexPage({ entries })`와 `JournalArticlePage({ entry, Article })`: 정적 renderer에서도 같은 컴포넌트를 사용한다.

- [ ] `/journal`, `/journal/valid-slug`, 알 수 없는 slug, 슬래시 변형, KR에서의 동일 요청을 검증하는 route test를 먼저 추가한다.
- [ ] 목록은 published 메타데이터만 읽도록 구현한다. 표지는 image ratio·excerpt 길이가 달라도 카드가 읽히게 한다. 빈 분류 필터는 숨긴다.
- [ ] article shell과 글별 배치를 합친다. 공통 header/footer와 실제 text DOM을 유지하되 shell이 별도 제목 영역을 추가하지 않게 한다. h1 1개와 metadata title 일치를 검증한다. sourceUrls는 표시할 출처 링크로 연결한다.
- [ ] App route에 Journal을 등록하고 store settings 의존에서 제외한다. 현재 App의 env notice·SEO effect·페이지별 shell 분기를 함께 검토한다.
- [ ] homepage/공통 헤더/모바일 메뉴/footer에 JOURNAL 진입점을 연결한다. 주문 상품 모듈 RENEWAL_NAV 원본은 수정하지 말고 frontend에서 Journal 링크를 합성한다.
- [ ] 새 글 본문이 homepage 초기 번들에 모두 들어가지 않도록 Journal route와 글 본문을 지연 로딩한다. 정적 HTML의 글 내용이 loading UI로 크게 사라지지 않게 최초 전환을 확인한다.
- [ ] 390px/1440px 직접 방문·새로고침·앞뒤 이동·목록 복귀를 확인한다. 헤더 메뉴와 Cart가 기존 경로로 작동해야 한다.
- [ ] `VITE_MARKET=AU node scripts/run-bundled-tests.mjs tests/journal-routes.test.ts`와 저장소 기존 UI runner로 `tests/journal-pages.test.tsx`를 실행한다. 실제 사용 runner에 맞는 package script를 함께 기록한다.

**완료 기준:** AU에서 목록과 글이 연결되고 KR 및 기존 고객 주문 흐름의 경계가 유지된다.

## Task 4. 같은 본문으로 정적 HTML·공유·RSS 생성

**Create:** journal-static.tsx, journal-seo.mjs, tests/journal-seo-generator.test.mjs.

**Modify:** generate-seo-pages.mjs, src/lib/seo.ts, 필요 시 route별 stylesheet 지원, package.json build script.

**Interfaces:**

- `renderJournalPath(path: string, entries: JournalEntry[]): Promise<string>`: Task 3의 동일 React 컴포넌트를 정적으로 출력한다.
- `getJournalSeoDefinitions({siteUrl, entries}): Promise<{pages,indexablePaths,rss}>`: 기존 portfolio/hogirl SEO 정의와 맞는 형태로 반환한다.
- 브라우저용 metadata와 build definition은 같은 validated entry로 만든다. canonical은 `${siteUrl}/journal/${slug}`다.
- article CSS/이미지 manifest는 Task 2 결과를 소비한다. 글별 CSS는 JS 실행 전에 해당 HTML에서 로딩된다.

- [ ] 실제 build HTML에 제목·본문 문자열·대표 이미지·canonical·OG·BlogPosting이 들어가는 테스트를 추가한다. 메타데이터만 있고 본문이 없는 경우 실패시킨다.
- [ ] 현재 portfolio static renderer 패턴을 재사용한다. shared header의 계정/언어 context는 기존 static 렌더 패턴에 맞춘다.
- [ ] 현재 createRoot 초기화로 본문이 바뀌지 않는지 확인한다. client applySeo가 Journal을 404/noindex로 덮어쓰지 않게 등록한다.
- [ ] article CSS를 runtime import에만 의존하지 않도록 HTML stylesheet 경로를 출력한다. 제목·본문·이미지가 JS를 끄고도 읽히는지 확인한다.
- [ ] sitemap/RSS에 published URL만 포함한다. draft/archived 본문·이미지가 production output 및 글 import registry에 포함되지 않게 build 대상도 필터링한다. 소스 repo 공개 여부와는 별개의 동작이다.
- [ ] 글 locale을 실제 원고와 일치시키고 번역 없는 언어 전환은 다른 번역글이 있다고 오해시키지 않게 한다.
- [ ] `VITE_MARKET=AU npm run build` 후 `node --test tests/journal-seo-generator.test.mjs`를 실행한다. `VITE_MARKET=KR npm run build`에서 Journal 경로와 sitemap entry가 생성되지 않는지 확인한다.

**완료 기준:** 직접 URL의 초기 응답과 앱 실행 후 본문이 일치하고, 공유 카드·검색용 주소·발행 상태가 일관된다.

## Task 5. 반복 발행 절차·preview·릴리스

**Create:** docs/journal-publishing.md 및 필요한 `journal:check`/`journal:prepare` package scripts.

**Inputs:** 검토된 글 패키지, 기존 Cloudflare Pages의 실제 프로젝트/production branch/preview 접근 설정.

**Produces:** 첫 공개 가능한 글, 재가져오기 검증 기록, 다음 글을 같은 흐름으로 발행하는 안내.

- [ ] 첫 두 개의 제안 명령을 구현하고 각각의 결과를 구분한다. `journal:check`는 입력·메타·자산 진단만 한다. `journal:prepare`는 로컬 산출물을 준비한다. 어느 것도 main merge나 운영 배포를 자동 실행하지 않는다.
- [ ] 실제 Cloudflare Pages 프로젝트와 Git 연동 상태를 읽는다. 기억 속 프로젝트명을 그대로 배포 대상으로 확정하지 않는다.
- [ ] 공개 가능한 테스트 글의 preview를 만들고 PC/모바일 화면, 이미지 요청 실패, 본문·메타정보를 확인한다. 비공개 초안을 공개 preview URL에 올리지 않는다.
- [ ] 같은 글의 수정본을 같은 id/slug로 다시 가져온다. 기존 revision과 다르면 충돌을 보고하고, 성공하면 목록·본문·대표 이미지가 함께 갱신되는지 확인한다.
- [ ] Journal 경로/SEO/asset 테스트와 AU/KR build를 우선 실행한다. 공통 내비게이션 수정에 대해서 기존 navigation/cart 계약 검증을 실행한다. 추가 테스트는 실제 변경 위험과 저장소 필수 gate에 따라 선택한다.
- [ ] 운영 반영 시 실제 배포 성공과 대상 URL을 확인한다. 실패하면 이전 정상 배포가 유지되는지 확인하고 기록한다. 되돌릴 때는 Journal 관련 커밋/배포 단위로 복원한다.
- [ ] 최종 안내에 도구→가져오기→미리보기→발행→수정의 실제 절차와 아직 자동화되지 않은 단계를 정확히 적는다.

**완료 기준:** 첫 글의 직접 방문과 두 번째 revision까지 실제 검증되어 다음 글을 위해 관리자 재입력 과정이 필요하지 않다.

## 후속 작업 — MVP와 분리

### Magazine 선택 연동

초기에는 approved source URLs 목록만 사용해 새 원고의 출처를 보관한다. 선택 카드 자동화는 후속 작업이며 기존 매거진 schema를 먼저 바꾸지 않는다. API 실패가 AU 런타임을 막지 않는 build-time snapshot 방식을 우선 검토한다. 라이브 canonical/og:url을 전용 도메인으로 바꾸는 작업은 별도 검토 가능한 변경으로 분리한다.

### 얇은 발행 화면 또는 Webstudio

실제 두 편의 반복 작업 후 어떤 클릭이 번거로운지 확인한다. 로컬 `가져오기/미리보기/발행` 화면만 필요한지, Webstudio에서 레이아웃 편집까지 필요한지 판단한다. Webstudio/Puck/GrapesJS 도입은 사진 재입력 제거 효과와 운영 부담을 비교한 뒤 결정한다.

## 현재까지 검증된 것 / 남은 것

검증됨: AU·매거진 저장소의 실제 구조, AU의 정적 페이지 재사용 지점, 공개 UI의 형태, 매거진 최신 글 표시와 canonical 설정, 후보 도구의 공식 기능/라이선스 근거.

미수행: 디자인 파일 export, 실제 코드 변환, Journal 제품 코드, 의존성 설치, 제품 테스트, 앱 배포, 매거진 설정 변경. 문서 생성·저장은 위 작업들의 완료를 뜻하지 않는다.
