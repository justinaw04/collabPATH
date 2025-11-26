// src/utils/geo.ts
import type { LatLng } from "../state/types.ts";

const R = 3958.8; // miles

function toRad(x: number) {
  return (x * Math.PI) / 180;
}

export function haversineMiles(a: LatLng, b: LatLng) {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}

export function polylineMiles(points: LatLng[]) {
  let miles = 0;
  for (let i = 1; i < points.length; i++) {
    miles += haversineMiles(points[i - 1], points[i]);
  }
  return miles;
}
