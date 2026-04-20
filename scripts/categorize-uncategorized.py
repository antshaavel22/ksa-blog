#!/usr/bin/env python3
"""
categorize-uncategorized.py

Reads all .mdx posts in content/posts/, finds those with no category items,
determines 2-3 categories from the allowed list via keyword scoring, and
rewrites their frontmatter in correct YAML block list format.

Usage:
    python3 scripts/categorize-uncategorized.py --dry-run
    python3 scripts/categorize-uncategorized.py
"""

import os
import re
import sys
import argparse

POSTS_DIR = os.path.join(os.path.dirname(__file__), '..', 'content', 'posts')

# ---------------------------------------------------------------------------
# Keyword scoring rules
# Each entry: (category_slug, [(keyword, weight), ...])
# Text checked: title + excerpt + first 400 chars of body — lowercased
# ---------------------------------------------------------------------------
SCORING_RULES = [
    # edulood — success stories: named patient, got rid of glasses
    ('edulood', [
        ('story', 3), ('success', 3), ('история', 3), ('история ', 3),
        ('got rid', 3), ('избавил', 3), ('vabanesid', 3), ('vabaneda', 2),
        ('no more glasses', 3), ('без очков', 3), ('без линз', 3),
        ('life without glasses', 3), ('жизнь без очков', 3),
        ('heidi', 3), ('helena', 3), ('birgit', 3), ('anne', 2),
        ('татьяна', 3), ('татьянa', 3), ('александра', 3), ('кристийн', 2),
        ('агнес', 2), ('карл-эрик', 3), ('мяр', 2),
        ('tantsutreener', 2), ('purjekas', 2), ('kitesurfer', 2),
        ('dream came true', 2), ('transformed', 2), ('changed my life', 2),
        ('изменила жизнь', 2), ('мечта', 2),
        ('eye surgery success', 2), ('laser correction story', 2),
        ('optomet', 2),  # matches optometrist
    ]),

    # kogemuslood — patient experience/journey
    ('kogemuslood', [
        ('experience', 2), ('journey', 2), ('опыт', 2), ('история пациента', 3),
        ('before and after', 2), ('до и после', 2),
        ('patient story', 3), ('personal', 2), ('real story', 2),
        ('реальная история', 2), ('мой опыт', 2),
        ('diary', 2), ('дневник', 2), ('daily', 1),
        ('procedure experience', 2), ('after surgery', 2),
        ('heidi', 2), ('helena', 2), ('birgit', 2),
        ('tattoo', 1), ('consultant', 1),  # KSA staff story
        ('татьяна', 2), ('александра', 2), ('кристийн', 2),
    ]),

    # flow-protseduur — Flow3 laser procedure specifically
    ('flow-protseduur', [
        ('flow3', 5), ('flow 3', 5), ('flow protseduur', 4), ('flow procedure', 4),
        ('flow лазер', 4), ('flow лазерная', 4),
        ('laser eye surgery', 3), ('laseroperatsioon', 3), ('лазерная коррекция', 3),
        ('laser correction', 3), ('laser procedure', 3),
        ('bladeless', 3), ('flapless', 3), ('lasik', 2),
        ('laser vision correction', 3), ('лазерная операция', 3),
        ('коррекция зрения', 2), ('визионная коррекция', 2),
        ('операция на глаза', 2), ('eye surgery', 2),
        ('студентам', 2), ('student discount', 2), ('50%', 2),
        ('incision-free', 2), ('bladeless surgery', 3),
        ('before pregnancy', 2), ('laser before', 2), ('keratoconus laser', 2),
    ]),

    # nagemise-korrigeerimine — vision correction broadly
    ('nagemise-korrigeerimine', [
        ('vision correction', 3), ('коррекция зрения', 3), ('nägemise korrigeerimine', 3),
        ('glasses', 2), ('очки', 2), ('prillid', 2),
        ('contact lens', 2), ('линзы', 2), ('laatsed', 2), ('contacts', 2),
        ('get rid of glasses', 3), ('избавиться от очков', 3),
        ('myopia', 2), ('nearsightedness', 2), ('близорукость', 2), ('lühinägelikkus', 2),
        ('prescription', 2), ('рецепт', 1),
        ('eligibility', 2), ('candidate for laser', 2),
        ('glasses vs', 2), ('очки vs', 2), ('compare vision', 2),
        ('laser vs contacts', 2), ('comparison', 1),
        ('od and os', 2), ('sph cyl', 2), ('glasses prescription', 2),
        ('presbyopia', 2), ('пресбиопия', 2), ('дальнозоркость', 1),
        ('color blindness', 2), ('дальтонизм', 2),
        ('стоматолог', 1), ('dentist', 1),
    ]),

    # silmad-ja-tervis — eyes & general health
    ('silmad-ja-tervis', [
        ('eye health', 3), ('здоровье глаз', 3), ('silmade tervis', 3),
        ('eye condition', 2), ('eye disease', 2), ('заболевание глаз', 2),
        ('glaucoma', 3), ('глаукома', 3),
        ('cataracts', 2), ('катаракта', 2),
        ('retina', 2), ('сетчатка', 2),
        ('keratoconus', 3), ('кератоконус', 3),
        ('AMD', 2), ('macular', 2), ('макулярная', 2),
        ('nutrition', 2), ('питание', 2), ('vitamins', 2), ('витамины', 2),
        ('vitamin a', 2), ('beta-carotene', 2), ('бета-каротин', 2),
        ('omega', 2), ('омега', 2),
        ('sleep', 2), ('сон', 2),
        ('immunity', 2), ('иммунитет', 2),
        ('floaters', 3), ('мушки в глазах', 3), ('плавающие', 2),
        ('eye changes', 2), ('structural eye', 2),
        ('space travel', 2), ('космос', 2),
        ('nitrogen', 1), ('oxygen', 1),
        ('children vision', 2), ('детское зрение', 2), ('детей', 2), ('laste', 2),
        ('myopia children', 2), ('близорукость у детей', 2),
        ('nitrates', 2), ('нитраты', 2), ('zöldségek', 1),
        ('convergent', 2), ('конвергентный', 2), ('косоглазие', 2),
        ('reindeer', 2), ('северный олень', 2),
        ('paralysed', 2), ('парализованных', 2), ('зрачки', 1),
        ('milia', 2), ('милия', 2), ('акне', 1), ('foam party', 2),
        ('chemical', 2), ('injury', 2), ('травма глаза', 2),
        ('artificial retina', 2), ('имплант', 2),
        ('eye aging', 2), ('aging eyes', 2), ('aging', 1),
        ('seasonal', 1), ('pollen', 2), ('пыльца', 2), ('весна', 1),
        ('stye', 2), ('ячмень', 2), ('blink', 2), ('моргание', 2),
        ('eye twitching', 2), ('дергается глаз', 2),
        ('cow milk', 1), ('молоко', 1),
        ('benjamin spok', 1), ('вдохновляющая', 0),
    ]),

    # silmade-tervis-nipid — practical tips, how-to guides
    ('silmade-tervis-nipid', [
        ('tips', 3), ('советы', 3), ('nõuanded', 3),
        ('how to', 3), ('как правильно', 3), ('kuidas', 2),
        ('guide', 2), ('руководство', 2), ('juhend', 2),
        ('protect', 2), ('protect your eyes', 3), ('защитить глаза', 3),
        ('eye drops', 3), ('глазные капли', 3), ('eye drop', 3),
        ('prevention', 2), ('профилактика', 2),
        ('bad habits', 2), ('плохие привычки', 2), ('habits', 2),
        ('night phone', 2), ('evening phone', 2), ('ночью телефон', 2),
        ('screen', 2), ('экран', 2), ('монитор', 1),
        ('office', 2), ('офис', 2), ('workplace', 2),
        ('sunglasses', 3), ('солнцезащитные очки', 3), ('päikeseprillid', 3),
        ('uv protection', 2), ('защита от солнца', 2),
        ('safety glasses', 3), ('защитные очки', 3), ('kaitseprillid', 3),
        ('back to school', 2), ('назад в школу', 2),
        ('eye exercises', 3), ('упражнения для глаз', 3),
        ('digital eye strain', 3), ('цифровой синдром', 2), ('CVS', 2),
        ('computer vision', 2), ('arvutinägemine', 2),
        ('outdoor time', 2), ('outdoor', 1),
        ('recipe', 1), ('рецепт', 1), ('pumpkin', 1), ('тыква', 1),
        ('celery', 1), ('сельдерей', 1),
        ('sleep', 1), ('сон', 1),
    ]),

    # huvitavad-faktid — interesting facts, research, studies
    ('huvitavad-faktid', [
        ('research', 3), ('исследование', 3), ('uuring', 3),
        ('study', 3), ('studies', 3), ('study shows', 3),
        ('science', 2), ('наука', 2), ('teadus', 2),
        ('statistics', 2), ('статистика', 2),
        ('facts', 3), ('факты', 3), ('faktid', 3),
        ('interesting', 2), ('interesting facts', 3), ('huvitav', 2),
        ('did you know', 2), ('знали ли вы', 2),
        ('taiwan study', 2), ('taiwan', 1),
        ('astronaut', 2), ('астронавт', 2), ('space', 2), ('космос', 2),
        ('insect eye', 2), ('compound eye', 2), ('насекомые', 1),
        ('how eyes work', 2), ('как работают глаза', 2), ('vision basics', 2),
        ('super vision', 2), ('100%', 1), ('суперзрение', 2),
        ('color blind', 2), ('дальтонизм', 2),
        ('reindeer', 2), ('северный олень', 2),
        ('paralysed patients', 2), ('зрачки общение', 2),
        ('ar glasses technology', 2), ('artificial retina', 2),
        ('nitrates', 2), ('нитраты', 2), ('44%', 2),
        ('blink', 2), ('моргание', 2), ('10.5 million', 1),
        ('foam party', 1), ('chemical', 1),
    ]),

    # elustiil — lifestyle, sports, travel
    ('elustiil', [
        ('sport', 3), ('спорт', 3), ('sports', 3),
        ('athlete', 3), ('спортсмен', 3), ('athletic', 2),
        ('active life', 2), ('активный образ', 2),
        ('travel', 2), ('путешествие', 2), ('reisija', 2),
        ('skydiving', 3), ('парашют', 3), ('parachute', 2),
        ('kitesurfer', 3), ('кайтсерфер', 3), ('kitesurf', 3),
        ('sailing', 3), ('парусный спорт', 3), ('purjekas', 3),
        ('swimming', 2), ('плавание', 2), ('ujumine', 2),
        ('gym', 2), ('тренажерный зал', 2), ('спортзал', 2),
        ('glasses in sport', 2), ('очки в спорте', 2),
        ('without glasses', 2), ('без очков', 2),
        ('peripheral vision', 2), ('боковое зрение', 2),
        ('adventure', 2), ('приключение', 2),
        ('dance', 2), ('танец', 2), ('dancer', 2), ('танцовщица', 2),
        ('summer', 1), ('лето', 1), ('suvi', 1),
        ('students', 1), ('студент', 1),
        ('problem with glasses', 2), ('11 проблем', 2),
    ]),

    # ksa-silmakeskus — KSA brand/clinic specific
    ('ksa-silmakeskus', [
        ('ksa', 2), ('ksa silmakeskus', 4),
        ('our clinic', 2), ('наша клиника', 2),
        ('dr haavel', 3), ('доктор хаавел', 3), ('dr. haavel', 3),
        ('haavel', 2),
        ('london training', 3), ('london lessons', 3), ('koolitus', 2),
        ('ksa team', 2), ('команда ksa', 2),
        ('laura', 2), ('merike', 2), ('лаура', 2), ('мерике', 2),
        ('consultant', 2), ('консультант', 2),
        ('optometrist', 2), ('optometrist ksa', 3),
        ('new clinic', 2), ('новая клиника', 2), ('tartu', 2),
        ('20 years', 2), ('20 лет', 2), ('principles', 2),
        ('opened', 1), ('открыли', 2),
        ('ksa supports', 2), ('ksa поддерживает', 2), ('sponsor', 2),
        ('20 questions', 2), ('20 küsimust', 2),
        ('meet', 2), ('meet laura', 2), ('знакомьтесь', 2),
        ('55,000', 2), ('55000', 2),
    ]),

    # tehnoloogia — technology of laser/procedure
    ('tehnoloogia', [
        ('technology', 3), ('технология', 3), ('tehnoloogia', 3),
        ('laser technology', 3), ('лазерная технология', 3),
        ('bladeless', 3), ('flapless', 3), ('no incision', 2),
        ('artificial retina', 3), ('искусственная сетчатка', 3),
        ('implant', 2), ('имплант', 2),
        ('AR glasses', 3), ('дополненная реальность', 2), ('augmented reality', 2),
        ('monocular', 2), ('монокулярный', 2), ('3D depth', 2),
        ('camera', 2), ('камера', 2), ('compound eye', 2), ('insect', 1),
        ('innovation', 2), ('инновация', 2),
        ('alpha ims', 3), ('retinal implant', 3),
        ('excimer', 2), ('эксимерный', 2),
        ('laser system', 2), ('лазерная система', 2),
        ('digital', 1),
    ]),
]

