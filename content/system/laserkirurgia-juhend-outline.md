# Silmade Laserkirurgia Tarbijajuhend 2026

**KSA Silmakeskuse põhjalik teejuht laserkirurgia kaalumiseks**
*Autor: Dr. Ants Haavel · Toimetus: Silvia Johanna Haavel*

URL: `blog.ksa.ee/laserkirurgia-juhend/` (ET) · `/ru/laser-korrekciya-rukovodstvo/` (RU) · `/en/laser-eye-surgery-guide/` (EN)

---

## Mahuestimaator (uuendatud 2026-05-22 — 14 peatüki struktuur)
- **14 peatükki + eessõna** × 1500-2200 sõna = ~22,000-28,000 sõna ET versioonis
- **10 Rendia videot** (vt valikud allpool peatükkide kõrval)
- **3 keelt** (ET / RU / EN)
- **Lugemise aeg per peatükk:** 6-10 minutit
- **Kogu juhend:** ~90-120 minutit põhjaliku lugemise jaoks

## Peatükkide staatus (live tracker)

| # | Pealkiri | Slug | Sõna | Staatus |
|---|---|---|---|---|
| 0 | Eessõna | — | 600-800 | Outline |
| 1 | Kuidas silm töötab | — | 900-1100 | Outline |
| 2 | Nägemise vead | — | 1200-1500 | Outline (sisaldab presbüoopia ülevaate, sügav käsitlus ch 11) |
| **3** | **Refraktiivkirurgia ajalugu (RK → tänapäev)** | `laserkirurgia-juhend-03-refraktiivkirurgia-ajalugu` | ~1900 | ✅ Drafted 2026-05-21 |
| **4** | **Kuidas modernne laserkirurgia töötab** | `laserkirurgia-juhend-03-kuidas-laserkirurgia-tootab` (slug säilib) | ~3000 | ✅ Drafted (oli vana ch 3) |
| **5** | **Sarvkesta biomehaanika** | `laserkirurgia-juhend-05-sarvkesta-biomehaanika` | ~1700 | ✅ Drafted 2026-05-21 |
| **6** | **Levinud müüdid laserkirurgiast** | `laserkirurgia-juhend-04-levinud-muudid-laserkirurgiast` (slug säilib) | ~2200 | ✅ Drafted (oli vana ch 4) |
| **7** | **Turvalisus ja ektaasia** | `laserkirurgia-juhend-07-turvalisus-ja-ektaasia` | ~2100 | ✅ Drafted 2026-05-22 |
| **8** | **Võrkkest ja vaakum** | `laserkirurgia-juhend-08-vorkkest-ja-vaakum` | ~2000 | ✅ Drafted 2026-05-21 |
| **9** | **Diagnostika tehnoloogia** | `laserkirurgia-juhend-09-diagnostika-tehnoloogia` | ~1800 | ✅ Drafted 2026-05-22 |
| **10** | **Kas Sa oled kandidaat?** | `laserkirurgia-juhend-10-kas-sa-oled-kandidaat` | ~1700 | ✅ Drafted 2026-05-22 |
| **11** | **Presbüoopia (dedicated)** | `laserkirurgia-juhend-11-presbuoopia` | ~2200 | ✅ Drafted 2026-05-21 |
| **12** | **Kuidas valida silmakirurgi/kliinikut** | `laserkirurgia-juhend-08-kuidas-valida-silmakirurgi-ja-kliinikut` (slug säilib) | ~2400 | ✅ Drafted (oli vana ch 8) |
| **13** | **Alternatiivid (ICL, RLE, kontaktläätsed)** | `laserkirurgia-juhend-13-alternatiivid` | ~1800 | ✅ Drafted 2026-05-22 |
| **14** | **Kokkuvõte + 20 küsimust** | `laserkirurgia-juhend-14-kokkuvote` | ~1500 | ✅ Drafted 2026-05-22 |

**Total drafted: 11 / 14 peatükki** (kõik tehnilised ja USP peatükid valmis; jäänud Eessõna + Ch 1 + Ch 2 anatoomia/refraktiivvigade ülevaade).

**Sõna kokku tänase seisuga:** ~24 300 sõna.

