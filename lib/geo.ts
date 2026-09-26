export type LatLon = { lat: number; lon: number };

/** Distance in km between two points (haversine). */
export function km(a: LatLon, b: LatLon): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lon - a.lon) / 2) ** 2;
  return Math.round(12742 * Math.asin(Math.sqrt(h)) * 10) / 10;
}

// Beyond this, a location is worth a notice. A charity may shoot the goods at its warehouse, so it never rejects.
export const NEAR_KM = 25;

export function parseLatLon(lat: unknown, lon: unknown): LatLon | undefined {
  const a = Number(lat);
  const b = Number(lon);
  return lat !== null && lat !== "" && Number.isFinite(a) && Number.isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 ? { lat: a, lon: b } : undefined;
}
