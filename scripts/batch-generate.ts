/**
 * batch-generate.ts
 * Generates a batch of KSA blog posts from a predefined topic list.
 * Posts are dated across March 2026 for natural look in the archive.
 *
 * Usage:
 *   npm run batch -- --lang ru          # Generate all RU topics
 *   npm run batch -- --lang en          # Generate all EN topics
 *   npm run batch -- --lang ru --dry-run
 *   npm run batch -- --topic 3          # Generate only topic #3
 */

import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { KSA_MASTER_PROMPT, LANG_SEO_KEYWORDS } from "../lib/master-prompt";

// Load .env.local
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
}

const args = process.argv.slice(2);
const DRY_RUN = args.includes("--dry-run");
const LANG = (() => { const i = args.indexOf("--lang"); return i >= 0 ? args[i + 1] : "ru"; })();
const TOPIC_INDEX = (() => { const i = args.indexOf("--topic"); return i >= 0 ? parseInt(args[i + 1]) - 1 : null; })();

const DRAFTS_ROOT = path.join(process.cwd(), "content/drafts");

// ── Topics per language ────────────────────────────────────────────────────────

const RU_TOPICS: Array<{ brief: string; date: string }> = [
  {
    date: "2026-03-01",
    brief: `
Тема: Мифы о лазерной коррекции зрения — развенчиваем самые частые страхи.
Аудитория: люди, которые хотят избавиться от очков или линз, но боятся операции.
Мифы для разбора:
1. "Лазер может попасть в мозг" — нет, лазер работает только на поверхности роговицы, глубина воздействия < 0.2 мм
2. "Если моргнуть во время операции — конец" — веко фиксируется, моргать невозможно
3. "После 40 делать бессмысленно" — Flow3 делаем в том числе людям 40-50+, просто уточняем ожидания
4. "Результат держится 5-10 лет, потом деградирует" — корнеальная ткань, которую убрали, не вырастает обратно. Зрение стабильно.
5. "Больно" — Flow3 проводится под каплями-анестезией, пациенты описывают давление, не боль
KSA контекст: 55 000+ процедур, Flow3 — наш основной метод, фепп нет
medicalReview: false — это образовательная статья, не клинические данные
CTA: kiirtest-inline
    `,
  },
  {
    date: "2026-03-03",
    brief: `
Тема: Первая неделя после лазерной операции Flow3 — день за днём.
Аудитория: люди, которые уже решились или почти решились, хотят знать чего ждать.
Структура по дням:
День 1 (день операции): затуманенное зрение нормально, отдыхаем, тёмные очки
День 2-3: зрение начинает проясняться, небольшой дискомфорт как "песок в глазах"
День 4-5: большинство уже читает телефон без очков
День 6-7: возвращение к работе за компьютером, вождению (после осмотра у врача)
Что нельзя в первую неделю: плавание, контактный спорт, тереть глаза, косметика вокруг глаз
Капли: антибиотик + противовоспалительный + увлажняющие (расписание примерно 4 раза в день)
Общий тон: поддерживающий, как письмо другу после операции
KSA: Flow3 — поверхностный метод, поэтому восстановление 5-7 дней типично
medicalReview: false — общее описание опыта, не клинические данные о дозах
CTA: kiirtest-inline
    `,
  },
  {
    date: "2026-03-05",
    brief: `
Тема: Близорукость у детей — когда начинать беспокоиться и что делать.
Аудитория: родители детей 8-16 лет, чьи дети носят очки или жалуются на зрение.
Ключевые моменты:
- Миопия у детей растёт с каждым поколением — причина: меньше времени на улице, больше экранов
- Признаки что ребёнку нужен окулист: щурится, придвигается к экрану, жалуется что не видит доску
- Что делает врач: рефракционное исследование, часто с каплями (циклоплегия) для точного измерения
- Лазер детям: нет, только с 18-20 лет когда зрение стабилизируется
- Что можно сейчас: ортокератологические линзы ночного ношения замедляют прогрессию миопии
- Главная рекомендация: минимум 2 часа на улице в день снижает риск развития миопии
KSA: мы консультируем по миопии у подростков, но лазер делаем только взрослым с стабильным зрением
medicalReview: false — общие рекомендации ВОЗ и педиатрической офтальмологии
CTA: kiirtest-soft
    `,
  },
  {
    date: "2026-03-07",
    brief: `
Тема: ИКБ линзы — когда лазер не подходит, а видеть хорошо всё равно хочется.
Аудитория: люди с высокой степенью близорукости (-7 и выше) или тонкой роговицей, которым сказали "лазер нельзя".
Объяснить:
- Что такое ИКБ (ICB — интраокулярная коллямерная биосовместимая линза): маленькая линза вставляется между радужкой и хрусталиком, хрусталик остаётся нетронутым
- Кому подходит: высокая близорукость, тонкая роговица, сухой глаз (который мешает лазеру)
- Отличие от катарактной операции: при ИКБ родной хрусталик остаётся
- Процедура: 10-15 минут, местная анестезия, амбулаторно
- Восстановление: 1-2 дня для базовых активностей, полная стабилизация 2-4 недели
- "А что потом?" — линза остаётся навсегда, но при необходимости извлекается
KSA: мы делаем и Flow3 и ICB — выбираем метод после полной диагностики
medicalReview: false
CTA: kiirtest-inline
    `,
  },
  {
    date: "2026-03-10",
    brief: `
Тема: Синдром сухого глаза — почему он случается и 7 вещей которые реально помогают.
Аудитория: люди, которые страдают от жжения, покраснения, ощущения "песка" в глазах.
Причины:
- Экраны: при смотрении на экран мы моргаем в 3-4 раза реже чем обычно
- Кондиционированный воздух зимой и летом
- Контактные линзы (особенно ношение дольше рекомендованного)
- Некоторые лекарства (антигистаминные, антидепрессанты)
7 советов:
1. Правило 20-20-20 (каждые 20 минут — 20 секунд смотреть на что-то в 20 метрах)
2. Увлажнители воздуха дома и в офисе
3. Капли-заменители слезы без консервантов (в разовых флаконах)
4. Тёплые компрессы на веки 5 минут вечером (помогает секреции мейбомиевых желез)
5. Омега-3 жирные кислоты (рыбий жир) — доказанная эффективность
6. Пить достаточно воды
7. Если носите линзы — соблюдайте рекомендованный режим
KSA: синдром сухого глаза — одна из причин почему не все могут делать лазер. Поэтому наша диагностика включает проверку слёзной плёнки.
medicalReview: false
CTA: kiirtest-soft
    `,
  },
  {
    date: "2026-03-12",
    brief: `
Тема: Очки против операции — честное сравнение для тех, кто не может решиться.
Аудитория: люди 25-45 лет, которые носят очки/линзы много лет и думают "а вдруг..."
Структура — честные плюсы и минусы:
ОЧКИ: привычно, недорого в краткосрочной перспективе, но: ограничения в спорте, туман на улице зимой, стоимость за 10-20 лет (новые линзы, оправы) немалая
КОНТАКТНЫЕ ЛИНЗЫ: удобнее очков, но: риск инфекций, синдром сухого глаза, нельзя спать, постоянные расходы
ОПЕРАЦИЯ FLOW3: единоразовая, результат постоянный, но: не всем подходит, есть период восстановления
Честная экономика: если носишь линзы 15 лет — суммарная стоимость vs операция. Сделать расчёт.
Главное послание: это не "очки плохо, операция хорошо". Это выбор образа жизни. Мы помогаем выбрать правильно.
medicalReview: false
CTA: kiirtest-inline
    `,
  },
  {
    date: "2026-03-14",
    brief: `
Тема: Что происходит во время лазерной операции Flow3 — пошаговое описание для тех, кто боится неизвестности.
Аудитория: люди, которые решились или почти решились, но хотят знать каждый шаг.
Шаги:
1. Приход в клинику, финальная проверка параметров роговицы
2. Вход в операционную — стерильно, тихо, музыка если хочешь
3. Укладываешься под лазерный аппарат
4. Капли-анестезия — через 30 секунд глаз не чувствует
5. Специальный инструмент мягко фиксирует веко (не больно — просто непривычно)
6. Лазер работает 20-40 секунд на глаз — видишь мигающую точку
7. Врач накладывает защитную линзу-"повязку" (как мягкая контактная линза)
8. Встаёшь, уже видишь лучше — но нечётко, это нормально
Весь процесс: ~15 минут для обоих глаз
"Мне было страшно, а оказалось... спокойно и даже интересно" — типичный отзыв
KSA: более 55 000 процедур. Страх — нормально. Мы объясняем каждый шаг заранее.
medicalReview: false
CTA: kiirtest-inline
    `,
  },
  {
    date: "2026-03-17",
    brief: `
Тема: Катаракта — что это, когда идти к врачу и что ждать от операции.
Аудитория: люди 50+ и их взрослые дети, которые замечают ухудшение зрения у близких.
Объяснение: катаракта (помутнение хрусталика) — нормальная часть старения. Не болезнь, которую ты "поймал", а процесс. Симптомы: всё становится матовым, как смотреть через запотевшее стекло; яркий свет слепит больше; ночное зрение хуже; очки часто менять.
Когда идти: когда качество жизни снижается. Не нужно ждать "пока совсем не ослепну".
Операция: удаляют помутневший хрусталик, вставляют искусственный (ИОЛ — интраокулярная линза). 15-20 минут. Один глаз за раз.
KSA: мы проводим диагностику и можем направить на катарактальную операцию. Flow3 и ICB — для других ситуаций (когда хрусталик ещё здоров).
medicalReview: false — это общеизвестные факты офтальмологии
CTA: kiirtest-soft
    `,
  },
  {
    date: "2026-03-20",
    brief: `
Тема: Экраны и зрение — правда и мифы о том, как смартфоны влияют на глаза.
Аудитория: все, кто проводит за экранами 6-10+ часов в день (то есть почти все).
Мифы для разбора:
МИФ: "Экраны разрушают зрение навсегда" — РЕАЛЬНОСТЬ: экраны вызывают усталость и сухость, но не необратимо портят зрение
МИФ: "Синий свет от экрана главная проблема" — РЕАЛЬНОСТЬ: главная проблема — не синий свет, а редкое моргание и длительное сфокусированное смотрение вблизи
МИФ: "Очки с синим фильтром решат проблему" — РЕАЛЬНОСТЬ: доказательств их эффективности немного, важнее делать перерывы
Реальные советы: правило 20-20-20, ночной режим на экране (тепловая температура), расстояние до экрана (минимум вытянутая рука)
Связь с миопией: рост времени за экранами коррелирует с ростом близорукости среди молодёжи — но причина скорее не сам экран, а меньше времени на улице
medicalReview: false
CTA: kiirtest-soft
    `,
  },
  {
    date: "2026-03-24",
    brief: `
Тема: Глаукома — тихая угроза зрению, о которой мало говорят.
Аудитория: взрослые 40+, особенно если есть семейная история, диабет или повышенное давление.
Объяснение: глаукома (повреждение зрительного нерва обычно из-за повышенного внутриглазного давления) опасна тем, что на начальных стадиях не болит и почти незаметна. Периферическое зрение уходит первым — человек замечает когда уже поздно.
Факторы риска: возраст 40+, семейная история, диабет, высокое артериальное давление, African или Latino происхождение
Профилактика = диагностика: тонометрия (измерение внутриглазного давления) — быстро и безболезненно. Проверяйте раз в год если 40+.
Лечение: капли снижающие давление, лазер, операция — зависит от стадии
Главный посыл: если вам больше 40 — проверьте глазное давление. Просто так. Это 2 минуты.
KSA: мы включаем тонометрию в нашу диагностику
medicalReview: false — это общеизвестная клиническая информация из guidelines
CTA: kiirtest-soft
    `,
  },
];