# Minimum scores to be included
MIN_SCORE = 2


def extract_frontmatter(content: str):
    """Return (frontmatter_str, body_str) or (None, content)."""
    m = re.match(r'^---\n(.*?)\n---\n?(.*)', content, re.DOTALL)
    if m:
        return m.group(1), m.group(2)
    return None, content


def get_lang(fm: str) -> str:
    m = re.search(r'^lang:\s*["\']?(\w+)["\']?', fm, re.MULTILINE)
    return m.group(1) if m else 'unknown'


def get_field(fm: str, field: str) -> str:
    """Extract a simple single-line frontmatter field value."""
    m = re.search(rf'^{field}:\s*["\']?(.*?)["\']?\s*$', fm, re.MULTILINE)
    if m:
        return m.group(1).strip().strip('"\'')
    return ''


def get_multiline_field(fm: str, field: str) -> str:
    """Extract a multiline string field (excerpt etc.) handling >- and block scalars."""
    m = re.search(rf'^{field}:\s*(.*?)(?=^\w|\Z)', fm, re.MULTILINE | re.DOTALL)
    if m:
        val = m.group(1).strip()
        # Strip YAML block scalars
        val = re.sub(r'^[>|]-?\s*', '', val)
        return val[:200]
    return ''


def is_uncategorized(fm: str) -> bool:
    """Return True if the categories field has no actual items."""
    m = re.search(r'^categories:(.*?)(?=^\w|\Z)', fm, re.MULTILINE | re.DOTALL)
    if not m:
        return True  # field missing entirely

    cat_block = m.group(1)

    # Check for block list items:  "- something"
    if re.search(r'^\s*-\s+\S', cat_block, re.MULTILINE):
        return False

    # Check for inline non-empty list: ["something"]  (not [] or [""])
    if re.search(r'\[\s*"[^"]+"\s*', cat_block):
        return False

    return True


