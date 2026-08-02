export function parseWktPolygon(value: string | null | undefined): [number, number][] {
  const text = String(value || "").trim();
  const match = text.match(/^POLYGON\s*\(\s*\((.+)\)\s*\)$/i);
  if (!match) return [];
  const coordinates = match[1]
    .split(",")
    .map((pair) => {
      const [lng, lat] = pair.trim().split(/\s+/).map(Number);
      return [lng, lat] as [number, number];
    })
    .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
  if (coordinates.length < 4) return [];
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) coordinates.push(first);
  return coordinates;
}

export function isPointInPolygon(latitude: number, longitude: number, polygon: [number, number][]) {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || polygon.length < 4) return false;
  const x = longitude;
  const y = latitude;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}
