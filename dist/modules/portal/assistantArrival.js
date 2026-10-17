import { distance } from '@turf/distance';
import { point } from '@turf/helpers';
export function assistantStartEligibility(fix, stop, now = Date.now(), radiusMeters = 100) {
    const arrivalRadiusMeters = Number.isFinite(Number(radiusMeters)) ? Math.max(10, Math.round(Number(radiusMeters))) : 100;
    const capturedAt = fix?.capturedAt ? new Date(fix.capturedAt).getTime() : NaN;
    const fresh = Number.isFinite(capturedAt) && now - capturedAt <= 30000 && capturedAt - now <= 10000;
    const usableAccuracy = fix?.accuracy != null && Number.isFinite(Number(fix.accuracy)) && Number(fix.accuracy) >= 0 && Number(fix.accuracy) <= 500;
    const valid = (value) => value && Number.isFinite(value.latitude) && Number.isFinite(value.longitude) && Math.abs(value.latitude) <= 90 && Math.abs(value.longitude) <= 180;
    const distanceMeters = valid(fix) && valid(stop) ? distance(point([fix.longitude, fix.latitude]), point([stop.longitude, stop.latitude]), { units: 'meters' }) : null;
    return { eligible: Boolean(fresh && usableAccuracy && distanceMeters != null && distanceMeters <= arrivalRadiusMeters), distanceMeters,
        radiusMeters: arrivalRadiusMeters,
        capturedAt: Number.isFinite(capturedAt) ? new Date(capturedAt).toISOString() : null,
        reason: !stop ? 'First stop location unavailable' : !fresh ? 'Waiting for fresh GPS' : !usableAccuracy ? 'Waiting for valid GPS' : distanceMeters == null || distanceMeters > arrivalRadiusMeters ? `Reach within ${arrivalRadiusMeters} m of the first stop` : 'Reached first stop' };
}