def score_categories(text: str) -> list:
    """Return list of (slug, score) sorted descending, filtered to MIN_SCORE."""
    text_lower = text.lower()
    scores = {}
    for slug, keywords in SCORING_RULES:
        total = 0
        for kw, weight in keywords:
            if kw.lower() in text_lower:
                total += weight
        if total >= MIN_SCORE:
            scores[slug] = total

    sorted_scores = sorted(scores.items(), key=lambda x: x[1], reverse=True)
    return sorted_scores


def pick_categories(slug: str, title: str, excerpt: str, body_snippet: str) -> list:
    """
    Determine 2-3 best category slugs for a post.
    Returns a list of 2-3 category slugs.
    """
    combined = f"{title} {excerpt} {body_snippet}"
    scored = score_categories(combined)

    if not scored:
        # Fallback: at least silmad-ja-tervis + huvitavad-faktid for unknown
        return ['silmad-ja-tervis', 'huvitavad-faktid']

    # Take top categories, cap at 3
    chosen = [s for s, _ in scored[:3]]

    # Ensure minimum 2 categories
    if len(chosen) < 2:
        # Add second best non-overlapping category from context
        fallback_candidates = ['silmad-ja-tervis', 'nagemise-korrigeerimine',
                                'silmade-tervis-nipid', 'huvitavad-faktid', 'elustiil']
        for fb in fallback_candidates:
            if fb not in chosen:
                chosen.append(fb)
                break

    return chosen[:3]


