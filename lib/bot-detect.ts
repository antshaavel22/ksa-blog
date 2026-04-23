/** Server-side bot detection by User-Agent. */
const BOT_REGEX =
  /bot|crawl|spider|slurp|mediapartners|adsbot|googlebot|bingbot|duckduckbot|yandexbot|baiduspider|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|pinterest|ahrefsbot|semrushbot|mj12bot|dotbot|rogerbot|petalbot|applebot|gptbot|chatgpt|claudebot|perplexity|anthropic-ai/i;

export function isBot(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  return BOT_REGEX.test(userAgent);
}