**Slug strateegia:** vanad slug'id (Ch 4 → uus #4 transepiteliaalne, Ch 4 müüdid → uus #6, Ch 8 kirurgi valik → uus #12) **säilitatakse** SEO ja olemasolevate viidete pärast. Routing-tasandil mappimine toimub `app/laserkirurgia-juhend/[slug]/page.tsx` järjekorra-loogikas (vt _Routing_ allpool).

## Tegevuskonversiooni võimalused per peatükk
1. **Külgriba (sticky)**: "Laadi alla PDF + saa 19€ sooduskood Audit uuringule" → e-posti gate
2. **Peatüki lõpus inline**: "Tee 90-sek sobivuse hinnang" → /sobivustest
3. **Video paus**: "Tahad rääkida arstiga? Broneeri tasuta konsultatsioon" → my.ksa.ee/et
4. **Sõnastikuväljad**: kontekstuaalne mini-CTA medical-term hover'is

## Pinned at top of every chapter
- **Eelmine ⟵ peatükk** | **Sisukord** | **Järgmine peatükk ⟶**
- Progress bar (Chapter 3 of 10)
- Reading time estimate

---

# Peatükkide ülevaade

## 0. Eessõna — Miks ma selle juhendi kirjutasin
**Author voice:** Dr. Ants Haavel personal narrative
**Length:** 600-800 sõna
**Key messages:**
- 20+ aastat silmakirurgi praktikat Eestis
- "Patsiendid väärivad ausa info, mitte turundust"
- Kuidas Reinsteini juhend Londonis inspireeris (acknowledgment)
- "See juhend on selleks, et oskaks õigeid küsimusi küsida — ka teiste kliinikute juures"
- KSA väärtuseelistus läbi käte: 55,000+ protseduuri, 0 ektaasiat 20+ aastat
**Rendia video:** Optional — Dr. Ants Haavel 60-sek welcome video (kui tahad teha)
**CTA:** "Hakka peatükist 1 või vali sisukorrast"

---

## 1. Kuidas silm töötab — Anatoomia 5 minutiga
**Length:** 900-1100 sõna
**Existing blog raw material:**
- `2026-04-07-silmad-on-ehitatud-kaugust-nagema.mdx`
- `2026-05-04-nagemise-taastamine-kuidas-rakuteraapia-muudab-silmaravi-tul.mdx`
**Structure:**
- Silma 6 võtmeosa: sarvkest, lääts, võrkkest, nägemisnärv, klaaskeha, iiris
- Kuidas valgus liigub silma sisse ja muutub pildiks
- Miks "nägemine vananeb" — bioloogiline reaalsus
- Mis on dioptri ja kuidas seda mõõdetakse
**Rendia video:** "Eye Anatomy Overview" (3D animation, ~90 sekundit)
**Glossary terms introduced:** sarvkest, lääts, võrkkest, akommodatsioon, fovea
**End-of-chapter CTA:** "Saa teada, milline nägemise viga sul on — Peatükk 2 ⟶"

---

## 2. Nägemise vead: müoopia, hüperoopia, astigmaatia, presbüoopia
**Length:** 1200-1500 sõna
**Existing blog raw material:**
- `2025-01-07-teen-myopia-parents-guide-protecting-eyes.mdx`
- `2025-03-08-astigmatism-cylinder-lenses-explained.mdx`
- `2025-11-28-myopia-epidemic-causes-solutions-1.mdx`
- `aastaks-2050-voib-pool-maailma-elanikkonnast-olla-luhinagelik.mdx`
- `hupotees-luhinagelikkust-pohjustavad-rafineeritud-susivesikud-mitte-liigne-lugemine.mdx`
**Structure:**
- **Müoopia (lühinägelikkus)** — silm liiga pikk, miinusprillid kompenseerivad
  - Kui kiiresti see suureneb? Mis vanuses stabiliseerub?
  - Globaalne epideemia (50% inimkonnast aastaks 2050)
- **Hüperoopia (kaugnägelikkus)** — silm liiga lühike
- **Astigmaatia (astigmatism)** — sarvkesta ebakorrapärasus
  - Selgitada cylinder + telg
- **Presbüoopia (vanusega kaugnägelikkus)** — lääts kaotab paindlikkuse
  - Algab tavaliselt 40-45 aastaselt
  - Erineb hüperoopia'st!
**Rendia video:** "Refractive Errors Explained — Myopia, Hyperopia, Astigmatism" (animation)
**Honest note:** "Kõikidel meil tulevad need vead lõpuks. Kuidas neid lahendada — Peatükk 3 ⟶"