const EN_TOPICS: Array<{ brief: string; date: string }> = [
  {
    date: "2026-03-02",
    brief: `
Topic: Flow3 laser surgery — what makes it different from LASIK and why KSA chose it.
Audience: English-speaking expats and international patients researching laser eye surgery in Estonia.
Key points:
- LASIK creates a flap in the cornea. Flow3 (surface ablation, similar to LASEK/PRK) doesn't. No flap = no flap-related risks.
- Flow3 is safer for people who play contact sports, swim, do martial arts — no risk of flap displacement
- Slightly longer recovery than LASIK (7 days vs 1-2 days) but the endpoint is the same
- Ideal for people with thinner corneas where LASIK might not have enough tissue
- KSA context: 55,000+ procedures, Dr. Ants Haavel, Tallinn, Estonia
- "We don't do LASIK — we believe Flow3 gives a safer long-term result"
- Cost context: often significantly cheaper than UK/Finland for same quality
medicalReview: false
CTA: kiirtest-inline
    `,
  },
  {
    date: "2026-03-04",
    brief: `
Topic: An honest guide to laser eye surgery costs — what you actually pay and why Estonia is worth considering.
Audience: British expats and medical tourists comparing options.
Key points:
- UK typical cost: £2,000-£4,000 per eye
- Estonia (KSA) cost: significantly lower for same standard of care
- What's included: pre-op assessment, the procedure, post-op follow-ups
- Hidden costs to ask about everywhere: enhancement surgery if needed, post-op drops
- KSA: we include the full package — no surprise add-ons
- Quality: EU-regulated, same equipment (SCHWIND, Zeiss) as top UK/Finnish clinics
- Practical info: flights Tallinn from Helsinki/Stockholm/London, accommodation
- "Shouldn't I just go to the clinic with the flashiest marketing?" — not necessarily
medicalReview: false
CTA: kiirtest-inline
    `,
  },
  {
    date: "2026-03-06",
    brief: `
Topic: Dry eye syndrome — why expats in Northern Europe get it more and what actually helps.
Audience: English-speaking people living in Estonia/Baltic States, dealing with sore, irritated eyes.
Key points:
- Estonia's climate: cold dry winters, air conditioning in summer, sudden changes — perfect conditions for dry eye
- Screen time at work + reduced blinking = tear film disruption
- Symptoms: burning, grittiness, occasional blurred vision that clears with blinking, redness
- Medical term: keratoconjunctivitis sicca (dry eye disease)
- What actually works vs. what's overhyped:
  WORKS: preservative-free drops (single-use vials), warm eyelid compresses, omega-3 supplements, humidifiers
  OVERHYPED: most "blue light glasses" have weak evidence
- When to see a specialist: if drops 3-4 times a day aren't enough
- KSA connection: dry eye affects eligibility for laser surgery — we assess tear film in our full diagnostic
medicalReview: false
CTA: kiirtest-soft
    `,
  },
  {
    date: "2026-03-09",
    brief: `
Topic: ICB lens implantation — the option when laser surgery isn't right for you.
Audience: People who've been told they can't have laser surgery and are looking at alternatives.
Key points:
- ICB (Intraocular Collamer/Phakic Lens): a small lens inserted between the iris and natural lens — your own lens stays
- Different from cataract surgery (which replaces the natural lens)
- Who it suits: high prescriptions (beyond laser range), thin corneas, severe dry eyes
- The procedure: 10-15 minutes per eye, local anaesthetic drops, no general anaesthetic
- Recovery: most patients see clearly within 24-48 hours; full stabilisation 2-4 weeks
- Reversible: the lens can be removed if needed (though results are typically permanent and patients don't want it removed)
- KSA: we assess every patient individually — some suit Flow3, some ICB, some neither. We tell you honestly.
medicalReview: false
CTA: kiirtest-inline
    `,
  },
  {
    date: "2026-03-11",
    brief: `
Topic: Short-sightedness (myopia) in teenagers — a guide for parents living abroad.
Audience: English-speaking parents of teenagers in Estonia or Baltic States.
Key points:
- Myopia epidemic: globally growing, especially in urban children who spend less time outdoors
- Signs your teen needs an eye test: squinting, sitting closer to TV/screen, headaches after school
- The outdoor connection: 2 hours of outdoor daylight per day significantly slows myopia progression (peer-reviewed research)
- Orthokeratology (night contact lenses): one of the best tools to slow myopia in children, worn at night, removed in morning — child sees clearly all day
- Laser surgery: only from age 18-20 when prescription has been stable for 2 years
- Finding English-speaking eye care in Tallinn: KSA offers consultations in English, Russian, and Estonian
medicalReview: false
CTA: kiirtest-soft
    `,
  },
  {
    date: "2026-03-13",
    brief: `
Topic: 5 things no one tells you before laser eye surgery — from patients who've had it done.
Audience: People who've decided to have surgery but want to know the real experience, not the brochure.
Key points (honest, not scaremongering):
1. The procedure room is quieter and calmer than you imagine
2. You won't feel pain — you'll feel pressure. It's different.
3. Your vision will be worse before it gets better (especially first 48 hours with Flow3)
4. The eye drops schedule is a bit annoying but important
5. The moment you first wake up and see the ceiling clearly — that's unexpectedly emotional
Patient voice: write from a perspective of "I wish someone had told me..."
KSA: we prepare every patient with a detailed explanation before surgery. No surprises.
medicalReview: false
CTA: kiirtest-inline
    `,
  },
  {
    date: "2026-03-16",
    brief: `
Topic: Screen time and your eyes — separating fact from fear.
Audience: Working professionals, parents, anyone spending 8+ hours on screens daily.
Key points:
MYTH: screens permanently damage your eyes — FACT: no strong evidence of permanent harm, but significant discomfort and fatigue
MYTH: blue light glasses are essential — FACT: the main problem is reduced blinking (from 15/min to 5/min when focused on screen), not blue light
MYTH: children's eyes are more vulnerable to screen damage — FACT: the real concern is myopia development from lack of outdoor time
What actually matters:
- The 20-20-20 rule (every 20 minutes, look at something 20 feet away for 20 seconds)
- Blink more consciously (sounds silly, works)
- Screen brightness matched to ambient light
- Regular outdoor time for children
KSA connection: digital eye strain is one of the most common reasons people come to us — often we just need to explain these habits
medicalReview: false
CTA: kiirtest-soft
    `,
  },
  {
    date: "2026-03-19",
    brief: `
Topic: Glasses vs contact lenses vs surgery — an honest comparison for people fed up with corrective eyewear.
Audience: People aged 25-45 considering their options, maybe for the first time seriously.
Structure: pros and cons of each, honest and balanced
GLASSES: safe, no infection risk, fashion accessory for some — but: fog up, fall off, limit sports, cost adds up over time
CONTACT LENSES: invisible, great for sports — but: infection risk if misused, dry eye, can't sleep in most, ongoing cost
LASER SURGERY (Flow3): one-time, permanent — but: requires suitable cornea, 1 week recovery, not for everyone
The honest maths: lifetime cost of lenses vs surgery — calculate over 15 years
The lifestyle question: surgery isn't about vanity. It's about freedom. Waking up and seeing the ceiling. Swimming without squinting.
medicalReview: false
CTA: kiirtest-inline
    `,
  },
  {
    date: "2026-03-22",
    brief: `
Topic: Age and laser eye surgery — can you have it at 40, 50, or beyond?
Audience: People over 40 who've been putting it off, thinking "I'm too old now".
Key points:
- Lower age limit: 18-20 (stable prescription needed). No upper age limit per se.
- What changes at 40: presbyopia (age-related loss of reading focus) develops. Laser corrects distance vision but doesn't fix presbyopia.
- Monovision option: correct one eye for distance, one for reading — some people adapt well
- At 55+: cataract risk increases — worth checking before doing laser
- KSA's approach: full assessment, honest conversation about what to expect at your age
- "I wish I'd done this 10 years ago" — we hear this regularly from patients in their 40s and 50s
KSA: we assess patients of all ages — the conversation is always about realistic expectations
medicalReview: false
CTA: kiirtest-inline
    `,
  },
  {
    date: "2026-03-25",
    brief: `
Topic: Glaucoma — the silent thief of sight and why regular check-ups matter.
Audience: Adults 40+, especially those with family history, diabetes or hypertension.
Key points:
- Glaucoma (damage to the optic nerve, usually from raised intraocular pressure): often has no symptoms until significant vision loss
- Peripheral vision goes first — like someone slowly narrowing your field of view
- Risk factors: age over 40, family history, myopia, diabetes, raised blood pressure, certain ethnic backgrounds
- The test: tonometry (measuring eye pressure) takes 2 minutes and is painless. Should be done annually from age 40.
- Treatment: eye drops to lower pressure, laser, surgery depending on severity — all much more effective when caught early
- The message: glaucoma is manageable if found early. Undetected, it's the second leading cause of blindness worldwide.
- KSA: we include pressure testing in our full eye assessment
medicalReview: false — established ophthalmology guidelines, no specific dosages
CTA: kiirtest-soft
    `,
  },
];

