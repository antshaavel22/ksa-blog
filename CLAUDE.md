# KSA Blog — Claude Code Project Context

## What This Is
KSA Silmakeskus (ksa.ee) blog migrated from WordPress+Elementor to Next.js+MDX on Vercel.
**Target domain:** blog.ksa.ee
**Strategy doc:** ~/Desktop/KSA_Blog_Reanimation_Strategy.pdf

## Tech Stack
- **Framework:** Next.js 16.2.2 (App Router), React 19, TypeScript
- **Styling:** Tailwind CSS v4 (uses `@import "tailwindcss"` + `@theme inline {}` — NOT v3 config)
- **Content:** MDX files in `content/posts/` (459 posts)
- **Fonts:** Geist (same as all KSA Vercel properties)
- **Params:** In Next.js 16, `params` is `Promise<{slug: string}>` — must `await params`

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
- **459 published posts** (not 384 — the WP blog counter was filtered)
- Language breakdown: ET=291, RU=125, EN=45
- Language detected via WP categories: posts tagged "Russian" category → `lang: "ru"`, "English" → `lang: "en"`, else `lang: "et"`
- Images stay at `ksa.ee/wp-content/uploads/` (no migration needed, Next.js Image proxies)
- WP XML source: `~/Desktop/ksasilmakeskus.WordPress.2026-04-01.xml`
- Content format: Gutenberg blocks (NOT Elementor) — already clean HTML

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
CTA URLs:
- ET: https://ksa-kiirtest-lp.vercel.app/
- RU: https://ksa-kiirtest-lp.vercel.app/ru.html
- EN: https://ksa-kiirtest-lp.vercel.app/en.html

## Authors
```
antsh    → Dr. Ants Haavel
silvia   → Silvia Haavel
yana     → Yana Grechits
maigret  → Maigret Moru
ndhaldur → KSA Silmakeskus
```

## Tracking & SEO
- **GTM:** GTM-KCZVRJ8 — wired in `app/layout.tsx`, fires on every page
- **Pixels:** managed through GTM (no hardcoded pixel tags needed)
- **Schema JSON-LD:** auto-generated on every post — BlogPosting + BreadcrumbList + FAQPage
- **Meta title/description:** from `seoTitle` / `seoExcerpt` frontmatter fields (Claude-generated)
- **OpenGraph:** auto from title, excerpt, featuredImage
- **Sitemap:** auto-generated at `/sitemap.xml` on every deploy
- **LLM search queries:** hidden in post HTML for AI search engines (Perplexity, ChatGPT)
- **`<meta keywords>`:** not used — obsolete since 2009, keywords live in content instead

## Key Files
```
lib/posts.ts               — getAllPosts, getPostBySlug, getRelatedPosts, getAllCategories
                             Future posts (date > today) are filtered out automatically
lib/categories.ts          — CATEGORY_LABELS registry, getCategoryLabel(), CTA classification
components/KiirtestCTA.tsx — smart CTA with 3-rule logic
components/BlogBookingCTA.tsx — soft booking strip (promo code BLOG24, €35 free audit)
components/BlogContactForm.tsx — contact form → Web3Forms → registreerumised@ksa.ee
components/YouTubeEmbed.tsx — responsive YouTube embed for MDX posts
                             Usage: <YouTubeEmbed url="https://youtube.com/watch?v=ID" />
                             Or:    <YouTubeEmbed id="videoID" title="..." caption="..." />
components/PostCard.tsx    — post card for grids
components/BlogNav.tsx     — sticky header (← ksa.ee | KSA Blogi | Broneeri aeg)
app/layout.tsx             — GTM, Geist font, default metadata (no ICB jargon)
app/page.tsx               — blog index (dynamic, searchParams for lang/category/page filters)
app/[slug]/page.tsx        — post detail (SSG, Schema JSON-LD, date-fns locales)
app/kategooria/[category]/page.tsx — category archive (SSG)
app/sitemap.ts             — auto sitemap
app/admin/page.tsx         — Admin UI at /admin (password protected)
app/admin/login/page.tsx   — Login page
app/api/admin/login/route.ts  — sets httpOnly cookie admin_session
app/api/admin/logout/route.ts — clears cookie
app/api/admin/drafts/route.ts — lists content/drafts/ (dev: fs, prod: GitHub API)
app/api/admin/draft/route.ts  — GET/PUT draft content
app/api/admin/publish/route.ts — removes status:draft, moves to content/posts/
app/api/admin/fetch-url/route.ts — fetches URL, strips HTML, returns text for brief
app/api/write-post/route.ts — generates trilingual drafts via Claude (dev only)
middleware.ts              — protects /admin and /api/admin/* routes
scripts/wp-to-mdx.ts       — WP XML → MDX converter (run: npm run convert <xml-file>)
scripts/content-scout.ts   — Daily RSS scout → generates ET/RU/EN drafts
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
npm run ai-facelift  # AI batch SEO improvement on all posts
npm run scout        # Daily content scout (--limit N, --trilingual, --dry-run, --source aav)
```

