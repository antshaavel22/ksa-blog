import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

// Build a photographic FLUX prompt from article metadata
async function buildImagePrompt(
  title: string,
  excerpt: string,
  lang: string
): Promise<string> {
  const response = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 300,
    messages: [
      {
        role: "user",
        content: `You are a creative director for KSA Vision Clinic (ksa.ee), an ophthalmology clinic in Tallinn, Estonia.

Create a FLUX image generation prompt for a blog article with this metadata:
Title: ${title}
Excerpt: ${excerpt}
Language: ${lang}

Rules for the prompt:
- Realistic, documentary-style photo like shot on iPhone 15 Pro
- Soft natural light, slightly warm tones, calm and reassuring mood
- No text, no logos, no watermarks, no people's faces visible
- Medical/eye health themes: eyes, vision, light, clarity, nature, calm indoor spaces
- Professional but approachable — like a Scandinavian clinic aesthetic
- 16:9 landscape orientation
- Return ONLY the prompt text, nothing else. Max 120 words.

Examples of good KSA image subjects: close-up of an eye with beautiful iris detail, soft morning light through a clinic window, green nature through clear glass, a person looking at a sunset (from behind), abstract bokeh lights resembling eye examination equipment, calm Nordic interior with plants.`,
      },
    ],
  });

  const text = response.content[0];
  if (text.type !== "text") throw new Error("Unexpected response type");
  return text.text.trim();
}

// Call Replicate FLUX.1-schnell and poll for result
async function generateWithReplicate(prompt: string): Promise<string> {
  const token = process.env.REPLICATE_API_TOKEN;
  if (!token) throw new Error("REPLICATE_API_TOKEN not configured");

  // Create prediction
  const createRes = await fetch("https://api.replicate.com/v1/models/black-forest-labs/flux-schnell/predictions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "wait=60",
    },
    body: JSON.stringify({
      input: {
        prompt,
        aspect_ratio: "16:9",
        output_format: "webp",
        output_quality: 85,
        num_outputs: 1,
      },
    }),
  });

  if (!createRes.ok) {
    const err = await createRes.text();
    throw new Error(`Replicate error: ${createRes.status} ${err}`);
  }

  const prediction = await createRes.json() as {
    id: string;
    status: string;
    output?: string[];
    urls?: { get: string };
  };

  // If already completed (Prefer: wait=60 returns synchronously when done)
  if (prediction.status === "succeeded" && prediction.output?.[0]) {
    return prediction.output[0];
  }

  // Otherwise poll
  const pollUrl = prediction.urls?.get ?? `https://api.replicate.com/v1/predictions/${prediction.id}`;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const pollRes = await fetch(pollUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const polled = await pollRes.json() as { status: string; output?: string[]; error?: string };
    if (polled.status === "succeeded" && polled.output?.[0]) return polled.output[0];
    if (polled.status === "failed") throw new Error(`Generation failed: ${polled.error}`);
  }
  throw new Error("Image generation timed out after 60s");
}

export async function POST(req: NextRequest) {
  const { title, excerpt, lang } = (await req.json()) as {
    title: string;
    excerpt: string;
    lang?: string;
  };

  if (!title) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }

  try {
    // Step 1: Claude crafts the perfect photographic prompt
    const imagePrompt = await buildImagePrompt(title, excerpt ?? "", lang ?? "et");

    // Step 2: Check if Replicate is configured
    if (!process.env.REPLICATE_API_TOKEN) {
      // Return just the prompt so editor can use it manually
      return NextResponse.json({
        ok: true,
        imageUrl: null,
        prompt: imagePrompt,
        note: "REPLICATE_API_TOKEN not set — use prompt manually in Midjourney or DALL-E",
      });
    }

    // Step 3: Generate the image
    const imageUrl = await generateWithReplicate(imagePrompt);

    return NextResponse.json({ ok: true, imageUrl, prompt: imagePrompt });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
