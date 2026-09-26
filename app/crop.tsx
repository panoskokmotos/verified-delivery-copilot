"use client";

import { useState } from "react";
import Cropper, { type Area } from "react-easy-crop";
import "react-easy-crop/react-easy-crop.css";

const SHAPES = [
  { label: "4:3", value: 4 / 3 },
  { label: "Square", value: 1 },
  { label: "3:4", value: 3 / 4 },
  { label: "16:9", value: 16 / 9 },
];

/**
 * Crop and zoom before checking, as nonprofits can on Givelink. Shows the face-blurred preview; the crop
 * is applied to the photo underneath and faces are looked for again in the result.
 */
export function CropPhoto({ preview, onDone, onCancel }: { preview: string; onDone: (area: Area) => void; onCancel: () => void }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [aspect, setAspect] = useState(4 / 3);
  const [area, setArea] = useState<Area | null>(null);
  return (
    <div className="crop">
      <div className="crop-stage">
        <Cropper image={preview} crop={crop} zoom={zoom} aspect={aspect} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={(_, px) => setArea(px)} />
      </div>
      <div className="crop-shapes">
        {SHAPES.map((s) => (
          <button key={s.label} type="button" className={aspect === s.value ? "on" : ""} onClick={() => setAspect(s.value)}>{s.label}</button>
        ))}
      </div>
      <label className="crop-zoom">
        Zoom
        <input type="range" min={1} max={4} step={0.05} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
      </label>
      <div className="crop-actions">
        <button type="button" className="btn subtle" onClick={onCancel}>Cancel</button>
        <button type="button" className="btn primary" disabled={!area} onClick={() => area && onDone(area)}>Use this crop</button>
      </div>
    </div>
  );
}
