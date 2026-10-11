import { nearestPointOnLine } from '@turf/nearest-point-on-line';
import { lineString, point } from '@turf/helpers';
import { bearing } from '@turf/bearing';
import { distance } from '@turf/distance';

export const metersBetween = (a, b) => distance(point(a), point(b), { units: 'meters' });

export function navigationProgress(path, location, steps = [], accuracy = 0) {
  if (path.length < 2 || !location) return null;
  const line = lineString(path);
  const fix = point(location);
  const projection = nearestPointOnLine(line, fix, { units: 'meters' });
  const progress = projection.properties.location;
  const end = nearestPointOnLine(line, point(path.at(-1)), { units: 'meters' }).properties.location;
  const projectedSteps = steps.filter(step => step.location).map(step => ({ ...step,
    at: nearestPointOnLine(line, point([step.location.longitude, step.location.latitude]), { units: 'meters' }).properties.location
  }));
  const upcoming = projectedSteps.find(step => step.at > progress + 12);
  const current = [...projectedSteps].reverse().find(step => step.at <= progress + 12);
  const nextPoint = path[Math.min(path.length - 1, projection.properties.index + 1)];
  return { progress, remaining: Math.max(0, end - progress),
    offRoute: projection.properties.dist > Math.max(50, Number(accuracy || 0) * 1.5),
    turnDistance: upcoming ? Math.max(0, upcoming.at - progress) : Math.max(0, end - progress),
    step: upcoming || current, heading: bearing(fix, point(nextPoint)),
    destinationDistance: distance(fix, point(path.at(-1)), { units: 'meters' }) };
}
