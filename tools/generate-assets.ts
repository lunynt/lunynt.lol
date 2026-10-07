import { mkdir } from "node:fs/promises";
import sharp from "sharp";
import { site, profile } from "../src/config.ts";

const CANVAS = "#0a0a0b";
const SURFACE = "#131316";
const LINE = "#26262c";
const INK = "#f4f4f5";
const MUTED = "#9b9ba4";

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function wrap(value: string, width: number): string[] {
  const words = value.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current.length > 0 ? `${current} ${word}` : word;
    if (candidate.length > width && current.length > 0) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }

  if (current.length > 0) {
    lines.push(current);
  }

  return lines;
}

function ogSvg(): string {
  const description = wrap(site.description, 46)
    .slice(0, 2)
    .map(
      (line, index) =>
        `<text x="120" y="${430 + index * 40}" font-family="Inter, Helvetica, Arial, sans-serif" font-size="28" fill="${MUTED}">${escapeXml(line)}</text>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="${CANVAS}"/>
  <rect x="48" y="48" width="1104" height="534" rx="32" fill="${SURFACE}" stroke="${LINE}" stroke-width="2"/>
  <rect x="120" y="150" width="44" height="44" rx="12" fill="${CANVAS}" stroke="${LINE}" stroke-width="2"/>
  <text x="120" y="320" font-family="Inter, Helvetica, Arial, sans-serif" font-size="104" font-weight="700" letter-spacing="-3" fill="${INK}">${escapeXml(profile.name)}</text>
  <text x="122" y="380" font-family="Inter, Helvetica, Arial, sans-serif" font-size="30" fill="${MUTED}">${escapeXml(new URL(site.url).host)}</text>
  ${description}
</svg>`;
}

await mkdir("public", { recursive: true });
await sharp(Buffer.from(ogSvg())).png().toFile("public/og.png");
console.log("generated public/og.png");
