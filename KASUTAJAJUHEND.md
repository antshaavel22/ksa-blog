# KSA Blogi — Toimetaja juhend v4.0

**Aadress:** blog.ksa.ee/admin · **Parool:** ksa-blog-2026
**Toimetajad:** Silvia Johanna Haavel (ET) · Jana (RU, EN)
**Tehniline tugi:** Dr. Ants Haavel (claude.ai kaudu)
**Uuendatud:** aprill 2026

---

## Blogi ülevaade

| | |
|---|---|
| Avaldatud postitused | 490+ (ET ~270 / RU ~130 / EN ~63) |
| Mustandid | 564+ (0 ET / 264 RU / 300 EN) |
| Keeled | ET · RU · EN — automaatne trilingual genereerimine |
| Uus mustand iga päev | kell 7:00 (EET) automaatselt |

---

## Admin paneel — 5 vahekaarti

| Vahekaart | Kirjeldus |
|-----------|-----------|
| 📋 **Mustandid** | Kõik mustandid ET/RU/EN filtriga — peamine töökoht |
| ✏️ **Avaldatud** | Kõik 490+ avaldatud postitust — saad otse muuta ja eemaldada |
| ✍️ **Kirjuta uus** | Kaks võimalust: kirjuta ise (otse mustandisse) või lase AI-l genereerida |
| 📝 **Sisureeglid** | AI kirjutamisjuhend — saad reegleid vaadata ja muuta |
| ❓ **Juhend** | See juhend inline paneelis |

---

## 1. Mustandi ülevaatamine ja avaldamine

Iga hommikul kell 7 genereerib süsteem automaatselt uue mustandi (ET + RU + EN). Need ilmuvad **Mustandid** vahekaardil.

1. Vali keelefilter: **ET / RU / EN** (või otsi pealkirja järgi)
2. Klõpsa mustandikaardil — avaneb redaktor
3. Kontrolli ja paranda: **pealkiri**, **kuupäev**, **pilt**, **tekst**
4. Klõpsa **Salvesta** (salvestab, ei avalda)
5. Klõpsa **👁 Eelvaade** — vaata kuidas postitus blogis välja näeb enne avaldamist
6. Klõpsa **✓ Avalda** — postitus ilmub blogis ~2 min jooksul (Vercel ehitab uuesti)

> 💡 **Ajastamine:** tulevane kuupäev → ilmub automaatselt sellel päeval.
> 💡 **Peitmine:** muuda kuupäev tulevikku → kaob avalikust vaatest.

---

## 2. Pilt lisamine artiklile *(uuendatud)*

Redaktoris on kolm võimalust pildi lisamiseks:

### 📁 Laadi pilt üles arvutist (soovitatav)
1. Klõpsa **📁 Lae pilt üles**
2. Vali pilt oma arvutist (JPEG, PNG, WebP, HEIC — kuni 20 MB)
3. Brauser tihendab automaatselt → optimaalne WebP (tüüpiliselt 80–200 KB)
4. Pilt salvestatakse **koheselt** mustandisse — kaduma ei lähe
5. **Lohista pilti raamis** et valida, milline osa nähtavale jääb (nägu ei lõigata ära!)

### ✨ AI pilt
- Nupp **✨ AI pilt** → Claude koostab FLUX-le professionaalse pildikirjelduse
- Kui Replicate token on seadistatud: genereerib pildi automaatselt
- Kui pole: kuvab kirjelduse, mida saab Midjourney/DALL-E-s kasutada

### 🔗 URL
- Kleebi pildi otselink lahtrisse (nt ksa.ee/wp-content/uploads/...)

### Pildi kärpimine (drag-to-crop) *(uus)*
Pärast pildi lisamist näed **eelvaadet 3:2 raamis** (sama suhe mis blogikaardil).
- **Lohista pilti** raamis → valid täpselt mis osa näha jääb
- Nägu, silmad, oluline detail — kõik jääb sinna kuhu soovid
- Nupp **Lähtesta** → tagasi keskmisele

---

## 3. Eelvaade enne avaldamist *(uus)*

Redaktoris on nupp **👁 Eelvaade** — see avab täisekraani ülevaate:

- Näed täpselt kuidas postitus blogis välja näeb (pealkiri, pilt, tekst, CTA)
- **Avalda see postitus** nupp otse eelvaates
- **Tagasi redigeerima** nupp tagasi redaktorisse
- Pärast avaldamist: 120-sekundiline taimer (Vercel ehitab ~2 min) → siis avaneb "Vaata postitust" link

