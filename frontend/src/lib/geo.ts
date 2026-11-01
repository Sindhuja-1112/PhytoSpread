import type { LatLng } from "@/types";

const R = 6378137;

/** Geodesic polygon area in m² (spherical excess approximation, same as Leaflet.draw). */
export function polygonArea(pts: LatLng[]): number {
  if (pts.length < 3) return 0;
  let area = 0;
  const rad = Math.PI / 180;
  for (let i = 0; i < pts.length; i++) {
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    area += (p2.lng - p1.lng) * rad * (2 + Math.sin(p1.lat * rad) + Math.sin(p2.lat * rad));
  }
  return Math.abs((area * R * R) / 2);
}

export const toHectares = (m2: number) => m2 / 10000;

export function pointInPolygon(p: LatLng, poly: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].lng, yi = poly[i].lat, xj = poly[j].lng, yj = poly[j].lat;
    const intersect = yi > p.lat !== yj > p.lat && p.lng < ((xj - xi) * (p.lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function bbox(poly: LatLng[]) {
  const lats = poly.map((p) => p.lat), lngs = poly.map((p) => p.lng);
  return { minLat: Math.min(...lats), maxLat: Math.max(...lats), minLng: Math.min(...lngs), maxLng: Math.max(...lngs) };
}

/** Simple self-intersection check for user-drawn polygons. */
export function isSimplePolygon(poly: LatLng[]): boolean {
  const n = poly.length;
  if (n < 3) return false;
  const seg = (a: LatLng, b: LatLng, c: LatLng, d: LatLng) => {
    const ccw = (p: LatLng, q: LatLng, r: LatLng) => (r.lat - p.lat) * (q.lng - p.lng) > (q.lat - p.lat) * (r.lng - p.lng);
    return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
  };
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (Math.abs(i - j) <= 1 || (i === 0 && j === n - 1)) continue;
      if (seg(poly[i], poly[(i + 1) % n], poly[j], poly[(j + 1) % n])) return false;
    }
  }
  return true;
}

/** Cell centre geographic coordinate for a grid laid over the field bbox. */
export function cellCenter(poly: LatLng[], n: number, idx: number): LatLng {
  const b = bbox(poly);
  const r = Math.floor(idx / n), c = idx % n;
  return {
    lat: b.maxLat - ((r + 0.5) / n) * (b.maxLat - b.minLat),
    lng: b.minLng + ((c + 0.5) / n) * (b.maxLng - b.minLng),
  };
}

export function seededRandom(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}
