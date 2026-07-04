---
version: alpha
name: Jeniselect Brand Home
description: Jeniselect home page design spec aligned with the current Very Good Chocolate / AU cake reservation visual language.
colors:
  primary: "#035542"
  secondary: "#333333"
  tertiary: "#56DDDB"
  neutral: "#FFFFFF"
  canvas: "#FFFFFF"
  forest: "#035542"
  billboard-blue: "#2B7BB9"
  cream-teal: "#56DDDB"
  butter-yellow: "#F9E9A9"
  charcoal: "#333333"
  muted: "#5F6864"
  surface-soft: "#F9FBFA"
  border: "#333333"
  danger: "#B23A32"
typography:
  display-xl:
    fontFamily: Work Sans
    fontSize: 6rem
    fontWeight: 900
    lineHeight: 0.88
    letterSpacing: "0em"
  display-lg:
    fontFamily: Work Sans
    fontSize: 4.5rem
    fontWeight: 900
    lineHeight: 0.92
    letterSpacing: "0em"
  heading-md:
    fontFamily: Work Sans
    fontSize: 2rem
    fontWeight: 900
    lineHeight: 1
    letterSpacing: "0em"
  body-lg:
    fontFamily: Work Sans
    fontSize: 1.125rem
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0em"
  body-md:
    fontFamily: Work Sans
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "0em"
  label:
    fontFamily: Work Sans
    fontSize: 0.875rem
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.04em"
rounded:
  none: 0px
  pill: 999px
spacing:
  xs: 6px
  sm: 10px
  md: 18px
  lg: 24px
  xl: 40px
  xxl: 72px
components:
  page-canvas:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.none}"
    padding: 0px
  button-primary:
    backgroundColor: "{colors.forest}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: 14px
  button-primary-hover:
    backgroundColor: "{colors.billboard-blue}"
    textColor: "#FFFFFF"
    rounded: "{rounded.pill}"
    padding: 14px
  button-outline:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    rounded: "{rounded.pill}"
    padding: 12px
  ribbon-tag:
    backgroundColor: "{colors.cream-teal}"
    textColor: "{colors.forest}"
    rounded: "{rounded.none}"
    padding: 10px
  ribbon-tag-warm:
    backgroundColor: "{colors.butter-yellow}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.none}"
    padding: 10px
  surface-card:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.charcoal}"
    rounded: "{rounded.none}"
    padding: 24px
  surface-soft:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.secondary}"
    rounded: "{rounded.none}"
    padding: 24px
  text-muted:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.muted}"
    rounded: "{rounded.none}"
    padding: 0px
  line-border:
    backgroundColor: "{colors.border}"
    textColor: "#FFFFFF"
    rounded: "{rounded.none}"
    padding: 0px
  error-message:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.danger}"
    rounded: "{rounded.none}"
    padding: 0px
---

## Overview

This file is the design handoff for turning `jeniselect.com` from a functional reservation app into a brand front door. The site should not become a separate soft-beige lifestyle brand. It should feel like the natural Australian/Jenny-facing extension of the current Very Good Chocolate and cake reservation visual system.

Primary design read:

`Jeniselect` is Jenny's Sydney-facing umbrella brand for custom cakes, kids baking classes, and selected goods. The page should feel warm and personal, but the visual language should stay close to `kr.verygood-chocolate.com` and the current AU cake reservation site: white canvas, Work Sans, huge billboard type, product-forward hero imagery, forest green interaction, teal/yellow accents, sharp geometry, ribbon tags, and outline/pill controls.

Key principle:

Keep the Very Good Chocolate family resemblance, but make the content Jenny-led and Sydney-local.

Target feeling:

- Same family as Very Good Chocolate, not a new unrelated boutique.
- Clean, direct, product-forward, slightly playful.
- Warm because of copy and photography, not because of generic beige styling.
- Practical enough for booking cakes and classes.
- Broad enough to later add selected goods.

Do not make it:

- A generic beige/brass lifestyle brand.
- A cute kids cafe design.
- A luxury patisserie design.
- A web agency portfolio.
- A heavy dashboard or admin-looking app.

## Colors

Use the existing AU cake / Very Good visual tokens as the source of truth.

Core palette:

- `#FFFFFF` canvas: main background. Use mostly white space.
- `#035542` forest: primary brand and CTA color.
- `#333333` charcoal: text and hard border color.
- `#56DDDB` cream teal: billboard accent, focus ring, ribbon tags, large pale background word.
- `#F9E9A9` butter yellow: secondary highlight, small product/category moments.
- `#2B7BB9` billboard blue: hover or secondary accent only.
- `#5F6864` muted: secondary body text.
- `#F9FBFA` surface soft: subtle admin/form background only.

Usage rules:

