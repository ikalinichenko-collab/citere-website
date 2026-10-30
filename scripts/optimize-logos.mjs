// One-off helper: resize assistant marks to 2× the largest on-screen size (52px)
// and save as WebP. Safe to re-run after dropping new brand files in src/assets/logos/.
import sharp from "sharp";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const dir = path.join(ROOT, "src/assets/logos");
const maxPx = 104;

const jobs = [
  { in: "google-gemini.jpeg", out: "google-gemini.webp", remove: "google-gemini.jpeg" },
  { in: "xai-grok.jpg", out: "xai-grok.webp", remove: "xai-grok.jpg" },
  { in: "anthropic-claude.png", out: "anthropic-claude.webp", remove: "anthropic-claude.png" },
  { in: "openai.webp", out: "openai.webp", remove: null },
];

for (const job of jobs) {
  const inp = path.join(dir, job.in);
  try {
    await fs.access(inp);
  } catch {
    console.warn("skip (missing):", job.in);
    continue;
  }
  const outPath = path.join(dir, job.out);
  const tmp = path.join(dir, `.opt-${job.out}`);
  await sharp(inp)
    .rotate()
    .resize(maxPx, maxPx, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 6 })
    .toFile(tmp);
  await fs.unlink(outPath).catch(() => {});
  await fs.rename(tmp, outPath);
  const stat = await fs.stat(outPath);
  const meta = await sharp(outPath).metadata();
  console.log(`${job.out}\t${meta.width}x${meta.height}\t${stat.size} B`);
  if (job.remove && job.remove !== job.out) {
    await fs.unlink(path.join(dir, job.remove)).catch(() => {});
  }
}
