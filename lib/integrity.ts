import sharp from "sharp";
import exifr from "exifr";
import type { IntegrityCheck } from "./types";

/** A fingerprint of an earlier delivery photo, kept in the store. */
export type Seen = { hash: string; id: string; at: string };

/** 64-bit difference hash. Survives resizing and recompression, so a reused photo still matches. */
export async function dHash(buf: Buffer): Promise<string> {
  const { data } = await sharp(buf).rotate().greyscale().resize(9, 8, { fit: "fill" }).raw().toBuffer({ resolveWithObject: true });
  let bits = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      bits += data[y * 9 + x] > data[y * 9 + x + 1] ? "1" : "0";
    }
  }
  return BigInt("0b" + bits).toString(16).padStart(16, "0");
}

/**
 * Reads the AI content label that Google, OpenAI, Adobe and others embed in generated images
 * (IPTC DigitalSourceType, inside XMP or a C2PA manifest). A screenshot strips it, so a
 * missing label proves nothing; a present one is decisive.
 */
function readAiLabel(buf: Buffer): IntegrityCheck["aiLabel"] {
  const s = buf.toString("latin1");
  if (/compositeWithTrainedAlgorithmicMedia/i.test(s)) return "edited";
  if (/trainedAlgorithmicMedia/i.test(s)) return "generated";
  return null;
}

function hamming(a: string, b: string) {
  let x = BigInt("0x" + a) ^ BigInt("0x" + b);
  let n = 0;
  while (x) {
    n += Number(x & 1n);
    x >>= 1n;
  }
  return n;
}

/**
 * original: the uploaded bytes (or just their metadata header), where camera data and AI labels live.
 * photo: the normalized image, fingerprinted to catch a photo reused for another delivery.
 * seen: fingerprints of earlier deliveries. A match on the same delivery id is a retake, not reuse.
 */
export async function checkIntegrity(original: Buffer, photo: Buffer, id: string, seen: Seen[]): Promise<IntegrityCheck> {
  const flags: string[] = [];
  let photoTakenAt: string | null = null;
  let gps: IntegrityCheck["gps"] = null;
  let hasExif = false;

  try {
    const meta = await exifr.parse(original, { gps: true, pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"] });
    if (meta) {
      hasExif = true;
      const d = meta.DateTimeOriginal || meta.CreateDate;
      if (d instanceof Date && !isNaN(d.getTime())) photoTakenAt = d.toISOString();
      if (typeof meta.latitude === "number" && typeof meta.longitude === "number") gps = { lat: meta.latitude, lon: meta.longitude };
    }
  } catch {
    /* no EXIF */
  }

  // Missing or old camera data is normal: nonprofits upload from a shared folder or WhatsApp,
  // which strips metadata, and the photo is often taken earlier by someone else. Only a
  // timestamp in the future counts, since that means the metadata was edited.
  if (photoTakenAt && new Date(photoTakenAt).getTime() > Date.now() + 86_400_000) {
    flags.push("Photo timestamp is in the future. The metadata was likely edited.");
  }

  const aiLabel = readAiLabel(original);
  if (aiLabel === "generated") flags.push("The file is labeled as AI-generated (C2PA / IPTC content label).");
  if (aiLabel === "edited") flags.push("The file is labeled as edited with AI (C2PA / IPTC content label).");

  const hash = await dHash(photo);
  let duplicateOf: string | null = null;
  let best: number | null = null;
  for (const s of seen) {
    if (s.id === id) continue;
    const d = hamming(hash, s.hash);
    if (best === null || d < best) best = d;
    if (d <= 6 && !duplicateOf) duplicateOf = s.id;
  }
  if (duplicateOf) flags.push(`Photo matches an earlier delivery (${duplicateOf}). Possible reuse.`);

  return { photoTakenAt, hasExif, aiLabel, gps, hash, duplicateOf, nearDuplicateDistance: best, flags };
}