- White background should dominate.
- Forest green is the main action color.
- Cream teal is the key visual accent. Use it for large background words, tags, focus rings, and occasional surface blocks.
- Butter yellow is a supporting accent. Use sparingly for selected goods, warm highlights, or small stickers.
- Charcoal borders should stay visible. The current style likes hard lines more than soft shadows.
- Avoid gradients, glassmorphism, black drop shadows, and warm beige craft palettes.

Recommended color ratio:

- 70 percent white
- 15 percent charcoal line/text
- 10 percent forest green
- 4 percent cream teal
- 1 percent butter yellow or billboard blue

## Typography

Use Work Sans as the default font family to match the current sites.

Font family:

```css
font-family: 'Work Sans', 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif;
```

Typography rules:

- Big billboard words use Work Sans 900, uppercase, very tight line-height.
- Body copy uses Work Sans 400 with generous line-height.
- Navigation and labels use Work Sans 500.
- Avoid decorative serif fonts. They would make Jeniselect feel disconnected from Very Good Chocolate.
- Avoid overly soft rounded fonts. The current identity is friendly through layout and product imagery, not through bubbly typography.

Desktop type scale:

- Billboard background word: 120px-180px, Work Sans 900, line-height 0.78, cream teal at low opacity.
- H1: 72px-96px, Work Sans 900, uppercase, line-height 0.88.
- H2: 48px-72px, Work Sans 900, uppercase, line-height 0.92.
- Section title: 28px-36px, Work Sans 900.
- Body: 16px-18px, line-height 1.65.
- Button/nav: 14px-15px, Work Sans 500 or 900 depending on emphasis.

Mobile type scale:

- H1: 48px-64px.
- H2: 34px-46px.
- Body: 16px.
- Buttons: 14px-15px.

Line-breaking guidance:

Preferred hero headline:

```txt
CAKES, CLASSES,
AND SELECTED GOODS
IN SYDNEY.
```

Alternative if using sentence case:

```txt
Cakes, classes,
and selected goods
in Sydney.
```

Because the existing visual language uses uppercase billboard type, uppercase is preferred for the big hero moment.

## Layout

Recommended page structure for the first Jeniselect home page:

```txt
/
├─ Header
├─ Hero: Jeniselect brand front door
├─ Services: Cakes / Kids Classes / Selected Goods
├─ Jenny-led section
├─ Visual mood board / product strip
├─ Booking CTA
└─ Footer
```

Existing functional routes should remain available:

```txt
/cakes or /reserve       Cake booking flow
/classes                 Kids class landing or booking entry
/class-reserve           Class booking form
/admin                   Hidden admin entry
/admin/classes           Hidden class admin
```

Suggested final route naming:

```txt
/                         Brand home
/cakes                    Cake booking entry, can route internally to /reserve
/classes                  Kids class booking entry
/selects                  Future selected goods page
/about                    Future Jenny/about page
/contact                  Future contact page
```

For the first version, do not build every future page. The home can link to existing booking flows.

Desktop frame for Penpot:

```txt
Frame: 1440 x 2200
Content max width: 1400px
Outer page padding: 20px minimum, 40px-72px on wide sections
Header height: 64px-72px
Hero height: 720px-860px
```

Mobile frame for Penpot:

```txt
Frame: 390 x 1800
Outer padding: 20px
Header height: 64px
Hero should show brand, headline, one visual, and at least one CTA without feeling buried.
```

Hero composition:

Use the existing cake reservation page logic as the base, but make it broader.

- Large faint background word: `JENISELECT` or `SELECTED` in cream teal.
- Product/lifestyle image cluster in the center or right side.
- Text block with top/bottom charcoal border, like the current hero copy block.
- Clear CTAs: `Order a Cake` and `Book a Class`.
- Small circular seal or ribbon label can say `SYDNEY` / `BY JENNY` / `CAKES + CLASSES`.

Desktop layout option A, closest to current AU cake style:

```txt
Header

Huge pale word in background: JENISELECT

          [cake / class / goods image cluster]

------------------------------------------------
CAKES, CLASSES, AND SELECTED GOODS IN SYDNEY.
Jenny's Sydney home for custom cakes, kids baking classes, and thoughtful finds.
[Order a Cake] [Book a Class]
------------------------------------------------
```

Desktop layout option B, slightly more brand-home style:

```txt
Left: text + CTAs + bordered copy block
Right: overlapping product/photo cluster
Background: oversized JENISELECT word
```

Use option A if the goal is maximum continuity with the current cake reservation site. Use option B if the goal is a clearer brand landing page.

## Elevation & Depth

Depth should come from product cutouts, overlap, scale, and hard layering rather than soft modern shadows.

Allowed:

- Product image drop shadow similar to existing hero cakes.
- 1px charcoal borders.
- Circular seals.
- Ribbon tags using clip-path notches.
- Overlapping product/lifestyle images.
- Large pale background typography.

