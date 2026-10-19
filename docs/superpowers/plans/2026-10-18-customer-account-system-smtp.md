# B5 System SMTP Implementation Plan

> **For agentic workers:** 실제 적용 승인 후 `superpowers:executing-plans`로 순차 실행한다. Mac Codex 단독이며 subagent/Hermes 위임 없음. **현재는 사전 점검·계획만 승인됐고 아래 쓰기 단계는 전부 미실행이다.** B6/Account ON/메일 발송으로 자동 진행하지 않는다.

**Goal:** 별도 운영 승인 아래 기존 very-server의 기본 SMTP만 유효한 system credential로 구성하고, B4 테스트 SMTP·Google과 기존 프로젝트의 저장된 권한·배포·인증 설정을 보존한다.

**Architecture:** 기존 Compose의 `.env` 7개만 변경하고 동일 이미지로 mail worker → API를 각각 재생성한다. 원본 바이트를 보존하는 로컬 검증 도구와 보호 백업을 먼저 준비한다. 실패 시 API → worker 순서로 같은 7개만 복구하며 고객 DB/공유 queue는 복구 대상이 아니다.

**Tech Stack:** Appwrite 1.8.1 / 현재 image ID 고정, Docker Compose 5.2.0, Python 표준 라이브러리, 기존 PHPMailer, Resend SMTP 465/SSL.

**Spec:** [B5 실제 점검·운영 영향](../../customer-account-b5-preflight.md), [공개 변경 명세](../../customer-account-b5-system-smtp-manifest.json), [B4 결과](../../customer-account-b4-smtp-validation.md), [B안 전체 계획](2026-10-17-customer-account-very-server-test.md).

## Global Constraints

- 승인 worktree `/Users/nam9295/Desktop/john_2.0/code/au-cake-customer-account`, branch `feat/customer-account`만 수정한다. main/다른 worktree/이력/운영 Function·schema·ACL·판매 설정 변경 금지.
- 대상 host `very-server`, Compose project `appwrite`, directory `/home/john/srv/appwrite/appwrite`, services **`appwrite`, `appwrite-worker-mails`**만. DNS/새 Compose/설치/이미지 pull·upgrade/전체 down/up/다른 컨테이너 재생성 금지.
- 기존 네 project의 Account/Email OTP/Magic URL/Email-Password ON, SMTP OFF가 실제 관측 baseline다. 공통 SMTP로 기존 발송 gate가 해제되는 영향을 별도 승인받는다. 원하지 않는 인증 방법을 임의 OFF하지 않는다.
- test `verygood-au-account-test`의 Account·Email OTP OFF, Google enabled, B4 override ON을 유지한다. 새 Appwrite Key, OTP·일반 메일 발송, 실제 주문/결제, 고객 데이터 접근·수정 금지. B5 도구의 검증은 **TLS/SMTP AUTH 연결까지만**, DATA/send 없음. manifest의 발송 금지 flag는 외부 native API 요청에 대한 방화벽이 아니며 기존 운영 경로의 동작 변화 수용을 대체하지 않는다.
- Resend 새 system Key는 `sending_access` / domain `43b81ebb-788c-41ac-8f0b-2160249a1470`만. 기존 운영 Key·B4 Key 재사용/회수 금지. Secret은 root 전용 보호 파일/0600 `.env` 외에 출력하지 않는다.
- 공개 명세 SHA-256: **`6516ad5400b40955f6e6604eca2161560c5e5cb10305a6638af4b9377f1539ce`**. 불일치하면 중단하고 재검토한다.
- queue pending0 / processing0 / failed1 보존. failed 재시도·삭제, queue flush, DB/volume restore 금지.
- 재생성 전 정식 root/sudo 인증이 필요하다. 현재 비대화식 sudo는 실패했다. 사용자의 기존 관리자 인증을 쓰며 Docker/SQL/새 권한으로 우회하지 않는다.

## Review Focus

1. 비 UTF-8 주석·CRLF·동시 `.env` 수정: 선택 7개 이외의 바이트가 그대로 남아야 한다(Task 1).
2. 다른 host/path/symlink/중복 key/manifest drift: 쓰기 전에 거부하고 파일 변경 0회여야 한다(Task 1).
3. 다른 env/Compose/image/dependency 변경 및 조회의 활동·암호화 nonce 갱신: raw와 canonical semantic 지문을 함께 보존하고 실제 정책 drift는 차단해야 한다(Task 1–3).
4. 정상/실패 mail의 부주의한 재투입과 숨은 발송: baseline failed1을 보존하고 SMTP 검증은 AUTH 뒤 종료해야 한다(Task 3–4).
5. 실패 후 전체 `.env`·DB를 덮는 복구: 원래 7개만 되돌리고 원본과 다른 설정 drift는 자동 덮어쓰지 않아야 한다(Task 1, 4).

