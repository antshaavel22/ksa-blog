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
      et: "Dr. Ants Haavel on silmaarst ja KSA Silmakeskuse asutaja, kellel on üle 25 aasta kliinilist kogemust. Ta on läbi viinud üle 55 000 silmaoperatsiooni, sh laserkorrektsioon (Flow3), ICB-läätse implantatsioon ja kataraktioperatsioon. Dr. Haavel on Eesti üks tunnustatumaid refraktiivsele kirurgiale spetsialiseerunud silmaarste. Ta on regulaarne ettekandja rahvusvahelistel silmaarstide konverentsidel ning järgib oma töös tõenduspõhise meditsiini põhimõtteid. Kõik KSA blogi meditsiinilised väited on tema poolt üle vaadatud.",
      ru: "Доктор Антс Хаавел — офтальмолог и основатель KSA Silmakeskus с более чем 25-летним клиническим опытом. Он провёл свыше 55 000 глазных операций, включая лазерную коррекцию (Flow3), имплантацию линзы ICB и операции по удалению катаракты. Доктор Хаавел является одним из наиболее признанных специалистов по рефракционной хирургии в Эстонии. Он регулярно выступает на международных офтальмологических конференциях и руководствуется принципами доказательной медицины. Все медицинские утверждения в блоге KSA проверены им лично.",
      en: "Dr. Ants Haavel is an ophthalmologist and founder of KSA Vision Clinic with over 25 years of clinical experience. He has performed more than 55,000 eye procedures, including Flow3 laser correction, ICB lens implantation, and cataract surgery. Dr. Haavel is one of Estonia's most recognised refractive surgery specialists. He regularly presents at international ophthalmology conferences and practises evidence-based medicine. All medical claims on the KSA blog are reviewed and approved by him.",
    },
    profileUrl: "https://ksa.ee/meeskond/",
    avatarUrl: "https://ksa.ee/wp-content/uploads/2024/ants-haavel.jpg",
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
    keys: ["yana", "Yana Grechits"],
    displayName: "Yana Grechits",
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
    keys: ["maigret", "Maigret Moru"],
    displayName: "Maigret Moru",
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
      et: "KSA Silmakeskuse meeskond",
      ru: "Команда KSA Silmakeskus",
      en: "KSA Vision Clinic Team",
    },
    bio: {
      et: "KSA Silmakeskus on Eesti juhtiv silmakliinik, mis on spetsialiseerunud laserkorrektsiooni, ICB-protseduuri ja silmahaiguste ravile. Meie blogi jagab ekspertteadmisi silmade tervise kohta.",
      ru: "KSA Silmakeskus — ведущая глазная клиника Эстонии, специализирующаяся на лазерной коррекции, процедуре ICB и лечении заболеваний глаз. Наш блог делится экспертными знаниями о здоровье глаз.",
      en: "KSA Vision Clinic is Estonia's leading eye clinic, specialising in laser correction, ICB procedure and eye disease treatment. Our blog shares expert knowledge about eye health.",
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
