# review-api sharp 0.35.5 배포 및 rollback

- 작성일: 2026-10-21
- 패치 커밋: `2cf67a1`
- 운영 변경 상태: 미실행
- 대상: Appwrite project `verygood-au`, Function `review-api`

## 1. 변경

`appwrite-functions/review-api/package.json`과 lockfile의 `sharp`를 0.35.4에서 0.35.5로 올렸다. sharp platform artifact는 0.35.5, libvips artifact는 1.3.4로 함께 갱신됐다. `libheif-js` 1.19.8과 `node-appwrite` 22.1.3을 포함한 다른 직접 dependency는 바꾸지 않았다.

[GHSA-wq5f-xc86-pv6w](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w)의 수정 경계는 0.35.5 이상이다.

## 2. 운영 기준선

| 항목 | 값 |
|---|---|
| Function ID | `review-api` |
| 이전 정상 deployment | `6a90036a14939fa970f1` |
| Runtime | `node-22` |
| Timeout | 30초 |
| Memory/spec | `s-8vcpu-8gb` |
| Scopes | databases read/write, documents read/write, files read/write |
| Execute | `any` |
| Schedule/events | 없음 |
| Variables | 19개, 기존 secret metadata 유지 |
| Entrypoint | `src/main.js` |
| Install | `npm ci --omit=dev` |

이 배포는 설정·scope·변수 값을 수정하지 않는다. 공개 review submit 계약 때문에 `execute=any`는 그대로 두며, admin action은 기존 server guard가 계속 막는다.

## 3. 검증 결과

### 로컬 관련 회귀

| Suite | 결과 |
|---|---:|
| review-api | 102/102 PASS |
| review-api deploy contract | 23/23 PASS |
| admin review/preview/reward | 38/38 PASS |
| review invite/email/Resend transport | 18/18 PASS |
| coupon client/component | 37/37 PASS |
| review photo client/component | 28/28 PASS |
| public review/display | 28/28 PASS |
| review page/isolation | 30/30 PASS |
| 합계 | 304/304 PASS |

변경 테스트 파일 ESLint와 `git diff --check`도 PASS했다. 중첩 Function의 `npm audit --omit=dev`는 production dependency 취약점 0건이다.

### Linux x86_64 / Node 22

- Debian `node:22-bullseye`: Node 22.23.2, npm 10.9.8, clean install PASS.
- 실제 Appwrite runtime image `openruntimes/node:v5-22`: Node 22.23.2, Alpine 3.23.6, x86_64, clean install PASS.
- native load: sharp 0.35.5, libvips 8.18.7, libheif 1.23.5, librsvg 2.63.2.
- Linux 관련 회귀: 132/132 PASS.
- 실제 포맷: WebP, JPEG, PNG, AVIF, real HEIC/HEIF PASS.
- 방어 경로: invalid bytes, MIME mismatch, animation, pixel bomb, byte limit, lifetime cap PASS.
- 저장/표시: private upload, metadata stripping, randomized WebP, 관리자 JWT preview PASS.
- 리뷰·쿠폰·초대·reward email·retry·배포 계약 PASS.

opaque JPEG/PNG/invalid bytes를 HEIF decoder가 먼저 거부할 때 stderr 경고가 발생하지만 기존 설계대로 sharp fallback이 처리하며 결과는 PASS다.

## 4. 배포 아카이브

검증 시 생성한 임시 아카이브:

- 경로: `/tmp/review-api-sharp-0.35.5-security-phase1.tar.gz`
- SHA-256: `d2ee7111402e6c5eba9e51d485508b45671e19ca7dcc1c8274507c76df5fa149`
- 크기: 42,919 bytes

포함 범위:

- `package.json`, `package-lock.json`
- `src/`
- shared email delivery/transport/retry modules
- Sydney calendar helper

`.env`, API Key, Resend Key, Function variables, `node_modules`는 포함되지 않는다. tar metadata 때문에 재생성 아카이브 hash가 달라질 수 있으므로 운영 배포 시에는 커밋 `2cf67a1`의 파일 목록과 내부 package hash를 다시 검증한다.

## 5. 승인 후 배포 절차

1. 현재 Function GET과 active deployment가 위 기준선과 동일한지 읽는다.
2. 프로젝트·Function ID guard를 `verygood-au/review-api`로 고정한다.
3. operator credential은 `functions.read`, `functions.write`만 가진 만료형 Key 또는 공식 Owner 세션을 사용한다.
4. 커밋 `2cf67a1`에서 archive를 다시 만들고 다음을 검사한다.
   - sharp 0.35.5
   - linux-x64 artifact 0.35.5
   - entrypoint/shared files 존재
   - secret·env·node_modules 없음
5. 기존 범용 deploy script처럼 Function metadata와 variables를 다시 쓰지 않는다. 공식 Appwrite 1.8.1 deployment API로 archive만 `activate=false` 상태로 업로드한다.
6. deployment가 ready인지 확인하고 build log의 `npm ci --omit=dev`, Node 22, native sharp load를 비민감 정보로 확인한다.
7. ready일 때만 새 deployment를 활성화한다.
8. read-only health/public review list/admin preview를 순차 확인한다. 실제 리뷰·쿠폰·메일·고객 데이터를 생성하지 않는다.
9. Function metadata, variable key/secret flags, scope, schedule, execute가 기준선과 동일한지 다시 읽는다.
10. 운영 응답과 서버 자원을 확인하고 종료한다.

## 6. 중단·rollback

- build 실패: 새 deployment를 활성화하지 않고 이전 active deployment를 유지한다.
- activation 후 import/native/health 실패: 이전 deployment `6a90036a14939fa970f1`을 즉시 재활성화한다.
- Function metadata·variables·scope drift: 새 deployment 활성화를 중단한다. 이미 활성화했다면 이전 deployment를 복원하고 drift를 승인 없이 고치지 않는다.
- email/review/coupon 오류: 메일을 재시도하거나 쿠폰을 재발급하지 않고 이전 deployment로 복원한다.
- rollback 후 active deployment ID, Function enabled 상태, scope·variables metadata, public review read, admin guard를 확인한다.

DB schema, ACL, Storage permission, Auth, SMTP, Pages, main은 이 배포 범위에 포함하지 않는다.
