import { NextRequest, NextResponse } from "next/server";
import { BOOKING_FUNNELS, type BookingFunnel } from "@/lib/booking-funnels";

// Receives booking-form submission from /broneeri/[funnel] and posts a
// notification to #kiirtesti-täitmised via Slack incoming webhook.
//
// Email delivery is handled CLIENT-SIDE (browser → Web3Forms) because the free
// Web3Forms plan blocks server-side requests. That split is fine: the email is
// the source of truth (lands in registreerumised@ksa.ee inbox); Slack is just
// the instant-notification surface for the team.

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
  // Strip ASCII control chars (keeps printable + UTF-8 incl. Estonian/Russian)
  return s.replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

function isEmail(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
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
    return NextResponse.json(
      { ok: false, error: "Email ei ole õigesti vormistatud." },
      { status: 400 },
    );
  }
  if (!raw.consent) {
    return NextResponse.json(
      { ok: false, error: "Palun kinnita andmete töötlemise nõusolek." },
      { status: 400 },
    );
  }

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
        {
          type: "mrkdwn",
          text: `Allikas: ${source} · ${new Date().toLocaleString("et-EE")}`,
        },
      ],
    },
  ];

  const slackOk = await sendSlack(slackText, slackBlocks);

  // Slack failure shouldn't block the user — email is the source of truth and
  // is sent client-side independently. Return ok:true either way; surface the
  // slack status to the client for logging.
  return NextResponse.json({ ok: true, slack: slackOk });
}