def build_categories_block(cats: list) -> str:
    """Build YAML block list string for categories."""
    lines = ['categories:']
    for cat in cats:
        lines.append(f'  - {cat}')
    return '\n'.join(lines)


def replace_categories_in_frontmatter(fm: str, cats: list) -> str:
    """
    Replace the categories: line (and any following items or inline list)
    with the new YAML block list.
    """
    new_block = build_categories_block(cats)

    # Pattern: match 'categories:' followed by inline list or block items or empty
    # We need to capture the entire categories section
    pattern = re.compile(
        r'^(categories:)([^\n]*)(\n(?:[ \t]+-[^\n]*\n?)*)',
        re.MULTILINE
    )

    m = pattern.search(fm)
    if m:
        # Replace the whole match with the new block + trailing newline
        replacement = new_block + '\n'
        new_fm = fm[:m.start()] + replacement + fm[m.end():]
        return new_fm
    else:
        # categories field not found at all — append before tags if possible
        tags_m = re.search(r'^tags:', fm, re.MULTILINE)
        if tags_m:
            insert_pos = tags_m.start()
            return fm[:insert_pos] + new_block + '\n' + fm[insert_pos:]
        else:
            return fm + '\n' + new_block


def process_file(fpath: str, dry_run: bool) -> dict | None:
    """
    Process one file. Returns info dict if modified (or would be), else None.
    """
    with open(fpath, 'r', encoding='utf-8') as f:
        content = f.read()

    fm, body = extract_frontmatter(content)
    if fm is None:
        return None

    if not is_uncategorized(fm):
        return None

    lang = get_lang(fm)

    # Only process en and ru
    if lang not in ('en', 'ru'):
        return None

    title = get_field(fm, 'title') or get_multiline_field(fm, 'title')
    excerpt = get_field(fm, 'excerpt') or get_multiline_field(fm, 'excerpt')
    body_snippet = body.strip()[:400]

    cats = pick_categories(os.path.basename(fpath), title, excerpt, body_snippet)

    if not dry_run:
        new_fm = replace_categories_in_frontmatter(fm, cats)
        new_content = f'---\n{new_fm}\n---\n{body}'
        with open(fpath, 'w', encoding='utf-8') as f:
            f.write(new_content)

    return {
        'file': os.path.basename(fpath),
        'title': title,
        'lang': lang,
        'categories': cats,
    }