---

## 3. Kuidas silmade laserkirurgia töötab
**Length:** 1500-1800 sõna
**Existing blog raw material:**
- `10-suvist-fakti-flow-2-0-laserprotseduuri-kohta.mdx`
- `15-kusimust-silmade-laserprotseduuri-kohta.mdx`
- `2025-01-01-flow3-laser-eye-surgery-vs-lasik-tallinn.mdx`
- `2025-01-10-operaciya-flow3-poshagovo-chto-vas-zhdyot.mdx`
- `2025-06-23-miks-voib-kaasaegne-laseroperatsioon-olla-ohutum-kui-igapaev.mdx`
**Structure:**
- Põhiprintsiip: sarvkesta kuju muutmine = uue "läätse" loomine silma enda kudest
- **Kaks suurt perekonda: KLAPI-meetodid (flap) ja PINNA-meetodid (surface)**

### KLAPI-meetodid (flap)
- **LASIK** — sarvkesta klapp luuakse mehaanilise noaga, all olev sarvkest reshape'itakse excimer laseriga
- **Femto-LASIK** — klapp luuakse femtosekundi laseriga (nn "all-laser LASIK", iLASIK, Z-LASIK)
- **Klapi-meetodite eelis:** 24-tunnine taastumine
- **Klapi-meetodite riskid:** klapi nihkumine, epiteeli sissekasv klapi alla, sarvkesta biomehaaniline nõrgenemine (suurem ektaasia risk pikaajaliselt)

### PINNA-meetodid (surface ablation)
- **PRK (vana põlvkond)** — epiteel mehaaniliselt eemaldatud, sarvkest excimer laseriga
- **LASEK** — alkohol-põhine epiteeli eemaldus, muidu sama
- **Transepiteliaalne PRK / kõik-laser pinna-meetod** — kogu protseduur tehakse laseriga, sealhulgas epiteeli läbimine
  - **Flow3 (KSA)** — moderne kõik-laser pinna-meetod
  - **C-Ten** (iVis Suite, Itaalia) — sama tehnika perekond
  - **SmartSurface** (Schwind, Saksamaa) — sama tehnika perekond
- **Pinna-meetodite eelised:**
  - **Klapita ja lõiketa** — kõik flap-i komplikatsioonid välistatud
  - Sarvkesta biomehaaniliselt **tugevam** (laser ei läbi alustugevdust)
  - Õhukestele sarvkestadele sobiv (LASIK nõuab ≥480μm)
  - Sportlaste, sõjaväelaste, kontaktspordi jaoks parem (klapp ei saa nihkuda)
  - **Pikaajaliselt madalam ektaasia risk**
- **Pinna-meetodite trade-off:**
  - Nägemise stabiliseerumine 3-7 päeva (LASIK: 24h)
  - Kerge ebamugavus päevadel 1-3
  - Lõpptulemus 1-3 kuu pärast — identne LASIKiga

### Muud meetodid (mainime, et patsient teaks alternatiivid)
- **SMILE / ReLEx SMILE** — väikese (3mm) sisselõikega lentikulaarne meetod. KSA ei tee. Suuna teiste kliinikute poole, kui see on patsiendile õige meetod.
- **Refraktiivne läätsevahetus (RLE)** — kui sarvkest pole sobiv, vt 9. peatükk.

**Võrdlustabel:**
| Meetod | Klapp/sisselõige | Sarvkesta tugevus pärast | Taastumine | Sobib kellele |
|---|---|---|---|---|
| LASIK | Klapp (mehaaniline nuga) | Nõrgenenud (flap) | 24-48 tundi | Standardne, ei sport |
| Femto-LASIK | Klapp (laser) | Nõrgenenud (flap) | 24h | Standardne premium |
| **Flow3 (KSA pinna-meetod)** | **Ei** | **Säilinud** | **3-7 päeva** | **Õhuke sarvkest, sport, premium** |
| C-Ten / SmartSurface | Ei | Säilinud | 3-7 päeva | Sama nagu Flow3 (teised brändid) |
| SMILE | Väike sisselõige | Vahepealne | 24-48h | Kõrge dioptria |

**Rendia videod (2):**
- "LASIK Procedure Animation" — klapi-meetodi näitlikustamiseks
- "PRK / Surface Ablation Animation" — Flow3 perekonna näitlikustamiseks (kasutab silmatervis Rendia kogu)

