# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is
KSA Silmakeskus (ksa.ee) blog migrated from WordPress+Elementor to Next.js+MDX on Vercel.
**Target domain:** blog.ksa.ee
**GitHub repo:** https://github.com/antshaavel22/ksa-blog

## Tech Stack
- **Framework:** Next.js 16.2.2 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4 (`@import "tailwindcss"` + `@theme inline {}` — NOT v3 config). Admin UI uses inline styles only (no Tailwind).
- **Content:** MDX files in `content/posts/` (~460+ published posts)
- **Fonts:** Geist (same as all KSA Vercel properties)
- **Params:** In Next.js 16, `params` is `Promise<{slug: string}>` — must `await params`
- **Middleware:** `proxy.ts` (NOT `middleware.ts`) — exports `proxy` function + `config` matcher, protects /admin and /api/admin/*

## Commands

```bash
npm run dev          # dev server on port 3002
npm run build        # production build
npm run convert      # WP XML → MDX: npx tsx scripts/wp-to-mdx.ts <path.xml>
npm run ai-facelift  # batch AI title/excerpt improvement (add --content for phase 2)
npm run scout        # daily content scout (--limit N, --trilingual, --dry-run)
npm run batch        # batch generate: npm run batch -- --lang ru|en [--dry-run]
```

**Node:** `/Users/antsh/.nvm/versions/node/v24.14.0/bin/node` — not in PATH by default.
**Build:** `PATH="/Users/antsh/.nvm/versions/node/v24.14.0/bin:$PATH" node node_modules/.bin/next build`

## Architecture: Read vs Write

### READS (filesystem-first, GitHub API fallback)
In production, read APIs try the bundled filesystem first (fast, works for files present at deploy time), then fall back to GitHub API for files created *after* the last deploy (e.g. newly-published posts, same-day scout drafts). In dev, filesystem only.

```
GET /api/admin/drafts  → fs.readdirSync(content/drafts/)   [listing: filesystem only]
GET /api/admin/draft   → try fs → fallback GitHub API
GET /api/admin/posts   → fs.readdirSync(content/posts/)    [listing: filesystem only]
GET /api/admin/post    → try fs → fallback GitHub API
```

### WRITES (GitHub API in production)
All writes use GitHub REST API (contents PUT/DELETE). Never use `fs.writeFileSync` in prod.

```
PUT  /api/admin/draft    → GitHub API PUT content/drafts/[lang]/filename.mdx
PUT  /api/admin/post     → GitHub API PUT content/posts/filename.mdx
POST /api/admin/publish  → GitHub API PUT content/posts/ + DELETE content/drafts/ + deploy hook
POST /api/admin/unpublish → GitHub API PUT content/drafts/[lang]/ + DELETE content/posts/
POST /api/admin/sync-images → GitHub API PUT to update featuredImage on sister articles
```

### DEPLOY FLOW
```
Editor clicks "Avalda" in admin
  → client builds finalContent = buildMdx(buildFm(), body) from React state
  → POST /api/admin/publish with { path, content: finalContent }
  → publishProd() writes to GitHub (content/posts/) + deletes draft
  → publishProd() calls VERCEL_DEPLOY_HOOK → Vercel rebuilds (~2 min)
  → ISR: new post URLs render on-demand on first visit (dynamicParams=true, revalidate=120)
```

**CRITICAL:** `publishProd()` must receive content from the client. Reading from the filesystem gets the OLD bundled file (pre-upload) → `featuredImage: ""` bug.

Any `git push origin main` also auto-triggers Vercel deploy (GitHub ↔ Vercel connected).

## KSA Brand Tokens
```
accent:    #87be23   (KSA green)
text:      #1a1a1a
surface:   #f9f9f7
border:    #e6e6e6
muted:     #9a9a9a
secondary: #5a6b6c
```

## Critical: Categories Frontmatter

**`categories` must always be a YAML block list — never a quoted string.**

Use `setCategoriesField(fm, slug)` (defined in `app/admin/page.tsx`) when writing categories — NOT `setFmField()`. `setFmField()` writes a quoted scalar (`categories: "foo"`) which gray-matter parses as `string`, causing `categories.some is not a function` build crashes.

`setCategoriesField()` writes the correct format:
```yaml
categories:
  - Flow Protseduur
```

`lib/posts.ts` normalises `categories` to always be `string[]` at read time (handles string, JSON array `["foo"]`, YAML list — all coerced to array). This is a safety net, not a substitute for writing correct YAML.

## Frontmatter Helpers (app/admin/page.tsx)

| Function | Use for |
|---|---|
| `setFmField(fm, key, value)` | All scalar fields (title, date, lang, featuredImage, etc.) |
| `setCategoriesField(fm, slug)` | `categories` only — writes proper YAML block list |
| `getFmField(fm, key)` | Read any scalar field from frontmatter string |
| `buildFm()` | Called before save/publish — assembles final frontmatter from React state |
| `buildMdx(fm, body)` | Wraps `---\n${fm}\n---\n${body}` |
| `compressImageClient(file)` | Module-level (not inside DraftEditor) — shared by cover + body image upload |

## Content Facts
- **~460+ published posts** (ET ~270, RU ~130, EN ~60+, growing daily via scout)
- **~570+ drafts** (ET growing, RU ~264, EN ~300)
- Images stay at `ksa.ee/wp-content/uploads/` (no migration needed)
- **AI facelift run:** 437 posts have Claude-improved titles + excerpts
- **medicalReview queue:** `medical-review-queue.txt` — 222 posts flagged for Dr. Haavel
- Daily content scout DISABLED 2026-04-18 — Ants writes all drafts manually for fact/quality control (workflow_dispatch still available for ad-hoc runs)

## Sister Article System
RU/EN translations link to their ET original via `translatedFrom` frontmatter:
```yaml
translatedFrom: "Flow3 laser silmad: elu pärast operatsiooni"  # exact ET title
```
`/api/admin/sync-images` uses this to propagate `featuredImage` across language versions.

## KiirtestCTA Rules
```
Rule 1 → ctaType: "kiirtest-inline"
  Categories: edulood, kogemuslood, flow-protseduur, nagemise-korrigeerimine

Rule 2 → ctaType: "kiirtest-soft"  (default for informational posts)

Rule 3 → ctaType: "none"
  Categories: silmad-ja-tervis, silmade-tervis-nipid, eye-health-tips
```
CTA uses button link (NOT iframe — ksa-kiirtest-lp.vercel.app blocks iframes via X-Frame-Options):
- ET: https://ksa-kiirtest-lp.vercel.app/
- RU: https://ksa-kiirtest-lp.vercel.app/ru.html
- EN: https://ksa-kiirtest-lp.vercel.app/en.html

## Authors
Centralised in `lib/authors.ts` — `getAuthorByKey()` maps any key or full name to a profile.
```
antsh / Dr. Ants Haavel       → slug: dr-ants-haavel
silvia / Silvia Haavel        → slug: silvia-johanna-haavel
yana / Yana Grechits          → slug: yana-grechits
maigret / Maigret Moru        → slug: maigret-moru
ndhaldur / KSA Silmakeskus   → slug: ksa-silmakeskus
```
Editors: **Silvia Johanna Haavel** (ET), **Jana** (RU + EN)

## Team & Routing
- **Dr. Ants Haavel** — owner, medical sign-off
- **Silvia Johanna Haavel** — ET editor
- **Jana** — RU + EN editor
- **Mai** — building new booking system (active this week 2026-04-23)
- **Kadri** — redirects, Search Console — **on vacation until 2026-04-27**, do not route tasks to her this week; send booking-LP / WP requests to Mai. DNS handled by Ants directly.

## Tracking & SEO
- **GTM:** GTM-KCZVRJ8 + **GA4:** G-7R7T8GF37J — both in `app/layout.tsx`
- Schema JSON-LD on every post: BlogPosting + BreadcrumbList + FAQPage
- `seoTitle` / `seoExcerpt` frontmatter → meta tags (falls back to `title` / `excerpt`)
- Sitemap auto-generated at `/sitemap.xml` each deploy

## Key Files

```
lib/posts.ts               — getAllPosts (normalises categories→string[]), getPostBySlug,
                             getRelatedPosts, getAllCategories
lib/categories.ts          — CATEGORY_LABELS, getCategoryLabel(), toSlug(), CTA classification
lib/authors.ts             — AUTHORS array, getAuthorByKey(), getAuthorBySlug()
lib/config.ts              — BLOG_CONFIG: showDate / showAuthor global toggles
content/system/master-prompt.md — Editable AI writing rules (edit via Sisureeglid tab or directly)
app/admin/page.tsx         — ~2800-line monolithic admin UI (DraftEditor, PublishedTab, WriteTab,
                             FormattingToolbar, DragCrop, PostPreview — all in one file)
app/api/admin/draft/route.ts   — GET: fs-first→GitHub fallback | PUT/DELETE: GitHub API
app/api/admin/post/route.ts    — GET: fs-first→GitHub fallback | PUT: GitHub API
app/api/admin/posts/route.ts   — lists content/posts/, returns title/slug/lang/date/featuredImage/category
app/api/admin/publish/route.ts — uses clientContent from request body, NEVER reads filesystem
app/api/admin/sync-images/route.ts — propagates featuredImage to sister articles via translatedFrom
app/[slug]/page.tsx        — SSG post detail, ISR (dynamicParams=true, revalidate=120)
proxy.ts                   — middleware (named proxy.ts, not middleware.ts)
scripts/content-scout.ts   — daily RSS → trilingual drafts via Claude
.github/workflows/daily-content-scout.yml — 7am EET cron, pushes directly to main
```

## Admin UI (/admin)
**Password:** `ksa-blog-2026` | **Login:** https://blog.ksa.ee/admin/login

### 5 Tabs
1. **Mustandid** — browse/edit/publish drafts; full editor with image upload, category, YouTube, deadline
2. **Avaldatud** — published posts in 3 views:
   - **Nimekiri** (list) — row per post with category pill, clickable date quick-edit
   - **Koduleht** (grid) — editorial cards with thumbnails, hover "✎ Redigeeri" overlay, clickable date quick-edit
   - **Live** — iframe of blog.ksa.ee embedded in admin
3. **Kirjuta uus** — two modes:
   - **Salvesta otse** — paste text → save UNCHANGED to draft folder (no AI)
   - **AI kirjutab** — idea/URL → Claude generates article
4. **Sisureeglid** — edit master AI prompt (saved to `content/system/master-prompt.md` via GitHub API)
5. **Juhend** — Estonian user manual

### Editor Features
- Breadcrumb + interactive ET/RU/EN language switcher (moves file between lang folders)
- Sticky action bar: Salvesta + Avalda / Uuenda live (for published)
- Featured image: upload (client-compressed to WebP ≤300KB) | AI-generated | URL paste
- `DragCrop`: drag image in 3:2 frame → saves `imageFocalPoint` ("45% 30%") to frontmatter
- `FormattingToolbar`: B/I/H2/H3/Link/List + **🖼 Pilt** (inline body image upload → inserts `![alt](url)` at cursor)
- YouTube embed inserter (appends `<YouTubeEmbed url="..." />` to body)
- Category selector (10 pills, trilingual labels, writes proper YAML block list)
- Assignment (Vastutaja) + deadline picker
- Quick date edit in grid/list: click any date → inline `<input type="date">` → saves on blur/Enter

### Publish Flow (Critical)
`publish()` builds `finalContent = buildMdx(buildFm(), body)` from current React state and sends it to `POST /api/admin/publish`. `publishProd()` uses this directly — never reads filesystem. This ensures `featuredImage` and all state is current.

### Image Upload
`POST /api/admin/upload-image`: client compresses via Canvas (max 1400px, WebP 0.82) → ~150-300KB payload → stores at `public/uploads/YYYY/MM/slug-timestamp.webp` via GitHub API. Returns `url` (production path, saved to frontmatter) + `previewUrl` (raw.githubusercontent.com, editor-only). `compressImageClient()` is module-level in `app/admin/page.tsx` — shared by cover photo upload and inline body image toolbar button.

## Draft Frontmatter Fields
```yaml
title, slug, date, author, lang
categories:          # YAML block list — use setCategoriesField(), never setFmField()
  - Flow Protseduur
tags: []
excerpt, featuredImage
ctaType: "kiirtest-inline" | "kiirtest-soft" | "none"
medicalReview: false  # true = needs Dr. Haavel sign-off
seoTitle, seoExcerpt  # falls back to title/excerpt if absent
hideDate: true        # per-post override
hideAuthor: true      # per-post override
imageFocalPoint: "45% 30%"  # CSS object-position from DragCrop
translatedFrom: "ET article title"  # links RU/EN to ET original
llmSearchQueries: []  # for Perplexity/ChatGPT indexing
faqItems: [{q, a}]    # renders FAQ section + FAQPage schema
sourceUrl, briefSummary  # provenance tracking
assignedTo, deadline, status  # editorial workflow
```

## Content Creation Rules
1. **User-written text is sacred.** "Salvesta otse" saves text exactly as written — no AI editing.
2. **Language determines folder.** ET/RU/EN → `content/drafts/et/`, `ru/`, or `en/`.
3. **Writing language priority.** When generating trilingual content: write English first, then adapt ET and RU as independent pieces.
4. **Master prompt.** All AI content follows `content/system/master-prompt.md` (James Clear philosophy — stories over statistics, life-first framing, no marketing language).
5. **Russian spelling:** Tallinn = **Таллинн** (two н) — Estonian Russian local standard.
5a. **Estonian grammar:** events you attend take adessive `-l`: *uuringul, vastuvõtul, kontrollil* — NOT inessive `-s` (*uuringus*). Confirmed by Dr. Haavel 2026-04-27.
6. **Excerpts never end mid-sentence.** Every `excerpt` and `seoExcerpt` must end either with full sentence punctuation (`.`, `!`, `?`, `…`) or with a literal ellipsis `...` signalling more text follows. Run `npx tsx scripts/fix-excerpts.mjs` to auto-repair all abrupt endings (truncates to last sentence if ≥40% content preserved, otherwise appends `...`).
7. **No duplicate stories per language.** Before publishing a customer/founder story, check if the same subject already exists in that language folder. Scout can generate near-duplicates — delete extras, keep one canonical version per language.
8. **Every post uses the standard blog format (below). Use the ✨ Vorminda button in the editor toolbar — it applies all rules in one click.**
9. **Claude KSA Blog Editor (humanizer-ksa skill).** New 2026-04-27. Lives at `~/.claude/skills/humanizer-ksa/SKILL.md`. Layered on `~/.claude/skills/humanizer/` (blader/humanizer). Trilingual EE/RU/EN vocabulary lists of AI tells + KSA voice rules + Jana/Silvia/Haavel hand-off. Run on every AI-generated draft before it reaches editors — they should receive ~90% publish-ready material. Reference voice: `content/drafts/et/2026-04-22-vahiravi-ja-sinu-silmade-tervise-raakimata-lugu.mdx` (rewritten + Haavel-approved 2026-04-27). Strategic context: blog is 20–30% of new leads + free-value channel for existing patients → word-of-mouth + referrals. Win-win-win.

## Standard Blog Format (applied by the ✨ Vorminda button)

Every published post must follow this structure. The **✨ Vorminda blogi reeglite järgi** button in the editor toolbar (next to H2 / H3 / • List / 🖼 Pilt) applies all of these rules in one click via `/api/admin/format-body`.

**Frontmatter requirements:**
- `excerpt` and `seoExcerpt` end with full sentence punctuation (`.`, `!`, `?`, `…`) or with `...` — never mid-word. (Rule #6.)
- `reviewedBy` required before publish — see "Publish gate" below.
- `categories` is a YAML block list, never a quoted string. (Use `setCategoriesField()`.)
- `featuredImage` is a 3:2 image, WebP, ≤300KB after client-compression.

**Body structure:**
- Opens with a hook — NO "In this article we will…" / "Selles artiklis räägime…"
- 3–5 `## H2` headings spaced every ~200–300 words of body text. Headings are in the post's language.
- Paragraphs 40–90 words. Walls of text (>120 words) get split.
- List-intro paragraphs get bold lead-ins: `**X.** Foo bar` instead of `X: Foo bar`.
- Medical terms accompanied by plain-language explanation: `sarvkest (silma pealmine läbipaistev kiht)`.
- 1–2 natural inbound links to ksa.ee per post; avoid keyword-stuffing.
- Closing line is empowering, never a sales pitch.

**Embeds — use MDX components, never raw HTML:**
- Rendia video: `<RendiaEmbed id="UUID" caption="Allikas: Rendia" />` — NOT raw `<var data-presentation>` + `<script>` tags (those break MDX parse and Vercel build).
- YouTube: `<YouTubeEmbed url="https://youtu.be/…" />`.

**Published posts are written to `content/posts/`, draft in `content/drafts/[lang]/` is deleted in the same publish call.**

## Publish Gate — why Avalda may appear to do nothing

The "Avalda" button runs through three gates in order. If any fails, publish returns early without a visible toast. Editors sometimes click Avalda and see "nothing happen":

1. **`langChecked`** — the "✓ Keelekontroll tehtud" checkbox in Kvaliteedikontroll panel must be ticked. If not ticked, the Avalda button doesn't even render.
2. **`needsMedical === "no"`** — the "Kas arsti kontroll on vajalik?" radio must be set to "Ei". If "Jah", a separate "🏥 Suuna arsti lauale" button appears instead.
3. **`reviewedBy` non-empty** — the "Läbi vaadanud" select in the bottom sticky bar must have a reviewer selected. If empty, the Avalda button renders as **🔒 Avalda (nõuab kontrollijat)** in grey, and clicking it shows an alert + scrolls focus to the select.

The `reviewedBy` value is written into frontmatter as `reviewedBy: "Dr. Ants Haavel"` (or whichever reviewer). This is the medical sign-off field and is required by policy for every published article.

## Environment Variables (.env.local)
```
ANTHROPIC_API_KEY=...           # Claude API
NEXT_PUBLIC_WEB3FORMS_KEY=...   # Contact form
ADMIN_PASSWORD=ksa-blog-2026    # Admin panel
GITHUB_TOKEN=...                # PAT with contents:write
GITHUB_REPO=antshaavel22/ksa-blog
VERCEL_DEPLOY_HOOK=...          # Triggers rebuild on publish
REPLICATE_API_TOKEN=...         # Optional: enables FLUX AI image generation
```

## Deployment
- ✅ Auto-deploys on push to main (GitHub ↔ Vercel)
- ✅ Deploy hook: publish API triggers rebuild — no manual deploy needed
- ⏳ DNS: Kadri sets CNAME blog → cname.vercel-dns.com at zone.ee
- ⏳ Google Search Console: add blog.ksa.ee, submit /sitemap.xml
- ⏳ WordPress 301 redirects: Kadri imports `redirects-for-kadri.txt` via Yoast

## Pending
- **Replicate token:** Add `REPLICATE_API_TOKEN` to `.env.local` + Vercel env for actual AI image generation
- **Medical review:** Dr. Haavel to review `medical-review-queue.txt` (222 posts)
- **Author avatar photos:** real photos for author pages (currently initials)
- **Phase 2 facelift:** `npm run ai-facelift -- --content` — H2 structure + internal links
- **Cookie consent:** GTM/GA4 fire without user consent (GDPR)
- **hreflang tags:** ET/RU/EN language alternates for SEO

## Scheduled Diagnostics
Two Claude Code scheduled tasks run daily:
- **08:00** `ksa-blog-diagnostics-morning` — homepage, sitemap, sample articles, git log, build
- **18:00** `ksa-blog-diagnostics-evening` — full UI/UX + editor dashboard

## Known Technical Notes
- `getPostBySlug()` matches by filename OR frontmatter `slug` — handles date-prefixed scout files
- Turbopack cache corruption: `rm -rf .next` then restart
- `BLOG_CONFIG` in `lib/config.ts` controls global showDate/showAuthor; per-post `hideDate`/`hideAuthor` override
- Login page uses `window.location.href = "/admin"` (NOT `router.push`) — required for reliable cookie redirect
- `toSlug()` in `lib/categories.ts` strips `&` and special chars — use for all category comparisons
- Admin page is ~2800 lines; all UI in one file — read sections carefully before editing, changes can have wide blast radius

## Keyboard Navigation (article pages)
`components/KeyboardNav.tsx` is mounted on every `app/[slug]/page.tsx` render. Shortcuts:

| Key | Action |
|---|---|
| `→` | Next article in same language (older by date) |
| `←` | Previous article in same language (newer by date) |
| `↑` | Smooth scroll to top |
| `↓` | Smooth scroll to `#smart-cta` (bottom CTA section) |

Sequence is computed by `getAdjacentPosts(post)` in `lib/posts.ts` — same-language, date-desc ordered. Shortcuts are suppressed when the user is typing in `input`/`textarea`/`contenteditable` or when any modifier key (⌘/Ctrl/Alt/Shift) is held. SmartCTA's root `<section>` carries `id="smart-cta"` as the scroll target.

## Changelog (session 2026-04-27)
- **Pin-to-homepage feature (Maigret's request):** Editors can mark up to 3 posts per language as `pinned: true` in frontmatter. New `getHomeFeed()` in `lib/posts.ts` blends pinned (max 3 newest) with the 3 newest non-pinned to fill the top-6 slots, then shuffles those 6 with a UTC-day-seeded PRNG so SSR/ISR is stable per day and refreshes naturally on the next regen. Soft-cap: a 4th pinned post silently falls back into the regular feed (no manual unpinning needed). Applied only on `app/page.tsx` page=1 with no category/query — category and search views stay strict date-desc. Admin: new "📌 Kinnita avalehel" checkbox in Mustandid sidebar between Vimeo and Categories. PostMeta gained `pinned?: boolean`. Pinned cards on the homepage replace the date with a green "📌 Toimetaja valik / Editor's pick / Выбор редактора" badge so old pinned posts don't look stale next to fresh ones (commits `96d8afa` + `8c53fc6`).
- **Vimeo embed in admin (Silvia's request):** `VimeoEmbed` component already existed but only took `id`; admin had no UI to insert it. Extended `VimeoEmbed` to also accept `url` (parses `vimeo.com/123`, `vimeo.com/123/HASH` for unlisted/private, `player.vimeo.com/video/123`). Added "▶ Vimeo video" input block in the Mustandid sidebar toolbox right under YouTube — paste URL, "Lisa artiklisse →", appends `<VimeoEmbed url="..." />`. Admin preview's `mdToHtml` now renders VimeoEmbed as a 16:9 iframe so editors see the video before publishing. (commit `68cb6e4`)
- **Tag pills hidden on article pages:** Removed the beige tag-pill block under article bodies in `app/[slug]/page.tsx`. Tags stay in frontmatter for SEO + internal search; they just don't render to readers anymore. (commit `68cb6e4`)
- **CTA language mixing fix:** SmartCTA hardcoded "Flow3 uuring" + "39 €" in the ladder primary card regardless of `post.lang`, so EN articles showed Estonian copy. Moved both into `UI_LABELS` per language. EN uses "Flow3 exam · €39" (matches site terminology), RU uses "Исследование Flow3 · 39 €" (Jana to review Monday). (commits `7fb8e1a`, `a823e4d`)
- **Excerpt cleanup pass:** Two new one-off scripts in `scripts/`:
  - `fix-excerpts-dedupe-title.mjs` — strips title prefix from excerpts that literally repeat the post title before the body (6 posts).
  - `fix-excerpts-orphan-letter.mjs` — trims orphaned 1–2 letter remnants before `...` so excerpts don't end mid-word, e.g. `...affects nearly e...` → `...affects nearly...` (12 posts).
- **Juhend updated:** New entries for "Vimeo video" and "📌 Kinnita avalehel" in the admin Juhend tab; YouTube entry rewritten to match the toolbox UI accurately.

## Changelog (session 2026-04-24)
- **Keyboard navigation on article pages:** New `components/KeyboardNav.tsx` (client component) — arrow keys cycle next/prev articles in same language, ↑ to top, ↓ to Smart CTA. `lib/posts.ts` exports `getAdjacentPosts()`. Documented in Juhend section 6 + a dedicated CLAUDE.md section above.
- **Excerpt hygiene pass:** `scripts/fix-excerpts.mjs` scanned all 1003 posts. 76 had abrupt endings (30 RU, 25 EN, 21 ET). 42 truncated to last full sentence (preserved ≥40% content), 34 got `...` appended (content too short to truncate). 40 `seoExcerpt` fields also repaired. Re-run anytime after bulk content imports. **New content rule #6** in master rules: excerpts must end with sentence punctuation or `...`.
- **Reelika EN duplicates removed:** Scout generated 3 near-identical EN articles (2026-01-13, 14, 16). Deleted 13 and 16, kept 14 (longest). Note: a 2021 original `reelika-tammeoru-get-your-eyes-in-top-shape-for-the-driving-test.mdx` also exists — kept as canonical.
- **Unpublish API duplicate-key fix:** `addDraftStatus()` was blindly prepending `status: "draft"` to frontmatter — if file already had `status:` anywhere, this created a duplicate YAML key and crashed every build. Now checks for existing `status:` and replaces in-place. (commit 5b2849c)
- **Build incident root cause:** Silmatilkade-iroonia draft had duplicate `status:` from earlier unpublish → gray-matter threw → every Vercel build failed. Manually de-duplicated + pushed fix. Admin UI showed stale "published" state because production froze on old READY deploy.

## Changelog (session 2026-04-23)
- **Phase 7 complete (analytics + consent):** ConsentBanner (cookie-based, DNT-aware, 3 categories) replaced legacy CookieBanner. GTM/GA4 gated via `hasAnalyticsConsent()`. SmartCTA fires `cta_view`/`cta_click`/`funnel_outbound` with UTM params via navigator.sendBeacon. BlogAnalytics fires `article_view` + scroll_depth (25/50/75/100). Events landing in Supabase `blog_events` (project hjnvvulgbccbvwapxtgv). Admin `Stats7dTile` pulls from `blog_events_7d_by_slug` view via service role. Env vars `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` set in Vercel prod+preview.
- **⚠ ROTATE Supabase service-role key** — exposed in screenshot during env-var setup. Rotate via Supabase → API Keys → Secret keys → ⋯ → Rotate, update Vercel, redeploy.
- **CTA primaryHref fix:** `ksa.ee/broneeri` WP router ignored funnel param and sent everyone to Audit LP. Updated `data/cta-config.json`: flow3 → `/vabane-prillidest/flow3-silmauuring/`, audit → `/lp/broneeri-aeg-audit-silmauuring/`, kids → `/nagemiskontroll-lastele/`, dryeye → `/hinnakiri/` (temp). Three `/lp/broneeri-aeg-*` LPs to be built by Mai alongside new booking system.

## Changelog (session 2026-04-22)
- **RendiaEmbed component:** New `components/RendiaEmbed.tsx` — patient-education video embed for MDX posts. Rendia uses `<var data-presentation="UUID">` + `hub.rendia.com/whitelabel/embed.js` (NOT an iframe). Component is `"use client"` and injects the script once per page via `useEffect`. Usage: `<RendiaEmbed id="UUID" caption="Allikas: Rendia" />`. Registered in `app/[slug]/page.tsx` MDXRemote components. Admin Eelvaade shows a dark placeholder with a play icon. **Note:** blog.ksa.ee must be whitelisted by Rendia for embeds to display — email sent to Terrie.Brown@patientpoint.com; currently whitelisted: silmatervis.ksa.ee.
- **SEO image name field:** Admin cover image upload now has a "Pildi SEO nimi" text field above the upload button. Whatever the user types becomes the base filename (`{seoname}-{timestamp}.webp`); field auto-sanitizes to lowercase slug chars. If left empty, original filename is used as before. State: `coverSeoName`, cleared in the upload `finally` block.
- **Batch SEO image rename:** `scripts/rename-images-seo.ts` — renamed 91 poorly-named `image-moXXXXXX.webp` images to `{keyword}-ksa-silmakeskus-{timestamp}.webp`. Keyword derived from post slug via `slugToKeyword()` (stop words filtered, first 4 meaningful words, max 35 chars). Renamed on GitHub (read → write new path → delete old) + patched all referencing MDX files locally. Run: `npx tsx scripts/rename-images-seo.ts [--dry-run]`.
- **Eemalda retry fix:** `app/api/admin/unpublish/route.ts` — after 91 rapid GitHub API calls (batch rename), the API temporarily returned 404 for existing files. Added `githubGetWithRetry()` with 3 attempts and 800ms × attempt exponential delays. Also fixed base64 decode: `Buffer.from(fileData.content.replace(/\n/g, ""), "base64")`.
- **Juhend updates:** Admin Juhend tab expanded with new sections: "Pildi SEO nimi" (explains the name field), "Rendia video" (MDX embed usage), "Otsing blogis" (blog.ksa.ee/otsing search feature).

## Changelog (session 2026-04-18)
- **Admin login unblocked:** `proxy.ts` middleware was blocking `/api/admin/login` itself → chicken-and-egg 401. Added explicit exemption.
- **Image upload race fix:** Uploading multiple images (featured or inline) silently lost all but one because each upload auto-saved with a stale `body` React closure. Removed the auto-save-on-image-upload entirely and made `handleImageFile` use functional `setBody(prev => ...)` so concurrent uploads compose correctly. One Save / Uuenda live at end commits everything. Applies to ET, RU, EN — same editor across languages.
- **Juhend tab rewritten:** added optimal-image-size table (3:2 · 1500×1000 · <1MB · WebP), multi-image workflow tip, removed stale 7am auto-draft claim.
- **Scout disabled:** daily content scout cron commented out. Workflow previously failing silently since early April (missing `contents: write` permission on GITHUB_TOKEN). Fixed permission + re-enabled temporarily, then disabled per Ants's decision to write all drafts manually.
- **EN bulk publish:** 327 EN drafts moved from `content/drafts/en/` to `content/posts/` in one commit. EN pill 65 → ~392.
- **Medical-review bulk-clear:** 64 of 99 Haiku-flagged posts cleared via cluster-based script (`scripts/clear-escalations-abc.ts`). 35 cluster-D posts remain in `medical-review-escalated.md` for manual review.
- **Wall-of-text reformat:** `scripts/format-walls-of-text.ts` added paragraph breaks + H2 headings to 16 long unformatted posts via Sonnet with word-preservation check (multiset compare, ≤3 missing / ≤40 added tolerance). 5 posts flagged for manual fix.

## Changelog (session 2026-04-10, part 2)
- **Editorial UX redesign:** Published tab — editorial grid cards with thumbnails (posts API now returns `featuredImage`/`category`), hover "✎ Redigeeri" overlay, admin nav tabs clean (no emoji, green underline for active)
- **Quick date edit:** click date in grid/list → inline input → saves in-place via GitHub API
- **Inline body images:** FormattingToolbar "🖼 Pilt" button — uploads, compresses, inserts `![alt](url)` at cursor
- **Live blog iframe:** 🌐 Live view in Avaldatud tab — full-height iframe of blog.ksa.ee
- **Read fallback:** draft/post GET APIs now try filesystem first → GitHub API fallback (eliminates 404 on newly-created files)
- **Categories always array:** `lib/posts.ts` normalises `categories` to `string[]` at read time; `setCategoriesField()` writes proper YAML block list; build no longer crashes on scalar categories
- **Concurrent save guard:** `save()` returns early if already saving; error alerts on GitHub write failure
- **Editor metadata panel:** sections separated by dividers, sentence-case labels, category shows "✓ valitud" badge

## Changelog (session 2026-04-10, part 1)
- **Non-blocking publish:** removed countdown from PublishSuccessScreen
- **Language switcher in editor:** ET/RU/EN pills move draft to correct folder via `/api/admin/move-lang`
- **Category selector:** 10-pill selector in editor, writes YAML block list
- **Delete draft:** permanent delete button (trash icon) in editor
- **ISR:** `dynamicParams=true`, `revalidate=120` on `app/[slug]/page.tsx` — new posts render on-demand
- **YouTube in preview:** `mdToHtml()` converts `<YouTubeEmbed>` MDX tags to responsive iframe
- **Duplicate detection:** grid view detects posts with same normalised title → amber DUPLIKAAT badge
- **GitHub API reads for post/draft:** added for files created after last deploy

## Changelog (session 2026-04-07)
- **Image publish bug fixed:** `publishProd` uses clientContent from React state, never stale filesystem
- **Auto-save on image upload:** draft saved to GitHub immediately after upload *(REMOVED 2026-04-18 — caused stale-state race when uploading multiple images. Now: upload images freely, one Save/Uuenda live at end commits all changes together.)*
- **DragCrop component:** drag-to-reposition in 3:2 frame; `imageFocalPoint` saved to frontmatter
- **PostPreview overlay:** full-screen preview before publish
- **Kirjuta uus rewrite:** "Salvesta otse" (no AI) + "AI kirjutab" modes
- **Flow3 footer CTA:** dark-green section with 55,000+ social proof, trilingual

## Related KSA Projects (all on Vercel)
- `~/Desktop/ksa-kiirtest/` — kiirtest quiz LP (ET/RU/EN), static HTML
- `~/Desktop/ksa-lps/` — 5 campaign LPs
- `~/ksa-followup/` — Next.js 14 post-op SMS follow-up app (PostgreSQL, Drizzle, Twilio)
