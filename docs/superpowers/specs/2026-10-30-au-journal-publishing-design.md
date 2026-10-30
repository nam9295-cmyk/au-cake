# **verygood** AU Journal — 디자인 페이지 발행 설계 제안

- 작성일: 2026-10-30, Asia/Seoul
- 상태: 조사 완료 / 추천 설계 초안. 사용자 확정안이나 구현 완료본이 아니다.
- 대상: nam9295-cmyk/au-cake
- 조사 기준: main `47730d473da9ff537f032ad9e13e86b89d58aaad`
- 매거진 기준: nam9295-cmyk/very-magazine main `a9e9f544f8de93c70b16b61792189bad2c663126`
- 다음 실행 문서: [구현 계획](../plans/2026-10-30-au-journal-publishing.md)

## 1. 사용자가 원하는 결과

원고와 사진을 Pencil 또는 Penpot에서 자유롭게 배치한다. 완성된 한 편의 디자인을 AU 사이트의 블로그 글로 발행한다. 관리자 에디터에서 문장을 다시 붙이거나 사진을 하나씩 다시 올리고 정렬하는 작업을 없앤다.

글마다 레이아웃을 다르게 만들 수 있어야 한다. 실제 텍스트, 링크, 사진을 유지하고 작은 화면에서 읽히는 웹페이지로 만든다. 글 목록·대표 이미지·공유 미리보기·주소는 발행 과정에서 연결한다.

사용자는 Pencil과 Penpot를 모두 언급했다. 본 문서는 **Pencil HTML+CSS 내보내기를 첫 파일럿으로 삼는 추천안**이며, 주 도구 선택이 확정됐다고 기록하지 않는다. Penpot의 결과물도 동일한 발행 구조에 들어갈 수 있게 경계를 둔다.

## 2. 직접 확인한 현재 구조

### AU 사이트

- React 19 / TypeScript / Vite 8 기반이다. 현재 package.json에 React 19.2.5, Vite 8.0.10, Sharp 0.35.5가 선언되어 있다. 새 작업에서 임의로 버전을 변경하지 않는다.
- `src/lib/app-routes.ts`와 `src/App.tsx`가 경로와 페이지를 연결한다. 현재 blog/journal 경로는 없다.
- `src/components/AuNavigation.tsx`가 공통 메뉴를 표시하고, `AuRedesignChrome.tsx`가 헤더·푸터를 제공한다.
- `scripts/portfolio-static.tsx`는 실제 React 페이지와 헤더·푸터를 `renderToStaticMarkup`으로 출력한다. `scripts/portfolio-seo.mjs`가 이를 빌드 과정에 연결한다.
- `scripts/generate-seo-pages.mjs`는 경로별 HTML과 sitemap을 만들고 `src/lib/seo.ts`는 브라우저 이동 시 메타데이터를 갱신한다. Journal은 양쪽에 같은 메타데이터와 본문을 연결해야 한다.
- `src/main.tsx`는 `createRoot`로 앱을 시작한다. 사전 생성 HTML만 추가하고 클라이언트 경로를 등록하지 않으면 로딩 후 404 화면이나 다른 본문으로 바뀔 수 있다.
- AU/KR 공용 경계와 기존 주문 기능이 있으므로 Journal 공개 경로는 AU에만 추가한다.
- 공개 홈페이지에서 녹색 포인트, 밝은 바탕, 큰 사진/영상, 영문 중심·한국어 전환, 상품·Business 중심 메뉴를 직접 확인했다. Journal은 이 공통 브랜드 체계에 연결한다.

### 기존 매거진

- Next.js 16.2.1 / React 19.2.4 / OpenNext / Cloudflare Worker 구성이다.
- Appwrite의 `magazine_posts`를 읽는다. 글 필드는 title, eng_title, kor_summary, eng_summary, image_url, original_url, category이다.
- GET `/api/posts`는 category와 offset으로 12개씩 반환한다. 자체 개별 기사 페이지, 자유 HTML 본문, 관리자 작성기, RSS, 수집 실행기는 조사한 저장소에 없다.
- 2026-10-30 공개 UI에서 **2,800 POSTS**, 최신 첫 화면 글들의 **7시간 전** 표시, 디자인·테크·비즈니스가 섞인 피드를 확인했다. 이는 화면 관찰이며 스케줄러의 일일 실행 성공 보장은 아니다.
- 공개 DOM의 canonical과 og:url이 모두 `https://very-magazine.nockpet.workers.dev`로 설정돼 있다. 전용 도메인을 기준 주소로 사용할 경우 별도 수정 후보다.
- 수집기 위치와 실제 cron/systemd 실행 로그는 미확인이다. 새 스케줄이나 크롤러를 중복 생성하지 않는다.
- `brief.verygood.run`은 사용자의 요청에 따라 범위에서 제외한다.

