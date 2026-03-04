import * as cheerio from "cheerio";

export async function parseWebPage(
  url: string
): Promise<{ title: string; text: string }> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }

  const html = await response.text();
  return parseHtml(html, url);
}

export function parseHtml(
  html: string,
  sourceUrl?: string
): { title: string; text: string } {
  const $ = cheerio.load(html);

  // Remove non-content elements
  $(
    "script, style, nav, footer, header, aside, .sidebar, .navigation, .menu, .ad, .advertisement"
  ).remove();

  // Try to find main content area
  const mainContent =
    $("main").text() ||
    $("article").text() ||
    $('[role="main"]').text() ||
    $(".content").text() ||
    $("body").text();

  const title =
    $("title").text().trim() ||
    $("h1").first().text().trim() ||
    sourceUrl ||
    "Web Page";

  // Clean up whitespace
  const text = mainContent
    .replace(/\s+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();

  return { title, text };
}