---

## 4. Oma teksti kirjutamine / kleepimine *(uus)*

Klõpsa **✍️ Kirjuta uus** → näed kahte võimalust:

### 📝 Salvesta otse (enda tekst)
Kasuta seda kui sul on **valmis tekst** (kirjutasid ise, koopiasid kuskilt, dikteerisid):
1. Klõpsa **📝 Salvesta otse**
2. Kirjuta pealkiri
3. Vali keel: ET / RU / EN
4. Kleebi või kirjuta tekst
5. **Salvesta mustandina** → tekst salvestatakse muuutmata

> ⚠️ See valik **ei muuda su teksti** — täpselt nagu kirjutasid, nii läheb mustandisse.

### 🤖 AI kirjutab
Kasuta seda kui soovid **AI-l teksti genereerida** ideedest, märkmetest või lingist:
1. Klõpsa **🤖 AI kirjutab**
2. Sisesta idee, märkmed, URL või lühikirjeldus
3. Vali keeled (ET/RU/EN)
4. **Genereeri** → ~30 sek → ilmub mustanditesse

---

## 5. Avaldatud postituse muutmine ja eemaldamine

### Postituse muutmine
1. Ava **✏️ Avaldatud** vahekaart
2. Otsi pealkirja, katkendi või URL-slogi järgi
3. Klõpsa postitusel → avaneb redaktor
4. Tee muudatused → **Salvesta**

### Postituse eemaldamine (unpublish)
1. Ava post **✏️ Avaldatud** vahekaardil
2. Klõpsa **↩ Eemalda avaldamisest**
3. Postitus liigub automaatselt tagasi **Mustandid** kausta

---

## 6. Ülesande määramine toimetajale

Redaktoris alumisel ribal:

| Väli | Kirjeldus |
|------|-----------|
| **Vastutaja** | Silvia Johanna Haavel · Jana · Dr. Ants Haavel |
| **Tähtaeg** | Kuupäev — punane märk kui möödunud |
| **Teavita** | E-kiri määratud toimetajale |

---

## 7. Sõsarartiklite pildi sünkroonimine

Kui lisad ET artiklile pildi ja tahad sama pildi ka RU + EN versiooni:
1. Lisa pilt ET artiklile → Salvesta
2. Klõpsa **Sünkrooni pilt sõsarartiklitele**
3. Süsteem leiab automaatselt seotud RU ja EN mustandid ja lisab pildi sinna

---

## 8. YouTube video lisamine

Redaktoris on **YouTube** lahter — kleebi video link → **Lisa video** → ilmub teksti sisse.

---

## 9. Sisureeglid — AI kirjutamisjuhend

Vahekaart **📝 Sisureeglid** sisaldab täielikku prompti mida AI kasutab.

**Mida see hõlmab:**
- KSA kliiniku faktid (55 000+ protseduuri, Flow3, ICB)
- **Eesti keel:** loomulik Tallinna keel, "sina" vorm
- **Vene keel:** Балтийский стиль — soe, mitte formaalne Moskva vene · **Таллинн (kaks н — Eesti vene kohalik standard, kinnitanud Jana)**
- **Inglise keel:** briti inglise (colour, centre, whilst)
- Lugemistase: arusaadav 8. klassi õpilasele
- Meditsiiniterminid koos lihtsustusega: "müoopia (lühinägelikkus)"

**Kuidas muuta:**
1. Klõpsa **📝 Sisureeglid**
2. Muuda teksti
3. **Salvesta muudatused** → järgmine genereeritud mustand järgib kohe uusi reegleid

---

## 10. SEO — mis toimub automaatselt

Iga avaldatud postitusel on automaatselt:

- **Meta title & description** — Claude-optimeeritud
- **Google Schema JSON-LD** — BlogPosting, BreadcrumbList, Person, ImageObject
- **OpenGraph** — FB/LinkedIn jagamiseks (title, description, image)
- **Automaatne sitemap** — blog.ksa.ee/sitemap.xml uueneb iga avaldamisega
- **AI otsinguküsimused** — Perplexity ja ChatGPT jaoks
- **FAQ Schema** — kui postitusel on FAQ sektsioon, ilmub Google tulemuses otse

---

## 11. Jälgimine ja analüütika

