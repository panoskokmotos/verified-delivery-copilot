import { BlobPreconditionFailedError, get, head, put } from "@vercel/blob";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { SEED } from "./demo";
import type { Seen } from "./integrity";
import { MAX_CALLS_PER_DAY } from "./nebius";
import { sha256 } from "./sign";
import { verified } from "./verified";
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

/**
 * A delivery as it stands: the saved record, or the demo seed when there is none. Demo deliveries go
 * back to their seed a few hours after a check, so the next visitor can run the whole flow too. That
 * costs no writes: the old record is just ignored, everywhere, including when it is changed again.
 */
function current(state: State, id: string): Delivery | undefined {
  const seed = SEED.find((d) => d.id === id);
  const saved = state.deliveries[id];
  // Records saved before deliveries were batched have no donations list: the pages can't render them.
  const usable = saved && Array.isArray(saved.donations);
  const expired = seed && DEMO_RESET_HOURS > 0 && Date.parse(saved?.updatedAt ?? "") < Date.now() - DEMO_RESET_HOURS * 3_600_000;
  return usable && !expired ? saved : seed;
}

/** All deliveries: the demo seeds, overlaid with whatever has been verified since. */
export async function listDeliveries(): Promise<Delivery[]> {
  const { state } = await readState();
  const ids = new Set([...SEED.map((d) => d.id), ...Object.keys(state.deliveries)]);
  return [...ids]
    .map((id) => current(state, id))
    .filter((d): d is Delivery => Boolean(d))
    .sort((a, b) => a.arrivesAt.localeCompare(b.arrivesAt));
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

/** Thrown when a delivery's proof was sent while another check of it was still running. */
export class AlreadySentError extends Error {
  constructor() {
    super("This delivery's proof was just sent by someone else.");
  }
}

/**
 * Reads the state, applies a change, and writes it back only if nobody wrote in between; otherwise
 * reads again and retries. `change` returns false when there is nothing to write, and may throw.
 */
async function mutateState(change: (state: State) => boolean | void) {
  for (let attempt = 0; attempt < 4; attempt++) {
    // On a retry, take the version tag straight from storage (see readState).
    const { state, etag } = await readState(attempt > 0);
    if (state.month !== thisMonth()) Object.assign(state, { month: thisMonth(), verifications: 0, writes: 0 });
    if (change(state) === false) return;
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

/** Adds a check's model calls to today's shared count (one write). */
export async function recordCalls(n: number) {
  if (n <= 0) return;
  await mutateState((state) => {
    if ((state.writes ?? 0) >= MAX_WRITES) return false; // storage budget spent: the per-process cap still holds
    if (state.day !== today()) Object.assign(state, { day: today(), calls: 0 });
    state.calls = (state.calls ?? 0) + n;
    state.writes = (state.writes ?? 0) + 1;
  });
}

/**
 * Changes one delivery (one write). `reserve` keeps that many writes back for checks and proofs, so
 * optional writes like questions can never use up the month.
 */
export async function updateDelivery(id: string, change: (d: Delivery) => Delivery, { reserve = 0 } = {}) {
  await mutateState((state) => {
    if ((state.writes ?? 0) >= MAX_WRITES - reserve) throw new Error("This month's storage limit is reached. It resets on the 1st.");
    const d = current(state, id);
    if (!d) throw new Error("Unknown delivery");
    state.deliveries[id] = change(d);
    state.writes = (state.writes ?? 0) + 1;
  });
}

/** The storage key of a delivery's current proof photo. Older records stored it under the delivery id. */
export const proofKey = (d: Delivery) => d.photoKey ?? d.id;

/**
 * Saves a finished check: the photo under its own key, then the delivery and its fingerprint in one
 * state write. A sent proof is only ever replaced on purpose: `replaces` must name the proof photo the
 * nonprofit saw. Otherwise (a second check still running, two people sending at once) it refuses with
 * AlreadySentError, so nobody overwrites a proof donors already have by accident.
 */
export async function saveVerification(delivery: Delivery, photo: Buffer, { replaces }: { replaces?: string } = {}) {
  const photoKey = `${delivery.id}-${sha256(photo).slice(0, 12)}`;
  await savePhoto(photoKey, photo);
  await mutateState((state) => {
    const before = current(state, delivery.id);
    if (before?.status === "approve") {
      if (!replaces || replaces !== proofKey(before)) throw new AlreadySentError();
      const entry = { at: before.updatedAt ?? "", photoKey: before.photoKey, passedCheck: Boolean(before.result && verified(before.result)) };
      delivery = { ...delivery, replaced: [...(before.replaced ?? []), entry] };
    }
    state.verifications++;
    state.writes = (state.writes ?? 0) + 2; // the photo and this state file
    state.deliveries[delivery.id] = { ...delivery, photoKey };
    const hash = delivery.result?.integrity.hash;
    if (hash) {
      state.hashes = state.hashes.filter((h) => h.id !== delivery.id).concat({ hash, id: delivery.id, at: new Date().toISOString() }).slice(-5000);
    }
  });
}

async function savePhoto(key: string, photo: Buffer) {
  if (useBlob()) {
    await put(`photos/${key}.jpg`, photo, { access: "private", contentType: "image/jpeg", addRandomSuffix: false, allowOverwrite: true });
    return;
  }
  await fs.mkdir(path.join(LOCAL, "photos"), { recursive: true });
  await fs.writeFile(path.join(LOCAL, "photos", `${key}.jpg`), photo);
}

/** The photo of a delivery's current proof. Older records stored it under the delivery id. */
export async function readPhoto(d: Delivery): Promise<Buffer | null> {
  const key = proofKey(d);
  if (useBlob()) {
    const r = await get(`photos/${key}.jpg`, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return null;
    return Buffer.from(await new Response(r.stream).arrayBuffer());
  }
  try {
    return await fs.readFile(path.join(LOCAL, "photos", `${key}.jpg`));
  } catch {
    return null;
  }
}
