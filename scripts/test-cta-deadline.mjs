// Tests for the rolling CTA deadline in components/SmartCTAEditorial.tsx.
// Mirrors that function exactly; run with: node scripts/test-cta-deadline.mjs
const MONTHS={et:["jaanuarini","veebruarini","märtsini","aprillini","maini","juunini","juulini","augustini","septembrini","oktoobrini","novembrini","detsembrini"],
ru:["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"],
en:["January","February","March","April","May","June","July","August","September","October","November","December"]};
const FB={et:"selle kuu lõpuni",ru:"до конца этого месяца",en:"the end of this month"};
const ROLL_FORWARD_DAY=25;
function until(lang,now=new Date()){
  try{
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Tallinn",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
    const num=t=>Number(parts.find(p=>p.type===t)?.value);
    const y=num("year"),m=num("month"),d=num("day");
    if(![y,m,d].every(Number.isFinite)||m<1||m>12)return FB[lang];
    let ty=y,tm=m;
    if(d>=ROLL_FORWARD_DAY){tm+=1;if(tm>12){tm=1;ty+=1;}}
    const last=new Date(Date.UTC(ty,tm,0)).getUTCDate();
    const n=MONTHS[lang][tm-1];
    if(!n||!Number.isFinite(last))return FB[lang];
    return lang==="et"?`${last}. ${n} ${ty}`:`${last} ${n} ${ty}`;
  }catch{return FB[lang]}
}
let fails=0;
const chk=(l,got,want)=>{const ok=got===want;if(!ok)fails++;console.log(`${ok?"✓":"✗ FAIL"}  ${l.padEnd(50)} ${got}`);if(!ok)console.log(`         expected: ${want}`);};
const at=(iso)=>new Date(iso);

console.log("── the 25th rule: never fewer than ~5 weeks to book ──");
chk("24 Aug (day before roll)", until("en",at("2026-08-24T12:00:00Z")), "31 August 2026");
chk("25 Aug (rolls forward)",   until("en",at("2026-08-25T12:00:00Z")), "30 September 2026");
chk("31 Aug (still next month)",until("en",at("2026-08-31T12:00:00Z")), "30 September 2026");
chk("1 Sep (holds)",            until("en",at("2026-09-01T12:00:00Z")), "30 September 2026");
chk("24 Sep (last day before)", until("en",at("2026-09-24T12:00:00Z")), "30 September 2026");
chk("25 Sep (rolls again)",     until("en",at("2026-09-25T12:00:00Z")), "31 October 2026");

console.log("\n── roll-over at the exact second, Tallinn local ──");
chk("24 Aug 23:59:59 EEST", until("en",at("2026-08-24T20:59:59Z")), "31 August 2026");
chk("25 Aug 00:00:00 EEST", until("en",at("2026-08-24T21:00:00Z")), "30 September 2026");

console.log("\n── UTC trap: 25th in Tallinn, still 24th in UTC ──");
chk("25 Aug 00:30 EEST", until("en",at("2026-08-24T21:30:00Z")), "30 September 2026");
chk("25 Jan 01:00 EET",  until("en",at("2026-01-24T23:00:00Z")), "28 February 2026");

console.log("\n── year boundary (Dec 25 must roll into next year) ──");
chk("24 Dec 2026", until("en",at("2026-12-24T12:00:00Z")), "31 December 2026");
chk("25 Dec 2026", until("en",at("2026-12-25T12:00:00Z")), "31 January 2027");
chk("31 Dec 2026", until("en",at("2026-12-31T12:00:00Z")), "31 January 2027");
chk("1 Jan 2027",  until("en",at("2027-01-01T12:00:00Z")), "31 January 2027");

console.log("\n── leap years, incl. rolling INTO February ──");
chk("25 Jan 2028 → leap Feb", until("en",at("2028-01-25T12:00:00Z")), "29 February 2028");
chk("25 Jan 2027 → non-leap", until("en",at("2027-01-25T12:00:00Z")), "28 February 2027");
chk("25 Jan 2100 → century",  until("en",at("2100-01-25T12:00:00Z")), "28 February 2100");
chk("10 Feb 2028 (in month)", until("en",at("2028-02-10T12:00:00Z")), "29 February 2028");

console.log("\n── DST transition days ──");
chk("29 Mar spring-forward (>=25, rolls)", until("en",at("2026-03-29T02:30:00Z")), "30 April 2026");
chk("22 Mar spring-fwd week (<25)",        until("en",at("2026-03-22T02:30:00Z")), "31 March 2026");
chk("25 Oct 2026 fall-back+roll", until("en",at("2026-10-25T02:30:00Z")), "30 November 2026");

console.log("\n── all three languages, Nov + Dec ──");
chk("ET Nov", until("et",at("2026-11-05T12:00:00Z")), "30. novembrini 2026");
chk("RU Nov", until("ru",at("2026-11-05T12:00:00Z")), "30 ноября 2026");
chk("ET Dec (25 Nov rolls)", until("et",at("2026-11-25T12:00:00Z")), "31. detsembrini 2026");
chk("RU Dec (25 Nov rolls)", until("ru",at("2026-11-25T12:00:00Z")), "31 декабря 2026");

console.log("\n── graceful failure ──");
const real=globalThis.Intl;
globalThis.Intl={DateTimeFormat:function(){throw new Error("no Intl")}};
chk("Intl throws → ET", until("et"), "selle kuu lõpuni");
chk("Intl throws → RU", until("ru"), "до конца этого месяца");
chk("Intl throws → EN", until("en"), "the end of this month");
globalThis.Intl=real;

console.log("\n── how much time a reader actually gets (worst day per month) ──");
let globalWorst = 99, globalWhen = "";
for (let m = 0; m < 12; m++) {
  const daysInMonth = new Date(Date.UTC(2026, m + 1, 0)).getUTCDate();
  let worst = 99, when = "";
  for (let d = 1; d <= daysInMonth; d++) {
    const now = new Date(Date.UTC(2026, m, d, 12));
    const [dd, mn, yy] = until("en", now).split(" ");
    const end = new Date(Date.UTC(Number(yy), MONTHS.en.indexOf(mn), Number(dd), 23, 59));
    const left = Math.round((end - now) / 864e5);
    if (left < worst) { worst = left; when = `the ${d}${d===1?"st":d===2?"nd":d===3?"rd":"th"}`; }
  }
  if (worst < globalWorst) { globalWorst = worst; globalWhen = `${MONTHS.en[m]}, ${when}`; }
  const flag = worst <= 5 ? "  ← tight" : "";
  console.log(`  ${MONTHS.en[m].padEnd(10)} worst case ${String(worst).padStart(2)} days (on ${when})${flag}`);
}
console.log(`\n  Shortest window any reader ever sees: ${globalWorst} days — ${globalWhen}.`);
console.log("  (Before the 25th rule this was 0 days: on the 31st the CTA showed that same day.)");
if (globalWorst < 4) { fails++; console.log("  ✗ FAIL — below the 4-day floor this rule guarantees"); }
else console.log("  ✓ matches the 4-day floor the 25th rule guarantees");

console.log(`\n${fails===0?"ALL PASS":fails+" FAILURE(S)"}`);
process.exit(fails?1:0);
