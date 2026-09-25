// Blocks `git commit` / `git push` if the staged diff contains something that looks like an API key.
import { execSync } from "node:child_process";

let input = "";
for await (const chunk of process.stdin) input += chunk;
const cmd = JSON.parse(input || "{}")?.tool_input?.command || "";
if (!/\bgit\s+(commit|push)\b/.test(cmd)) process.exit(0);

let diff = "";
try {
  diff = execSync("git diff --cached", { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
} catch {
  process.exit(0);
}
const patterns = [/tvly-[A-Za-z0-9]{20,}/, /sk-[A-Za-z0-9]{20,}/, /NEBIUS_API_KEY\s*=\s*\S{12,}/, /eyJ[A-Za-z0-9_-]{30,}\.[A-Za-z0-9_-]{10,}/];
const hit = diff.split("\n").find((l) => l.startsWith("+") && patterns.some((p) => p.test(l)));
if (hit) {
  console.error("Blocked: the staged diff looks like it contains an API key. Remove it and use .env.local.");
  process.exit(2);
}
process.exit(0);
