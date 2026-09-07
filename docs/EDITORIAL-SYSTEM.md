# Editorial System — state of play and V1 scope

Handoff for a fresh session. Everything below is **already live on
blog.ksa.ee** unless marked OPEN. Written 2026-09-07.

Repo: `~/Desktop/Desktop Organized/Dev & Repos/ksa-blog` → `antshaavel22/ksa-blog` → Vercel `prj_9uYkCpgXJR0k5tTteoauLGgq1oXl`

---

## 1. What exists now

### Lugemine tab (`/admin` → "✓ Lugemine")
Editors read a post and tick it. Everyone sees who has ticked what.

- One row per post; **one chip per editor responsible for that post's language**
  - `ET → Mia, Silvia, Ants` · `RU → Jana` · `EN → Ants`
- Filled green ✓ = read, dashed grey = waiting
- Counters: total / fully read / waiting / **waiting on you**
- Filters: 7·30·90 days, "only what I haven't read"

**Identity:** `/admin` is one shared password, so there is no per-user login.
The editor picks who they are once (localStorage `ksa-blog-editor-code`) and can
only toggle their own chip. Others' chips are visible but read-only.

**Storage:** Supabase table `post_reviews (slug, editor, ticked_at)`, project
`hjnvvulgbccbvwapxtgv` (`ksa-analytics`). **Deliberately NOT frontmatter** — a
tick must be instant, and a frontmatter write means a git commit plus a ~2 min
Vercel rebuild on every click.

Files: `lib/editors.ts` · `app/api/admin/reviews/route.ts` · `ReadingTab` in `app/admin/page.tsx`

### Friday digest (`.github/workflows/editor-digest.yml`)
Every Friday 10:00 Tallinn, each editor gets a Slack DM listing only the posts
from the last 7 days that they are responsible for and have **not** ticked.
Ticked posts drop off; says "kõik loetud ✅" when clear.

Timing trick: GitHub cron is UTC-only and Estonia shifts EET↔EEST, so it fires
at **both** 07:00 and 08:00 UTC and `scripts/editor-digest.ts` keeps only the
run that is genuinely 10:00 in Tallinn.

Test safely: Actions → Editor Digest → Run workflow (dry-run defaults to true).

---

## 2. The people — get this right

| Code | Person | Reads | Reachable |
|---|---|---|---|
| A | Ants Haavel | ET, EN | Slack `U08C1C757NX` |
| S | Silvia Johanna Haavel | ET | Slack `U08N63QURHC` |
| J | Jana (Yana Grechits) | RU | Slack `U093CDPHZS5` |
| M | **Mia Haavel** | ET | **not in Slack** · `mia.haavel@ksa.ee` · WhatsApp "HMG" group |

⚠️ **Mia Haavel ≠ Mai Hollo.** Mai (`mai.hollo@ksa.ee`, `U092FM0F71N`) is
marketing-ops and **not** a blog editor. Slack search for "Mia" returns nothing
and returns Mai for "Mai" — this already caused one misrouting. `lib/editors.ts`
carries the warning.

Mia's list is currently appended to Ants's Friday DM for him to relay.

---

## 3. OPEN — blocking full function

1. **Add two GitHub repo secrets** (Settings → Secrets → Actions):
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
   `SLACK_BOT_TOKEN` already exists (used by blog-radar).
   Without them the digest still sends but lists *every* post from the week
   instead of only unticked ones (and says so in the message).
2. **Decide Mia's channel** — relay via Ants (current), or add email delivery.
   Ants has not approved emailing her directly.

---

## 4. Context a fresh session needs

**Analytics was broken until 2026-09-07 and is now fixed.** `Analytics.tsx`
built the gtag shim with rest params (`dataLayer.push(args)` → an Array).
gtag.js only reads **Arguments** objects, so `config` never registered and GA4
recorded *zero* blog traffic for months. Fixed to `dataLayer.push(arguments)`.
Verified live: `window.gtag` is a function, GA4 realtime shows blog pages.
**Do not "simplify" that back to rest parameters.**

- GA4 is **consent-gated** — expect under-reporting, not full traffic.
- **Vercel Web Analytics** script is in the layout but the feature is NOT
  enabled on the project (404). Either enable or remove the dead script.
- Supabase `blog_events` is also consent-gated; its numbers are a fraction.

**Real performance (Ahrefs, independent of tracking):** 485 organic
visits/month, **26 pages earn all of it**, 1,163 posts earn nothing. Top 5 = 75%.
People arrive on **symptom** content (odraiva/stye, silm tõmbleb, milia, od+os),
not laser-surgery content.

**Other gotchas already paid for:**
- Post slugs cut on word boundaries (`lib/slug.mjs`); 158 old URLs 301 via `data/slug-redirects.json`.
- `getPostBySlug()` matches filename **or** frontmatter slug — renaming one without the other creates duplicate-serving posts.
- Batch queue lives in browser localStorage; the flush guard refuses to write when the post was renamed or changed since staging.
- Excerpt rules: `lib/excerpt-rules.mjs` (validation) + `lib/excerpt-writer.mjs` (generation), shared by CLI and the ✨ button. Do not duplicate.
- CTA deadline rolls to end of next month on the 25th; `scripts/test-cta-deadline.mjs` has 31 tests.

---

## 5. Proposed V1 scope

Current state is a working prototype. V1 = make it trustworthy and useful daily.

**Must**
- [ ] Secrets added, digest verified end-to-end with real tick data
- [ ] Mia's delivery decided and implemented
- [ ] Tick history visible (who ticked when) — `ticked_at` is stored but unused in UI
- [ ] "Needs attention" surfaced on the Avaldatud tab too, not only in Lugemine

**Should**
- [ ] Per-editor identity beyond localStorage (a name picker at login is enough)
- [ ] Digest also covers *scheduled* posts before they publish, so proofing happens **before** readers see it — currently it fires after publication
- [ ] Slack thread per week instead of separate DMs, so editors see each other's progress

**Could**
- [ ] Tie ticks to the publish gate: a post cannot go live until its language editor has ticked it
- [ ] Weekly stats in the digest (how many read on time)

---

## 6. Wider open items (not editorial)

- Russian excerpts still on old text (writer works; just needs a run)
- 11 posts fail `npm run excerpts:audit`
- 3 ET stories kept Estonian titles where WordPress had Russian ones — Silvia's call
- Push 3 near-miss keywords to top-3: `sinise valguse prillid` (700/mo, #12), `odraiva ravi` (450, #8), `odraiva ravi kodus` (100, #6)
- Add kiirtest CTAs to the symptom pages that actually earn traffic
- 439 RU posts produce 13 visits/month — biggest unexplained anomaly