---

## 파일과 산출물

현재 승인 범위에서 작성한 것은 B5 report/manifest/이 계획 및 기존 상태 문서의 갱신뿐이다. **아래 도구는 향후 승인 후 작성할 예정이며 현재 존재하는 실행 도구로 오인하지 않는다.** 제품 코드는 수정하지 않는다.

- Create later: `scripts/customer-account-system-smtp-env.py` — 원본 bytes 기반 계획/적용/복구와 exact-host/path/manifest/permission/hash guard.
- Create later: `tests/customer-account-system-smtp-env.test.mjs` — Python subprocess/임시 합성 fixture의 byte 보존·거부·복구 검증. 운영 연결 없음.
- Create later: `scripts/customer-account-system-smtp-metadata.mjs`, `tests/customer-account-system-smtp-metadata.test.mjs` — 공식 Owner CLI 세션의 console-project GET 5개만 허용하고, 시간/암호화 envelope와 의미적 정책을 구분하는 read-only 지문 검증.
- Reuse: 기존 private `b1-metadata-snapshot.py`의 READ ONLY 구성·schema/ACL 지문. 실행 전 source를 검토하고 운영 rows를 추가하지 않는다.
- Server only, after approval: `/root/verygood-b5-backups/<UTC stamp>/`의 원본·image tar·state·도구·manifest·safe 결과. 0700/0600, Git/공개 artifact 업로드 금지.

### Task 1: 로컬 bytes 보존 도구와 read-only metadata guard

**Interfaces:** `plan_env(before: bytes, replacements: dict[str, bytes]) -> bytes`, `restore_env(current: bytes, state: dict) -> bytes`. 정확한 7개 key의 기존 단일 행만 변경한다. CLI `plan`, `apply`, `rollback`은 `--manifest`, `--env-file`, `--state`를 받는다. `plan`은 `--credential-file`, `--output`으로 private candidate를 만든다. password는 CLI 값/로그로 받지 않는다. `apply`/`rollback`은 root·hostname·실제 경로/owner·0600·승인 manifest hash·현재/선택 행 hash를 모두 확인한다.

- [ ] RED: `tests/customer-account-system-smtp-env.test.mjs`에 비 UTF-8 bytes/CRLF fixture를 만들고 7개만 변경한 뒤 복구하면 원본 bytes와 동일함을 검증한다. 모듈 부재로 실패하는지 확인한다.
- [ ] RED: 잘못된 host/경로/symlink, 6개 또는 8개 key, 중복·누락 key, 잘못된 manifest, before hash drift, credential의 scope/domain/보호 파일 권한 오류와 개행 주입이 모두 file write 0회임을 검증한다. 실제 scope 확인은 공식 Resend Console 관찰이며 자기 선언 JSON만으로 대체하지 않는다.
- [ ] 구현: bytes로 읽고 대상 행만 치환한다. 다른 행/순서/줄바꿈을 보존하고 atomic replace·fsync·root:root/0600을 사용한다. key 7개의 원본 행과 적용 행 digest를 private state에 보관한다. rollback은 선택 행이 적용 상태와 일치할 때만 원본 행을 복구한다. 타인이 SMTP 행까지 바꿨으면 멈춘다.
- [ ] GREEN: `node --test tests/customer-account-system-smtp-env.test.mjs`. 복구 중 다른 설정을 유지하되 non-SMTP drift가 있으면 재생성 전 사람에게 보고한다. manifest의 테스트 Account OFF/메일 금지 조건을 우회하는 runtime flag는 만들지 않는다.
- [ ] 로컬 lint/관련 guard 회귀·diff 검증 후 기능 커밋한다. 도구 검증이 실패하면 다음 단계로 가지 않는다.
- [ ] metadata 도구의 RED: `fingerprintProject(project: object) -> string`이 같은 정책/다른 `accessedAt`·`$updatedAt`을 동일하게 보고, Auth/SMTP/OAuth/서비스/권한 변경은 모두 다르게 보는 합성 fixture를 추가한다. SMTP/OAuth credential 원문은 결과·로그에 없어야 한다. 보안 필드를 생략해 테스트를 통과시키지 않는다.
- [ ] metadata 도구 구현·GREEN: `readProjectFingerprints({endpoint, officialOwnerCliSession, transport})`는 manifest의 5개 project에 대한 `GET /projects/:id`만 호출하며 `X-Appwrite-Project: console`과 정식 CLI 세션만 사용한다. admin mode/다른 메서드/redirect/운영 API Key/브라우저 Cookie 추출을 거부한다. raw SQL 지문과 current semantic 지문을 함께 기록한다. 과거 semantic 자료가 없는 Gallery 예외는 자동 정상 처리하지 않는다. 별도 기능 커밋하고 검토한다.

