# KSA Blog — Claude Code Project Context

## What This Is
KSA Silmakeskus (ksa.ee) blog migrated from WordPress+Elementor to Next.js+MDX on Vercel.
**Target domain:** blog.ksa.ee
**GitHub repo:** https://github.com/antshaavel22/ksa-blog
**Strategy doc:** ~/Desktop/KSA_Blog_Reanimation_Strategy.pdf

## Tech Stack
- **Framework:** Next.js 16.2.2 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4 (uses `@import "tailwindcss"` + `@theme inline {}` — NOT v3 config)
- **Content:** MDX files in `content/posts/` (442 posts after dedup)
- **Fonts:** Geist (same as all KSA Vercel properties)
- **Params:** In Next.js 16, `params` is `Promise<{slug: string}>` — must `await params`
- **Middleware:** renamed from `middleware.ts` → `proxy.ts`, export renamed `middleware` → `proxy`

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
- **442 published posts** (459 migrated, 19 deleted duplicates/mislabeled)
- Language breakdown: ET ~270, RU ~127, EN ~45
- Language fixes applied: 34 posts had Cyrillic categories but `lang: et` → fixed to `lang: ru`; 16 posts had no Estonian chars in body → fixed to `lang: en`; 1 post wrongly `lang: en` fixed back to `lang: ru`
- Images stay at `ksa.ee/wp-content/uploads/` (no migration needed, Next.js Image proxies)
- WP XML source: `~/Desktop/ksasilmakeskus.WordPress.2026-04-01.xml`
- Content format: Gutenberg blocks (NOT Elementor) — already clean HTML
- **AI facelift run:** 437 posts have Claude-improved titles + excerpts (2026-04-02)
- **medicalReview queue:** `medical-review-queue.txt` — 222 posts flagged for Dr. Haavel

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
- **Pixels:** managed through GTM (no hardcoded pixel tags needed)
- **Schema JSON-LD:** auto-generated on every post — BlogPosting + BreadcrumbList + FAQPage
- **Meta title/description:** from `seoTitle` / `seoExcerpt` frontmatter fields; falls back to `title` / `excerpt`
- **OpenGraph:** auto from title, excerpt, featuredImage
- **Sitemap:** auto-generated at `/sitemap.xml` on every deploy
- **robots.txt:** `public/robots.txt` — allows all crawlers, blocks /admin and /api/
- **LLM search queries:** hidden in post HTML for AI search engines (Perplexity, ChatGPT)

## Key Files
```
lib/posts.ts               — getAllPosts, getPostBySlug, getRelatedPosts, getAllCategories
                             Future posts (date > today) filtered out automatically
lib/categories.ts          — CATEGORY_LABELS registry, getCategoryLabel(), toSlug(), CTA classification
lib/authors.ts             — AuthorProfile type, AUTHORS array, getAuthorByKey(), getAuthorBySlug(), authorToSlug()
lib/config.ts              — BLOG_CONFIG: showDate / showAuthor global toggles
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
components/RelatedPosts.tsx — related posts by shared categories
app/layout.tsx             — GTM, Geist font, default metadata (no ICB jargon)
app/page.tsx               — blog index: lang/category/search/page filters via searchParams
app/[slug]/page.tsx        — post detail (SSG, Schema JSON-LD, date-fns locales, author link)
app/autor/[author]/page.tsx — author profile: bio card, lang filter, post grid, pagination
app/kategooria/[category]/page.tsx — category archive (SSG)
app/sitemap.ts             — auto sitemap
app/admin/page.tsx         — Admin UI: Mustandid + Kirjuta uus + Juhend tabs (password protected)
app/admin/login/page.tsx   — Login page
app/api/admin/login/route.ts  — sets httpOnly cookie admin_session
app/api/admin/logout/route.ts — clears cookie
app/api/admin/drafts/route.ts — lists content/drafts/ (dev: fs, prod: GitHub API)
app/api/admin/draft/route.ts  — GET/PUT draft content
app/api/admin/publish/route.ts — removes status:draft, moves to content/posts/
app/api/admin/fetch-url/route.ts — fetches URL, strips HTML, returns text for brief
app/api/write-post/route.ts — generates trilingual drafts via Claude (dev only)
proxy.ts                   — protects /admin and /api/admin/* routes (renamed from middleware.ts)
public/robots.txt          — crawler rules
scripts/wp-to-mdx.ts       — WP XML → MDX converter (run: npm run convert <xml-file>)
scripts/content-scout.ts   — Daily RSS scout → generates ET/RU/EN drafts
scripts/ai-facelift.ts     — Batch AI title/excerpt improvement (run: npm run ai-facelift)
scripts/generate-redirects.ts — Generates redirects-for-kadri.txt from all post slugs
redirects-for-kadri.txt    — 442 WordPress 301 redirects in Yoast CSV format for Kadri
medical-review-queue.txt   — 222 posts flagged for Dr. Haavel medical sign-off
KASUTAJAJUHEND.md          — Estonian user manual for editors
KSA_Blogi_Juhend.html      — Print-ready PDF-quality manual (on Desktop)
content/drafts/            — ET drafts staging
content/drafts/ru/         — RU drafts staging
content/drafts/en/         — EN drafts staging
.github/workflows/daily-content-scout.yml — runs scout daily at 7am EET, creates PR
```

