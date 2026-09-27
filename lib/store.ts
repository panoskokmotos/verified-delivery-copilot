import { BlobPreconditionFailedError, get, head, put } from "@vercel/blob";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { SEED } from "./demo";
import type { Seen } from "./integrity";
import { MAX_CALLS_PER_DAY } from "./nebius";
import type { Delivery } from "./types";

// Storage: Vercel Blob (private store) in production, a local folder in dev.
// Everything except photos lives in one state file, so a verification costs exactly two writes
// (photo + state). The Hobby plan allows 2,000 writes a month and blocks the store for 30 days
// past that, so writes are what we budget.

type State = {
  month: string; // YYYY-MM the counter below belongs to
  verifications: number; // saved verifications this month
  writes?: number; // every storage write this month: photos, state, questions, answers
  hashes: Seen[];
  day?: string; // YYYY-MM-DD (UTC) the call count below belongs to
  calls?: number; // model calls today, across every server copy
  deliveries: Record<string, Delivery>;
};

const MAX_PER_MONTH = Number(process.env.MAX_VERIFICATIONS_PER_MONTH || 300);
// The Hobby plan blocks the store for 30 days past 2,000 writes. Stop well before, leaving room for the dashboard.
const MAX_WRITES = Number(process.env.MAX_WRITES_PER_MONTH || 1500);
const STATE = "state.json";
const DEMO_RESET_HOURS = Number(process.env.DEMO_RESET_HOURS ?? 3);
const LOCAL = process.env.VDC_STORE_DIR || path.join(os.tmpdir(), "vdc-store");
const useBlob = () => Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const empty = (): State => ({ month: thisMonth(), verifications: 0, writes: 0, hashes: [], deliveries: {} });

async function readState(fresh = false): Promise<{ state: State; etag?: string }> {
  if (useBlob()) {
    // useCache: false reads the latest version. Cached reads can lag an overwrite by 60s.
    const r = await get(STATE, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return { state: empty() };
    const state = JSON.parse(await new Response(r.stream).text());
    // On a retry, take the version tag from head(), which asks storage directly, as the Blob docs do.
    // A read can still hand back an older copy's tag, and then every conditional write is refused.
    return { state, etag: fresh ? (await head(STATE)).etag : r.blob.etag };
  }
  try {
    return { state: JSON.parse(await fs.readFile(path.join(LOCAL, STATE), "utf8")) };
  } catch {
    return { state: empty() };
  }
}

async function writeState(state: State, etag?: string) {
  const body = JSON.stringify(state);
  if (useBlob()) {
    await put(STATE, body, {
      access: "private",
      contentType: "application/json",
      addRandomSuffix: false,
      allowOverwrite: true,
      ...(etag ? { ifMatch: etag } : {}),
    });
    return;
  }
  await fs.mkdir(LOCAL, { recursive: true });
  await fs.writeFile(path.join(LOCAL, STATE), body);
}

/** All deliveries: the demo seeds, overlaid with whatever has been verified since. */
export async function listDeliveries(): Promise<Delivery[]> {
  const { state } = await readState();
  const byId = new Map(SEED.map((d) => [d.id, d]));
  const resetBefore = Date.now() - DEMO_RESET_HOURS * 3_600_000;
  for (const d of Object.values(state.deliveries)) {
    // Skip records saved before deliveries were batched (no donations list): the pages can't render them.
    if (!Array.isArray(d.donations)) continue;
    // The demo deliveries go back to "awaiting photo" a few hours after someone checks them, so the next
    // visitor can run the whole flow too. Costs no writes: the old record is just ignored.
    if (byId.has(d.id) && DEMO_RESET_HOURS > 0 && Date.parse(d.updatedAt ?? "") < resetBefore) continue;
    byId.set(d.id, d);
  }
  return [...byId.values()].sort((a, b) => a.arrivesAt.localeCompare(b.arrivesAt));
}

export async function getDelivery(id: string): Promise<Delivery | null> {
  return (await listDeliveries()).find((d) => d.id === id) ?? null;
}

const today = () => new Date().toISOString().slice(0, 10);

/** Fingerprints for the reused-photo check, and whether this month's and today's budgets have room. */
export async function preflight(): Promise<{ seen: Seen[]; budgetLeft: number; callsLeftToday: number }> {
  const { state } = await readState();
  const fresh = state.month !== thisMonth();
  const checksLeft = MAX_PER_MONTH - (fresh ? 0 : state.verifications);
  const writesLeft = Math.floor((MAX_WRITES - (fresh ? 0 : state.writes ?? state.verifications * 2)) / 2); // a verification is 2 writes
  const callsLeftToday = MAX_CALLS_PER_DAY - (state.day === today() ? state.calls ?? 0 : 0);
  return { seen: state.hashes, budgetLeft: Math.min(checksLeft, writesLeft), callsLeftToday };
}

/** Adds a finished check's model calls to today's shared count (one write). */
export async function recordCalls(n: number) {
  if (n <= 0) return;
  for (let attempt = 0; attempt < 4; attempt++) {
    const { state, etag } = await readState(attempt > 0);
    if (state.month !== thisMonth()) Object.assign(state, { month: thisMonth(), verifications: 0, writes: 0 });
    if ((state.writes ?? 0) >= MAX_WRITES) return; // storage budget spent: the per-process cap still holds
    if (state.day !== today()) Object.assign(state, { day: today(), calls: 0 });
    state.calls = (state.calls ?? 0) + n;
    state.writes = (state.writes ?? 0) + 1;
    try {
      return await writeState(state, etag);
    } catch (err) {
      if (!(err instanceof BlobPreconditionFailedError)) throw err;
      console.warn(`state.json changed under us (attempt ${attempt + 1}, etag ${etag})`);
      await new Promise((ok) => setTimeout(ok, 300 * (attempt + 1)));
    }
  }
}

/** Changes one delivery in the state file (one write). Throws when this month's write budget is spent. */
export async function updateDelivery(id: string, change: (d: Delivery) => Delivery) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const { state, etag } = await readState(attempt > 0);
    if (state.month !== thisMonth()) Object.assign(state, { month: thisMonth(), verifications: 0, writes: 0 });
    if ((state.writes ?? 0) >= MAX_WRITES) throw new Error("This month's storage limit is reached. It resets on the 1st.");
    const current = state.deliveries[id] ?? SEED.find((d) => d.id === id);
    if (!current) throw new Error("Unknown delivery");
    state.deliveries[id] = change(current);
    state.writes = (state.writes ?? 0) + 1;
    try {
      return await writeState(state, etag);
    } catch (err) {
      if (!(err instanceof BlobPreconditionFailedError)) throw err;
      console.warn(`state.json changed under us (attempt ${attempt + 1}, etag ${etag})`);
      await new Promise((ok) => setTimeout(ok, 300 * (attempt + 1)));
    }
  }
  throw new Error("Could not save. Please try again.");
}

