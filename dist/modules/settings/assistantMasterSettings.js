const DEFAULT_DISTANCE_SLABS = [
    { fromKm: 0, toKm: 3, rateType: "fixed", ratePaise: 5000 },
    { fromKm: 3, toKm: 5, rateType: "per_km", ratePaise: 1000 },
    { fromKm: 5, toKm: 10, rateType: "per_km", ratePaise: 900 },
    { fromKm: 10, toKm: 15, rateType: "per_km", ratePaise: 800 },
    { fromKm: 15, toKm: 20, rateType: "per_km", ratePaise: 700 }
];
export const DEFAULT_ASSISTANT_MASTER_SETTINGS = {
    broadcastTimeSeconds: 30,
    autoArrivedRadiusMeters: 100,
    dryRunDistanceKm: 3,
    travelCostBasePaise: 3000,
    travelCostSlabs: DEFAULT_DISTANCE_SLABS.map((slab) => ({ ...slab })),
    assistantTravelPayoutSlabs: DEFAULT_DISTANCE_SLABS.map((slab) => ({ ...slab })),
    deliveryOfferSlabs: []
};
function boundedInteger(value, fallback, min, max) {
    const numeric = Math.round(Number(value));
    return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : fallback;
}
function boundedDecimal(value, fallback, min, max) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric))
        return fallback;
    return Math.round(Math.max(min, Math.min(max, numeric)) * 1000) / 1000;
}
export function validateAssistantDistanceSlabs(slabs) {
    if (!Array.isArray(slabs) || slabs.length < 1)
        return "Add at least one distance slab.";
    if (slabs.length > 20)
        return "A maximum of 20 distance slabs is allowed.";
    const tolerance = 0.0001;
    for (let index = 0; index < slabs.length; index += 1) {
        const slab = slabs[index];
        if (!Number.isFinite(slab.fromKm) || slab.fromKm < 0)
            return `Slab ${index + 1} has an invalid From distance.`;
        if (slab.toKm !== null && (!Number.isFinite(slab.toKm) || slab.toKm <= slab.fromKm)) {
            return `Slab ${index + 1} To distance must be greater than From distance.`;
        }
        if (slab.toKm === null && index !== slabs.length - 1)
            return "Only the final distance slab can be open-ended.";
        if (!Number.isInteger(slab.ratePaise) || slab.ratePaise < 0)
            return `Slab ${index + 1} has an invalid rate.`;
        if (slab.rateType !== "fixed" && slab.rateType !== "per_km")
            return `Slab ${index + 1} has an invalid rate type.`;
        if (index === 0 && Math.abs(slab.fromKm) > tolerance)
            return "The first distance slab must start at 0 km.";
        if (index > 0) {
            const previous = slabs[index - 1];
            const startsAtBoundary = previous.toKm !== null && Math.abs(previous.toKm - slab.fromKm) <= tolerance;
            const startsAtNextWholeKm = previous.toKm !== null
                && Number.isInteger(previous.toKm)
                && Number.isInteger(slab.fromKm)
                && Math.abs(previous.toKm + 1 - slab.fromKm) <= tolerance;
            if (!startsAtBoundary && !startsAtNextWholeKm) {
                return `Slab ${index + 1} must start at the previous boundary or the next whole kilometre.`;
            }
        }
    }
    return null;
}
export function validateAssistantDistanceOfferSlabs(slabs) {
    if (!Array.isArray(slabs))
        return "Delivery offer slabs must be a list.";
    if (slabs.length > 20)
        return "A maximum of 20 delivery offer slabs is allowed.";
    let previousMaxDistanceKm = 0;
    for (let index = 0; index < slabs.length; index += 1) {
        const slab = slabs[index];
        if (!Number.isFinite(slab.maxDistanceKm) || slab.maxDistanceKm <= 0) {
            return `Offer slab ${index + 1} has an invalid maximum distance.`;
        }
        if (index > 0 && slab.maxDistanceKm <= previousMaxDistanceKm) {
            return `Offer slab ${index + 1} must have a greater maximum distance than the previous slab.`;
        }
        if (slab.discountType !== "percent" && slab.discountType !== "flat") {
            return `Offer slab ${index + 1} has an invalid discount type.`;
        }
        if (!Number.isFinite(slab.discountValue) || slab.discountValue < 0) {
            return `Offer slab ${index + 1} has an invalid discount value.`;
        }
        if (slab.discountType === "percent" && slab.discountValue > 100) {
            return `Offer slab ${index + 1} percentage cannot be greater than 100%.`;
        }
        previousMaxDistanceKm = slab.maxDistanceKm;
    }
    return null;
}
function normalizedSlabs(value, fallback) {
    if (!Array.isArray(value))
        return fallback.map((slab) => ({ ...slab }));
    const slabs = value.map((entry) => {
        const source = typeof entry === "object" && entry !== null ? entry : {};
        const toKmValue = source.toKm === null || source.toKm === "" ? null : Number(source.toKm);
        return {
            fromKm: boundedDecimal(source.fromKm, Number.NaN, 0, 10000),
            toKm: toKmValue === null ? null : boundedDecimal(toKmValue, Number.NaN, 0, 10000),
            rateType: source.rateType === "fixed" ? "fixed" : "per_km",
            ratePaise: boundedInteger(source.ratePaise, -1, 0, 100_000_000)
        };
    });
    return validateAssistantDistanceSlabs(slabs) ? fallback.map((slab) => ({ ...slab })) : slabs;
}
function normalizedOfferSlabs(value) {
    if (!Array.isArray(value))
        return [];
    const slabs = value.map((entry) => {
        const source = typeof entry === "object" && entry !== null ? entry : {};
        return {
            maxDistanceKm: boundedDecimal(source.maxDistanceKm, Number.NaN, 0, 10000),
            discountType: source.discountType === "flat" ? "flat" : "percent",
            discountValue: boundedDecimal(source.discountValue, Number.NaN, 0, 100000000)
        };
    });
    return validateAssistantDistanceOfferSlabs(slabs) ? [] : slabs;
}
export function normalizeAssistantMasterSettings(value) {
    const source = typeof value === "object" && value !== null ? value : {};
    return {
        broadcastTimeSeconds: boundedInteger(source.broadcastTimeSeconds, DEFAULT_ASSISTANT_MASTER_SETTINGS.broadcastTimeSeconds, 5, 600),
        autoArrivedRadiusMeters: boundedInteger(source.autoArrivedRadiusMeters, DEFAULT_ASSISTANT_MASTER_SETTINGS.autoArrivedRadiusMeters, 10, 5000),
        dryRunDistanceKm: boundedDecimal(source.dryRunDistanceKm, DEFAULT_ASSISTANT_MASTER_SETTINGS.dryRunDistanceKm, 0, 500),
        travelCostBasePaise: boundedInteger(source.travelCostBasePaise, DEFAULT_ASSISTANT_MASTER_SETTINGS.travelCostBasePaise, 0, 100_000_000),
        travelCostSlabs: normalizedSlabs(source.travelCostSlabs, DEFAULT_ASSISTANT_MASTER_SETTINGS.travelCostSlabs),
        assistantTravelPayoutSlabs: normalizedSlabs(source.assistantTravelPayoutSlabs, DEFAULT_ASSISTANT_MASTER_SETTINGS.assistantTravelPayoutSlabs),
        deliveryOfferSlabs: normalizedOfferSlabs(source.deliveryOfferSlabs)
    };
}
export function calculateAssistantDistanceSlabs(slabs, distanceKm, basePaise = 0) {
    const normalizedDistanceKm = Math.max(0, Number.isFinite(distanceKm) ? distanceKm : 0);
    const normalizedBasePaise = Number.isFinite(basePaise) ? Math.max(0, Math.round(basePaise)) : 0;
    const lines = slabs.map((slab, index) => {
        const previousToKm = index > 0 ? slabs[index - 1].toKm : null;
        const startsAtBoundary = previousToKm !== null && Math.abs(previousToKm - slab.fromKm) <= 0.0001;
        const startsAtNextWholeKm = previousToKm !== null
            && Number.isInteger(previousToKm)
            && Number.isInteger(slab.fromKm)
            && Math.abs(previousToKm + 1 - slab.fromKm) <= 0.0001;
        const billableFromKm = startsAtBoundary || startsAtNextWholeKm
            ? previousToKm ?? slab.fromKm
            : slab.fromKm;
        const upperBound = slab.toKm === null ? normalizedDistanceKm : slab.toKm;
        const billableKm = Math.max(0, Math.min(normalizedDistanceKm, upperBound) - billableFromKm);
        const amountPaise = billableKm <= 0
            ? 0
            : slab.rateType === "fixed"
                ? slab.ratePaise
                : Math.round(billableKm * slab.ratePaise);
        return { ...slab, billableKm, amountPaise };
    });
    return {
        distanceKm: normalizedDistanceKm,
        basePaise: normalizedBasePaise,
        totalPaise: normalizedBasePaise + lines.reduce((total, line) => total + line.amountPaise, 0),
        lines
    };
}
