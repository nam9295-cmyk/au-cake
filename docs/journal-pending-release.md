# Pending Journal release

## Article02 hero replacement — included in article03 release candidate

The owner requested replacing article02's hero with the supplied `01-v2.png` and deploying the change together with article03. The owner has now supplied completed article03 and requested its folder photographs in the ongoing publishing workflow. This candidate includes both changes; release completion still requires a successful deployment and live verification.

- Article: `draft-02`, `/journal/why-does-chocolate-taste-waxy-instead-of-creamy`.
- The same replacement is applied to the native FigCraft desktop, tablet, mobile, compact and executive-summary image layers. Native text, layout, other photographs and original image files remain unchanged. A pre-edit native backup is retained privately in `.journal-workspace/article-02/hero-replacement/before.figcraft`.
- The public-source package uses `assets/f82c1e691144b48ea5c230e613d858bb0f8b61787ea1a48f51d199c9e05228da.webp` for its first content image and cover, with matching descriptive alt text. Index and Open Graph images follow the cover automatically.
- Preserve the existing article ID, URL and first `publishedAt`; only its update/approval timestamp advances. Its `published` status describes an existing article, not whether this replacement has been deployed.
- Do not push these changes to production `main` or deploy separately. When the owner explicitly requests article03 publication, include this pending article02 package in the same validated Git/Pages release. Saving or finding an article03 design is not a release request.
- After the combined deployment succeeds, verify both articles and their cover images, then replace this hold with a short completed-release record.

Private preparation/preview records are under `.journal-workspace/article-02/hero-replacement/`; do not add that directory or native design files to public Git.