**Aus avalikustamine:** KSA teeb Flow3 (pinna-meetod). Me ei tee LASIKit ega femto-LASIKit — sest oleme valinud pinna-meetodite tee pikaajalise turvalisuse ja sarvkesta säilimise tõttu. Kui keegi sulle ütleb, et Flow3 = femto-LASIK, see on **VALE** — see on hoopis erinev tehnika perekond.

---

## 4. Levinud müüdid laserkirurgiast — mida arstid sageli ei selgita
**Length:** 1200-1400 sõna
**Existing blog raw material:**
- `2025-09-28-laser-eye-surgery-recovery-time-safety.mdx`
- `15-most-frequently-asked-questions-about-laser-eye-procedures.mdx`
**Structure (myth → reality):**
1. **"Lähen pimedaks"** — Tegelikkus: 0 ektaasiat KSA-s 20+ aasta jooksul ja 55,000+ protseduurist. Globaalne tõsine komplikatsioon < 0.01%.
2. **"On väga valus"** — Tegelikkus: silmade anesteesia tilkadega; valu protseduuri ajal puudub; mõneks tunniks pinge.
3. **"Aja jooksul mõju kaob"** — Tegelikkus: kui dioptri oli operatsiooni eel stabiilne (≥1 aasta), siis tulemus on eluaegne. Vananemisega tulevad teised vead (presbüoopia), mis pole laserkirurgia "mõju kadumise" tunnused.
4. **"Liiga kallis"** — Vaata 20-aastast prilli/läätse kogukulu: kuni €18,000. Flow3 €2,990 = tasub end ära 3-5 aastaga.
5. **"Halod ja tuldejooned"** — Tegelikkus: 95%+ patsientidest neid ei teki; mõnel kerged paranevad 3-6 kuu jooksul.
6. **"Mu silmad on liiga kuivad"** — Tegelikkus: pärast laserkirurgiat võib mõnda aega kuivus suureneda; lahendab end 6 kuu jooksul. Eelkonsultatsioon sõelub välja inimesed, kellele see oleks tõsine risk.
7. **"Sport peab katkema"** — Tegelikkus: peaaegu mitte. Vt patsientide lood (4-7 päevaga tagasi treenimas).
**Rendia video:** None (text-heavy chapter)
**End-of-chapter CTA:** "Sukeldume nüüd turvalisusse põhjalikumalt — Peatükk 5 ⟶"

---

## 5. Turvalisus: kuidas seda mõõdetakse ja mida vältida
**Length:** 1500-1700 sõna
**Existing blog raw material:**
- `2025-06-23-miks-voib-kaasaegne-laseroperatsioon-olla-ohutum-kui-igapaev.mdx`
- `2025-03-30-contact-lens-care-guide-safety-best-practices.mdx`
**Structure:**
- **Kuidas mõõdetakse laserkirurgia ohutust?**
  - Ektaasia (sarvkesta nõrgenemine) — kõige kardetud komplikatsioon, 0% KSA-s
  - Infektsiooni risk — väiksem kui 0.1%
  - Underkorrigeerimine / overkorrigeerimine — mõõdetav, korrigeeritav
- **Mis teeb laserkirurgia ohutuks?**
  1. Põhjalik eel-diagnostika (vt Peatükk 6)
  2. Kogenud kirurg (vt Peatükk 8)
  3. Modernsed seadmed
  4. Konservatiivne kandidatuuri sõelumine — "mitte iga inimene pole sobiv"
- **KSA turvalisuse rekord** (faktid, mitte turundus):
  - 55,000+ protseduuri 20+ aasta jooksul
  - 0 ektaasiat
  - 7-aastane garantii rekursioon
  - Iga patsient näeb sama kirurgi nii enne kui pärast (mitte erinevaid arste igas kontrollis)
- **Punakad lipud teiste kliinikute juures:**
  - "Tasuta esmakonsultatsioon ostukeskuses" (pole põhjalik diagnostika)
  - Sa ei kohta kunagi seda kirurgi, kes opereerib
  - Kiired "limited time" pakkumised
  - Põhjaliku silmade tervise hindamiseta otsus
**Rendia video:** "Corneal Ectasia Explained" + "Post-LASIK Dry Eye"

---