/** Saves a finished verification: the photo, then the delivery and its fingerprint in one state write. */
export async function saveVerification(delivery: Delivery, photo: Buffer) {
  await savePhoto(delivery.id, photo);
  for (let attempt = 0; attempt < 4; attempt++) {
    const { state, etag } = await readState(attempt > 0);
    if (state.month !== thisMonth()) Object.assign(state, { month: thisMonth(), verifications: 0, writes: 0 });
    state.verifications++;
    state.writes = (state.writes ?? 0) + 2; // the photo and this state file
    state.deliveries[delivery.id] = delivery;
    const hash = delivery.result?.integrity.hash;
    if (hash) {
      state.hashes = state.hashes.filter((h) => h.id !== delivery.id).concat({ hash, id: delivery.id, at: new Date().toISOString() }).slice(-5000);
    }
    try {
      return await writeState(state, etag);
    } catch (err) {
      // Someone else saved in between. Re-read and apply our change on top.
      if (!(err instanceof BlobPreconditionFailedError)) throw err;
      console.warn(`state.json changed under us (attempt ${attempt + 1}, etag ${etag})`);
      await new Promise((ok) => setTimeout(ok, 300 * (attempt + 1)));
    }
  }
  throw new Error("Could not save the verification. Please try again.");
}

async function savePhoto(id: string, photo: Buffer) {
  if (useBlob()) {
    await put(`photos/${id}.jpg`, photo, { access: "private", contentType: "image/jpeg", addRandomSuffix: false, allowOverwrite: true });
    return;
  }
  await fs.mkdir(path.join(LOCAL, "photos"), { recursive: true });
  await fs.writeFile(path.join(LOCAL, "photos", `${id}.jpg`), photo);
}

export async function readPhoto(id: string): Promise<Buffer | null> {
  if (useBlob()) {
    const r = await get(`photos/${id}.jpg`, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return Buffer.from(await new Response(r.stream).arrayBuffer());
  }
  try {
    return await fs.readFile(path.join(LOCAL, "photos", `${id}.jpg`));
  } catch {
    return null;
  }
}
