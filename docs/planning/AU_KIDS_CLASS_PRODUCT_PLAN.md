# Verygood Chocolate AU Kids Cake Class Product Plan

> Status: ready for implementation
> Project path: `/home/john/workspace/au-cake`
> Source research: `/home/john/workspace/au-kids/sydney_kids_cake_class_launch_proposal.md`
> Reference site only: `https://partner.verygood-chocolate.com/`

## 1. 결론

호주 키즈 케이크 클래스는 한국 partner 사이트를 그대로 복사하지 않는다. 기존 AU 케이크 예약사이트에 별도 클래스 예약 흐름을 추가한다.

권장 구조:

- Existing cake order: `/`, `/reserve`, `/lookup`, `/admin/reservations`
- New class landing: `/classes`
- New class reservation: `/class-reserve`
- New class admin: `/admin/classes`

이유:

- 기존 AU 사이트는 Appwrite Auth, AU market config, AUD, 호주 전화번호 검증, 관리자 흐름이 이미 있다.
- 한국 partner 사이트는 Firebase/한국어/한국 일정/한국 계좌/하드코딩 admin password/fake viewer count 등 호주 운영에 부적합하다.
- 아이 개인정보/알러지/보호자 동의가 들어가므로 기존 AU Appwrite 권한 구조를 확장하는 편이 안전하다.

## 2. 파일럿 상품

### Public name

School Holiday Private Cake Class

### Product line

Make Your Own 15cm Chocolate Cake

### Positioning

일반 베이킹 수업이 아니라, 아이가 색상·토핑·메시지를 선택하고 자기만의 15cm 케이크를 완성해서 가져가는 private cake decorating / design class.

### 핵심 스펙

- Location: Melrose Park, Sydney
- Format: home-based private cake decorating class
- Duration: 90 minutes
- Capacity: max 2 kids per session
- Take-home: one 15cm cake per child
- Main age: Year 3-6
- Younger kids: K-Year 2 only with parent/guardian participation or waiting nearby
- Teen option: Year 7-9 can be separated later as Teen Design Class

## 3. 가격

### Launch pricing

- 1 child: A$109
- 2 friends / siblings: A$198 total
- Deposit: A$50 to secure booking

### Future regular pricing

- 1 child: A$129
- 2 friends / siblings: A$240 total
- Teen Design Class: A$149 one child / A$280 two kids

첫 런칭에서는 Teen Class와 생일파티 상품을 노출하지 않는다. 문의가 오면 DM/manual로 받는다.

## 4. 일정 운영

처음에는 하루 2세션만 공개한다.

- Morning: 10:00-11:30
- Afternoon: 13:00-14:30

운영자가 여유 있을 때만 15:30-17:00을 private request / teen / waitlist로 수동 운영한다.

## 5. 예약폼 필드

### Session

- classType: `school-holiday-private-cake-class`
- classDate
- classTime
- bookingType: `1-child` or `2-friends`
- totalPrice
- depositAmount

### Parent / guardian

- parentName
- parentPhone
- parentEmail

### Child

- childName
- childAge
- schoolYear
- secondChildName
- secondChildAge
- secondChildSchoolYear

### Safety

- allergyNote
- emergencyContact
- pickupPerson

### Consent

- parentConsent required
- cancellationAgreement required
- photoConsent optional yes/no

### Admin

- status: Requested / Confirmed / Completed / Cancelled
- paymentStatus: Pending deposit / Deposit paid / Fully paid / Refund required
- adminMemo
- createdAt
- updatedAt

## 6. 고객 흐름

1. 고객이 `/classes`에서 상품을 이해한다.
2. `Request a spot` 클릭.
3. `/class-reserve`에서 날짜/시간, 아이 정보, 알러지, 동의 입력.
4. 제출 후 신청 완료 화면 또는 안내 패널 표시.
5. 제니가 `/admin/classes`에서 확인한다.
6. 가능하면 deposit 안내 메시지를 복사해 보낸다.
7. 입금 확인 후 Confirmed로 변경하고 확정 메시지를 복사해 보낸다.

## 7. 관리자 기능

MVP 필수:

- 신청 목록 보기
- 날짜/상태 필터는 v1에서는 간단히 전체 목록 우선
- 상태 변경: Requested / Confirmed / Completed / Cancelled
- 결제상태 변경: Pending deposit / Deposit paid / Fully paid / Refund required
- 관리자 메모 저장
- customer message copy
- CSV download

## 8. 안전/허가 체크리스트

사이트 공개 전 제니 확인 필요:

- ABN / business name
- Council home food business registration
- NSW food handling requirement
- Food Safety Supervisor 필요 여부
- Working With Children Check, WWCC
- Public/product liability insurance
- Allergy declaration wording
- Parent consent wording
- Photo consent wording
- Cancellation policy

공개 문구에는 상세 집주소를 쓰지 않는다. `Melrose Park, Sydney`까지만 노출하고, 상세 주소는 예약 확정 후 전달한다.

## 9. 금요일 공개 기준

필수 완료:

- `/classes` 모바일 랜딩
- `/class-reserve` 신청폼
- `/admin/classes` 확인 가능
- Appwrite `class_reservations` collection 준비
- Instagram feed/story/DM copy 준비
- build/lint 통과
- 320px/360px 모바일 확인

## 10. KPI

- 공개 후 48시간 DM 10건 이상
- 예약폼 작성 5건 이상
- deposit paid 2건 이상
- 방학 전 유료 예약 8명 이상
- 파일럿 전체 참여 12-16명 이상
- 후기/사진 5건 이상
- 작품 사진 20장 이상
- 생일파티 문의 2건 이상
