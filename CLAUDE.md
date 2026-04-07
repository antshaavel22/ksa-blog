# KSA Blog — Claude Code Project Context

## What This Is
KSA Silmakeskus (ksa.ee) blog migrated from WordPress+Elementor to Next.js+MDX on Vercel.
**Target domain:** blog.ksa.ee
**GitHub repo:** https://github.com/antshaavel22/ksa-blog
**Strategy doc:** ~/Desktop/KSA_Blog_Reanimation_Strategy.pdf

## Tech Stack
- **Framework:** Next.js 16.2.2 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4 (uses `@import "tailwindcss"` + `@theme inline {}` — NOT v3 config)
- **Content:** MDX files in `content/posts/` (~446 published posts)
- **Fonts:** Geist (same as all KSA Vercel properties)
- **Params:** In Next.js 16, `params` is `Promise<{slug: string}>` — must `await params`
- **Middleware:** `proxy.ts` (exports `proxy` function + `config` matcher) — protects /admin and /api/admin/*

## Architecture: Read vs Write

### READS (always filesystem)
All read operations use `fs.readFileSync` on the bundled deployment. Files are bundled with each
Vercel deploy — never read from GitHub API at runtime.

```
GET /api/admin/drafts  → fs.readdirSync(content/drafts/)
GET /api/admin/draft   → fs.readFileSync(content/drafts/...)
GET /api/admin/posts   → fs.readFileSync(content/posts/...)  (reads all, no limit)
GET /api/admin/post    → fs.readFileSync(content/posts/...)
```

### WRITES (GitHub API in production)
All write operations use GitHub REST API (contents PUT/DELETE). Never use fs.writeFileSync in prod.

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
  → publish API writes file to GitHub (content/posts/)
  → publish API calls VERCEL_DEPLOY_HOOK (POST)
  → Vercel rebuilds static pages (~2 min)
  → Article live at blog.ksa.ee/[slug]
```

Also: any `git push origin main` auto-triggers Vercel deploy (GitHub ↔ Vercel connected 2026-04-07).

## KSA Brand Tokens
```
accent:  #87be23   (KSA green)
text:    #1a1a1a
surface: #f9f9f7
border:  #e6e6e6
muted:   #9a9a9a
secondary: #5a6b6c
```

## Content Facts
- **~446 published posts** (459 migrated, 19 deleted duplicates/mislabeled, new posts added)
- **~564 drafts** in content/drafts/ — 0 ET, 264 RU, 300 EN (as of 2026-04-07)
- Language breakdown published: ET ~270, RU ~130, EN ~50
- Images stay at `ksa.ee/wp-content/uploads/` (no migration needed, Next.js Image proxies)
- WP XML source: `~/Desktop/ksasilmakeskus.WordPress.2026-04-01.xml`
- Content format: Gutenberg blocks (NOT Elementor) — already clean HTML
- **AI facelift run:** 437 posts have Claude-improved titles + excerpts (2026-04-02)
- **medicalReview queue:** `medical-review-queue.txt` — 222 posts flagged for Dr. Haavel
- **Batch generation:** 10 RU + 10 EN March 2026 drafts generated via `npm run batch`

## Sister Article System
RU/EN translations are linked to their ET original via the `translatedFrom` frontmatter field:
```yaml
translatedFrom: "Flow3 laser silmad: elu pärast operatsiooni"  # exact ET title
```
The `/api/admin/sync-images` endpoint uses this to find sisters and propagate `featuredImage`.
- ET article = original; finds sisters where `translatedFrom === etTitle`
- RU/EN article = translation; finds ET original then all other translations

## Blog Hero Taglines (per language)
```
ET: "Hea nägemine on üks inimese supervõimetest. Hea nägemisega on elu ilusam!"
RU: "Хорошее зрение — одна из сверхспособностей человека. С хорошим зрением жизнь становится красивее!"
EN: "Good vision is one of life's superpowers. See better — live better!"
```
RU version may be updated by Jana later. Edit in `app/page.tsx` hero section.

## KiirtestCTA Rules (3 rules from strategy doc)
```
Rule 1 → ctaType: "kiirtest-inline"
  Categories: edulood, kogemuslood, flow-protseduur, nagemise-korrigeerimine

Rule 2 → ctaType: "kiirtest-soft"
  Informational/educational posts (default)

Rule 3 → ctaType: "none"
  Categories: silmad-ja-tervis, silmade-tervis-nipid, eye-health-tips
```
CTA URLs (ksa-kiirtest-lp.vercel.app blocks iframes — CTA now uses button link, NOT iframe):
- ET: https://ksa-kiirtest-lp.vercel.app/
- RU: https://ksa-kiirtest-lp.vercel.app/ru.html
- EN: https://ksa-kiirtest-lp.vercel.app/en.html

## Authors
All author data centralised in `lib/authors.ts` — `getAuthorByKey()` maps any key or full name to
a profile with displayName, slug, role and bio in ET/RU/EN.

```
antsh / Dr. Ants Haavel       → slug: dr-ants-haavel
silvia / Silvia Haavel        → slug: silvia-johanna-haavel  (displayed as "Silvia Johanna Haavel")
yana / Yana Grechits          → slug: yana-grechits
maigret / Maigret Moru        → slug: maigret-moru
ndhaldur / KSA Silmakeskus   → slug: ksa-silmakeskus
```

Author pages live at `/autor/[slug]` — bio card, language filter, post grid, pagination.
Author names on post pages link to their author page.

## Blog Editors
- **Silvia Johanna Haavel** — ET content editor
- **Jana** — RU and EN content editor

## Tracking & SEO
- **GTM:** GTM-KCZVRJ8 — wired in `app/layout.tsx`, fires on every page
- **GA4:** G-7R7T8GF37J — added directly in `app/layout.tsx` alongside GTM (2026-04-07)
- **Pixels:** managed through GTM (no hardcoded pixel tags needed)
- **Schema JSON-LD:** auto-generated on every post — BlogPosting + BreadcrumbList + FAQPage
- **Meta title/description:** from `seoTitle` / `seoExcerpt` frontmatter fields; falls back to `title` / `excerpt`
- **OpenGraph:** auto from title, excerpt, featuredImage
- **Sitemap:** auto-generated at `/sitemap.xml` on every deploy
- **robots.txt:** `public/robots.txt` — allows all crawlers, blocks /admin and /api/
- **LLM search queries:** hidden in post HTML for AI search engines (Perplexity, ChatGPT)

## Key Files
```
lib/posts.ts               — getAllPosts, getPostBySlug (matches by filename OR frontmatter slug),
                             getRelatedPosts, getAllCategories
                             Future posts (date > today) filtered out automatically
lib/categories.ts          — CATEGORY_LABELS registry, getCategoryLabel(), toSlug(), CTA classification
lib/authors.ts             — AuthorProfile type, AUTHORS array, getAuthorByKey(), getAuthorBySlug(), authorToSlug()
lib/config.ts              — BLOG_CONFIG: showDate / showAuthor global toggles
lib/master-prompt.ts       — Loads KSA_MASTER_PROMPT from content/system/master-prompt.md
                             Also exports LANG_SEO_KEYWORDS (per-language SEO keyword arrays)
content/system/master-prompt.md — Editable AI writing rules (voice, tone, medical policy, CTA rules)
                             Edit via admin Sisureeglid tab OR directly in this file
components/KiirtestCTA.tsx — smart CTA: kiirtest-soft (banner+button) or kiirtest-inline (full card)
                             NOTE: inline is now a button card, NOT an iframe (iframe blocked by X-Frame-Options)
components/BlogBookingCTA.tsx — soft booking strip (promo code BLOG24, €35 free audit)
components/BlogContactForm.tsx — contact form → Web3Forms → registreerumised@ksa.ee
components/YouTubeEmbed.tsx — responsive YouTube embed for MDX posts
components/PostCard.tsx    — post card: title, category, date, reading time, author, excerpt
components/BlogNav.tsx     — sticky header (← ksa.ee | KSA Blogi | Broneeri aeg)
components/BlogFooter.tsx  — footer with inline SVG social icons (FB, IG, YT, TikTok) + links
components/ShareButton.tsx — "use client" — Web Share API (mobile) + clipboard fallback (desktop)
components/SearchInput.tsx — "use client" — URL param ?otsing= search, Enter/Escape, clear button
components/RelatedPosts.tsx — related posts by shared categories (wired into app/[slug]/page.tsx)
app/layout.tsx             — GTM + GA4, Geist font, default metadata
app/page.tsx               — blog index: lang/category/search/page filters via searchParams
app/[slug]/page.tsx        — post detail (SSG, Schema JSON-LD, date-fns locales, author link,
                             RelatedPosts at bottom)
app/autor/[author]/page.tsx — author profile: bio card, lang filter, post grid, pagination
app/kategooria/[category]/page.tsx — category archive (SSG)
app/sitemap.ts             — auto sitemap
app/admin/page.tsx         — Admin UI: 5 tabs (Mustandid, Avaldatud, Kirjuta uus, Sisureeglid, Juhend)
app/admin/login/page.tsx   — Login page (show/hide password toggle)
app/api/admin/login/route.ts   — sets httpOnly cookie admin_session = ADMIN_PASSWORD
app/api/admin/logout/route.ts  — clears cookie
app/api/admin/drafts/route.ts  — lists content/drafts/ via filesystem (all 3 langs)
app/api/admin/draft/route.ts   — GET: filesystem | PUT: GitHub API
app/api/admin/post/route.ts    — GET: filesystem | PUT: GitHub API
app/api/admin/posts/route.ts   — lists content/posts/ via filesystem, returns slug+title from frontmatter
app/api/admin/publish/route.ts — read fs → write GitHub → delete draft GitHub → trigger deploy hook
app/api/admin/unpublish/route.ts — read GitHub → write draft GitHub → delete post GitHub
app/api/admin/sync-images/route.ts — GET: find sister articles | POST: propagate featuredImage to sisters
app/api/admin/prompt/route.ts  — GET/PUT content/system/master-prompt.md
app/api/admin/generate-image/route.ts — Claude crafts photographic prompt → Replicate FLUX generates image
app/api/admin/fetch-url/route.ts — fetches URL, strips HTML, returns text for brief
app/api/admin/save-raw-draft/route.ts — saves user text DIRECTLY as draft (no AI processing)
app/api/write-post/route.ts — generates trilingual drafts via Claude (uses master prompt)
proxy.ts                   — protects /admin and /api/admin/* routes
                             NOTE: file named proxy.ts (not middleware.ts), exports proxy function
public/robots.txt          — crawler rules
scripts/wp-to-mdx.ts       — WP XML → MDX converter (run: npm run convert <xml-file>)
scripts/content-scout.ts   — Daily RSS scout → generates ET/RU/EN drafts
scripts/ai-facelift.ts     — Batch AI title/excerpt improvement (run: npm run ai-facelift)
scripts/batch-generate.ts  — Batch generates 10 RU + 10 EN posts (run: npm run batch -- --lang ru)
scripts/generate-redirects.ts — Generates redirects-for-kadri.txt from all post slugs
redirects-for-kadri.txt    — 442 WordPress 301 redirects in Yoast CSV format for Kadri
medical-review-queue.txt   — 222 posts flagged for Dr. Haavel medical sign-off
KASUTAJAJUHEND.md          — Estonian user manual for editors (v3.0)
content/drafts/et/         — ET drafts staging
content/drafts/ru/         — RU drafts (264 as of 2026-04-07)
content/drafts/en/         — EN drafts (300 as of 2026-04-07)
content/system/master-prompt.md — AI writing rules
.github/workflows/daily-content-scout.yml — runs scout daily at 7am EET, pushes directly to main
.claude/launch.json        — dev server config for Claude Preview (port 3002)
```

## NPM Scripts
```bash
npm run dev          # dev server on port 3002
npm run build        # production build
npm run convert      # re-run XML conversion: npx tsx scripts/wp-to-mdx.ts <path.xml>
npm run ai-facelift  # AI batch SEO improvement (phase 1: metadata; add --content for phase 2)
npm run scout        # Daily content scout (--limit N, --trilingual, --dry-run, --source healio)
npm run batch        # Batch generate: npm run batch -- --lang ru|en [--dry-run] [--topic N]
```
**Node:** use `/Users/antsh/.nvm/versions/node/v24.14.0/bin/node` — not in PATH by default.
**Build:** `PATH="/Users/antsh/.nvm/versions/node/v24.14.0/bin:$PATH" node node_modules/.bin/next build`

## Admin UI (/admin)
**Password:** `ksa-blog-2026` (set as `ADMIN_PASSWORD` in `.env.local` and Vercel env)
**Login URL:** https://blog.ksa.ee/admin/login

### 5 Tabs
1. **📋 Mustandid** — browse/edit/publish drafts (564 total: 264 RU, 300 EN)
2. **✏️ Avaldatud** — browse/edit published posts, unpublish back to draft
3. **✍️ Kirjuta uus** — two modes:
   - **📝 Salvesta otse** — paste/write text → pick language (ET/RU/EN) → saves to draft folder UNCHANGED (no AI)
   - **🤖 AI kirjutab** — give idea/notes/link → AI generates article (uses Claude + master prompt)
   IMPORTANT: "Salvesta otse" saves text exactly as user wrote it. No AI editing, no rewriting.
   User provides: title + language + body text. Endpoint: POST /api/admin/save-raw-draft
4. **📝 Sisureeglid** — view/edit master AI writing prompt
5. **❓ Juhend** — Estonian user manual

### Editor features
- Breadcrumb nav: `← Mustandid > [LANG] > title` + "Vaata blogis ↗" link for published
- Sticky action bar: Salvesta + Avalda (or Salvesta + Eemalda avaldamisest for published)
- Featured image: URL input + preview + **✨ Genereeri AI pilt** button + "Sünkrooni pilt sõsarartiklitele"
- YouTube embed inserter
- Assignment (Vastutaja) + deadline picker
- Medical review flag + email notification

### AI Image Generation
Button "✨ Genereeri AI pilt" in editor:
1. Claude (claude-opus-4-6) crafts a photographic FLUX prompt from title + excerpt
2. If `REPLICATE_API_TOKEN` set: calls FLUX.1-schnell via Replicate → sets as featuredImage
3. If no token: shows the Claude-crafted prompt + "Kopeeri prompt" button for manual use in Midjourney/DALL-E

### Sisureeglid Tab
Editable textarea with full master prompt — covers:
- KSA voice & tone, language rules (ET/RU/EN), medical policy, CTA types, article structure
- Changes saved to `content/system/master-prompt.md` via GitHub API in production

## Draft Frontmatter Fields
```yaml
title, slug, date, author, categories, tags, excerpt, featuredImage, lang
ctaType: "kiirtest-inline" | "kiirtest-soft" | "none"
medicalReview: true | false   # true = needs Dr. Haavel sign-off before publish
status: "draft"               # remove this line to publish
seoTitle, seoExcerpt          # Claude-optimised meta (falls back to title/excerpt)
hideDate: true                # per-post override to hide date
hideAuthor: true              # per-post override to hide author
llmSearchQueries: [...]       # for Perplexity/ChatGPT indexing
faqItems: [{q, a}, ...]       # renders as FAQ section + FAQPage schema
sourceUrl, briefSummary       # provenance tracking
translatedFrom: "ET article title"  # links RU/EN to their ET original (used by sync-images)
```

## Content Creation Rules
1. **User-written text is sacred.** When user pastes/writes text via "Salvesta otse", save it EXACTLY as-is.
   No AI editing, no rewriting, no "improving". The text goes to the draft folder unchanged.
2. **Language determines folder.** User picks ET/RU/EN → file saves to `content/drafts/et/`, `ru/`, or `en/`.
3. **AI generation is separate.** The "AI kirjutab" mode is a different flow — only used when user explicitly
   wants AI to write from scratch based on ideas/notes/links.
4. **Writing language priority.** When creating trilingual content, write English first (strongest creative
   quality), then adapt to Estonian and Russian as independent-feeling pieces — not stiff translations.
5. **Master prompt.** All AI-generated content follows `content/system/master-prompt.md` (James Clear philosophy).
   Minimal rules, stories over statistics, life-first framing, no marketing language in articles.

## Content Scout (Daily AI Posts)
GitHub Action runs daily at 7am EET:
- Fetches TOP 20 health/lifestyle/vision RSS feeds
- Scores articles by relevance to KSA keywords
- Generates 1 trilingual draft (ET+RU+EN) via Claude Sonnet
- Pushes drafts directly to main branch (auto-deploys via Vercel)
- Editors review in admin UI → publish with one click

RSS sources: 21 feeds including Healio, ScienceDaily, Review of Ophthalmology, PubMed,
WebMD, Healthline, Medical News Today, Well+Good, Mindbodygreen, and more (see content-scout.ts)

## Search
URL param `?otsing=` on the index page filters posts by title, excerpt, categories, tags.
`SearchInput` component (client) in the filter bar — Enter to search, Escape to clear.
Admin search (Avaldatud tab) matches title + excerpt + slug.

## Social Media Links (in BlogFooter)
```
Facebook:  https://www.facebook.com/ksasilmakeskus
Instagram: https://www.instagram.com/ksa_silmakeskus
TikTok:    https://www.tiktok.com/@ksa_silmakeskus
YouTube:   https://www.youtube.com/@KSASilmakeskus
```

## Environment Variables (.env.local)
```
ANTHROPIC_API_KEY=sk-ant-...         # Claude API — drafts, AI facelift, image prompts
NEXT_PUBLIC_WEB3FORMS_KEY=...        # Contact form submissions
ADMIN_PASSWORD=ksa-blog-2026         # Admin panel password (CHANGED 2026-04-07)
GITHUB_TOKEN=<pat with contents:write>  # GitHub API writes (publish, unpublish, save)
GITHUB_REPO=antshaavel22/ksa-blog    # Target repo for GitHub API
VERCEL_DEPLOY_HOOK=https://api.vercel.com/v1/integrations/deploy/prj_.../...
                                     # Auto-redeploy on publish (added 2026-04-07)
REPLICATE_API_TOKEN=<optional>       # If set: enables AI image generation via FLUX.1-schnell
                                     # Get free token at replicate.com
```

## Deployment (as of 2026-04-07)
- ✅ GitHub: https://github.com/antshaavel22/ksa-blog (main branch)
- ✅ Vercel: **auto-deploys on push to main** (GitHub connected 2026-04-07)
- ✅ Deploy hook: publish API triggers `VERCEL_DEPLOY_HOOK` — no manual deploy needed
- ✅ Build verified: ~490 static pages
- ✅ Admin password: `ksa-blog-2026`
- ⏳ DNS: Kadri needs to set CNAME blog → cname.vercel-dns.com at zone.ee
- ⏳ Google Search Console: Kadri adds blog.ksa.ee, submits /sitemap.xml
- ⏳ WordPress 301 redirects: Kadri imports redirects-for-kadri.txt via Yoast SEO → Redirects

## Scheduled Diagnostics
Two Claude Code scheduled tasks run daily:
- **08:00** `ksa-blog-diagnostics-morning` — homepage, sitemap, sample articles, git log, build
- **18:00** `ksa-blog-diagnostics-evening` — full UI/UX + editor dashboard (all APIs, admin login, related posts)
Both auto-fix issues when possible and notify on completion.

## Pending / Next Session
- **Replicate token:** Add `REPLICATE_API_TOKEN` to `.env.local` and Vercel env to enable actual AI image generation (get free at replicate.com)
- **Medical review:** Dr. Haavel to glance through `medical-review-queue.txt` (222 posts flagged)
- **Publish batch articles:** Jana to review and publish 10 RU + 10 EN March 2026 drafts
- **DNS go-live:** waiting on Kadri (zone.ee CNAME + Yoast redirects + Search Console)
- **Author avatar photos:** real photos for author pages instead of initials
- **Phase 2 facelift:** `npm run ai-facelift -- --content` adds H2 structure + internal links to posts

## Known Technical Notes
- `getPostBySlug()` matches by filename OR frontmatter `slug` field — handles date-prefixed scout files
- `toSlug()` in `lib/categories.ts` strips `&` and special chars
- Turbopack cache corruption fix: `rm -rf .next` then restart
- `overflow-wrap: break-word` on `.prose-ksa` fixes long URL overflow on mobile
- Category pills use horizontal scroll (`overflow-x-auto scrollbar-hide`) not wrapping
- `BLOG_CONFIG` in `lib/config.ts` controls global showDate/showAuthor toggles
- Per-post `hideDate: true` / `hideAuthor: true` override the global config
- Login page uses `window.location.href = "/admin"` (NOT router.push) for reliable redirect

## Related KSA Projects (all on Vercel)
- `~/Desktop/ksa-kiirtest/` — kiirtest quiz LP (ET/RU/EN), static HTML
- `~/Desktop/ksa-lps/` — 5 campaign LPs (ksa-besttime, ksa-finance, ksa-timetax, ksa-glasses, ksa-sports)
- `~/ksa-followup/` — Next.js 14 post-op SMS follow-up app (PostgreSQL, Drizzle, Twilio)
- `~/ksa-sms-followup/` — Express.js SMS app (older)