Avoid:

- Glass panels.
- Gradient cards.
- Heavy black shadows.
- Generic rounded SaaS cards.
- Blurry mesh gradients.

If using photos rather than cutout product images, keep them rectangular or lightly clipped with hard edges. Do not over-round every image.

## Shapes

Shape system:

- Main layout surfaces: square corners, 0px radius.
- Buttons and nav chips: pill radius, 999px.
- Circular seal: perfect circle.
- Ribbon tags: square middle with notched left/right edges.
- Form fields: mostly square or very subtle radius only if already present in existing components.

This mix matches the current site: hard composition plus friendly pill interactions.

Do not use 20px-32px rounded cards everywhere. That would move the brand away from the existing Very Good Chocolate tone.

## Components

### Header

Desktop:

```txt
Jeniselect                         Cakes  Classes  Selects  About  Contact  [Book now]
```

Visual style:

- White background.
- Brand wordmark left, Work Sans 900, uppercase or lowercase depending on logo decision.
- Nav items as forest outline pills, matching current site.
- Header should stay one line at desktop.

Recommended brand display:

```txt
JENISELECT
```

or

```txt
Jeniselect
```

Use `Jeniselect` in body copy. Use uppercase only for the visual wordmark/hero if it looks better.

Mobile:

```txt
Jeniselect                                      Menu
```

For first version, mobile menu can be simple. Do not overbuild.

### Hero

Hero content:

```txt
Headline:
CAKES, CLASSES,
AND SELECTED GOODS
IN SYDNEY.

Body:
Jenny's Sydney home for custom cakes, children's baking classes, and thoughtful finds.

Primary CTA:
Order a Cake

Secondary CTA:
Book a Class
```

Hero visual directions:

- Use current cake cutouts if no new photo set exists.
- Add placeholder blocks for future class/select images if needed.
- A three-part cluster works well: cake cutout, kids baking hands photo, packaging/select goods photo.
- If real class photos are not ready, use clean placeholders in Penpot labeled with exact asset needs.

Photo placeholders for Penpot:

```txt
PHOTO 01: cake cutout or cake close-up
PHOTO 02: kids baking hands / class table
PHOTO 03: selected goods / gift packaging / chocolate box
```

### Service cards

Avoid three identical generic cards. Use an asymmetric service block.

Recommended structure:

```txt
Large left block:
CUSTOM CAKES
For birthdays, family gatherings, and small celebrations.
[Order a Cake]

Right top:
KIDS BAKING CLASSES
Hands-on classes for children in Sydney.
[Book a Class]

Right bottom:
SELECTED GOODS
Thoughtful goods and seasonal finds, curated by Jenny.
[Coming Soon]
```

Visual style:

- White cards with charcoal border.
- Forest titles.
- Teal or yellow ribbon tags.
- Small product image or sticker per service if possible.
- No soft beige cards.

### Jenny-led section

Purpose:

Explain the new umbrella brand without overexplaining john or Very Good Chocolate.

Copy:

```txt
LED BY JENNY IN SYDNEY

Jeniselect brings together Jenny's cakes, children's classes, and selected goods in one simple place.

Behind the scenes, a small creative support team helps with design, web, and systems, so bookings stay clear and easy.
```

Design:

- Use a bordered text block.
- Add a circular seal or small portrait/photo placeholder.
- Keep john unnamed.
- Do not make this section look like a design agency pitch.

### Visual mood board

Purpose:

Show the world of Jeniselect.

Content:

```txt
Cake detail
Class moment
Gift packaging
Selected goods
```

Design:

- 2x2 or asymmetrical image grid.
- Hard edges or very subtle radius.
- Use labels only if useful. Avoid decorative captions.
- One line of copy is enough:
  `Small celebrations, family moments, and thoughtful finds.`

### Final CTA

Copy:

```txt
PLAN SOMETHING WITH JENNY

Order a custom cake or book a kids baking class in Sydney.

[Order a Cake] [Book a Class]
```

Design:

- Bordered block.
- White background.
- Forest CTA.
- Teal/yellow accent tag.

### Footer

Content:

```txt
Jeniselect
Sydney, Australia
Cakes / Classes / Selected Goods
Instagram / Contact
```

Optional small line:

```txt
Jenny-led in Sydney, with quiet creative support behind the scenes.
```

Do not add version numbers, build labels, weather, or decorative status text.

## Do's and Don'ts

Do:

- Keep the page visibly related to `kr.verygood-chocolate.com` and the current AU cake booking site.
- Use Work Sans.
- Use white, forest green, charcoal, cream teal, and butter yellow.
- Use huge billboard typography.
- Use real product/class/goods imagery as soon as available.
- Keep CTAs obvious and practical.
- Keep admin pages hidden from public navigation.
- Make `/classes` and cake booking easy to find from the home page.
- Preserve all current booking functionality.

