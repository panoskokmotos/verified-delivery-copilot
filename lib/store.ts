import { BlobPreconditionFailedError, get, head, put } from "@vercel/blob";
import { promises as fs } from "fs";
import os from "os";
import path from "path";
import { ORGS, SEED, WISHLIST } from "./demo";
import type { Seen } from "./integrity";
import { MAX_CALLS_PER_DAY } from "./nebius";
import { sha256 } from "./sign";
import { verified } from "./verified";
import type { Delivery, Recall, WishItem } from "./types";

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
  wishlist?: Record<string, WishItem[]>; // by nonprofit id; overrides the demo wishlist for that nonprofit
  products?: Record<string, { name: string; image?: string; url?: string; price?: number; recall: Recall; at: string }>; // lookup cache
  tavilyDay?: string;
  tavilyCalls?: number; // Tavily calls today, across every server copy
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

// ---------- Wishlists ----------

const MAX_TAVILY_PER_DAY = Number(process.env.TAVILY_MAX_CALLS_PER_DAY || 40);
const MAX_WISH_ITEMS = 12; // per nonprofit, so a busy demo can't grow the state file without bound

export async function tavilyLeftToday(): Promise<number> {
  const { state } = await readState();
  return MAX_TAVILY_PER_DAY - (state.tavilyDay === today() ? state.tavilyCalls ?? 0 : 0);
}

/** Counts Tavily calls before they are made (one write each), so the cap holds across server copies. */
export async function recordTavily(n: number) {
  await mutateState((state) => {
    if ((state.writes ?? 0) >= MAX_WRITES) throw new Error("This month's storage limit is reached. It resets on the 1st.");
    if (state.tavilyDay !== today()) Object.assign(state, { tavilyDay: today(), tavilyCalls: 0 });
    state.tavilyCalls = (state.tavilyCalls ?? 0) + n;
    state.writes = (state.writes ?? 0) + 1;
  });
}

const wishlistOf = (state: State, orgId: string): WishItem[] => state.wishlist?.[orgId] ?? WISHLIST[orgId] ?? [];

export async function listWishlists(): Promise<Record<string, WishItem[]>> {
  const { state } = await readState();
  return Object.fromEntries(ORGS.map((o) => [o.id, wishlistOf(state, o.id)]));
}

/** A cached lookup for this product link or name, if one was made before. */
export async function cachedProduct(key: string) {
  const { state } = await readState();
  return state.products?.[key] ?? null;
}

/** Adds a product to a nonprofit's wishlist and caches its lookup (one write). */
export async function addWishItem(item: WishItem, cacheKey: string) {
  await mutateState((state) => {
    if ((state.writes ?? 0) >= MAX_WRITES - 200) throw new Error("This month's storage limit is reached. It resets on the 1st.");
    const list = wishlistOf(state, item.orgId);
    if (list.length >= MAX_WISH_ITEMS) throw new Error(`A wishlist holds up to ${MAX_WISH_ITEMS} products in this demo.`);
    if (list.some((i) => i.key === cacheKey)) throw new Error("This product is already on your wishlist.");
    state.wishlist = { ...state.wishlist, [item.orgId]: [...list, { ...item, key: cacheKey }] };
    const { name, image, url, price, recall } = item;
    if (recall) state.products = { ...state.products, [cacheKey]: { name, image, url, price, recall, at: new Date().toISOString() } };
    state.writes = (state.writes ?? 0) + 1;
  });
}

const supplierOf = (url?: string) => {
  const host = url ? new URL(url).hostname.replace(/^www\./, "") : "";
  const known: Record<string, string> = { "amazon.com": "Amazon", "walmart.com": "Walmart", "target.com": "Target", "chewy.com": "Chewy" };
  return known[host] ?? (host || "Online store");
};

/**
 * A donor gives from a wishlist (one write). The gift joins the nonprofit's open delivery, or starts one,
 * carrying the product's photo and recall result so the photo check and the receipt can show them.
 * In the demo the delivery counts as arrived at once, so the photo check can be tried straight away.
 */
export async function giveFromWishlist(orgId: string, itemId: string, donorId: string, donorName: string, quantity: number): Promise<string> {
  let deliveryId = "";
  await mutateState((state) => {
    if ((state.writes ?? 0) >= MAX_WRITES - 200) throw new Error("This month's storage limit is reached. It resets on the 1st.");
    const org = ORGS.find((o) => o.id === orgId);
    const list = wishlistOf(state, orgId);
    const item = list.find((i) => i.id === itemId);
    if (!org || !item) throw new Error("Unknown product");
    if (item.recall?.status === "found") throw new Error("This product has a recall notice, so it can't be given.");
    if (quantity < 1 || quantity > item.quantity - item.given) throw new Error(`Only ${item.quantity - item.given} still needed.`);

    const open = Object.values(state.deliveries).find((d) => d.id.startsWith(`wl-${orgId}-`) && d.status === "awaiting_photo");
    const now = new Date().toISOString();
    const base: Delivery = open ?? {
      id: `wl-${orgId}-${Date.now().toString(36)}`,
      orgName: org.name,
      city: org.city,
      cause: org.cause,
      location: org.location,
      supplier: supplierOf(item.url),
      orderCode: `GL-${3000 + Math.floor(Math.random() * 6000)}`,
      arrivesAt: today(),
      status: "awaiting_photo",
      donations: [],
    };
    const { id: _id, orgId: _org, addedAt: _at, given: _given, ...line } = item;
    const mine = base.donations.find((x) => x.donorId === donorId);
    const donations = mine
      ? base.donations.map((x) => (x.donorId === donorId ? { ...x, items: [...x.items, { ...line, quantity }] } : x))
      : [...base.donations, { donorId, donorName, items: [{ ...line, quantity }] }];
    state.deliveries[base.id] = { ...base, donations, updatedAt: now };
    state.wishlist = { ...state.wishlist, [orgId]: list.map((i) => (i.id === itemId ? { ...i, given: i.given + quantity } : i)) };
    state.writes = (state.writes ?? 0) + 1;
    deliveryId = base.id;
  });
  return deliveryId;
}