// ── Prompt builder ─────────────────────────────────────────────────────────────

function buildPrompt(brief: string, lang: string): string {
  const langLabel = lang === "et" ? "Estonian" : lang === "ru" ? "Russian" : "English";
  const keywords = LANG_SEO_KEYWORDS[lang]?.join(", ") ?? "";

  return `${KSA_MASTER_PROMPT}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOUR TASK — WRITE FROM BRIEF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

The editor has given you the following brief. Develop it into a full,
polished KSA blog post in ${langLabel}.

BRIEF:
───────
${brief}
───────

Language: ${langLabel}
SEO keywords to weave in naturally (1-2 per 300 words, never awkward):
${keywords}

Return ONLY a valid JSON object (no markdown fences, no text before or after):
{
  "title": "Compelling title max 60 chars — primary keyword near the start",
  "slug": "url-kebab-slug-max-60-chars",
  "excerpt": "Engaging meta description 150-180 chars — benefit + keyword",
  "categories": ["Primary Category", "Secondary Category"],
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "ctaType": "kiirtest-inline or kiirtest-soft or none",
  "medicalReview": false,
  "seoTitle": "SEO title max 60 chars",
  "seoExcerpt": "Meta description 120-155 chars",
  "llmSearchQueries": [
    "Natural question 1 this post answers (in ${langLabel})",
    "Natural question 2",
    "Natural question 3",
    "Natural question 4",
    "Natural question 5"
  ],
  "faqItems": [
    {"q": "FAQ question 1 (in ${langLabel})", "a": "Clear 2-3 sentence answer"},
    {"q": "FAQ question 2", "a": "Answer"},
    {"q": "FAQ question 3", "a": "Answer"}
  ],
  "content": "Full ${langLabel} article body in markdown (750-1100 words). Rules:\\n- Hook immediately — NO 'In this article...'\\n- ## H2 headings every 200-300 words\\n- Short paragraphs (2-4 sentences max)\\n- Medical terms with plain language translation on first use\\n- 1-2 natural links to ksa.ee\\n- Do NOT include H1 or FAQ section\\n- End with an empowering close, not a sales pitch"
}`;
}

