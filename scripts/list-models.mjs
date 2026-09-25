// Lists models on your Nebius Token Factory account so you can set exact Nemotron IDs.
const key = process.env.NEBIUS_API_KEY;
if (!key) { console.error("Set NEBIUS_API_KEY first."); process.exit(1); }
const base = process.env.NEBIUS_BASE_URL || "https://api.tokenfactory.nebius.com/v1";
const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${key}` } });
const json = await res.json();
const ids = (json.data || []).map((m) => m.id).sort();
console.log("NVIDIA models:\n" + ids.filter((i) => /nvidia|nemotron/i.test(i)).join("\n"));
console.log(`\n(${ids.length} models total)`);
