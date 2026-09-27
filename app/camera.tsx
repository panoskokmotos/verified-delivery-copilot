"use client";

import { useEffect, useRef, useState } from "react";
import type { Area } from "react-easy-crop";
import { CropPhoto } from "./crop";
import { blurFaces, findFaces, type Box } from "./face-blur";

/** What gets sent for checking: faces already blurred, plus how and where it was taken. */
export type Shot = {
  photo: Blob; // what the check sees and what donors may see
  preview: string;
  name: string;
  meta?: Blob; // header of a gallery file: camera data and AI labels live there
  inApp: boolean; // taken with the live camera here, not picked from the gallery
  location: { lat: number; lon: number } | null;
  faces: number;
};

const MAX_SIDE = 2048;

async function toCanvas(src: CanvasImageSource, w: number, h: number): Promise<HTMLCanvasElement> {
  const k = Math.min(1, MAX_SIDE / Math.max(w, h));
  const c = document.createElement("canvas");
  c.width = Math.round(w * k);
  c.height = Math.round(h * k);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return c;
}

/**
 * Proof is taken with the phone camera inside the page, so it's a photo of now, not an old one from the
 * gallery. Location is asked for at the same moment. Faces are found on the phone, and the
 * nonprofit can blur them there before sending, so an unblurred face never has to leave the phone.
 */
export function Camera({ onShot, disabled }: { onShot: (s: Shot | null) => void; disabled?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [live, setLive] = useState<MediaStream | null>(null);
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [blur, setBlur] = useState(false); // off by default: the nonprofit turns it on when people are in the photo
  const [source, setSource] = useState<{ canvas: HTMLCanvasElement; faces: Box[]; inApp: boolean; meta?: Blob; name: string } | null>(null);
  const [shot, setShot] = useState<Shot | null>(null);
  const [dragging, setDragging] = useState(false);
  const [cropping, setCropping] = useState(false);

  useEffect(() => () => live?.getTracks().forEach((t) => t.stop()), [live]);

  async function openCamera() {
    setStatus(null);
    navigator.geolocation?.getCurrentPosition(
      (p) => setLocation({ lat: p.coords.latitude, lon: p.coords.longitude }),
      () => setLocation(null),
      { timeout: 10_000 },
    );
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment", width: { ideal: 1920 } }, audio: false });
      setLive(stream);
      setShot(null);
      setSource(null);
      onShot(null);
      requestAnimationFrame(() => {
        if (video.current) video.current.srcObject = stream;
      });
    } catch {
      setStatus("No camera access. Allow the camera in your browser, or choose a photo instead.");
    }
  }

  async function process(canvas: HTMLCanvasElement, inApp: boolean, name: string, meta?: Blob) {
    setStatus("Looking for faces to blur…");
    let faces: Box[] = [];
    try {
      faces = await findFaces(canvas);
    } catch {
      setStatus("Couldn't look for faces on this device. Only send photos where everyone agreed to be shown.");
    }
    setSource({ canvas, faces, inApp, meta, name });
    setStatus(null);
  }

  async function takePhoto() {
    const v = video.current;
    if (!v) return;
    const canvas = await toCanvas(v, v.videoWidth, v.videoHeight);
    live?.getTracks().forEach((t) => t.stop());
    setLive(null);
    await process(canvas, true, "camera.jpg");
  }

  async function pickFile(f: File | null) {
    if (!f) return;
    // A chosen photo replaces the live camera: close it so the preview shows the chosen photo.
    live?.getTracks().forEach((t) => t.stop());
    setLive(null);
    const bmp = await createImageBitmap(f);
    await process(await toCanvas(bmp, bmp.width, bmp.height), false, f.name, f.slice(0, 512 * 1024));
  }

  // Cut the unblurred photo to the chosen area, then look for faces again in what's left.
  async function applyCrop(a: Area) {
    if (!source) return;
    setCropping(false);
    const c = document.createElement("canvas");
    c.width = Math.round(a.width);
    c.height = Math.round(a.height);
    c.getContext("2d")!.drawImage(source.canvas, a.x, a.y, a.width, a.height, 0, 0, c.width, c.height);
    await process(c, source.inApp, source.name, source.meta);
  }

  // Build what gets sent whenever the photo or the blur switch changes.
  useEffect(() => {
    if (!source) return;
    const out = document.createElement("canvas");
    out.width = source.canvas.width;
    out.height = source.canvas.height;
    out.getContext("2d")!.drawImage(source.canvas, 0, 0);
    if (blur) blurFaces(out, source.faces);
    out.toBlob(
      (blob) => {
        if (!blob) return;
        const s: Shot = { photo: blob, preview: URL.createObjectURL(blob), name: source.name, meta: source.meta, inApp: source.inApp, location, faces: source.faces.length };
        setShot(s);
        onShot(s);
      },
      "image/jpeg",
      0.88,
    );
  }, [source, blur, location, onShot]);

  return (
    <div className="camera">
      {live ? (
        <>
          <video ref={video} autoPlay playsInline muted className="viewfinder" />
          <button className="btn primary block" onClick={takePhoto}>📸 Take photo</button>
        </>
      ) : shot && cropping ? (
        <CropPhoto preview={shot.preview} onDone={applyCrop} onCancel={() => setCropping(false)} />
      ) : shot ? (
        <img src={shot.preview} alt="Delivery photo" className="viewfinder" />
      ) : (
        <div
          className={`drop${dragging ? " over" : ""}`}
          onClick={() => !disabled && openCamera()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const f = e.dataTransfer.files?.[0];
            if (f && /^image\/(jpeg|png|webp)$/.test(f.type) && !disabled) pickFile(f);
          }}
        >
          📷 Open camera <span className="sub">or drop a photo here</span>
          <ul>
            <li>All donated items, with labels readable</li>
            <li>A packing slip or label, if you have one</li>
            <li>People in the photo? You can blur their faces before sending</li>
          </ul>
        </div>
      )}
      {shot && (
        <div className="shot-info">
          <span className={`pill ${shot.inApp ? "success" : "warning"}`}>{shot.inApp ? "📸 Taken live in the app" : "From the gallery"}</span>
          {shot.location && <span className="pill">📍 Location shared with Givelink</span>}
          {blur && <span className="pill">{shot.faces} {shot.faces === 1 ? "face" : "faces"} blurred</span>}
        </div>
      )}
      {source && source.faces.length > 0 && (
        <label className="check">
          <input type="checkbox" checked={blur} onChange={(e) => setBlur(e.target.checked)} />
          Blur the {source.faces.length === 1 ? "face" : `${source.faces.length} faces`} we found before sending
        </label>
      )}
      {status && <p className="sub">{status}</p>}
      <div className="alt">
        {shot && !disabled && !cropping && <button className="link" onClick={() => setCropping(true)}>Crop or zoom</button>}
        {shot && !disabled && <button className="link" onClick={openCamera}>Retake</button>}
        <button className="link" onClick={() => fileRef.current?.click()} disabled={disabled}>No camera? Choose a photo</button>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => {
          pickFile(e.target.files?.[0] ?? null);
          e.target.value = ""; // choosing the same file again still counts
        }} />
    </div>
  );
}