### Task 2: 승인·공식 credential·보호 백업과 dry-run

**Consumes:** Task 1 도구, 승인 manifest, B5 report. **Produces:** 보호 `env.before`, `env.candidate`, `state.json`, before metadata 및 비교 결과. 아래 명령은 **이번에 실행하지 않았다**.

- [ ] 운영자에게 기존 4개/Console의 gate 해제, system sender/name, 새 Resend Key, `.env` 0600, root 인증, failed1 미재시도, 저부하 15분 창 및 두 서비스 rollback 권한을 함께 승인받는다. 수신자 제한 없는 공개 test OTP는 승인 요청에 포함하지 않는다.
- [ ] 기존 Owner Console에서 각 project ID/Account/Auth/SMTP와 test OFF를 다시 확인한다. B4 authLimit2는 공식 Owner GET으로 재확인한다. Security UI의 100 기본 입력을 저장하지 않는다.
- [ ] 기존 Resend Owner Console에서 root domain Verified, quota/반송 집계를 재확인한다. 미래 별도 승인된 테스트 예산과 운영 여유를 정하고 악화/차단이 있으면 중단한다. 현재 failed mail 1건은 원인 미조회 상태로 보존하는 정책을 확인한다.
- [ ] 실제 Key 발급 시 실행 직전 보안 확인을 거쳐 `VERYGOOD Appwrite SYSTEM SMTP B5 20261018` / Sending access / 정확한 root domain ID만 생성한다. Secret은 비공개 파일로 전달한다. 새 Appwrite 관리자 Key는 만들지 않는다.
- [ ] 기존 관리자가 **실제 실행할 동일한 root/sudo 세션**을 정식으로 인증한다. 다른 SSH 세션의 `sudo -v`가 현재 세션에 적용됐다고 가정하지 않는다. 비밀번호·토큰은 채팅으로 받지 않는다.
- [ ] hostname/Compose·env 원본 SHA, 이미지 ID, 7개 key 단일 존재, server 여유를 다시 검사한다. 달라졌으면 명세를 자동 갱신하지 말고 보고한다. 공개 health와 READ ONLY metadata, 다른 Compose 컨테이너의 ID/image/start/env hash를 기록한다. mount 목록은 destination/source 기준으로 정렬해 비교한다.
- [ ] Gallery의 사전 점검 raw 지문 예외를 검토하고 공식 Owner GET semantic baseline을 승인받는다. 기존 raw 지문은 보존한다. 앞으로도 raw 차이를 활동 시각/암호화 변동이라고 설명하려면 전후 semantic 값이 동일해야 하며, 실제 보안 정책 diff 또는 증거 부족이면 중단한다.

아래는 승인 후 **서버의 정식 root bash 세션에서만** 사용할 백업 명령이다. dot-source나 `set -x`는 사용하지 않는다.

