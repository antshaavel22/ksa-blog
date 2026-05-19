import { NextRequest, NextResponse } from "next/server";
import { BOOKING_FUNNELS, BOOKING_RECIPIENT, type BookingFunnel } from "@/lib/booking-funnels";

// Receives booking-form submission from /broneeri/[funnel].
// Sends:
//   1. Email to registreerumised@ksa.ee  (via Web3Forms, same key used by /admin)
//   2. Slack message to #kiirtesti-täitmised  (via incoming webhook in env)
// Returns ok: true once BOTH have been attempted. We don't fail the user if
// Slack is misconfigured — email is the source of truth.

const WEB3FORMS_KEY = process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? process.env.WEB3FORMS_KEY ?? "";
const SLACK_WEBHOOK_URL = process.env.SLACK_BOOKING_WEBHOOK_URL ?? "";

interface SubmitPayload {
  funnel: BookingFunnel;
  name: string;
  phone: string;
  email: string;
  clinic: "Tallinn" | "Tartu";
  preferredTime?: string;
  message?: string;
  consent: boolean;
  source?: string;
  // Anti-spam honeypot — must be empty
  website?: string;
}

function sanitize(s: unknown, max = 500): string {
  if (typeof s !== "string") return "";
  return s.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

async function sendEmail(subject: string, body: string): Promise<boolean> {
  if (!WEB3FORMS_KEY) return false;
  try {
    const res = await fetch("https://api.web3forms.com/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        access_key: WEB3FORMS_KEY,
        subject,
        message: body,
        email: BOOKING_RECIPIENT,
        from_name: "KSA blogi broneerimisvorm",
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function sendSlack(text: string, blocks: object[]): Promise<boolean> {
  if (!SLACK_WEBHOOK_URL) return false;
  try {
    const res = await fetch(SLACK_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, blocks }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  let raw: SubmitPayload;
  try {
    raw = (await req.json()) as SubmitPayload;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  // Honeypot: bots fill this hidden field. Silently 200 so they don't retry.
  if (raw.website && raw.website.trim() !== "") {
    return NextResponse.json({ ok: true });
  }

  const funnel = BOOKING_FUNNELS[raw.funnel];
  if (!funnel) {
    return NextResponse.json({ ok: false, error: "Tundmatu uuringutüüp" }, { status: 400 });
  }

  const name = sanitize(raw.name, 100);
  const phone = sanitize(raw.phone, 30);
  const email = sanitize(raw.email, 200);
  const clinic = raw.clinic === "Tartu" ? "Tartu" : "Tallinn";
  const preferredTime = sanitize(raw.preferredTime, 200);
  const message = sanitize(raw.message, 1000);
  const source = sanitize(raw.source, 80) || "blog";

  if (!name || !phone || !email) {
    return NextResponse.json(
      { ok: false, error: "Palun täida nimi, telefon ja email." },
      { status: 400 },
    );
  }
  if (!isEmail(email)) {
    return NextResponse.json({ ok: false, error: "Email ei ole õigesti vormistatud." }, { status: 400 });
  }
  if (!raw.consent) {
    return NextResponse.json(
      { ok: false, error: "Palun kinnita andmete töötlemise nõusolek." },
      { status: 400 },
    );
  }

  const subject = `Broneerimissoov · ${funnel.service} · ${name}`;
  const lines = [
    `Uuring: ${funnel.service}`,
    `Hind: ${funnel.priceLabel}${funnel.priceStrike ? ` (tavahind ${funnel.priceStrike})` : ""}`,
    `Sooduskood: ${funnel.promoCode}`,
    "",
    `Nimi: ${name}`,
    `Telefon: ${phone}`,
    `Email: ${email}`,
    `Kliinik: ${clinic}`,
    preferredTime ? `Eelistatud aeg: ${preferredTime}` : null,
    message ? `Märkused: ${message}` : null,
    "",
    `Allikas: ${source}`,
    `Aeg: ${new Date().toISOString()}`,
  ]
    .filter(Boolean)
    .join("\n");

  const slackText = `Uus broneerimissoov: ${funnel.service} — ${name}`;
  const slackBlocks = [
    {
      type: "header",
      text: { type: "plain_text", text: `📅 ${funnel.service}`, emoji: true },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Nimi:*\n${name}` },
        { type: "mrkdwn", text: `*Telefon:*\n${phone}` },
        { type: "mrkdwn", text: `*Email:*\n${email}` },
        { type: "mrkdwn", text: `*Kliinik:*\n${clinic}` },
        { type: "mrkdwn", text: `*Hind:*\n${funnel.priceLabel}` },
        { type: "mrkdwn", text: `*Kood:*\n${funnel.promoCode}` },
      ],
    },
    ...(preferredTime || message
      ? [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text:
                (preferredTime ? `*Eelistatud aeg:* ${preferredTime}\n` : "") +
                (message ? `*Märkused:* ${message}` : ""),
            },
          },
        ]
      : []),
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: `Allikas: ${source} · ${new Date().toLocaleString("et-EE")}` },
      ],
    },
  ];

  const [emailOk, slackOk] = await Promise.all([
    sendEmail(subject, lines),
    sendSlack(slackText, slackBlocks),
  ]);

  // Email must succeed — it's the source of truth.
  if (!emailOk) {
    return NextResponse.json(
      { ok: false, error: "Vabandust, tekkis tehniline tõrge. Palun proovi uuesti või helista 661 6868." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true, slack: slackOk });
}