## 6. Diagnostika tehnoloogia — miks "tasuta konsultatsioon" pole alati piisav
**Length:** 1200-1400 sõna
**Existing blog raw material:**
- (Vajab natuke uut sisu — ei ole otseseid eelnevaid postitusi)
**Structure:**
- **Mida põhjalik silmade hindamine tähendab:**
  - **Topograafia** — sarvkesta pinna täpne kaart (Pentacam, Atlas vms)
  - **Tomograafia** — sarvkesta kihiline analüüs
  - **Pahümeetria** — sarvkesta paksus (alla 480μm = LASIK ei sobi)
  - **Pupillomeetria** — pupilli läbimõõt päevasel + öösel valgustusel
  - **Lainefronti aberromeetria** — kõrgemate korraldushälvete mõõtmine
  - **Tonomeetria** — silmasisene rõhk
  - **Nägemisteravus + kontrastitundlikkus**
- **Miks see olulisem on kui tundub:**
  - Üks "tasuta konsultatsioon" 15 minuti jooksul ei suuda sõeluda välja ohu-patsiente
  - KSA standardne Audit silmauuring: 60 min, 9 testi, kirjalik raport
- **Kui kliinik EI tee neid uuringuid eel-staadiumis — punakas lipp.**
**Rendia video:** "Corneal Topography & Tomography" (technical animation)
**End-of-chapter CTA:** "Audit silmauuring KSA-s 69€ — kuidas broneerida"

---

## 7. Kas Sa oled kandidaat? Kontroll-leht enne paari tuhande euro investeeringut
**Length:** 1000-1200 sõna
**Existing blog raw material:**
- `15-kusimust-silmade-laserprotseduuri-kohta.mdx`
**Structure:**
- **Põhilised tingimused:**
  - Vanus ≥18 (mõnel kliinikul ≥21)
  - Dioptri stabiilne ≥1 aasta
  - Üldine silmade tervis (ei ole aktiivset silmahaigust)
  - Üldine tervis (mõned ravimid + autoimmuunhaigused võivad mõjutada)
- **Ajutiseid keelde:**
  - Rasedus + rinnaga toitmine (hormoonid mõjutavad sarvkesta)
  - Aktiivne kuiva silma sündroom
  - Mõned diabeedi-vormid
  - Mõned ravimid (steroidid, retinoidid)
- **Lõplikuid keelde:**
  - Sarvkest liiga õhuke (<480μm)
  - Keratokoonus või ektaasia eelsoodumus
  - Tugev presbüoopia ilma multifokaal-läätse valikuta
- **Vanusepõhised soovitused:**
  - 18-25: stabiliseerumine alles, tavaliselt oodata
  - 25-45: tüüpiline laserkirurgia "sweet spot"
  - 45-55: presbüoopia tekib — kaaluda multifokaal-läätse
  - 55+: hallkae ennetav diagnostika oluline
**Rendia video:** "Are You a Candidate for LASIK?" (criteria animation)
**End-of-chapter CTA:** "Tee 90-sek sobivuse hinnang" → /sobivustest

---

