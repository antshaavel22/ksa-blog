# Laserkirurgia juhend — build-breaking patterns to fix
**Date:** 2026-05-20
**Author:** Claude (during Ants's CTA-pricing session)
**Audience:** the AI agent working on the laserkirurgia juhend (~15 posts dated 2026-05-21)

## TL;DR

Three of your generated posts crashed the Vercel prerender today. I patched the three that were already committed to unblock production. **The remaining ~12 still-untracked posts almost certainly carry the same patterns** — please audit them all before committing, or they'll take down the build again.

The patterns are simple to fix in batch. Details below.

---

## What broke

Posts affected (already fixed in commit `bb4b5ab`):
- `content/posts/2026-05-21-laserkirurgia-juhend-03-kuidas-laserkirurgia-tootab.mdx`
- `content/posts/2026-05-21-laserkirurgia-juhend-04-levinud-muudid-laserkirurgiast.mdx`
- `content/posts/2026-05-21-laserkirurgia-juhend-08-kuidas-valida-silmakirurgi-ja-kliinikut.mdx`

Posts NOT yet committed (audit before pushing):
```
2026-05-21-laserkirurgia-juhend-00-eessona.mdx
2026-05-21-laserkirurgia-juhend-01-kuidas-silm-tootab.mdx
2026-05-21-laserkirurgia-juhend-02-nagemise-vead.mdx
2026-05-21-laserkirurgia-juhend-03-refraktiivkirurgia-ajalugu.mdx
2026-05-21-laserkirurgia-juhend-05-sarvkesta-biomehaanika.mdx
2026-05-21-laserkirurgia-juhend-07-turvalisus-ja-ektaasia.mdx
2026-05-21-laserkirurgia-juhend-08-vorkkest-ja-vaakum.mdx
2026-05-21-laserkirurgia-juhend-09-diagnostika-tehnoloogia.mdx
2026-05-21-laserkirurgia-juhend-10-kas-sa-oled-kandidaat.mdx
2026-05-21-laserkirurgia-juhend-11-presbuoopia.mdx
2026-05-21-laserkirurgia-juhend-13-alternatiivid.mdx
2026-05-21-laserkirurgia-juhend-14-kokkuvote.mdx
```

Also untracked: the entire `app/laserkirurgia-juhend/` route. Same audit applies.

---

## Three patterns to remove

### Pattern 1 — `<` followed by a digit in body text

**Why it breaks:** MDX parses any `<` followed by `a-zA-Z`, `$`, `_`, or a digit as the start of a JSX tag. `<0.01%` → MDX sees the start of element name `0` → "Unexpected character `0`" → build fails.

**Example we found:**
```
... globaalsed andmed näitavad <0.01%. KSA Silmakeskuses ...
```

**Fix — write it in prose:**
```
... globaalsed andmed näitavad alla 0,01%. KSA Silmakeskuses ...
```

Also use Estonian comma as decimal separator (`0,01` not `0.01`).

**Other variants that will also break** — audit for these:
- `<5%`, `<10mm`, `<60s` etc.
- `<5×10⁻⁶`
- Any inequality written as `<NUMBER`

**Safe alternatives:** "alla X", "vähem kui X", or escape: `\<0,01%`.

### Pattern 2 — `import` statements inside MDX bodies

**Why it breaks:** Our setup uses `next-mdx-remote` (server-rendered MDX strings), which does **not** support inline `import` statements. Components are injected via the parent route's `<MDXRemote components={...} />` prop.

**Example we found:**
```mdx
import RendiaEmbed from '@/components/RendiaEmbed'
import KiirtestCTA from '@/components/KiirtestCTA'
```

**Fix — just delete these lines.** The components that are actually usable in MDX are pre-registered in `app/[slug]/page.tsx:391`:

```ts
<MDXRemote source={post.content} components={{ YouTubeEmbed, VimeoEmbed, RendiaEmbed }} />
```

So you can use `<YouTubeEmbed url="..." />`, `<VimeoEmbed url="..." />`, and `<RendiaEmbed id="..." caption="..." />` **without importing them** — they're already in scope.

### Pattern 3 — `<KiirtestCTA />`

**Why it breaks two ways:**
1. The component **doesn't exist** in `components/`. There's no `KiirtestCTA.tsx`.
2. Even if it did, you'd hit Pattern 2 (can't import in MDX).

**The reason you don't need it:** the inline kiirtest CTA is rendered automatically by `components/ContextualInlineCTA.tsx`, which reads `ctaType` from the post's frontmatter. As long as the post has:
```yaml
---
ctaType: kiirtest-inline
---
```
…the inline CTA will appear in the right place automatically. **Just delete the `<KiirtestCTA />` tags from the body.**

---

## Quick audit command for the remaining 12 posts

Run this from the repo root before committing them:

```bash
# Find any of the three broken patterns in untracked laserkirurgia posts
grep -nE "<[0-9]|^import .* from '@/components|<KiirtestCTA" \
  content/posts/2026-05-21-laserkirurgia-juhend-*.mdx
```

If it prints any lines, fix them with the rules above. If it prints nothing, you're clean to commit.

A one-shot batch fix (we used this on the 3 already-broken ones, works on the rest):

```bash
python3 -c "
import re, glob
for p in glob.glob('content/posts/2026-05-21-laserkirurgia-juhend-*.mdx'):
    with open(p,'r') as f: t = f.read()
    orig = t
    # Pattern 2: drop import lines
    t = re.sub(r'^import .* from .@/components/.*\n', '', t, flags=re.M)
    # Pattern 3: drop standalone <KiirtestCTA /> tags
    t = re.sub(r'<KiirtestCTA\s*/>', '', t)
    # Pattern 1: '<digit' → 'alla digit' (heuristic; review each)
    t = re.sub(r'<(\d)', r'alla \1', t)
    if t != orig:
        with open(p,'w') as f: f.write(t)
        print('fixed:', p)
"
```

After running, **manually re-read each diff** — Pattern 1's heuristic ("`<digit` → `alla digit`") can produce awkward phrasing in some sentences. Replace with proper Estonian phrasing where needed.

---

## Verify before pushing

Always run a local prebuild before pushing new MDX posts:

```bash
PATH="/Users/antsh/.nvm/versions/node/v24.14.0/bin:$PATH" \
  node node_modules/.bin/next build 2>&1 | tail -10
```

If it ends with `✓ Generating static pages using 9 workers (1135/1135)` — you're safe. If it ends with `Error occurred prerendering page "/foo"` — fix the named page first.

The validate-content prebuild gate (`scripts/validate-content.ts`) auto-repairs some patterns (raw Rendia HTML) but does NOT catch the three above. Worth adding them; for now, the local-build check is the safety net.

---

## Bonus suggestion

Consider building a `KiirtestCTA` component if you actually want a body-level CTA distinct from `ContextualInlineCTA` (e.g. shown only at specific positions in long-form guides). Right now using the existing frontmatter mechanism is simpler — it places one inline CTA at the inferred best position automatically.

If you do build it: register it in `app/[slug]/page.tsx` MDXRemote `components` prop alongside `YouTubeEmbed`/`VimeoEmbed`/`RendiaEmbed`, then `<KiirtestCTA />` (no import) will work in MDX bodies. Don't need a separate route or page.

---

That's it. Sorry for the cleanup — easy mistakes, and they didn't show up until the prerender phase, which is why local `npm run dev` didn't catch them either.

— Claude (with Ants)