| Süsteem | ID | Mis jälgib |
|---------|----|------------|
| Google Tag Manager | GTM-KCZVRJ8 | Kõik lehevaatamised ja sündmused |
| Google Analytics 4 | G-7R7T8GF37J | Liiklus, kasutajad, sessioonid |

---

## 12. Mis töötab automaatselt

| Millal | Mis juhtub |
|--------|------------|
| Iga päev kell 7:00 | Uued silmatervise uudised → ET + RU + EN mustand automaatselt |
| Iga avaldamine | Sitemap uueneb, Schema + OpenGraph genereeritakse, Vercel ehitab (~2 min) |
| Pärast pildi üleslaadimist | Pilt salvestatakse kohe mustandisse — ei kao ära |
| Tuleviku kuupäev | Postitus ilmub õigel päeval iseseisvalt |
| Iga artikli lõpus | Flow3 kiirtest CTA — suunab ksa-kiirtest.vercel.app/[keel] |

---

## 13. Claude KSA Blog Editor — uus humaniseerija (aprill 2026)

**Mis see on:** AI-generaator teeb mustandid liiga toored ja AI-laadsed (pikad laused, *"sukeldume teadusesse!"*, *"võtmerolli mängib"*, slogan-lõpud, jargooon ilma seletuseta). Claude KSA Blog Editor võtab toore mustandi ja kirjutab ümber sooja arstihäälega, 8. klassi lugemistasemel, kõik meditsiinitermid kohe sulgudes lahti seletatud.

**Mida ta parandab:**
- Cuts AI-fraasid: *"tõeliselt põnev"*, *"võtmetähtsusega"*, *"sukeldume"*, *"helget tulevikku"*
- Lühendab pikki lauseid → 8. klassi tase
- Lisab meditsiiniterminite kõrvale lihtsa selgituse: *sarvkest (silma esimene läbipaistev kiht)*
- Esimese isiku arstihääl kus loomulik: "Olen näinud...", "Soovitan..."
- Lõpetab **soodustava kutsega**, mitte müügi-slogan'iga
- ET grammatika: *uuringul, vastuvõtul, kontrollil* (mitte *uuringus*)
- RU: **Таллинн kahe н-ga**, mitte Таллин

**Kuidas kasutada:** praegu jooksutab Ants seda Claude'i kaudu kõikidele mustanditele enne, kui need sinuni jõuavad. Kui näed mustandit, mis ikkagi loeb AI-laadselt — anna teada, parandame skilli reegleid.

**Tulemus:** mustandid on nüüd ~90% avaldamiseks valmis. Sinu töö on lugeda üle, kohendada paari nüanssi, lisada kaanepilt, valida kontrollija ja vajutada Avalda. **Eesmärk: 1 postitus päevas keele kohta.**

---

## 14. Miks blog meie pildis nii oluline on

Korralikult kasutatud blog võib tuua **20–30% uutest leadidest**. See pole väike number — see on terve broneerimisvoo lisarivi.

Aga sama tähtis: blog on **tasuta väärtuskanal olemasolevatele patsientidele**. Inimene, kes käis kunagi Flow3-l või kuiva silma vastuvõtul, saab meilt jätkuvalt usaldusväärset infot — ilma et me midagi müüks. See ehitab usaldust ja **käivitab suusõnalise reklaami, jagamise ja soovitused ilma, et küsiks**.

**Win-win-win:**
- 🟢 **Lugeja** — saab tasuta usaldusväärset arstinfot
- 🟢 **Olemasolev patsient** — tunneb, et hoolime ka pärast operatsiooni
- 🟢 **KSA** — orgaanilised leadid + soovitused

**Soovitus toimetajatele:** kui avaldad postitust, jaga seda pehmelt ka oma kanalites (Instagram-storyd, LinkedIn, Facebook). Mitte agressiivset müüki — lihtsalt "vaadake, mida me sel teemal kirjutasime". Just see õrn, regulaarne kohalolek toob aja jooksul kliendid sisse.

---

## 15. Sagedased olukorrad