## 8. Kuidas valida kirurgi ja kliinikut — kõige tähtsam peatükk
**Length:** 1500-1800 sõna · **Strongest chapter (Reinstein-style)**
**Existing blog raw material:**
- Limited (mostly fresh content here — KSA's USP)
**Structure:**
- **Tõde Eesti seadusandlusest:**
  - Eestis ei nõuta refraktiivkirurgia eraldiseisvat sertifikaati
  - Iga oftalmoloog võib teostada laserkirurgiat
  - Praktiline kogemus erineb 100 vs 50,000+ protseduuriga
- **Küsimused, mida iga kirurgilt küsida:**
  1. Kui palju protseduure sa isiklikult oled teinud?
  2. Mis on sinu komplikatsiooni protsent?
  3. Kas ma kohtan sind enne protseduuri (mitte ainult päeval)?
  4. Kes minu järelkontrolle teeb?
  5. Milline on garantii? Kui regressioon, kas täiendav operatsioon on tasuta?
  6. Kuidas käituda, kui mul on probleem aastate pärast?
- **Kliinikuvalik:**
  - "Tasuta konsultatsioon ostukeskuses" vs "60-min põhjalik uuring eraldi visiidil"
  - Hinnakiri veebis vs "kõne peale"
  - Üks kirurg vs mitu erinevat arsti
  - Eestis vs välisriigi ketid
- **Hinna roll:**
  - Kõige odavam ei ole alati halb; kõige kallim ei ole alati parim
  - Mis on hinda lisatud (järelkontrollid, korrigeerimised, garantii)?
- **KSA mudel (faktid):**
  - Sama kirurg eel-konsultatsioonilt järelkontrollideni
  - Hinnakiri ksa.ee/hinnakiri
  - 7-aastane garantii
  - Tartu + Tallinn kontorid
  - Konservatiivne sõelumine (~25% kandidaate ei sobi → ütleme ausalt)
**Rendia video:** None (text + checklist focus)
**End-of-chapter:** Downloadable PDF checklist "Küsimused enne broneerimist"

---

## 9. Alternatiivid laserkirurgiale — mil juhul see EI ole õige
**Length:** 1000-1200 sõna
**Existing blog raw material:**
- Cataract posts: `katarakti-ennetamine-hea-toidu-abil.mdx`
- `2025-01-11-katarakta-simptomy-operatsiya-kogda-idti.mdx`
**Structure:**
- **Multifokaal-lääts (RLE — Refractive Lens Exchange)**
  - Kellele sobib: 45+ inimesed, presbüoopia + müoopia/hüperoopia kombinatsioon
  - Eelis laserkirurgia ees: lahendab ka tulevase hallkae
  - KSA pakub: Audit silmauuring → multifokaal-läätse plaan
- **ICL (Implantable Contact Lens)**
  - Kellele: väga kõrge dioptria (üle -10) või õhuke sarvkest
  - Reversed: läätse saab eemaldada
  - KSA: praegu ei paku (suuna teiste kliinikute poole)
- **Hallkae operatsioon multifokaal-läätsega**
  - 60+ inimestele — kaks probleemi (presbüoopia + hallkae) lahendatakse korraga
- **Optimaalne prillid + kontaktläätsed**
  - "Mõnikord on õige vastus MITTE operatsioon"
  - Kui kandidatuur on kahtlane, parem oodata kui kiirustada
**Rendia video:** "Multifocal IOL for Presbyopia"
**Honest closing:** "KSA sobib paljudele, aga mitte kõigile. Aus konsultatsioon ütleb seda Sulle ette."

---

## 10. Kokkuvõte + küsimuste kontroll-leht arstile
**Length:** 800-1000 sõna
**Structure:**
- **20 küsimust enne mis tahes broneeringut** (printable PDF checklist):
  - Sertifikaat + kogemus
  - Komplikatsiooni protsent
  - Mis on hinda lisatud
  - Järelkontrollide plaan
  - Garantii tingimused
  - Kontakt probleemide korral
  - jne
- **Punaste lippude check-list:**
  - "Limited time only" pakkumised
  - Kiire otsuse surve
  - Hinnakirja puudumine veebis
  - Põhjaliku diagnostikata otsus
  - Erinevad kirurgid iga visiidi ajal
- **Lõppsõna Dr. Haavelilt:** "Sõltumata sellest, kuhu lõpuks valid minna — palun küsi neid küsimusi. See on minu eesmärk selle juhendi kirjutamisega."
- **Resources:**
  - Lingid teaduslike artiklite juurde (PubMed, FDA)
  - Eesti Oftalmoloogia Seltsi
  - Patsiendiabi telefonid
- **KSA Silmakeskus** — 1 lk, ülevaade:
  - 20+ aastat, 55,000+ protseduuri
  - Tallinn + Tartu
  - Audit silmauuring 69€
  - my.ksa.ee — broneeri tasuta konsultatsioon
**End:** "Aitäh, et lugesite. Edu Sinu otsusega — olgu see KSA-s või mujal."

---

# Rendia videote valik (silmatervis.ksa.ee olemasolevast kogust)

Kõik videod on KSA Rendia kontol, juba kasutusel silmatervis.ksa.ee-l, valitud meditsiiniliselt:

| Peatükk | Teema | Rendia ID | Silmatervis source |
|---|---|---|---|
| 1 | Silma anatoomia ülevaade | `3a4018da-4f11-416a-4df6-4a2a4d6f4429` | /cornea, /retina, /optic-nerve |
| 2.1 | Müoopia (lühinägelikkus) | `45oOwX` | /myopia |
| 2.2 | Hüperoopia + Astigmaatia | `C8ig3Q` | /hyperopia, /astigmatism |
| 2.3 | Presbüoopia | `3a4018da-4f11-416a-4df6-4a2a4d6f4429` | /presbyopia |
| 3 | LASIK / Femto / SMILE / PRK | `2418c31f-4bce-4e5e-48ea-435e4a0a4b08` | /lasik-surgery, /femtosecond-laser-surgery |
| 5.1 | Keratokoonus / ektaasia | `FZsOd6` | /kerectopia-cone-topography |
| 5.2 | Post-LASIK kuiv silm | `q9SjH8` | /dry-eye-syndrome |
| 5.3 | Klaaskeha hägud (halode müüt) | `AkNlm` | /floaters-flashes |
| 9.1 | Hallkae operatsioon / IOL | `BTB8zj` | /cataract-surgery, /intraocular-lens-implant |
| 9.2 | Hallkae (üldine) | `5d2fe5ce-4003-4475-4d02-490346194c11` | /cataracts |

## Reserves (kasutada hiljem või tasakaalu jaoks)
- `NOU5i` — Glaukoom (cross-condition awareness)
- `xtbALl` — AMD (vananemine)
- `2418c31f...` — LASIK (sama video kasutatud overview + femto + SMILE + PRK pages — multi-purpose)
- `7dc112ef-4059-4348-436e-42a741ec4a93` — Kontaktläätsed (Peatükk 9 alternatives)

# Tehnilised märkused implementeerimiseks

## Routing (blog.ksa.ee)
Eelistus 1: kasutame olemasolevat `content/posts/` ja loome uue kategooria `tarbijajuhend` igale peatükile:
```yaml
categories:
  - Tarbijajuhend
title: "Peatükk 1: Kuidas silm töötab"
slug: laserkirurgia-juhend-01-kuidas-silm-toob
```
+ Lisame `app/laserkirurgia-juhend/page.tsx` mis kuvab kõik peatükid järjekorras + külgriba navigatsiooni.

Eelistus 2 (puhtam aga rohkem tööd): eraldi `app/laserkirurgia-juhend/[chapter]/page.tsx` route + content/guide/ kaust.

## Komponendid, mis vaja teha:
- `ChapterNav.tsx` — eelmine/järgmine + sisukord
- `ChapterProgressBar.tsx` — visuaalne edenemine
- `GuideSidebar.tsx` — sticky sidebar email-gate'iga
- `ChapterCTA.tsx` — bottom-of-chapter call to action
- `RendiaPauseCTA.tsx` — overlay video paus käigus (Rendia API toetab seda)
- `GlossaryTooltip.tsx` — medical-term hover'i mini-selgitus

## SEO
- `MedicalProcedure` schema igale peatükile, mis kirjeldab operatsiooni
- `Article` schema kõikidele peatükkidele
- `BreadcrumbList` schema
- `FAQPage` schema seal, kus on Q&A
- hreflang ET ↔ RU ↔ EN
- XML sitemap update sisestab uued URL-id automaatselt

## Konversiooni-mõõdik (täiendab Booking Click Intent + Quiz Completed)
Uus GTM event: `guide_chapter_complete` (kasutaja jõudis chapter end CTA-ni) — feed Smart Bidding'ule kui sekundaar-signaali

## PDF versioon (later)
- HTML → PDF kaudu Playwright või Puppeteer
- Genereerib full guide ühest URL-ist
- Kättesaadav `blog.ksa.ee/laserkirurgia-juhend/download.pdf`
- E-posti gate vahel kui tahad lead capture'da

---

# Järgmised sammud

1. **Sina vaatad selle outline'i üle** (15 min) — pakid välja, milline peatükk on hea/parandust vajav, kas mõni teema on puudu
2. **Mina kirjutan peatüki 1 ET draft'i** (4-6 tundi) — kasutan olemasolevat blogi sisu + uut materjali
3. **Sina/Dr. Haavel arstilise sisukontrolli draft'ile** (1 päev)
4. **Korda peatüki 1 → 10 jaoks** (ca 1 nädal koguselt)
5. **Jana RU tõlge + native EN polish** (3-5 päeva paralleelselt)
6. **Designer + sidebar + CTA-d** (3-4 päeva)
7. **Rendia video sissetoomine** (1 päev)
8. **Launch + SEO push** (1 päev)

**Kogu graafik: 2-3 nädalat.**
