// Builds the "screenshot" half of the fake set: the same AI images with their metadata stripped,
// the way a screenshot or a messaging app would. The content label is gone, so only the visual
// check can catch them. Usage: node scripts/make-fakes.mjs   (reads and extends eval/fake/labels.json)
import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const dir = "eval/fake";
const labels = JSON.parse(await fs.readFile(path.join(dir, "labels.json"), "utf8"));
for (const [file, label] of Object.entries(labels)) {
  if (file.startsWith("stripped-")) continue;
  const out = `stripped-${file.replace(/\.\w+$/, ".jpg")}`;
  const img = sharp(path.join(dir, file));
  const { width } = await img.metadata();
  // Re-encode at a phone-screenshot size, no metadata kept (sharp drops it unless asked).
  await img.resize(Math.min(width ?? 1080, 1080)).jpeg({ quality: 88 }).toFile(path.join(dir, out));
  labels[out] = { ...label, note: `${label.note || ""} Metadata stripped, like a screenshot.`.trim() };
}
await fs.writeFile(path.join(dir, "labels.json"), JSON.stringify(labels, null, 2) + "\n");
console.log(`${Object.keys(labels).length} fake cases in ${dir}/labels.json`);
