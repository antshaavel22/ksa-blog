export interface AuthorProfile {
  /** Matches the `author` field in MDX frontmatter (may be key or full name) */
  keys: string[];
  /** Display name shown on site */
  displayName: string;
  /** URL-safe slug */
  slug: string;
  role: {
    et: string;
    ru: string;
    en: string;
  };
  credentials?: {
    et: string;
    ru: string;
    en: string;
  };
  bio: {
    et: string;
    ru: string;
    en: string;
  };
  profileUrl?: string;
  avatarUrl?: string;
}

export const AUTHORS: AuthorProfile[] = [
  {
    keys: ["antsh", "Dr. Ants Haavel"],
    displayName: "Dr. Ants Haavel",
    slug: "dr-ants-haavel",
    role: {
      et: "Silmaarst, KSA Silmakeskuse juht",
      ru: "Офтальмолог, руководитель KSA Silmakeskus",
      en: "Ophthalmologist, CEO of KSA Vision Clinic",
    },
    credentials: {
      et: "MD · Tartu Ülikool · Üle 25 aasta kogemust",
      ru: "MD · Тартуский университет · Более 25 лет опыта",
      en: "MD · University of Tartu · 25+ years of experience",
    },
    bio: {
      et: "Dr. Ants Haavel on silmaarst ja KSA Silmakeskuse asutaja, kellel on üle 25 aasta kliinilist kogemust. Ta on läbi viinud üle 55 000 silmaoperatsiooni, sh Flow3 laserkorrektsioon, kuivsilma diagnostika ja ravi ning katarakti operatsioonid. Dr. Haavel on Eesti üks tunnustatumaid refraktiivsele kirurgiale spetsialiseerunud silmaarste. Ta on regulaarne delegaat rahvusvahelistel silmaarstide konverentsidel ning järgib oma töös tõenduspõhise meditsiini põhimõtteid. Kõik KSA blogi meditsiinilised väited on tema poolt üle vaadatud.",
      ru: "Доктор Антс Хаавел — офтальмолог и основатель KSA Silmakeskus с более чем 25-летним клиническим опытом. Он провёл свыше 55 000 глазных операций, включая лазерную коррекцию Flow3, диагностику и лечение синдрома сухого глаза, а также операции по удалению катаракты. Доктор Хаавел является одним из наиболее признанных специалистов по рефракционной хирургии в Эстонии. Он регулярно выступает на международных офтальмологических конференциях и руководствуется принципами доказательной медицины. Все медицинские утверждения в блоге KSA проверены им лично.",
      en: "Dr. Ants Haavel is an ophthalmologist and founder of KSA Vision Clinic with over 25 years of clinical experience. He has performed more than 55,000 eye procedures, including Flow3 laser correction, dry eye diagnostics and treatment, and cataract surgery. Dr. Haavel is one of Estonia's most recognised refractive surgery specialists. He regularly presents at international ophthalmology conferences and practises evidence-based medicine. All medical claims on the KSA blog are reviewed and approved by him.",
    },
    profileUrl: "https://ksa.ee/meeskond/",
    avatarUrl: "/uploads/authors/ants-haavel.jpg",
  },
  {
    keys: ["karl-erik", "Dr. Karl-Erik Tillmann", "Karl-Erik Tillmann"],
    displayName: "Dr. Karl-Erik Tillmann",
    slug: "dr-karl-erik-tillmann",
    role: {
      et: "Silmaarst, KSA Silmakeskus",
      ru: "Офтальмолог, KSA Silmakeskus",
      en: "Ophthalmologist, KSA Vision Clinic",
    },
    credentials: {
      et: "MD · Tartu Ülikool",
      ru: "MD · Тартуский университет",
      en: "MD · University of Tartu",
    },
    bio: {
      et: "Dr. Karl-Erik Tillmann on KSA Silmakeskuse silmaarst, kes on spetsialiseerunud laserkorrektsiooni ja refraktiivsele kirurgiale. Ta töötab tihedas koostöös Dr. Ants Haavelega, tagades patsientidele individuaalse ja tõenduspõhise lähenemise. Dr. Tillmann osaleb regulaarselt erialastel koolitustel ja rahvusvahelistel konverentsidel, et pakkuda patsientidele parima kaasaegse meditsiini tulemusi.",
      ru: "Доктор Карл-Эрик Тиллманн — офтальмолог KSA Silmakeskus, специализирующийся на лазерной коррекции зрения и рефракционной хирургии. Он работает в тесном сотрудничестве с доктором Антсом Хаавелом, обеспечивая каждому пациенту индивидуальный и основанный на доказательствах подход. Доктор Тиллманн регулярно участвует в международных конференциях и повышении квалификации.",
      en: "Dr. Karl-Erik Tillmann is an ophthalmologist at KSA Vision Clinic specialising in laser vision correction and refractive surgery. He works in close collaboration with Dr. Ants Haavel, ensuring an individualised, evidence-based approach for every patient. Dr. Tillmann regularly attends international conferences and continuing medical education programmes.",
    },
    profileUrl: "https://ksa.ee/meeskond/",
    avatarUrl: "/uploads/authors/karl-erik-tillmann.jpg",
  },
  {
    keys: ["anita", "Anita Zuravljova", "Anita Žuravljova", "anita-zuravljova"],
    displayName: "Anita Zuravljova",
    slug: "anita-zuravljova",
    role: {
      et: "Optometrist, KSA Silmakeskus",
      ru: "Оптометрист, KSA Silmakeskus",
      en: "Optometrist, KSA Vision Clinic",
    },
    credentials: {
      et: "Optometrist · KSA Silmakeskus",
      ru: "Оптометрист · KSA Silmakeskus",
      en: "Optometrist · KSA Vision Clinic",
    },
    bio: {
      et: "Anita Zuravljova on KSA Silmakeskuse optometrist, kelle pärusmaaks on kuiva silma esmane hindamine ja igapäevase elustiili nõustamine — toitumine, ekraaniaeg, töökoha valgustus ja kontaktläätsede sobivus. Tema patsiendid alustavad sageli temaga ja, kui vaja, suunatakse seejärel sügavamale ravile dr Karl-Erik Tillmanni juurde. Anita kirjutab regulaarselt KSA blogis silmade tervise igapäevateemadel.",
      ru: "Анита Журавлёва — оптометрист KSA Silmakeskus, специализирующаяся на первичной оценке синдрома сухого глаза и консультировании по образу жизни — питание, экранное время, освещение рабочего места, подбор контактных линз. Её пациенты часто начинают именно с неё и, при необходимости, направляются к доктору Карлу-Эрику Тиллманну для углублённого лечения.",
      en: "Anita Zuravljova is an optometrist at KSA Vision Clinic specialising in initial dry eye assessment and lifestyle counselling — nutrition, screen time, workplace lighting, contact lens fit. Patients often start with her and, when needed, are referred to Dr. Karl-Erik Tillmann for deeper care.",
    },
    profileUrl: "https://ksa.ee/meeskond/",
    avatarUrl: "/uploads/authors/anita-zuravljova.jpg",
  },
  {
    keys: ["liisi", "Optometrist Liisi", "Liisi", "Liisi Mölder", "liisi-molder"],
    displayName: "Liisi Mölder",
    slug: "optometrist-liisi",
    role: {
      et: "Optometrist, KSA Silmakeskus",
      ru: "Оптометрист, KSA Silmakeskus",
      en: "Optometrist, KSA Vision Clinic",
    },
    credentials: {
      et: "Optometrist · KSA Silmakeskus",
      ru: "Оптометрист · KSA Silmakeskus",
      en: "Optometrist · KSA Vision Clinic",
    },
    bio: {
      et: "Liisi on KSA Silmakeskuse kogenud optometrist, kes tegeleb nägemise hindamise, prillide ja kontaktläätsede valikuga ning silmade tervise seirega. Ta aitab patsientidel mõista nende nägemise eripärasid ja leiab igaühele sobiva lahenduse — olgu selleks prillid, kontaktläätsed või kirurgilise korrektsiooni sobivuse hindamine. Liisi on meeskonna usaldusväärne esimene kontaktpunkt kõikidele silmanägemisega seotud küsimustele.",
      ru: "Лийси — опытный оптометрист KSA Silmakeskus, занимающийся оценкой зрения, подбором очков и контактных линз, а также мониторингом здоровья глаз. Она помогает пациентам разобраться в особенностях их зрения и подобрать подходящее решение — будь то очки, контактные линзы или оценка пригодности к хирургической коррекции. Лийси — надёжный первый контакт в команде по всем вопросам, связанным со зрением.",
      en: "Liisi is an experienced optometrist at KSA Vision Clinic, focusing on vision assessments, glasses and contact lens fitting, and eye health monitoring. She helps patients understand their unique vision needs and find the right solution — whether that's glasses, contact lenses, or an evaluation for surgical correction. Liisi is the team's trusted first point of contact for all vision-related questions.",
    },
    profileUrl: "https://ksa.ee/meeskond/",
    avatarUrl: "/uploads/authors/liisi-optometrist.jpg",
  },
  {
    keys: ["silvia", "Silvia Haavel", "Silvia Johanna Haavel"],
    displayName: "Silvia Johanna Haavel",
    slug: "silvia-johanna-haavel",
    role: {
      et: "KSA blogi toimetaja (eesti keel)",
      ru: "Редактор блога KSA (на эстонском языке)",
      en: "KSA Blog Editor (Estonian)",
    },
    bio: {
      et: "Silvia Johanna Haavel vastutab KSA blogi eestikeelse sisu eest. Ta kirjutab selgelt ja arusaadavalt silmade tervise teemadel, muutes keerulised meditsiiniteemad kõigile kättesaadavaks.",
      ru: "Силвия Йоханна Хаавел отвечает за эстоноязычный контент блога KSA. Она пишет чётко и доступно о здоровье глаз, делая сложные медицинские темы понятными для всех.",
      en: "Silvia Johanna Haavel manages the Estonian-language content of the KSA blog, writing clearly about eye health topics and making complex medical subjects accessible to everyone.",
    },
  },
  {
    keys: ["yana", "Yana Grechits", "jana", "Jana", "Jana Gretchits"],
    displayName: "Jana Gretchits",
    slug: "yana-grechits",
    role: {
      et: "KSA blogi toimetaja (vene ja inglise keel)",
      ru: "Редактор блога KSA (русский и английский языки)",
      en: "KSA Blog Editor (Russian & English)",
    },
    bio: {
      et: "Yana Grechits toimetab KSA blogi vene- ja ingliskeelset sisu, tagades täpse ja lugejasõbraliku meditsiiniteabe kättesaadavuse.",
      ru: "Яна Гречиц редактирует русско- и англоязычный контент блога KSA, обеспечивая точную и доступную медицинскую информацию для читателей.",
      en: "Yana Grechits edits the Russian and English content of the KSA blog, ensuring accurate and reader-friendly medical information.",
    },
  },
  {
    keys: ["maigret", "Maigret Moru", "Maigret Mõru"],
    displayName: "Maigret Mõru",
    slug: "maigret-moru",
    role: {
      et: "KSA Silmakeskus",
      ru: "KSA Silmakeskus",
      en: "KSA Vision Clinic",
    },
    bio: {
      et: "Maigret Moru kirjutab silmade tervise ja nägemise teemadel KSA Silmakeskuse meeskonnas.",
      ru: "Майгрет Мору пишет о здоровье глаз и зрении в команде KSA Silmakeskus.",
      en: "Maigret Moru writes about eye health and vision as part of the KSA Vision Clinic team.",
    },
  },
  {
    keys: ["ndhaldur", "KSA Silmakeskus", '"KSA Silmakeskus"'],
    displayName: "KSA Silmakeskus",
    slug: "ksa-silmakeskus",
    role: {
      et: "KSA Silmakeskus",
      ru: "KSA Silmakeskus",
      en: "KSA Vision Clinic",
    },
    bio: {
      et: "KSA Silmakeskus on Eesti juhtiv silmakliinik, mis on spetsialiseerunud Flow3 laserkorrektsioonile, kuivsilma diagnostikale ja ravile ning põhjalikele silmaläbivaatustele. Meie blogi jagab ekspertteadmisi silmade tervise kohta.",
      ru: "KSA Silmakeskus — ведущая глазная клиника Эстонии, специализирующаяся на лазерной коррекции Flow3, диагностике и лечении синдрома сухого глаза, а также на комплексных обследованиях зрения. Наш блог делится экспертными знаниями о здоровье глаз.",
      en: "KSA Vision Clinic is Estonia's leading eye clinic, specialising in Flow3 laser correction, dry eye diagnostics and treatment, and comprehensive eye examinations. Our blog shares expert knowledge about eye health.",
    },
  },
];

/** Find author profile by any key or display name */
export function getAuthorByKey(key: string): AuthorProfile | undefined {
  const normalised = key.replace(/^"|"$/g, "").trim();
  return AUTHORS.find((a) => a.keys.some((k) => k === normalised));
}

/** Find author profile by URL slug */
export function getAuthorBySlug(slug: string): AuthorProfile | undefined {
  return AUTHORS.find((a) => a.slug === slug);
}

/** Convert any author name/key to URL slug */
export function authorToSlug(key: string): string {
  const profile = getAuthorByKey(key);
  if (profile) return profile.slug;
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