Don't:

- Do not create a completely new beige lifestyle palette.
- Do not use serif editorial typography.
- Do not make everything rounded and soft.
- Do not use generic 3-card SaaS layouts without product character.
- Do not use AI-purple gradients, glassmorphism, or fake app screenshots.
- Do not advertise design/development services on the home page.
- Do not put john forward. Keep support unnamed as `small creative support team` if mentioned.
- Do not remove or bury cake/class booking CTAs.

## Content Copy Set

Use this copy for the first Penpot version.

Header nav:

```txt
Cakes
Classes
Selects
About
Contact
Book now
```

Hero:

```txt
CAKES, CLASSES,
AND SELECTED GOODS
IN SYDNEY.

Jenny's Sydney home for custom cakes, children's baking classes, and thoughtful finds.

Order a Cake
Book a Class
```

Service block:

```txt
CUSTOM CAKES
For birthdays, family gatherings, and small celebrations.

KIDS BAKING CLASSES
Hands-on classes for children in Sydney.

SELECTED GOODS
Thoughtful goods and seasonal finds, curated by Jenny.
```

Jenny section:

```txt
LED BY JENNY IN SYDNEY

Jeniselect brings together Jenny's cakes, children's classes, and selected goods in one simple place.

Behind the scenes, a small creative support team helps with design, web, and systems, so bookings stay clear and easy.
```

Final CTA:

```txt
PLAN SOMETHING WITH JENNY

Order a custom cake or book a kids baking class in Sydney.

Order a Cake
Book a Class
```

## Penpot Checklist

Create these frames first:

```txt
01 Desktop Home / 1440 x 2200
02 Mobile Home / 390 x 1800
03 Components / buttons, ribbons, seal, service cards
04 Image Placeholders / cake, class, selected goods
```

Desktop measurements:

```txt
Page max width: 1400px
Outer margin: 20px minimum
Hero visual area: 720px-860px high
Hero copy block: max 760px wide if centered
Header: 64px-72px high
CTA height: 44px-52px
Nav pill height: 38px
Border: 1px charcoal or forest
```

Mobile measurements:

```txt
Outer margin: 20px
H1: 48px-64px
Hero image cluster above or behind copy, but keep CTA visible early
Buttons can stack vertically
Service cards stack in order: Cakes, Classes, Selected Goods
```

Asset notes:

- If current cake cutout assets are available, use them for continuity.
- Add placeholders for kids class and selected goods, but do not use random glossy stock images.
- Best future photos: natural light, real hands, cake detail, class table, packaging, selected goods.

## Implementation Notes for Antigravity

The current repo is:

```txt
/home/john/workspace/au-cake
```

Important files:

```txt
src/App.tsx
src/index.css
src/assets/hero-cake-1.webp
src/assets/hero-cake-2.webp
src/assets/hero-cake-3.webp
src/assets/pave-side.webp
src/assets/pound-side.webp
```

Current style tokens already exist in `src/index.css`:

```css
--canvas: #ffffff;
--forest: #035542;
--billboard-blue: #2b7bb9;
--cream-teal: #56dddb;
--butter-yellow: #f9e9a9;
--charcoal: #333333;
--surface-soft: #f9fbfa;
--muted: #5f6864;
--radius: 0px;
--page-max: 1400px;
```

Keep these tokens. Extend them only if needed.

Implementation target:

- Make `/` the Jeniselect brand home.
- Keep existing cake booking and class booking flows functional.
- Prefer `/cakes` as the public cake entry route if route cleanup is included. It can navigate to or replace the current `/reserve` flow.
- Keep `/classes` as the class entry route.
- Keep admin routes out of public nav.
- Do not change Appwrite database behavior for a visual-only redesign.

Quality checks after implementation:

```txt
npm run lint
npm run test:class
npm run build
```

Visual QA:

- Desktop 1440px: header single-line, hero CTA visible, billboard word not clipping badly.
- Mobile 390px: no horizontal overflow, hero readable, CTAs visible early.
- 320px width: no CTA text wrapping, no image cluster causing clipping that hides the core booking action.
- `/classes` still works.
- Cake booking still works.
- Admin routes still accessible directly.

## SEO Notes

Use Jeniselect as the public-facing brand for the new domain.

Suggested title:

```txt
Jeniselect | Cakes, Classes & Selected Goods in Sydney
```

Suggested description:

```txt
Jeniselect is Jenny's Sydney home for custom cakes, kids baking classes, and carefully selected goods.
```

Suggested page targets:

```txt
/         Jeniselect brand home
/cakes    Custom cakes in Sydney
/classes  Kids baking classes in Sydney
```

Do not index admin pages.