## Admin UI (localhost:3002/admin)
Password: set in `.env.local` as `ADMIN_PASSWORD` (default: ksa-blogi-2024)

### Drafts tab
- Pill filters by language (ET/RU/EN) with counts
- Search by title
- Click card → opens editor
- Editor shows: title input, date picker, featured image URL (with preview), YouTube URL inserter, body textarea
- **Date picker:** past date = backdate post, today = publish now, future date = scheduled (hidden until that date)
- Sticky "Salvesta" + "✓ Avalda" bar
- Publish removes `status: "draft"`, moves file to `content/posts/`

### Write tab
- 3 steps: choose source (type / paste URL / upload file) → write brief + pick languages → generate
- Generates ET+RU+EN simultaneously by default
- "Fetch URL" feature: paste article link → auto-fills brief with extracted text

### Daily greeting
- Rotating motivational quotes seeded by date (for editors Jana/others)
- Dismissible

## Draft Frontmatter Fields
```yaml
title, slug, date, author, categories, tags, excerpt, featuredImage, lang
ctaType: "kiirtest-inline" | "kiirtest-soft" | "none"
medicalReview: true | false   # true = needs Dr. Haavel sign-off before publish
status: "draft"               # remove this line to publish
seoTitle, seoExcerpt          # Claude-optimised meta
llmSearchQueries: [...]       # for Perplexity/ChatGPT indexing
faqItems: [{q, a}, ...]       # renders as FAQ section + FAQPage schema
sourceUrl, briefSummary       # provenance tracking
```

## Scheduled / Backdated Posts
Posts with `date > today` are automatically hidden from the public index.
They appear on their scheduled date without any code change or redeployment needed
(as long as Vercel rebuilds daily — or trigger manually).
To backdate: set any past date → post appears at that position in the timeline.
To repost: change date to today → post jumps back to top of feed.

## Content Scout (Daily AI Posts)
GitHub Action runs daily at 7am EET:
- Fetches top eye health RSS feeds (AAO, Healio, BrightFocus, Review of Ophthalmology)
- Scores articles by relevance to KSA keywords
- Generates 1 trilingual draft (ET+RU+EN) via Claude Haiku
- Creates a PR with the draft files for editor review
- Editors review in admin UI → publish with one click

RSS sources status: allaboutvision.com and AAO feeds return 404 — need replacement sources.

## Environment Variables (.env.local)
```
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_WEB3FORMS_KEY=10f4c27e-17d4-4a75-b4e5-20fc162d1564
ADMIN_PASSWORD=ksa-blogi-2024
GITHUB_TOKEN=<pat with contents:write>   # needed for production publish
GITHUB_REPO=antsh/ksa-blog               # set after repo created
```

## Build Status
- ✅ Build verified: 494 static pages (459 posts + 31 category pages + sitemap + 404)
- ✅ Dev server: localhost:3002 (launch config: "ksa-blog" in ~/.claude/launch.json)
- ✅ Date localization: ET=märts, RU=март, EN=March via date-fns locales
- ✅ Category pills: only CATEGORY_LABELS registry shown, no Cyrillic bleed, no Uncategorized
- ✅ Schema JSON-LD on every post (BlogPosting + BreadcrumbList + FAQPage)
- ✅ GTM GTM-KCZVRJ8 on every page

## Deployment (Not Done Yet)
```bash
# 1. Create GitHub repo
gh repo create antsh/ksa-blog --public
git remote add origin https://github.com/antsh/ksa-blog.git
git push -u origin main

# 2. Deploy to Vercel
vercel --prod
# Add env vars in Vercel dashboard

# 3. DNS at registrar (zone.ee — Kadri does this)
CNAME  blog  →  cname.vercel-dns.com

# 4. Google Search Console
Add blog.ksa.ee property, submit /sitemap.xml

# 5. WordPress 301 redirects (after DNS live)
Yoast → Redirects: /blogi/[slug] → https://blog.ksa.ee/[slug]

# 6. GitHub Actions secret
Add ANTHROPIC_API_KEY to repo secrets → daily scout starts generating drafts
```

## Known Issues / To Fix
- Kiirtest iframe blank on inline CTA posts — likely X-Frame-Options on ksa-kiirtest-lp.vercel.app
- RSS feeds: allaboutvision.com + AAO return 404 — replace with working sources
- Some posts have `lang: "ru"` but Estonian content — WP data issue, not a code bug
- 403 posts have `medicalReview: true` — batch review pass needed with Dr. Haavel

## Related KSA Projects (all on Vercel)
- `~/Desktop/ksa-kiirtest/` — kiirtest quiz LP (ET/RU/EN), static HTML
- `~/Desktop/ksa-lps/` — 5 campaign LPs (ksa-besttime, ksa-finance, ksa-timetax, ksa-glasses, ksa-sports)
- `~/ksa-followup/` — Next.js 14 post-op SMS follow-up app (PostgreSQL, Drizzle, Twilio)
- `~/ksa-sms-followup/` — Express.js SMS app (older)