## NPM Scripts
```bash
npm run dev          # dev server on port 3002
npm run build        # production build
npm run convert      # re-run XML conversion: npx tsx scripts/wp-to-mdx.ts <path.xml>
npm run ai-facelift  # AI batch SEO improvement (phase 1: metadata; add --content for phase 2)
npm run scout        # Daily content scout (--limit N, --trilingual, --dry-run, --source healio)
```
**Node:** use `/Users/antsh/.nvm/versions/node/v24.14.0/bin/node` — not in PATH by default.
**Build:** `PATH="/Users/antsh/.nvm/versions/node/v24.14.0/bin:$PATH" node node_modules/.bin/next build`

## Admin UI (/admin)
Password: set in `.env.local` as `ADMIN_PASSWORD` (default: ksa-blogi-2024)

### Mustandid tab
- Pill filters by language (ET/RU/EN) with counts + title search
- Click card → opens editor with: title, date picker, featured image URL, YouTube URL inserter, body textarea
- **Date logic:** past = backdated post | today = publish now | future = scheduled (hidden until that date)
- Sticky "Salvesta" + "✓ Avalda" bar
- Publish removes `status: "draft"`, moves file to `content/posts/`

### Kirjuta uus tab
- 3 steps: choose source (type / paste URL / upload file) → write brief + pick languages → generate
- Generates ET+RU+EN simultaneously by default
- "Fetch URL": paste article link → auto-fills brief with extracted text

### Juhend tab (NEW 2026-04-02)
- Full Estonian user manual inline — workflow, scheduling, images, video, tips

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
```

## Content Scout (Daily AI Posts)
GitHub Action runs daily at 7am EET:
- Fetches eye health RSS feeds (Healio, ScienceDaily, Review of Ophthalmology, PubMed)
- Scores articles by relevance to KSA keywords
- Generates 1 trilingual draft (ET+RU+EN) via Claude Haiku
- Creates a PR with draft files for editor review
- Editors review in admin UI → publish with one click

RSS sources (updated 2026-04-02 — old sources were dead):
- `healio`: https://www.healio.com/sws/feed/news/ophthalmology (weight 3)
- `sciencedaily`: https://www.sciencedaily.com/rss/health_medicine/eye_care.xml (weight 2)
- `reviewofopt`: https://www.reviewofophthalmology.com/rss/news (weight 2)
- `pubmed`: PubMed eye surgery RSS (weight 1)

## Search
URL param `?otsing=` on the index page filters posts by title, excerpt, categories, tags.
`SearchInput` component (client) in the filter bar — Enter to search, Escape to clear.

## Social Media Links (in BlogFooter)
```
Facebook:  https://www.facebook.com/ksasilmakeskus
Instagram: https://www.instagram.com/ksa_silmakeskus
TikTok:    https://www.tiktok.com/@ksa_silmakeskus
YouTube:   https://www.youtube.com/@KSASilmakeskus
```

## Environment Variables (.env.local)
```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_WEB3FORMS_KEY=10f4c27e-17d4-4a75-b4e5-20fc162d1564
ADMIN_PASSWORD=ksa-blogi-2024
GITHUB_TOKEN=<pat with contents:write>
GITHUB_REPO=antshaavel22/ksa-blog
```
GitHub Actions secret `ANTHROPIC_API_KEY` added to repo (2026-04-02) — daily scout active.

## Deployment Status (as of 2026-04-02)
- ✅ GitHub: https://github.com/antshaavel22/ksa-blog (main branch)
- ✅ Vercel: auto-deploys on push to main
- ✅ Build verified: 483 static pages
- ⏳ DNS: Kadri needs to set CNAME blog → cname.vercel-dns.com at zone.ee
- ⏳ Google Search Console: Kadri adds blog.ksa.ee, submits /sitemap.xml
- ⏳ WordPress 301 redirects: Kadri imports redirects-for-kadri.txt via Yoast SEO → Redirects

## Pending / Next Session
- **Medical review:** Dr. Haavel to glance through `medical-review-queue.txt` (222 posts flagged)
- **DNS go-live:** waiting on Kadri (zone.ee CNAME + Yoast redirects + Search Console)
- **Author avatar photos:** real photos for author pages instead of initials
- **Phase 2 facelift:** `npm run ai-facelift -- --content` adds H2 structure + internal links to posts

## Known Technical Notes
- `toSlug()` in `lib/categories.ts` strips `&` and special chars: `name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim().replace(/\s+/g, "-")`
- Turbopack cache corruption fix: `rm -rf .next` then restart
- `overflow-wrap: break-word` on `.prose-ksa` fixes long URL overflow on mobile
- Category pills use horizontal scroll (`overflow-x-auto scrollbar-hide`) not wrapping
- `BLOG_CONFIG` in `lib/config.ts` controls global showDate/showAuthor toggles
- Per-post `hideDate: true` / `hideAuthor: true` override the global config

## Related KSA Projects (all on Vercel)
- `~/Desktop/ksa-kiirtest/` — kiirtest quiz LP (ET/RU/EN), static HTML
- `~/Desktop/ksa-lps/` — 5 campaign LPs (ksa-besttime, ksa-finance, ksa-timetax, ksa-glasses, ksa-sports)
- `~/ksa-followup/` — Next.js 14 post-op SMS follow-up app (PostgreSQL, Drizzle, Twilio)
- `~/ksa-sms-followup/` — Express.js SMS app (older)