def main():
    parser = argparse.ArgumentParser(description='Categorize uncategorized KSA blog posts.')
    parser.add_argument('--dry-run', action='store_true',
                        help='Show what would be changed without writing files.')
    args = parser.parse_args()

    posts_dir = os.path.abspath(POSTS_DIR)
    if not os.path.isdir(posts_dir):
        print(f'ERROR: posts directory not found: {posts_dir}', file=sys.stderr)
        sys.exit(1)

    mdx_files = sorted(
        [os.path.join(posts_dir, f) for f in os.listdir(posts_dir) if f.endswith('.mdx')]
    )

    mode = 'DRY RUN' if args.dry_run else 'WRITING'
    print(f'\n=== categorize-uncategorized.py [{mode}] ===')
    print(f'Posts dir: {posts_dir}')
    print(f'Total .mdx files: {len(mdx_files)}\n')

    changed = []
    skipped = 0

    for fpath in mdx_files:
        result = process_file(fpath, dry_run=args.dry_run)
        if result:
            changed.append(result)
            cats_str = ', '.join(result['categories'])
            action = 'WOULD SET' if args.dry_run else 'SET'
            print(f"[{result['lang'].upper()}] {action}: {result['title'][:60]}")
            for cat in result['categories']:
                print(f"        - {cat}")
        else:
            skipped += 1

    print(f'\n=== Summary ===')
    print(f'Posts modified: {len(changed)}')
    print(f'Posts skipped (already categorized or ET): {skipped}')

    if args.dry_run:
        print('\nRe-run without --dry-run to apply changes.')

    return changed


if __name__ == '__main__':
    main()