## 3. 검토한 접근과 추천

| 접근 | 이점 | 부담/제약 | 판단 |
| --- | --- | --- | --- |
| 기존 디자인 도구 + AU 글 발행 연결부 | 익숙한 캔버스 사용, 이미지 재입력 제거, 기존 AU 코드 재사용 | 최초 변환 프로필·미리보기·발행 연결 개발 | 추천 |
| Webstudio에서 제작 또는 HTML 전체 가져오기 | 시각적인 HTML/CSS 편집, 참조 이미지 수집, 정적 사이트 export | 새 도구 학습, AU 글 목록·공유 메타·경로 연결은 별도 | 브라우저 안에서 직접 편집까지 원할 때 대안 |
| Puck 또는 GrapesJS를 AU 관리자에 내장 | 내부 전용 편집 화면 구축 가능 | 저장·인증·파일·발행을 함께 개발해야 함. 디자인 파일 직접 변환 기능이 아님 | 첫 버전 이후 실제 필요가 생길 때 검토 |

Pencil은 현재 HTML+CSS/HTML+Tailwind 직접 내보내기를 제공한다. 설치된 버전에 해당 기능이 있는지는 첫 파일럿에서 확인한다. Pencil 자체를 오픈소스로 분류하지 않는다.

Penpot은 MPL-2.0 오픈소스이며 Inspect의 HTML/CSS와 공식 MCP를 사용할 수 있다. 현재 사용 중인 서버의 버전·구성은 확인되지 않았으므로 이 작업의 선행조건으로 Penpot 업그레이드를 강제하지 않는다.

Webstudio Builder는 AGPL 계열이며 플랫폼 전체의 모든 옵션이 같은 오픈소스 조건인 것은 아니다. HTML+style 붙여넣기와 이미지 수집, HTML/CSS/JS/images 정적 export가 공식 문서에 있다. Builder 자체의 운영용 self-host는 공식 문서가 현재 권장하지 않는다.

Puck core는 MIT, GrapesJS core는 BSD-3-Clause이다. GrapesJS Studio SDK는 별도 라이선스 조건의 제품이다. GrapesJS 재편집 원본은 JSON project data로 보존해야 하며 HTML/CSS만 왕복시키는 방식은 정보 손실 가능성이 있다.

현재 AU가 Tailwind를 쓰지 않으므로 첫 파일럿은 **HTML+CSS** 또는 **React+CSS**를 기준으로 한다. MDX는 MIT이고 Vite에 연결할 수 있지만, 첫 버전에 반드시 필요한 의존성은 아니다. React와 기존 Sharp를 우선 재사용한다.

## 4. 첫 버전의 제작·발행 경험

1. 원고와 사진을 한 번 준비한다.
2. Pencil/Penpot에서 글 한 편을 디자인한다. 제목·본문 텍스트는 문자 상태로 유지한다.
3. 글 전체의 HTML+CSS와 사진 묶음, 또는 연결된 디자인 파일을 전달한다.
4. Codex가 글 단위로 AU용 React 페이지와 CSS를 만들고 사진을 일괄 정리한다. 목록용 제목·요약·대표 이미지도 같이 준비한다.
5. 사용자는 PC·모바일 미리보기를 한 번 확인한다.
6. 검토된 글을 기존 Cloudflare Pages 배포 흐름으로 발행한다.
7. 수정은 원래 디자인 파일에서 시작하고, 같은 글 ID/주소로 다시 가져온다.

첫 버전은 **에이전트가 수행하는 가져오기·발행**이다. 일반 관리자용 업로드/발행 버튼이나 범용 무손실 변환기가 이미 존재하는 것처럼 설명하지 않는다. 자동화 수준은 첫 실제 export의 HTML 구조·이미지 포함 방식·모바일 품질을 확인한 뒤 정한다.

