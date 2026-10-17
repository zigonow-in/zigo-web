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
  const boundaryTolerance = 1e-7;

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    const deltaX = end[0] - start[0];
    const deltaY = end[1] - start[1];
    const lengthSquared = deltaX * deltaX + deltaY * deltaY;
    if (lengthSquared === 0) {
      if (Math.hypot(x - start[0], y - start[1]) <= boundaryTolerance) return true;
      continue;
    }
    const projection = Math.max(0, Math.min(1, ((x - start[0]) * deltaX + (y - start[1]) * deltaY) / lengthSquared));
    const closestX = start[0] + projection * deltaX;
    const closestY = start[1] + projection * deltaY;
    if (Math.hypot(x - closestX, y - closestY) <= boundaryTolerance) return true;
  }

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