| Olukord | Lahendus |
|---------|----------|
| Postitus vajab arsti kinnitust | Märgi *Meditsiiniline ülevaatus* → määra Antsule → Saada teavitus |
| Viga avaldatud postituses | ✏️ Avaldatud → otsi → paranda → Salvesta |
| Tahan postituse ajutiselt maha võtta | ✏️ Avaldatud → postitus → **↩ Eemalda avaldamisest** |
| Tahan postitust ajutiselt peita | Muuda kuupäev tulevikku |
| Pilt ei ilmu kohe blogis | Normaalne — Vercel ehitab ~2 min. Pilt on salvestatud, oota natuke. |
| Pilt lõikab pea/jäsemed ära | Lohista pilti raamis → valid täpse nurga enne avaldamist |
| Genereeritud mustand on kehv | Kustuta → Kirjuta uus detailsema kokkuvõttega |
| Ülesande tähtaeg möödunud | Punane ⚠ märk mustandikaardil — ava ja tegutse |

---

## 16. Tekstipuhastus — mida AI mustandites vältida ja parandada

AI genereerib mustandeid suure mahuga, kuid jätab teksti sisse ehituselemente, mis lugejale loevad nagu prooviprintimise kahjustused. **Kontrolli iga uue mustandi puhul** ning eemalda või paranda need:

### A) Struktuurisildid pealkirjadena

Need on ainult tühjad sildid ilma sisuta — eemalda kogu rida:

| Vältida | Põhjus |
|---------|--------|
| `## Sissejuhatus` | Esimene lõik on niikuinii sissejuhatus. Vajaduseta. |
| `## Kokkuvõte` | Kui sektsioonil on tegelik teema, kasuta seda nimena (nt `## Kas glaukoomi saab ravida toitumisega?`). Tühi "Kokkuvõte" eemalda. |
| `## Введение` (RU) / `## Introduction` (EN) | Sama loogika — ära jäta tühja silti. |
| `## Заключение` (RU) / `## Conclusion` (EN) / `## Summary` (EN) | Sama. |

### B) Sildid algusparagrahvi sees

AI alustab mõnikord lõiku sõnaga, mis on tegelikult struktuurisilt: **eemalda ainult see sõna ja jätka sama lausega**.

| Vältida (algus) | Paranda |
|-----------------|---------|
| `Sissejuhatus Kas oled kunagi mõelnud...` | `Kas oled kunagi mõelnud...` |
| `Введение Вы когда-нибудь...` | `Вы когда-нибудь...` |
| `Introduction Have you ever wondered...` | `Have you ever wondered...` |
| `Conclusion The US military...` | `The US military...` |

### C) Reklaami-fraasid sissejuhatuses

AI lisab sageli "Tere tulemast KSA Silmakeskuse blogisse..." stiilis fraasi. **Eemalda** — lugeja teab juba, kus ta on. Asenda kohe asjale tulevate küsimuste või faktidega.

### D) Kokkuvõtete YAML väljad (`excerpt`, `seoExcerpt`)

- Peavad lõppema lause-kirjavahemärgiga (`.`, `!`, `?`) **või** kolme punktiga `...` (mis annab märku, et tekst jätkub)
- Mitte kunagi sõna keskel
- Maksimaalselt ~25 sõna

### E) Pikad lõigud (üle 6 lause)

- Iga lõik **maksimaalselt 5–6 lauset**
- Jaga loogiliselt: kus algab uus mõte või näide, alusta uut lõiku
- Mobiilis (70 % lugejatest) on pikk lõik vältimatu väljalülitumise põhjus

### F) Категориад (categories) YAML

- Peab olema **plokk-loend**, mitte string
- Õige:
  ```yaml
  categories:
    - Silmade Tervis
  ```
- Vale: `categories: "Silmade Tervis"` — see paneb kogu Vercel buildi pikali

### Muud reeglid mis ei muutu

- **Tallinn vene keeles = Таллинн** (kaks н — Eesti vene standard, Jana kinnitas)
- **Jana parandused vene keeles ON kanoonilised** — kui ta on midagi parandanud, ära kirjuta üle. Lisa ainult faktilisi parandusi.
- **Üritustel käimine eesti keeles** — `uuringu**l**`, `vastuvõtu**l**` (mitte `uuringu**s**`). Dr. Haavel kinnitas 2026-04-27.
- **Madala-võtme usaldushääl** — ei mingit `parim`, `imeline`, `revolutsiooniline`, `kõige parem`. Tsiteeri uuringu nimesid + numbreid, mitte tugevdavaid omadussõnu.

---

## Kontakt

- **Tehniline tugi:** Ants Haavel (claude.ai kaudu)
- **ET sisu:** Silvia Johanna Haavel
- **RU/EN sisu:** Jana