일반 글 1편과 사진 중심 글 1편에서 동일한 절차가 반복됨을 확인한 다음, 필요하면 `가져오기 → 미리보기 → 발행`만 제공하는 얇은 로컬/관리 화면을 추가한다. 새 Naver식 편집기는 만들지 않는다.

## 5. 공개 정보 구조

- 메뉴 이름 제안: JOURNAL / 저널.
- 주소 제안: `/journal`, `/journal/{slug}`.
- 첫 목록: 대표 글 1개와 최신 글 카드. 내용이 적을 때 빈 카테고리 메뉴를 만들지 않는다.
- 초기 분류 제안: Stories, Chocolate & Cake, Gatherings. 이름은 추천값이다.
- 글 본문: 글마다 자유로운 구성, 공통 헤더·푸터, 목록으로 돌아가기, 관련 상품/문의 링크, 필요한 경우 관련 글.
- 글별 Article 컴포넌트가 h1·히어로·본문 배치를 소유한다. 공통 글 shell은 별도의 제목·히어로를 추가하지 않는다. metadata title은 목록·SEO·공유에 사용하고 글 본문의 h1과 내용이 일치하는지 검증한다.
- 현재 HOGIRL은 기존 주소를 유지하고 Journal에서는 링크로 소개할 수 있다.
- 첫 버전은 영문 원고가 있으면 en-AU로 발행한다. 한국어 원고를 발행할 경우 해당 글을 ko로 명시한다. 번역이 없는 글에서 언어 버튼이 번역 완료를 암시하지 않게 한다. 한영 짝 페이지와 hreflang은 실제 양쪽 원고가 생긴 뒤 추가한다.
- 검색용 단일 canonical은 해당 `/journal/{slug}`로 정한다. 중복 주소·슬래시 변형은 기존 호스팅 정책에 맞춰 정규화한다.

## 6. 글 패키지와 소유권

게시용 파일은 다음 책임으로 나눈다.

| 항목 | 책임 |
| --- | --- |
| 메타데이터 | id, slug, title, excerpt, locale, category, status, publishedAt, updatedAt, cover/alt, sourceUrls |
| 본문 React 컴포넌트 | 글 전체의 h1·히어로·본문·사진 배치와 의미 있는 읽기 순서. 공통 shell은 제목을 중복 출력하지 않음 |
| 글별 CSS | 해당 글 범위의 디자인. 공통 사이트의 스타일을 바꾸지 않음 |
| 최적화 이미지 | 상대경로 해석, 파일명 충돌 방지, width/height, 적절한 variants |
| 원본 위치/변환 기록 | 도구·프레임 식별자·export 버전·revision. 인증 토큰·비공개 경로는 포함하지 않음 |

발행 원본은 검토된 Git 파일이다. 디자인 원본이 편집 기준이며 생성된 페이지를 관리자가 별도로 수정하는 양방향 편집은 첫 버전에 제공하지 않는다. 같은 글의 재가져오기는 기존 revision을 확인해 다른 작업을 덮어쓰지 않는다.

중요: AU 저장소는 현재 **public**이다. `draft` 또는 `noindex`는 비공개 보관을 뜻하지 않는다. 비공개 원고·사진·연락처는 public 브랜치/PR/빌드 자산에 넣지 않는다. 비공개 초안은 원래 디자인 작업 위치에서 보관하고, public 저장소에 넣는 샘플은 공개 가능한 내용으로만 만든다. 공개 전용 관리자를 따로 만들 때 비공개 초안 저장소를 별도 설계한다.

## 7. 실제 내보내기 파일럿의 판정 기준

대표 글은 제목, 본문, 사진 3장 이상, 사진과 글 2열 구간, 인용/강조 구간, 관련 상품 링크를 포함한다. 실제 사용자 export 1개를 기준으로 한다. 실제 파일 없이 임의의 HTML을 만들고 Pencil/Penpot 호환 검증이 끝났다고 보고하지 않는다.