// ── File builder ───────────────────────────────────────────────────────────────

function buildMdxFile(post: Record<string, unknown>, lang: string, brief: string, date: string): string {
  const now = new Date().toISOString();
  const faqItems = (post.faqItems as { q: string; a: string }[]) ?? [];
  const faqSection = faqItems.length > 0
    ? `\n\n## ${lang === "ru" ? "Часто задаваемые вопросы" : lang === "en" ? "Frequently Asked Questions" : "Korduma kippuvad küsimused"}\n\n` +
      faqItems.map((f) => `**${f.q}**\n\n${f.a}`).join("\n\n")
    : "";

  const y = (s: string) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, " ").trim()}"`;
  const yamlList = (arr: string[]) => arr.map((s) => `  - ${y(s)}`).join("\n");
  const cats = post.categories as string[];
  const tags = post.tags as string[];

  return `---
title: ${y(post.title as string)}
slug: ${y(post.slug as string)}
date: ${y(date)}
author: "KSA Silmakeskus"
categories: [${cats.map((c) => `"${c.replace(/"/g, '\\"')}"`).join(", ")}]
tags: [${tags.map((t) => `"${t.replace(/"/g, '\\"')}"`).join(", ")}]
excerpt: ${y(post.excerpt as string)}
featuredImage: ""
lang: "${lang}"
ctaType: "${post.ctaType}"
medicalReview: ${post.medicalReview}
status: "draft"
seoTitle: ${y(post.seoTitle as string)}
seoExcerpt: ${y(post.seoExcerpt as string)}
llmSearchQueries:
${yamlList((post.llmSearchQueries as string[]) ?? [])}
briefSummary: ${y(brief.slice(0, 200))}
generatedAt: "${now}"
---