```bash
umask 077
B5_ROOT=/home/john/srv/appwrite/appwrite
B5_BACKUP_DIR="/root/verygood-b5-backups/$(date -u +%Y%m%dT%H%M%SZ)"
install -d -o root -g root -m 0700 "$B5_BACKUP_DIR"
install -o root -g root -m 0600 "$B5_ROOT/.env" "$B5_BACKUP_DIR/env.before"
install -o root -g root -m 0600 "$B5_ROOT/docker-compose.yml" "$B5_BACKUP_DIR/compose.before.yml"
stat -c '%n %a %u %g' "$B5_ROOT/.env" "$B5_ROOT/docker-compose.yml" > "$B5_BACKUP_DIR/file-metadata.before"
sha256sum "$B5_ROOT/.env" "$B5_ROOT/docker-compose.yml" > "$B5_BACKUP_DIR/file-sha.before"
unset _APP_SMTP_HOST _APP_SMTP_PORT _APP_SMTP_SECURE _APP_SMTP_USERNAME _APP_SMTP_PASSWORD _APP_SYSTEM_EMAIL_NAME _APP_SYSTEM_EMAIL_ADDRESS
B5_COMPOSE=(docker compose --project-directory "$B5_ROOT" --env-file "$B5_ROOT/.env" -p appwrite -f "$B5_ROOT/docker-compose.yml")
"${B5_COMPOSE[@]}" config --format json > "$B5_BACKUP_DIR/compose-resolved.before.json"
docker inspect appwrite appwrite-worker-mails > "$B5_BACKUP_DIR/containers.before.json"
docker image inspect appwrite/appwrite:1.8.1 > "$B5_BACKUP_DIR/image.before.json"
docker image save --output "$B5_BACKUP_DIR/appwrite-1.8.1.tar" appwrite/appwrite:1.8.1
sha256sum "$B5_BACKUP_DIR/appwrite-1.8.1.tar" > "$B5_BACKUP_DIR/image-tar.sha256"
```

- [ ] 이미지 tag가 manifest의 image ID인지 export 전·후 확인한다. backup 내 원본 두 파일의 bytes가 원본과 일치하는지 검사한다. tar의 파일 목록/sha와 디스크 여유(백업 후 30 GiB 이상)를 검증한다. DB/volume/queue/customer export는 하지 않는다.
- [ ] 검증한 Task 1 도구·manifest만 `$B5_BACKUP_DIR/tools/`와 `$B5_BACKUP_DIR/manifest.json`에 root 소유로 설치하고 SHA를 대조한다. `system-key.private.json`은 root 0600, Secret을 출력하지 않는다. 원본 `.env` 0600 전환은 이 단계의 별도 승인 항목이다.
- [ ] `plan`으로 candidate를 만든다. 다음 read-only config 명령은 **원래 `.env`를 바꾸지 않고** 검증한다. before/candidate resolved JSON은 secret을 포함하므로 화면에 출력하지 않는다.

```bash
python3 "$B5_BACKUP_DIR/tools/customer-account-system-smtp-env.py" plan --manifest "$B5_BACKUP_DIR/manifest.json" --env-file "$B5_ROOT/.env" --credential-file "$B5_BACKUP_DIR/system-key.private.json" --state "$B5_BACKUP_DIR/state.json" --output "$B5_BACKUP_DIR/env.candidate"
docker compose --project-directory "$B5_ROOT" --env-file "$B5_BACKUP_DIR/env.candidate" -p appwrite -f "$B5_ROOT/docker-compose.yml" config --format json > "$B5_BACKUP_DIR/compose-resolved.candidate.json"
```

- [ ] candidate의 차이가 두 서비스의 정확한 7개 변수뿐인지 기계 비교한다. image/mount/volume/network/command/다른 서비스/non-SMTP env에 차이가 있으면 중단한다. 보호 state·diff·backup을 검토한 뒤에만 실제 apply로 진행한다.

### Task 3: 동일 이미지로 worker → API 적용

**Consumes:** 검증된 candidate/state와 실제 적용 승인. **Produces:** 두 서비스에만 반영된 7개 변수, safe health 결과. 도구는 User/DB/API resource write나 SMTP DATA를 실행하지 않는다. 공통 gate가 해제된 기존 native Auth에 외부 요청이 들어오면 Auth 데이터/메일이 생길 수 있으므로 그 운영 영향은 별도로 승인받아야 한다.

- [ ] mail queue 건수를 다시 5초 간격 두 번 확인한다. pending/processing 0, failed1 기준과 다르면 진행하지 않는다. `queue-retry`, `LRANGE`, payload 조회는 하지 않는다.

```bash
docker exec appwrite-redis redis-cli --raw LLEN utopia-queue.queue.v1-mails
docker exec appwrite-redis redis-cli --raw LLEN utopia-queue.processing.v1-mails
docker exec appwrite-redis redis-cli --raw LLEN utopia-queue.failed.v1-mails
```

- [ ] `apply`는 원본 hash/state/hostname/manifest를 다시 확인하고 7개만 atomic 변경한다. helper가 이미 적용된 상태나 모호한 실패를 받으면 자동 재시도하지 않는다.