- 문장과 사진 순서가 원본 의도와 일치한다.
- 390px 모바일에서 가로 스크롤·겹침·잘린 텍스트가 없다. 320px에서도 주요 내용을 읽을 수 있다.
- 768px와 1440px에서 배치가 자연스럽게 확장된다.
- 본문은 이미지가 아닌 실제 텍스트다. 200% 확대에서도 내용이 사라지지 않는다.
- 제목 h1 1개와 하위 제목 구조, 링크 이름, 이미지 alt가 맞다.
- 원본의 링크와 이미지가 실제 발행 경로에서 정상 작동한다.
- 디자인의 의도는 유지하되 모바일은 열이 접히거나 이미지가 재배치될 수 있다. 모든 폭에서 같은 픽셀 배치를 보장하지 않는다.
- 처음 한 번 가져온 사진을 관리자에서 재업로드하는 단계가 없다.
- 동일 글 수정본을 다시 가져와도 주소와 목록 카드의 연결이 유지된다.

긴 JPG 1장, 디자인 프로토타입 iframe, 업로드한 임의 JavaScript 실행은 기본 발행 형식으로 채택하지 않는다. 도해·포스터 부분은 이미지로 사용할 수 있다.

## 8. 가져오기와 런타임 경계

첫 버전은 소유자가 제공한 디자인 export를 개발 작업에서 읽고 검토한 React/CSS/이미지로 변환한다. 운영 브라우저가 외부 HTML 문자열을 직접 실행하는 구조를 만들지 않는다.

정적 이미지·링크·텍스트·CSS를 우선 지원한다. export에 script, onerror/onclick, iframe, form, 외부 실행 의존성이 있으면 자동으로 게시하지 않고 위치와 처리 결과를 보고한다. SVG는 필요한 정적 도형만 검토하거나 래스터 이미지로 변환한다. 외부 이미지는 사용자가 제공한/사용 가능한 자산만 일괄 수집하고, 임의 사이트를 광범위하게 수집하지 않는다.

CSS는 `.vg-journal-<slug>` 범위로 제한하고 글별 class/keyframes/font 충돌을 처리한다. 정규식으로 임의 HTML/CSS를 완벽하게 정리할 수 있다고 가정하지 않는다. 범용 자동 importer를 확장할 때 HTML/CSS AST parser와 자산 허용 정책을 실제 입력에 맞춰 선택한다.

수입 파일은 웹에서 실행 가능한 코드로 바로 신뢰하지 않는다. MDX/TSX는 검토된 저장소 코드만 빌드한다. 공개 파일 업로드 API는 이 단계에 만들지 않는다.

## 9. 검색·공유·성능

- 실제 React 본문과 동일한 데이터로 초기 HTML을 생성한다. 검색 전용 숨김 본문을 별도로 쓰지 않는다.
- 초기 HTTP 응답에 글 제목·본문·사진 alt·canonical·description·OG가 들어간다.
- BlogPosting JSON-LD에 headline, datePublished/dateModified, image, author/publisher를 명시한다. 비어 있거나 미확인인 값은 꾸며 넣지 않는다.
- sitemap과 RSS에는 발행된 글만 포함한다. RSS는 첫 버전에서 제목·요약·canonical 링크 중심으로 제공한다.
- build가 끝나야 발행된 것으로 처리한다. 실패하면 이전 운영 버전이 계속 제공된다.
- 글의 큰 이미지/본문을 첫 홈페이지 JavaScript 번들에 모두 포함하지 않는다. 목록은 요약 메타데이터만 읽는다.
- 원본 이미지 크기를 무조건 늘리지 않고 Sharp로 필요한 크기만 만든다. hero 외 이미지는 lazy loading, 크기를 지정해 화면 흔들림을 줄인다.
- 글 발행일 기준은 Australia/Sydney를 명시한다. 타임존이 없는 날짜 문자열을 발행 순간으로 추정하지 않는다. 자동 예약 발행은 첫 버전 범위에 포함하지 않는다.

## 10. 매거진 연동 범위

첫 버전에서는 기존 매거진을 소재 저장소로 활용한다. AU 고객에게 적합한 글만 선택해서 새 원고·자체 사진/허용된 이미지로 Journal 콘텐츠를 만든다. 출처가 있는 글은 sourceUrls와 본문 출처 링크를 유지한다.

선별 뉴스 카드를 추가할 경우 AU 쪽에 작은 승인 목록을 두고 빌드할 때 반영한다. 기존 매거진 전체 피드나 Tech 카테고리를 자동 삽입하지 않는다. 브라우저가 매거진 API 응답을 기다려야 Journal이나 주문 페이지가 표시되는 구조로 만들지 않는다.

나중에 자동 연동을 원할 때만 featuredOnAu 같은 명시적 선별 필드와 서버/빌드 어댑터를 설계한다. 현재 API에는 CORS 설정이 코드상 명시돼 있지 않으므로 도메인 간 브라우저 요청이 된다고 가정하지 않는다.

