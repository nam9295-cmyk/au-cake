# HOGIRL public-content contract

This directory contains audited HOGIRL production content, including web drafts.
Do not put test fixtures, placeholder translations, or artwork binaries here.
`historicalPublication` records prior publication of the story; each locale's
`status` is the separate website publication gate.

`series.json` is the small catalogue loaded by the HOGIRL route shell:

```json
{
  "id": "hogirl",
  "locales": {
    "en": { "status": "published", "title": "…", "description": "…" },
    "ko": { "status": "published", "title": "…", "description": "…" }
  },
  "publishedSeasons": [
    { "number": 1, "slug": "season-1", "directory": "season-01" }
  ]
}
```

`publishedPrologue` is omitted until the Prologue is web-published. When it is
published, it is a separate story route rather than an `epNN` episode:

```json
{
  "publishedPrologue": {
    "slug": "prologue-a-tiger-dream",
    "directory": "prologue-a-tiger-dream"
  }
}
```

The matching `prologue-a-tiger-dream/manifest.json` has `kind: "prologue"`, no
episode number, its own locale publication states, and clean media panels. Its
optional `next` reference points to the first Season 1 episode. An episode can
use `previous: { "kind": "prologue", "storySlug": "…" }` to link back.

Create `season-01/manifest.json` only when the season can be published:

```json
{
  "number": 1,
  "slug": "season-1",
  "episodes": [{ "number": 1, "slug": "ep01-i-know-what-i-want" }]
}
```

Each episode uses a locale-independent `manifest.json` plus one completed,
explicitly published locale file. Example paths:

```text
season-01/episodes/ep01-i-know-what-i-want/manifest.json
season-01/episodes/ep01-i-know-what-i-want/en.json
season-01/episodes/ep01-i-know-what-i-want/ko.json
```

The episode manifest owns panel ordering, clean-media keys, source dimensions,
locale publication status, and an optional dedicated social image:

```json
{
  "number": 1,
  "slug": "ep01-i-know-what-i-want",
  "locales": { "en": { "status": "published" }, "ko": { "status": "published" } },
  "media": {
    "ogImagePanelId": "panel-001",
    "socialImage": { "key": "hogirl/season-01/ep01/social", "sourceWidth": 1080, "sourceHeight": 1350 },
    "panels": [
      { "id": "panel-001", "media": { "key": "hogirl/season-01/ep01/panel-001", "sourceWidth": 1080, "sourceHeight": 1350 } }
    ]
  }
}
```

If `socialImage` is omitted, `ogImagePanelId` identifies the clean panel used for
Open Graph metadata. The asset publisher creates only variants no wider than the
recorded source dimensions: 540w, 720w, and 1080w only. For source images wider
than 1080px, use the 1080w derivative; do not add a source-width derivative. For
source images between standard widths, use only the lower available standard
derivative. For source images below 540px, serve the optimized original at
`${VITE_HOGIRL_MEDIA_ORIGIN}/{key}.{format}` with no width suffix. A media key
never contains a hostname or extension; Vite does not import artwork. The sole
media-origin configuration is `VITE_HOGIRL_MEDIA_ORIGIN`, used by both the Vite
reader and static SEO generator. Cloudflare R2/CDN serves
`${VITE_HOGIRL_MEDIA_ORIGIN}/{key}-{width}.avif` and `.webp` for standard widths.

Each `en.json` or `ko.json` supplies user-visible content only:

```json
{
  "title": "…",
  "description": "…",
  "panels": {
    "panel-001": {
      "alt": "…",
      "captions": [{ "placement": "after", "text": "…" }]
    }
  }
}
```

Do not create a locale file, route, sitemap entry, or hreflang entry until that
locale is complete and its manifest status is explicitly `published`.
Draft content may retain complete copy and deterministic R2 keys, but it must
not set `publishedPrologue` or `publishedSeasons`; it then produces no static
page, sitemap, llms.txt entry, or media-origin requirement.
