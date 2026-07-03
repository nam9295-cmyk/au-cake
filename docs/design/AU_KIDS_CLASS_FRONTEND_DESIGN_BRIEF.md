# Verygood Chocolate AU Kids Class Frontend Design Brief

> Designer/developer handoff for `/home/john/workspace/au-cake`
> Build target: AU kids class flow
> New routes: `/classes`, `/class-reserve`, `/admin/classes`

## 1. 디자인 목표

호주 부모가 모바일에서 보고 “작고 안전하고 예쁜 프라이빗 수업”이라고 느껴야 한다.

한국 partner 사이트처럼 귀여운 키즈 이벤트 느낌을 참고하되, 그대로 복사하지 않는다. AU 사이트의 기존 Verygood cake 톤을 유지하고, 더 조용하고 신뢰감 있는 editorial commerce 페이지로 만든다.

핵심 인상:

- private
- careful
- small group
- premium but warm
- not childcare, not a loud kids camp
- beautiful take-home cake

## 2. Brand tone

Use:

- `very good` lowercase wordmark feeling
- Work Sans 중심
- warm ivory / deep chocolate / forest green / mint accent
- 큰 여백
- 얇은 선
- pill / outline CTA
- 제품/아이 작품이 중심이 되는 레이아웃

Avoid:

- fake urgency viewer count
- dense dashboard boxes
- rainbow kid-party clutter
- heavy gradients/glassmorphism
- too many emojis
- public home address
- “childcare”처럼 보이는 표현

## 3. Route: `/classes`

### Above the fold

Required content:

```text
Private Kids Cake Decorating Class
Melrose Park, Sydney

Design your own 15cm chocolate cake, choose your colours and toppings, decorate it your way, and take it home beautifully boxed.
```

CTA:

```text
Request a spot
```

Support line:

```text
90 minutes · Max 2 kids · School holiday limited spots
```

Visual direction:

- desktop: large editorial headline + cake/class image area
- mobile: headline first, then image, then CTA still visible without too much scrolling
- if no class photo exists yet, use cake cutout/photo placeholders but do not pretend kids are already attending

### Key info strip

3 or 4 compact facts:

- Best for Year 3-6
- 90-minute private class
- One 15cm cake per child
- Max 2 kids per session

### How it works section

Steps:

1. Choose your session
2. Design your cake
3. Decorate with colours, toppings and message
4. Box it up and take it home

### Pricing section

Launch pricing needs to be very clear:

```text
Opening spots
A$109 / child
A$198 / two friends or siblings
A$50 deposit to secure booking
```

Small note:

```text
Final confirmation is sent after availability and deposit are checked.
```

### Safety / parent note

Required copy:

```text
This is a short private cake decorating class, not childcare. Younger children may need a parent or guardian to stay nearby or join the session.
```

Also show:

- allergy check required
- parent consent required
- detailed address shared after confirmation

### FAQ / notes

Short, not too much:

- Location: Melrose Park, Sydney. Full address after confirmation.
- What to wear: comfortable clothes; cream/chocolate may stain.
- Hair: long hair tied back.
- Allergies: must be declared before confirmation.
- Photos: only used if parent gives consent.

## 4. Route: `/class-reserve`

### Form layout

Mobile first, one-column.

Recommended sections:

1. Session
2. Parent details
3. Child details
4. Allergy & safety
5. Consent
6. Submit

### Session controls

Use card/radio controls, not dense selects when possible.

Booking type:

- 1 child — A$109
- 2 friends / siblings — A$198

Default times:

- 10:00-11:30
- 13:00-14:30

### Consent UX

Use separate checkboxes:

- I am the parent/guardian and consent to my child joining this class.
- I understand bookings are confirmed after availability and deposit payment.
- Photo consent: yes/no radio, not required yes.

### Completion state

After submission, show clear confirmation:

```text
Your class request has been sent.
Jenny will check availability and send deposit details shortly.
Your spot is confirmed once the deposit is received.
```

Show reservation number.

## 5. Route: `/admin/classes`

Admin page should be functional, not overly designed.

Columns:

- Created
- Session
- Parent
- Child
- Booking
- Allergy
- Status / payment
- Actions

Actions:

- Copy deposit message
- Copy confirmation message
- Save status/payment/admin memo
- CSV download

Visual:

- Use existing admin style if available
- Tables can scroll horizontally on mobile/laptop
- Allergy field should be easy to spot

## 6. Copy library

### Deposit message

```text
Hi {{parentName}}, thank you for your cake class request for {{childName}}.

Requested session:
{{classDate}} {{classTime}}

We’ll check availability and send payment details shortly.
Your spot is confirmed once the A$50 deposit is received.

Verygood Chocolate AU
```

### Confirmation message

```text
Hi {{parentName}}, {{childName}}’s cake class booking is confirmed.

Date/time:
{{classDate}} {{classTime}}

Location:
Melrose Park, Sydney
The full address will be sent before the class.

Please note:
- Please arrive 5 minutes early
- Long hair should be tied back
- Clothes may get chocolate/cream on them
- Please let us know immediately if there are any allergies or dietary concerns

We’re excited to see you soon.

Verygood Chocolate AU
```

## 7. Mobile checks

Must inspect:

- 320px width
- 360px width
- 375px width

Check:

- CTA not clipped
- headline not too tall before CTA
- form controls easy to tap
- admin table still usable horizontally
- sticky CTA does not cover form submit or consent text

## 8. Source file hints

Likely files:

- `src/App.tsx` — add routes/pages/components
- `src/index.css` — add `.class-*` styles
- `src/lib/types.ts` — class reservation types
- `src/lib/repository.ts` — class reservation storage/Appwrite methods
- `src/lib/utils.ts` or new module — message/csv/date helpers
- `scripts/setup-appwrite.mjs` — `class_reservations` collection
- `.env.example` — `APPWRITE_CLASS_RESERVATIONS_TABLE_ID`

## 9. Visual acceptance

Looks good if:

- It feels like Verygood Chocolate, not a generic kids camp.
- Parent understands price, duration, location area, age fit, and deposit before clicking reserve.
- Safety/consent feels calm and professional.
- Jenny can handle inquiries manually without the site overpromising automatic confirmation.