별도 정비 후보: 매거진 canonical/OG 기준 주소, 혼재한 카테고리명, 수집일과 원문 발행일 구분. 이들은 AU Journal MVP의 선행조건이 아니다.

## 11. 범위와 완료 기준

이번 MVP의 제품 범위는 AU Journal 목록·상세, 글 패키지 계약, 이미지 일괄 처리, 디자인→웹 파일럿, 미리보기·Git 발행 절차, 검색·공유 메타데이터다. WordPress/새 DB/새 상시 서버는 첫 버전의 필수 요소가 아니다.

완료는 조사 문서 작성이나 빌드 성공만으로 판단하지 않는다. 실제 디자인 글 1편의 PC·모바일 비교, 텍스트·사진 확인, 직접 URL 접근과 새로고침, JS 실행 전후 내용 일치, AU 주요 내비게이션·장바구니 확인, 동일 글 재가져오기까지 성공해야 한다.

다음 시작에 필요한 입력은 **대표 글의 실제 디자인 export(HTML+CSS+사진) 또는 접근 가능한 Pencil/Penpot 원본**이다. 현재 조사 세션에는 해당 글 원본이 제공되지 않았다. 첫 도구 선택과 실제 export 품질이 확정되기 전에는 범용 자동 가져오기 지원 범위를 확정하지 않는다.

## 12. 근거

### 현재 프로젝트

- [AU package.json](https://github.com/nam9295-cmyk/au-cake/blob/47730d473da9ff537f032ad9e13e86b89d58aaad/package.json)
- [AU routes](https://github.com/nam9295-cmyk/au-cake/blob/47730d473da9ff537f032ad9e13e86b89d58aaad/src/lib/app-routes.ts)
- [AU static portfolio rendering](https://github.com/nam9295-cmyk/au-cake/blob/47730d473da9ff537f032ad9e13e86b89d58aaad/scripts/portfolio-static.tsx)
- [AU SEO build](https://github.com/nam9295-cmyk/au-cake/blob/47730d473da9ff537f032ad9e13e86b89d58aaad/scripts/generate-seo-pages.mjs)
- [Magazine schema and readers](https://github.com/nam9295-cmyk/very-magazine/blob/a9e9f544f8de93c70b16b61792189bad2c663126/src/lib/magazine-posts.ts)
- [Magazine API](https://github.com/nam9295-cmyk/very-magazine/blob/a9e9f544f8de93c70b16b61792189bad2c663126/src/app/api/posts/route.ts)
- [Magazine site URL](https://github.com/nam9295-cmyk/very-magazine/blob/a9e9f544f8de93c70b16b61792189bad2c663126/src/lib/site.ts)
- [AU 공개 화면](https://au.verygood-chocolate.com/) / [매거진 공개 화면](https://magazine.verygood-chocolate.com/) — 2026-10-30 직접 관찰.

### 도구 공식 문서

- [Pencil HTML export](https://docs.pencil.dev/core-concepts/import-and-export) — 문서 갱신일 2026-10-13.
- [Pencil design to code](https://docs.pencil.dev/design-and-code/design-to-code)
- [Pencil EULA](https://www.pen.dev/eula)
- [Penpot Inspect/HTML/CSS](https://help.penpot.app/user-guide/dev-tools/)
- [Penpot MCP](https://help.penpot.app/mcp/)
- [Penpot repository/license](https://github.com/penpot/penpot)
- [Webstudio HTML/CSS import](https://docs.webstudio.is/university/foundations/copy-paste/html-with-css)
- [Webstudio static export](https://docs.webstudio.is/university/self-hosting/download)
- [Webstudio hosting distinction](https://docs.webstudio.is/university/self-hosting)
- [Webstudio repository/license](https://github.com/webstudio-is/webstudio)
- [Puck](https://puckeditor.com/docs)
- [GrapesJS project storage](https://grapesjs.com/docs/modules/Storage.html)
- [GrapesJS license](https://github.com/GrapesJS/grapesjs/blob/dev/packages/core/LICENSE)
- [GrapesJS Studio SDK licensing](https://app.grapesjs.com/docs-sdk/overview/licenses)
- [MDX Vite integration](https://mdxjs.com/packages/rollup/)