```bash
python3 "$B5_BACKUP_DIR/tools/customer-account-system-smtp-env.py" apply --manifest "$B5_BACKUP_DIR/manifest.json" --env-file "$B5_ROOT/.env" --state "$B5_BACKUP_DIR/state.json"
"${B5_COMPOSE[@]}" up -d --no-deps --no-build --pull never --force-recreate --timeout 30 appwrite-worker-mails
```

- [ ] worker Running/restart count, image ID·정확한 SMTP fields 및 non-SMTP env/구성 불변, queue 0/0/1을 확인한다. 아래 AUTH-only 검사를 worker에서 실행한다. 실패하면 API는 새 env로 재생성하지 말고 Task 4의 worker 복구만 수행한다.
- [ ] worker 확인 후 API만 재생성한다. 5초 간격 public health를 관찰하고 60초 안에 200/1.8.1이 복원되지 않으면 Task 4로 간다.

```bash
"${B5_COMPOSE[@]}" up -d --no-deps --no-build --pull never --force-recreate --timeout 30 appwrite
curl --fail --silent --show-error --max-time 5 https://api.verygood-chocolate.com/v1/health/version
```

- [ ] API와 worker에서 각각 아래 PHP를 `docker exec -i <정확한 서비스> php`의 STDIN으로 전달한다. PHP는 이미 설치된 PHPMailer를 사용한다. Secret은 container env 안에서만 읽고 SMTP AUTH 후 닫으며 `send()`/DATA는 호출하지 않는다. 외부 timeout/실패는 성공으로 취급하지 않는다.

```php
<?php
require '/usr/src/code/vendor/autoload.php';
use PHPMailer\PHPMailer\PHPMailer;
if (getenv('_APP_SMTP_HOST') !== 'smtp.resend.com' || getenv('_APP_SMTP_PORT') !== '465' || getenv('_APP_SMTP_SECURE') !== 'ssl' || getenv('_APP_SMTP_USERNAME') !== 'resend' || getenv('_APP_SYSTEM_EMAIL_ADDRESS') !== 'appwrite-system@verygood-chocolate.com') { exit(1); }
$mail = new PHPMailer(true);
$mail->isSMTP();
$mail->Host = 'smtp.resend.com';
$mail->Port = 465;
$mail->SMTPSecure = 'ssl';
$mail->SMTPAutoTLS = false;
$mail->SMTPAuth = true;
$mail->Username = 'resend';
$mail->Password = getenv('_APP_SMTP_PASSWORD');
$mail->Timeout = 5;
try {
    if (!$mail->Password || !$mail->smtpConnect()) { throw new RuntimeException(); }
    $mail->smtpClose();
    echo "SMTP_TLS_AUTH_OK\n";
} catch (Throwable $error) {
    $mail->smtpClose();
    fwrite(STDERR, "SMTP_TLS_AUTH_FAILED\n");
    exit(1);
}
```

- [ ] AUTH 성공은 메일 배송이나 기본 transport의 queue end-to-end 성공이 아님을 기록한다. B4 explicit override sample을 common fallback 검증으로 바꾸어 보고하지 않는다. B5에 sample 발송을 추가하려면 수신자·내용·1회 제한을 별도 승인받는다.

### Task 4: 불변 검사와 즉시 rollback

**Consumes:** before metadata, root backup/state, Task 3 결과. **Produces:** 적용 성공 또는 명시된 부분 적용을 포함한 복구 보고. DB/history/공유 queue를 자동 원복하지 않는다.

- [ ] project 수5·기존4의 9범주 구성/schema/ACL/배포/Key/platform 지문을 비교하고 원본 raw 결과를 보존한다. 활동 저장으로 암호화 raw 지문이 달라져도 공식 Owner GET의 전후 semantic config는 완전히 같아야 한다. test Account OFF guest `GET /account`는 403 `general_service_disabled`, Google/B4 SMTP semantic 지문도 동일해야 한다. 증거가 부족하거나 실제 설정 diff면 중단한다. 고객 사용자/주문 rows로 확인하지 않는다.
- [ ] API/mail worker 두 개만 container ID/start가 변경됐고 image ID는 동일한지, 다른 Compose 서비스 및 핵심 DB/Redis/executor/Console/realtime/proxy는 그대로인지 확인한다. 관리자 인증 기존 설정 보존을 확인하고 실제 관리자 로그인/회귀 smoke에 새로운 세션·이메일이 필요하면 별도 승인 범위로 표시한다.
- [ ] queue/failed 증가·예상치 않은 발송, AUTH/인증서 오류, 60초 health 실패, quota 급증/429, config/image drift, 기존 관리자/guest 장애, OOM/CrashLoop, RAM<3 GiB/disk<30 GiB, load1≥4 5분 지속이면 rollback한다. Resource threshold에 도달하면 5분을 기다리지 않아도 중단할 수 있다.
- [ ] `.env` 7개가 적용 상태와 일치하는지 먼저 확인한다. 다른 설정 drift가 있으면 원본 전체를 덮지 말고 operator와 복구 범위를 확인한다. 변경 7개만 helper `rollback`으로 원래 bytes로 되돌리고 0600을 유지한다.

