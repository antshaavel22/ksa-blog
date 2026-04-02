# KSA Blogi — Toimetaja juhend

**Aadress:** blog.ksa.ee/admin
**Toimetajad:** Silvia Johanna Haavel (ET) · Jana (RU, EN)

---

## 1. Sisselogimine

Ava **blog.ksa.ee/admin** → sisesta parool → klõpsa „Logi sisse".

Parooli leiab `.env.local` failist (küsi Antsult kui vaja).

---

## 2. Mustandi ülevaatamine ja avaldamine

Iga hommikul kell 7 genereerib süsteem automaatselt uue mustandi (ET + RU + EN) päevauudiste põhjal. Need ilmuvad **Mustandid** vahekaardil.

### Samm-samm:

1. Vali keelefilter: **ET / RU / EN**
2. Klõpsa mustandi kaardil — avaneb redaktor
3. Kontrolli ja paranda:
   - **Pealkiri** — lühike, selge, sisaldab märksõna
   - **Kuupäev** — tänane (avaldatakse kohe) või tulevane (ilmub automaatselt valitud päeval)
   - **Pilt** — kleebi pildi URL (ksa.ee/wp-content/uploads/... või Unsplash)
   - **Tekst** — loe üle, paranda stiil, lisa KSA vaatenurk
4. Klõpsa **Salvesta** (salvestab mustandina, ei avalda)
5. Klõpsa **✓ Avalda** — postitus ilmub kohe blogis

> 💡 **Ajastamine:** kui märgid tulevase kuupäeva (nt homme), ilmub postitus automaatselt sellel päeval ilma sinupoolse tegevuseta.

> 💡 **Tagasiajastamine:** saad märkida ka möödunud kuupäeva — postitus ilmub siis õiges kohas ajaloos.

---

## 3. Uue postituse kirjutamine

Klõpsa vahekaardil **Kirjuta uus**.

### 3 viisi sisu lisamiseks:

| Viis | Millal kasutada |
|------|----------------|
| **Kirjuta ise** | Tead täpselt mida tahad öelda |
| **Kleebi URL** | Leidsid hea artikli — süsteem loeb selle läbi ja kirjutab KSA vaatenurgast |
| **Laadi fail** | Sul on olemasolev tekst (Word, PDF) |

### Seejärel:

1. Kirjuta **lühikokkuvõte** — mida postitus peaks käsitlema (2–4 lauset piisab)
2. Vali keeled: **ET** / **RU** / **EN** (saab kõik 3 korraga)
3. Klõpsa **Genereeri** — Claude kirjutab postituse ~30 sekundiga
4. Ava genereeritud mustand → vaata üle → avalda

---

## 4. YouTube video lisamine

Teksti redigeerides kleebi redaktori ülaosas lahtrisse YouTube link → klõpsa **Lisa video**. Video ilmub teksti sisse korrektselt vormindatuna.

---

## 5. Pildi lisamine

**Featuredimage** lahtrisse kleebi pildi otsene URL:
- KSA pildid: `https://ksa.ee/wp-content/uploads/aasta/kuu/failinimi.jpg`
- Uued pildid: laadi ksa.ee meediakogusse (WordPress → Meedia) ja kopeeri URL sealt

---

## 6. Kasulikud nipid

| Olukord | Lahendus |
|---------|----------|
| Postitus vajab arsti kinnitust | Lisa tekstile märge „*Vajalik meditsiiniline ülevaatus*" ja saada link Antsule |
| Viga avaldatud postituses | Ava postitus otse blogist, kopeeri slug, redigeeri faili otse GitHubis |
| Mustand on halb, taha uut | Kustuta mustand → Kirjuta uus |
| Tahad posti ajutiselt peita | Muuda kuupäev tulevikku — postitus kaob avalikust vaatest |

---

## 7. Mida süsteem teeb automaatselt

- **Iga päev kell 7** — otsib uued silmatervise uudised, genereerib mustandi
- **Iga deploy** — uuendab sitemapi, lisab Schema JSON-LD kõigile postitustele
- **Tuleviku postitused** — ilmuvad automaatselt õigel päeval

---

## Kontakt

Tehniline tugi: **Ants Haavel** (küsi Claude'i kaudu 😄)
Sisu küsimused ET: **Silvia Johanna Haavel**
Sisu küsimused RU/EN: **Jana**
