import { BlobPreconditionFailedError, get, put } from "@vercel/blob";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { SEED } from "./demo";
import type { Seen } from "./integrity";
import type { Delivery } from "./types";

// Storage: Vercel Blob (private store) in production, a local folder in dev.
// Everything except photos lives in one state file, so a verification costs exactly two writes
// (photo + state). The Hobby plan allows 2,000 writes a month and blocks the store for 30 days
// past that, so writes are what we budget.

type State = {
  month: string; // YYYY-MM the counter below belongs to
  verifications: number; // saved verifications this month
  hashes: Seen[];
  deliveries: Record<string, Delivery>;
};

const MAX_PER_MONTH = Number(process.env.MAX_VERIFICATIONS_PER_MONTH || 300);
const STATE = "state.json";
const LOCAL = path.join(os.tmpdir(), "vdc-store");
const useBlob = () => Boolean(process.env.BLOB_STORE_ID || process.env.BLOB_READ_WRITE_TOKEN);
const thisMonth = () => new Date().toISOString().slice(0, 7);
const empty = (): State => ({ month: thisMonth(), verifications: 0, hashes: [], deliveries: {} });

async function readState(): Promise<{ state: State; etag?: string }> {
  if (useBlob()) {
    // useCache: false reads the latest version. Cached reads can lag an overwrite by 60s.
    const r = await get(STATE, { access: "private", useCache: false });
    if (!r || r.statusCode !== 200) return { state: empty() };
    return { state: JSON.parse(await new Response(r.stream).text()), etag: r.blob.etag };
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
  for (const d of Object.values(state.deliveries)) byId.set(d.id, d);
  return [...byId.values()].sort((a, b) => b.pledgedAt.localeCompare(a.pledgedAt));
}

export async function getDelivery(id: string): Promise<Delivery | null> {
  return (await listDeliveries()).find((d) => d.id === id) ?? null;
}

/** Fingerprints for the reused-photo check, and whether this month's budget has room. */
export async function preflight(): Promise<{ seen: Seen[]; budgetLeft: number }> {
  const { state } = await readState();
  const used = state.month === thisMonth() ? state.verifications : 0;
  return { seen: state.hashes, budgetLeft: MAX_PER_MONTH - used };
}

/** Saves a finished verification: the photo, then the delivery and its fingerprint in one state write. */
export async function saveVerification(delivery: Delivery, photo: Buffer) {
  await savePhoto(delivery.id, photo);
  for (let attempt = 0; attempt < 3; attempt++) {
    const { state, etag } = await readState();
    if (state.month !== thisMonth()) Object.assign(state, { month: thisMonth(), verifications: 0 });
    state.verifications++;
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