```bash
python3 "$B5_BACKUP_DIR/tools/customer-account-system-smtp-env.py" rollback --manifest "$B5_BACKUP_DIR/manifest.json" --env-file "$B5_ROOT/.env" --state "$B5_BACKUP_DIR/state.json"
"${B5_COMPOSE[@]}" up -d --no-deps --no-build --pull never --force-recreate --timeout 30 appwrite
```

- [ ] 원래 API host empty/health가 확인되면 worker를 원래 값으로 되돌린다. worker만 바뀐 부분 실패라면 API 재생성을 생략하고 worker만 원복한다. config 파일 복구만으로 이미 실행 중인 container env가 바뀌었다고 판단하지 않는다.

```bash
"${B5_COMPOSE[@]}" up -d --no-deps --no-build --pull never --force-recreate --timeout 30 appwrite-worker-mails
```

- [ ] 원래 image ID가 로컬에 없으면 자동 pull하지 않는다. 검증한 tar를 `docker image load --input "$B5_BACKUP_DIR/appwrite-1.8.1.tar"`로 복구하는 것은 사전 승인한 image 복구 범위에서만 수행하고 ID를 다시 대조한다. 다른 이미지 tag가 생겼다면 무단으로 덮지 않는다.
- [ ] 원래 공통 SMTP empty / system name/address, non-SMTP env, 기존4 metadata, B4 override/Google, test OFF, queue 0/0/failed baseline을 확인한다. 이미 발송된 메일·새 Auth user/token/session 같은 요청 부작용은 자동 삭제하지 않는다. 이미 발급된 코드·링크가 즉시 무효화된다고 보장하지 않는다. 시스템 Key 회수가 필요하면 **새 system Key만** 특정해 승인받는다.

### Task 5: 보고·중단

- [ ] 실제 적용/복구 시각, 각 서비스 통신 공백, image·non-SMTP 불변, TLS/AUTH 결과와 미발송, 기존4/test 설정·queue 건수, quota, resource 및 보존 backup 경로를 Secret 없이 기록한다.
- [ ] report/rollout/B안 계획을 실제 결과로 갱신하고 별도 문서 커밋한다. frontend/server customer flags·Account OFF, B4 설정 보존을 확인한다.
- [ ] B6/공개 OTP/실제 메일/사이트 배포/main 병합은 진행하지 않고 결과를 보고한다. TO 제한 미입증이면 공개 OTP 보류를 유지한다.

## 현재 계획 검증과 미완료

이 계획의 root backup/Key/env apply/recreate/AUTH-check/rollback 명령은 실행하지 않았다. 현재 root 인증·system credential·실제 적용 권한이 없고, TO 제한도 입증하지 못했다. 공통 env/컨테이너는 그대로지만 Gallery raw config 지문 1개는 조회 활동·재암호화와 일치하는 변동이 관찰돼 완전 불변을 확정하지 않았다. 이 예외를 해소/검토하기 전 실제 적용하지 않는다. 예상 API 공백 30–120초, 유지보수 창15분은 실측 SLA가 아니다. 실행 직전 baseline이 바뀌면 중단하고 계획을 갱신한다.

## 2026-10-19 실행 기록

사용자의 최신 일괄 요청으로 기존 통합 시험을 CLOSED25까지 종료했다.
[실행 결과](../../customer-account-b5-final-results.md)의 수신자 제한 gate에서
중단했으며 SMTP apply/Key 발급/서비스 재생성/OTP는 실행하지 않았다.
기존 명세와 SHA, 과거 raw 불확실성을 유지한다. B5는 **DEFERRED — RELEASE BLOCKER**.
