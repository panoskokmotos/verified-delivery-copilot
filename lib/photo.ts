import sharp from "sharp";

/** The stored and model-facing version of a photo: upright, at most 1600 px, JPEG. */
export const normalizePhoto = (raw: Buffer) =>
  sharp(raw).rotate().resize(1600, 1600, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82 }).toBuffer();
