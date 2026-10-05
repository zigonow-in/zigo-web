import polygonClipping from 'polygon-clipping';
const radians = Math.PI / 180;
const radius = 6371008.8;
function area(polygons) {
    return polygons.reduce((sum, polygon) => sum + polygon.reduce((total, ring, index) => {
        const value = Math.abs(ring.slice(0, -1).reduce((a, p, i) => a + p[0] * ring[i + 1][1] - ring[i + 1][0] * p[1], 0)) / 2;
        return total + (index === 0 ? value : -value);
    }, 0), 0);
}
// Equal-area projection and cumulative clipping keep shares equal for concave boundaries too.
export function splitMarketSections(coordinates, types) {
    const selected = types.filter(type => /^#[0-9a-f]{6}$/i.test(type.color));
    if (!selected.length || !coordinates[0]?.length)
        return [];
    const origin = coordinates[0][0];
    const polygon = coordinates.map(ring => ring.map(p => [(p[0] - origin[0]) * radians * radius, (Math.sin(p[1] * radians) - Math.sin(origin[1] * radians)) * radius]));
    const points = polygon.flat();
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys) - 1, maxY = Math.max(...ys) + 1;
    const box = (left, right) => [[[left, minY], [right, minY], [right, maxY], [left, maxY], [left, minY]]];
    const normalized = polygonClipping.union(polygon);
    const total = area(normalized);
    if (total <= 0 || maxX <= minX)
        return [];
    const cuts = [minX - 1];
    for (let index = 1; index < selected.length; index++) {
        let low = cuts.at(-1), high = maxX;
        const target = total * index / selected.length;
        for (let iteration = 0; iteration < 40; iteration++) {
            const middle = (low + high) / 2;
            if (area(polygonClipping.intersection(normalized, box(minX - 1, middle))) < target)
                low = middle;
            else
                high = middle;
        }
        cuts.push((low + high) / 2);
    }
    cuts.push(maxX + 1);
    return selected.map((type, index) => {
        const section = polygonClipping.intersection(normalized, box(cuts[index], cuts[index + 1]));
        return {
            type: 'Feature',
            geometry: { type: 'MultiPolygon', coordinates: section.map(p => p.map(r => r.map(point => [point[0] / (radius * radians) + origin[0], Math.asin(Math.max(-1, Math.min(1, point[1] / radius + Math.sin(origin[1] * radians)))) / radians]))) },
            properties: { color: type.color, marketTypeId: type.id, marketTypeName: type.name, share: 1 / selected.length }
        };
    });
}