${(post.content as string).trim()}${faqSection}
`;
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const topics = LANG === "ru" ? RU_TOPICS : EN_TOPICS;
  const selectedTopics = TOPIC_INDEX !== null ? [topics[TOPIC_INDEX]] : topics;

  console.log(`\n🚀 KSA Batch Generator — ${LANG.toUpperCase()} — ${selectedTopics.length} articles`);
  console.log(`   Model: claude-opus-4-6 | Dry run: ${DRY_RUN}`);
  console.log("━".repeat(60));

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY not set");
    process.exit(1);
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const draftsDir = path.join(DRAFTS_ROOT, LANG);

  if (!DRY_RUN) {
    fs.mkdirSync(draftsDir, { recursive: true });
  }

  let success = 0;
  let failed = 0;

  for (let i = 0; i < selectedTopics.length; i++) {
    const { brief, date } = selectedTopics[i];
    const topicNum = TOPIC_INDEX !== null ? (TOPIC_INDEX + 1) : (i + 1);
    console.log(`\n[${topicNum}/${topics.length}] ${date} — generating…`);

    try {
      const prompt = buildPrompt(brief.trim(), LANG);

      if (DRY_RUN) {
        console.log("  📋 DRY RUN — would call Claude with prompt length:", prompt.length);
        console.log("  Brief preview:", brief.trim().slice(0, 100) + "…");
        success++;
        continue;
      }

      const response = await client.messages.create({
        model: "claude-opus-4-6",
        max_tokens: 4500,
        messages: [{ role: "user", content: prompt }],
      });

      const text = (response.content[0] as { text: string }).text.trim();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON in response");

      const post = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
      const slug = (post.slug as string).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
      let filename = `${date}-${slug}.mdx`;

      let counter = 1;
      while (fs.existsSync(path.join(draftsDir, filename))) {
        filename = `${date}-${slug}-${counter++}.mdx`;
      }

      const mdx = buildMdxFile(post, LANG, brief, date);
      fs.writeFileSync(path.join(draftsDir, filename), mdx, "utf-8");

      console.log(`  ✅ ${filename}`);
      console.log(`     "${post.title}"`);
      success++;

      // Pause between calls to avoid rate limits
      if (i < selectedTopics.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }
    } catch (err) {
      console.error(`  ❌ Error:`, (err as Error).message);
      failed++;
    }
  }

  console.log("\n" + "━".repeat(60));
  console.log(`✅ Done: ${success} generated, ${failed} failed`);
  console.log(`📁 Drafts saved to: content/drafts/${LANG}/`);
  console.log(`   Open admin to review: http://localhost:3002/admin`);
}

main().catch(console.error);
