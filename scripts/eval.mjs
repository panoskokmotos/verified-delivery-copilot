// Scores the pipeline on labeled photos through the same API a platform would call (/api/v1/verify).
// Needs the app running with VDC_API_KEYS set (npm run dev picks it up from .env.local).
// Usage: npm run eval            (EVAL_URL to test a deployed copy, EVAL_MAX to cap the number of cases)
//
// eval/<set>/labels.json:
//   { "photo.jpg": { "items": [{ "name": "Dog toy", "quantity": 1, "unit": "toys" }],
//                    "expected": "approve" | "review" | "reject", "note": "why" } }
// real/ = genuine deliveries (approve if every item shows, review if some don't). fake/ = AI or reused (reject).
import { promises as fs } from "node:fs";
import path from "node:path";

const BASE = process.env.EVAL_URL || "http://localhost:3000";
const KEY = process.env.EVAL_API_KEY || (process.env.VDC_API_KEYS || "").split(",")[0];
const MAX = Number(process.env.EVAL_MAX || 40); // each case costs 3 or 4 Nebius calls
const ONLY = process.env.EVAL_ONLY ? new RegExp(process.env.EVAL_ONLY) : null; // run a subset, e.g. EVAL_ONLY=stripped
const SETS = ["eval/real", "eval/fake"];
if (!KEY) throw new Error("Set VDC_API_KEYS in .env.local (the server needs it too).");

const cases = [];
for (const dir of SETS) {
  let labels = {};
  try {
    labels = JSON.parse(await fs.readFile(path.join(dir, "labels.json"), "utf8"));
  } catch {
    console.log(`skip ${dir} (no labels.json)`);
    continue;
  }
  for (const [file, label] of Object.entries(labels)) if (!ONLY || ONLY.test(file)) cases.push({ dir, file, label });
}
if (cases.length > MAX) {
  console.log(`${cases.length} cases, capped at ${MAX} (about ${MAX * 4} Nebius calls). Raise EVAL_MAX to run more.`);
  cases.length = MAX;
}
console.log(`Running ${cases.length} cases, about ${cases.length * 4} Nebius calls.`);

const rows = [];
// Fingerprints of earlier REAL deliveries, so a reused real photo gets caught. Fakes are not added:
// otherwise a stripped copy is caught as a duplicate of its own original, which hides how the visual check does.
const known = [];
for (const { dir, file, label } of cases) {
  const buf = await fs.readFile(path.join(dir, file));
  const type = file.endsWith(".png") ? "image/png" : file.endsWith(".webp") ? "image/webp" : "image/jpeg";
  const form = new FormData();
  form.append("photo", new Blob([buf], { type }), file);
  form.append("items", JSON.stringify(label.items));
  form.append("knownHashes", JSON.stringify(known));
  form.append("deliveryId", `${path.basename(dir)}/${file}`);
  const t = Date.now();
  let r;
  try {
    const res = await fetch(`${BASE}/api/v1/verify`, { method: "POST", headers: { Authorization: `Bearer ${KEY}` }, body: form, signal: AbortSignal.timeout(240_000) });
    r = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  } catch (err) {
    r = { error: `no answer: ${err.name}` }; // counted as an error, the run goes on
  }
  if (r.photoHash && dir.endsWith("real")) known.push({ hash: r.photoHash, id: `${path.basename(dir)}/${file}` });
  const got = r.verdict ?? "error";
  const seen = (r.items || []).map((i) => `${i.name}: ${i.seen ?? "?"}/${i.expected} ${i.status}`).join("; ");
  const caughtBy = r.checks?.aiContentLabel ? "AI label" : r.checks?.reusedPhotoOf ? "reuse" : r.checks?.visualAiSigns && r.checks.visualAiSigns !== "none" ? `visual (${r.checks.visualAiSigns})` : "none";
  rows.push({ set: path.basename(dir), file, expected: label.expected, got, caughtBy, vision: r.visionModel ?? "", score: r.score ?? null, ms: Date.now() - t, why: r.reasons?.[0] ?? r.error ?? "", seen, note: label.note || "" });
  process.stdout.write(got === label.expected ? "." : "x");
}

const real = rows.filter((r) => r.set === "real");
const fake = rows.filter((r) => r.set === "fake");
const count = (xs, f) => xs.filter(f).length;
const avgMs = rows.length ? Math.round(rows.reduce((a, r) => a + r.ms, 0) / rows.length) : 0;
const md = [
  `# Eval report (${new Date().toISOString().slice(0, 16)} UTC)`,
  ``,
  `- Real deliveries wrongly rejected: **${count(real, (r) => r.got === "reject")} of ${real.length}**`,
  `- Real deliveries confirmed complete: ${count(real, (r) => r.got === "approve")} of ${real.length}, flagged as partial: ${count(real, (r) => r.got === "review")}`,
  `- Fakes stopped (rejected): **${count(fake, (r) => r.got === "reject")} of ${fake.length}**, let through as partial: ${count(fake, (r) => r.got === "review")}, approved: ${count(fake, (r) => r.got === "approve")}`,
  `- Fakes by what caught them: AI label ${count(fake, (r) => r.caughtBy === "AI label")}, reused photo ${count(fake, (r) => r.caughtBy === "reuse")}, visual check ${count(fake, (r) => r.caughtBy.startsWith("visual"))}, nothing ${count(fake, (r) => r.caughtBy === "none")}`,
  `- Exact verdict match: ${count(rows, (r) => r.got === r.expected)} of ${rows.length}`,
  `- Errors: ${count(rows, (r) => r.got === "error")}`,
  `- Average time per photo: ${(avgMs / 1000).toFixed(1)}s`,
  ``,
  `| set | file | expected | got | signal | score | items | reason | note |`,
  `|---|---|---|---|---|---|---|---|---|`,
  ...rows.map((r) =>
    `| ${r.set} | ${r.file} | ${r.expected} | ${r.got === r.expected ? r.got : "**" + r.got + "**"} | ${r.caughtBy} | ${r.score ?? ""} | ${r.seen.replace(/\|/g, "/")} | ${r.why.replace(/\|/g, "/")} | ${r.note.replace(/\|/g, "/")} |`,
  ),
].join("\n");
await fs.writeFile("eval/report.md", md + "\n");
console.log(`\n${md.split("\n").slice(2, 8).join("\n")}\nReport: eval/report.md`);
