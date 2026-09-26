# AU Home Hero video

## Approved scope

Replace the AU Hero photograph with John's supplied five-second cake video,
slowed to seven seconds per John's follow-up request.
Desktop uses edge-to-edge 16:9; mobile uses the approved 4:5 close-up of the
cake's cut face (the outer sides are cropped). Preserve KR, existing product
flows, all other section widths, and the original source file. No deployment.

## Implementation and verification plan

- [x] Add failing AU Hero SSR and real-browser regression tests.
- [x] Generate separate desktop/mobile H.264 MP4s and WebP first-frame posters.
- [x] Add `src/components/AuHeroVideo.tsx`, mounted only by the AU Home branch.
- [x] Scope full-bleed Hero styles to `.au-home-shell`; retain the 1440px
  maximum for other sections.
- [x] Verify responsive media selection, aspect ratio, pause/resume, offscreen
  pause, reduced-motion poster-only mode, and media-error fallback in Chromium.
- [x] Complete existing regression tests, AU/KR builds, and final review.

## Asset mapping

| Repo asset under `public/redesign/hero/` | Dimensions | Bytes |
| --- | --- | ---: |
| `cake-desktop.mp4` | 1920×1080 | 4,303,469 |
| `cake-mobile.mp4` | 640×800 | 1,256,956 |
| `cake-desktop.webp` | 1600×900 | 109,702 |
| `cake-mobile.webp` | 640×800 | 56,948 |

Source: `magnific_rgR4h99xtc.mp4`, 25,008,992 bytes, 1920×1080, 30fps,
5 seconds, no audio. Source SHA-256:
`e7586e872f62f3e7d71823fe9b6912cda129e9fd2852ac74ba9ecda8a9cf9a45`.
The private original remains outside the repository. No local absolute paths
are used by the frontend.

Both videos play for seven seconds at 30fps (210 frames), with the original
motion slowed to 5/7 speed. Encode from the original using FFmpeg `libx264`,
`-preset slow -crf 23 -pix_fmt yuv420p -an -map_metadata -1 -movflags +faststart`.
Desktop filter: `-vf 'setpts=1.4*(PTS-STARTPTS),fps=30,tpad=stop_mode=clone:stop_duration=0.1' -t 7`.
For mobile, prepend `crop=704:880:608:200,scale=640:800,` to that filter.
The small tail pad allows an exact seven-second output despite frame rounding;
no generated/interpolated scene content is added. The first-frame posters are
unchanged. The previous five-second web videos are backed up outside the repo
in `/tmp/au-hero-seven-seconds.sfiQ7F/`.
Extract the source's first frame to PNG, then use the existing Sharp dependency
to generate quality-80 WebP posters, with the same mobile crop and dimensions
shown above. The installed FFmpeg lacks the WebP encoder; no dependency was
installed or changed to create the posters.

## Runtime behavior

- One video source is mounted: desktop above 768px, mobile at or below 768px.
  Resizing across that breakpoint switches the source.
- Muted, inline, looping playback; an accessible Play/Pause button is provided.
- Offscreen or background-tab video pauses. An intentional user pause is not
  undone by scrolling back into view or crossing the mobile breakpoint.
- Reduced-motion preference mounts only the responsive poster, with no MP4
  download. SSR also renders the poster only.
- A video loading error leaves the poster; autoplay denial leaves a Play button.
- The browser displays the poster while the video starts. `faststart` puts MP4
  metadata before its media data; fixed frame ratios reserve layout space.

## Regression checks

`node --test tests/home-market-boundary.test.mjs tests/phase1-market-boundary.test.mjs`
covers AU markup/CSS isolation and exact legacy KR rendering.

Open the AU preview in Playwright CLI, then run
`tests/au-hero-video.browser.mjs` via `run-code --filename`. It checks
1920, 1440, 769, 768, 390, and 320px widths plus playback/fallback behavior.
Existing alignment browser checks cover the non-Hero collection/card layouts.

Verified 2026-09-26: lint, AU build, KR build, full `npm test`, 16 Home/Phase 1
boundary tests, six Hero viewport cases, and 102 existing alignment cases pass.
The full suite uses the previously approved external temporary dependency
resolver for review-api tests; package/backend files were not changed.
Both builds retain the existing large-chunk warning. KR browser verification
confirms no AU Hero media/request, with footer and announcement still displayed.

Fresh read-only review found one pause-persistence issue during breakpoint
changes. A browser regression reproduced it before the fix, then passed after
moving the manual pause preference above the responsive keyed media component.
No review findings remain deferred. Evidence is saved outside the repository in
`/tmp/au-hero-video-evidence.32SVrj/`.

Seven-second follow-up: both files measure exactly 7.000 seconds and retain
faststart. The six-viewport Hero browser regression and 16 market-boundary
tests pass; real playback loops were observed at 1440px and 390px. Original
source and Pencil hashes remain unchanged. Follow-up evidence and five-second
backups are in `/tmp/au-hero-seven-seconds.sfiQ7F/`. No component or CSS change
was needed for the slower playback.

The original source and user-edited Pencil file must remain unchanged.
Commit, integration merge, push, and production deploy are not part of this pass.
