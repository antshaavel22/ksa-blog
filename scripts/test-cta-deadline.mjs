const MONTHS={et:["jaanuarini","veebruarini","märtsini","aprillini","maini","juunini","juulini","augustini","septembrini","oktoobrini","novembrini","detsembrini"],
ru:["января","февраля","марта","апреля","мая","июня","июля","августа","сентября","октября","ноября","декабря"],
en:["January","February","March","April","May","June","July","August","September","October","November","December"]};
const FB={et:"selle kuu lõpuni",ru:"до конца этого месяца",en:"the end of this month"};
function until(lang,now=new Date()){
  try{
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Europe/Tallinn",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(now);
    const num=t=>Number(parts.find(p=>p.type===t)?.value);
    const y=num("year"),m=num("month");
    if(!Number.isFinite(y)||!Number.isFinite(m)||m<1||m>12)return FB[lang];
    const last=new Date(Date.UTC(y,m,0)).getUTCDate();
    const n=MONTHS[lang][m-1];
    if(!n||!Number.isFinite(last))return FB[lang];
    return lang==="et"?`${last}. ${n} ${y}`:`${last} ${n} ${y}`;
  }catch{return FB[lang]}
}
let fails=0;
const chk=(label,got,want)=>{const ok=got===want;if(!ok)fails++;console.log(`${ok?"✓":"✗ FAIL"}  ${label.padEnd(52)} ${got}`);if(!ok)console.log(`         expected: ${want}`);};

console.log("── month boundary, to the exact second (Tallinn) ──");
chk("31 Aug 23:59:59 EEST (still Aug)", until("en",new Date("2026-08-31T20:59:59Z")), "31 August 2026");
chk("1 Sep 00:00:00 EEST (rolls)",      until("en",new Date("2026-08-31T21:00:00Z")), "30 September 2026");

console.log("\n── the UTC trap: 1st of month, 00:30 Tallinn = previous month in UTC ──");
chk("1 Sep 00:30 EEST (UTC still 31 Aug)", until("en",new Date("2026-08-31T21:30:00Z")), "30 September 2026");
chk("1 Feb 01:00 EET  (UTC still 31 Jan)", until("en",new Date("2026-01-31T23:00:00Z")), "28 February 2026");

console.log("\n── DST transitions (EET↔EEST) ──");
chk("29 Mar 2026 spring-forward day",  until("en",new Date("2026-03-29T02:30:00Z")), "31 March 2026");
chk("25 Oct 2026 fall-back day",       until("en",new Date("2026-10-25T02:30:00Z")), "31 October 2026");

console.log("\n── year boundary ──");
chk("31 Dec 2026 23:00 EET",           until("en",new Date("2026-12-31T21:00:00Z")), "31 December 2026");
chk("1 Jan 2027 00:30 EET",            until("en",new Date("2026-12-31T22:30:00Z")), "31 January 2027");

console.log("\n── leap years ──");
chk("Feb 2028 (leap)",                 until("en",new Date("2028-02-10T12:00:00Z")), "29 February 2028");
chk("Feb 2027 (non-leap)",             until("en",new Date("2027-02-10T12:00:00Z")), "28 February 2027");
chk("Feb 2100 (century, NOT leap)",    until("en",new Date("2100-02-10T12:00:00Z")), "28 February 2100");

console.log("\n── all three languages, Nov + Dec ──");
chk("ET November", until("et",new Date("2026-11-05T12:00:00Z")), "30. novembrini 2026");
chk("RU November", until("ru",new Date("2026-11-05T12:00:00Z")), "30 ноября 2026");
chk("ET December", until("et",new Date("2026-12-05T12:00:00Z")), "31. detsembrini 2026");
chk("RU December", until("ru",new Date("2026-12-05T12:00:00Z")), "31 декабря 2026");

console.log("\n── graceful failure (Intl broken) ──");
const realIntl=globalThis.Intl;
globalThis.Intl={DateTimeFormat:function(){throw new Error("Intl unavailable")}};
chk("Intl throws → ET fallback", until("et"), "selle kuu lõpuni");
chk("Intl throws → RU fallback", until("ru"), "до конца этого месяца");
chk("Intl throws → EN fallback", until("en"), "the end of this month");
globalThis.Intl=realIntl;
console.log(`\n${fails===0?"ALL PASS":fails+" FAILURE(S)"} — ${fails===0?"no NaN, no wrong month, no crash":"see above"}`);
