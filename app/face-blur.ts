"use client";

// Finds faces in the browser and blurs them before the photo leaves the phone.
// MediaPipe's face detector sees a 128 px image, so faces in a group shot get lost when the whole
// photo is shrunk to it. We scan overlapping tiles at three sizes so every face looks big in one of them.
// On two real delivery photos this found all 6 faces, plus 2 false spots on packages.
import type { FaceDetector } from "@mediapipe/tasks-vision";

const VERSION = "1.0.1";
const MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";
let detector: Promise<FaceDetector> | null = null;

function load(): Promise<FaceDetector> {
  detector ??= (async () => {
    const { FaceDetector, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks(`https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`);
    return FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: MODEL, delegate: "CPU" }, runningMode: "IMAGE", minDetectionConfidence: 0.5 });
  })();
  return detector;
}

export type Box = { x: number; y: number; w: number; h: number };

export async function findFaces(img: CanvasImageSource & { width: number; height: number }): Promise<Box[]> {
  const det = await load();
  const W = img.width;
  const H = img.height;
  const found: (Box & { score: number })[] = [];
  const tile = document.createElement("canvas");
  tile.width = tile.height = 256;
  const ctx = tile.getContext("2d")!;
  for (const size of [Math.max(W, H) / 2, Math.max(W, H) / 4, Math.max(W, H) / 8]) {
    const step = size / 2;
    for (let y0 = 0; y0 < H - step / 2; y0 += step) {
      for (let x0 = 0; x0 < W - step / 2; x0 += step) {
        ctx.clearRect(0, 0, 256, 256);
        ctx.drawImage(img, x0, y0, size, size, 0, 0, 256, 256);
        for (const d of det.detect(tile).detections) {
          const score = d.categories?.[0]?.score ?? 0;
          const b = d.boundingBox;
          if (score < 0.6 || !b) continue;
          const k = size / 256;
          found.push({ x: x0 + b.originX * k, y: y0 + b.originY * k, w: b.width * k, h: b.height * k, score });
        }
      }
    }
  }
  // The same face shows up in several tiles: keep the strongest.
  const kept: Box[] = [];
  for (const b of found.sort((a, z) => z.score - a.score)) {
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    if (!kept.some((m) => Math.abs(m.x + m.w / 2 - cx) < Math.max(m.w, b.w) * 0.5 && Math.abs(m.y + m.h / 2 - cy) < Math.max(m.h, b.h) * 0.5)) kept.push(b);
  }
  return kept;
}

/** Blurs each box (grown a little to cover hair and chin) on the canvas in place. */
export function blurFaces(canvas: HTMLCanvasElement, boxes: Box[]) {
  const ctx = canvas.getContext("2d")!;
  for (const b of boxes) {
    const pad = b.w * 0.35;
    const x = Math.max(0, b.x - pad);
    const y = Math.max(0, b.y - pad);
    const w = Math.min(canvas.width - x, b.w + pad * 2);
    const h = Math.min(canvas.height - y, b.h + pad * 2);
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.clip();
    ctx.filter = `blur(${Math.max(8, Math.round(w / 6))}px)`;
    ctx.drawImage(canvas, x, y, w, h, x, y, w, h);
    ctx.drawImage(canvas, x, y, w, h, x, y, w, h); // twice: one pass leaves faces readable
    ctx.restore();
  }
}
