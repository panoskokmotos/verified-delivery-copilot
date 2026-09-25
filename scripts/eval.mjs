// Scores the pipeline on labeled photos. Needs the app running (npm run dev).
// Usage: npm run eval   (set EVAL_URL to test a deployed copy)
import { promises as fs } from "node:fs";
import path from "node:path";

const BASE = process.env.EVAL_URL || "http://localhost:3000";
const SETS = ["eval/real", "eval/fake"];
const rows = [];

for (const dir of SETS) {
  let labels = {};
  try {
    labels = JSON.parse(await fs.readFile(path.join(dir, "labels.json"), "utf8"));
  } catch {
    console.log(`skip ${dir} (no labels.json)`);
    continue;
  }
  for (const [file, label] of Object.entries(labels)) {
    const buf = await fs.readFile(path.join(dir, file));
    const type = file.endsWith(".png") ? "image/png" : file.endsWith(".webp") ? "image/webp" : "image/jpeg";
    const form = new FormData();
    form.append("requestText", label.request);
    form.append("orgName", label.orgName || "");
    form.append("city", label.city || "");
    form.append("donorName", "Eval");
    form.append("dryRun", "1");
    form.append("photo", new Blob([buf], { type }), file);
    const t = Date.now();
    const res = await fetch(`${BASE}/api/verify`, { method: "POST", body: form });
    const lines = (await res.text()).trim().split("\n").map((l) => JSON.parse(l));
    const final = lines.find((l) => l.type === "final")?.result;
    const got = final?.decision.verdict ?? "error";
    rows.push({ set: path.basename(dir), file, expected: label.expected, got, score: final?.decision.score ?? null, ms: Date.now() - t, why: final?.decision.reasons?.[0] ?? lines.find((l) => l.type === "error")?.error });
    process.stdout.write(got === label.expected ? "." : "x");
  }
}

const total = rows.length;
const correct = rows.filter((r) => r.got === r.expected).length;
const fakes = rows.filter((r) => r.expected === "reject");
const fakesCaught = fakes.filter((r) => r.got !== "approve").length;
const reals = rows.filter((r) => r.expected === "approve");
const realsApproved = reals.filter((r) => r.got === "approve").length;
const avgMs = total ? Math.round(rows.reduce((a, r) => a + r.ms, 0) / total) : 0;

const md = [
  `# Eval report (${new Date().toISOString().slice(0, 16)})`,
  ``,
  `- Accuracy: ${correct}/${total}`,
  `- Fakes stopped (not approved): ${fakesCaught}/${fakes.length}`,
  `- Real deliveries approved: ${realsApproved}/${reals.length}`,
  `- Average time per case: ${(avgMs / 1000).toFixed(1)}s`,
  ``,
  `| set | file | expected | got | score | reason |`,
  `|---|---|---|---|---|---|`,
  ...rows.map((r) => `| ${r.set} | ${r.file} | ${r.expected} | ${r.got === r.expected ? r.got : "**" + r.got + "**"} | ${r.score ?? ""} | ${(r.why || "").replace(/\|/g, "/")} |`),
].join("\n");
await fs.writeFile("eval/report.md", md);
console.log(`\n${correct}/${total} correct. Fakes stopped ${fakesCaught}/${fakes.length}. Report: eval/report.md`);
