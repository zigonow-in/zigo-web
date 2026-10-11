export type AssistantDistanceSlabRateType = "fixed" | "per_km";

export type AssistantDistanceSlab = {
  fromKm: number;
  toKm: number | null;
  rateType: AssistantDistanceSlabRateType;
  ratePaise: number;
};

export type AssistantMasterSettings = {
  broadcastTimeSeconds: number;
  autoArrivedRadiusMeters: number;
  dryRunDistanceKm: number;
  travelCostSlabs: AssistantDistanceSlab[];
  assistantTravelPayoutSlabs: AssistantDistanceSlab[];
};

const DEFAULT_DISTANCE_SLABS: AssistantDistanceSlab[] = [
  { fromKm: 0, toKm: 3, rateType: "fixed", ratePaise: 5000 },
  { fromKm: 3, toKm: 5, rateType: "per_km", ratePaise: 1000 },
  { fromKm: 5, toKm: 10, rateType: "per_km", ratePaise: 900 },
  { fromKm: 10, toKm: 15, rateType: "per_km", ratePaise: 800 },
  { fromKm: 15, toKm: 20, rateType: "per_km", ratePaise: 700 }
];

export const DEFAULT_ASSISTANT_MASTER_SETTINGS: AssistantMasterSettings = {
  broadcastTimeSeconds: 30,
  autoArrivedRadiusMeters: 100,
  dryRunDistanceKm: 3,
  travelCostSlabs: DEFAULT_DISTANCE_SLABS.map((slab) => ({ ...slab })),
  assistantTravelPayoutSlabs: DEFAULT_DISTANCE_SLABS.map((slab) => ({ ...slab }))
};

function boundedInteger(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Math.round(Number(value));
  return Number.isFinite(numeric) ? Math.max(min, Math.min(max, numeric)) : fallback;
}

function boundedDecimal(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.round(Math.max(min, Math.min(max, numeric)) * 1000) / 1000;
}

export function validateAssistantDistanceSlabs(slabs: AssistantDistanceSlab[]) {
  if (!Array.isArray(slabs) || slabs.length < 1) return "Add at least one distance slab.";
  if (slabs.length > 20) return "A maximum of 20 distance slabs is allowed.";

  const tolerance = 0.0001;
  for (let index = 0; index < slabs.length; index += 1) {
    const slab = slabs[index];
    if (!Number.isFinite(slab.fromKm) || slab.fromKm < 0) return `Slab ${index + 1} has an invalid From distance.`;
    if (slab.toKm !== null && (!Number.isFinite(slab.toKm) || slab.toKm <= slab.fromKm)) {
      return `Slab ${index + 1} To distance must be greater than From distance.`;
    }
    if (slab.toKm === null && index !== slabs.length - 1) return "Only the final distance slab can be open-ended.";
    if (!Number.isInteger(slab.ratePaise) || slab.ratePaise < 0) return `Slab ${index + 1} has an invalid rate.`;
    if (slab.rateType !== "fixed" && slab.rateType !== "per_km") return `Slab ${index + 1} has an invalid rate type.`;
    if (index === 0 && Math.abs(slab.fromKm) > tolerance) return "The first distance slab must start at 0 km.";
    if (index > 0) {
      const previous = slabs[index - 1];
      if (previous.toKm === null || Math.abs(previous.toKm - slab.fromKm) > tolerance) {
        return `Slab ${index + 1} must start where slab ${index} ends.`;
      }
    }
  }
  return null;
}

function normalizedSlabs(value: unknown, fallback: AssistantDistanceSlab[]) {
  if (!Array.isArray(value)) return fallback.map((slab) => ({ ...slab }));
  const slabs = value.map((entry) => {
    const source = typeof entry === "object" && entry !== null ? entry as Record<string, unknown> : {};
    const toKmValue = source.toKm === null || source.toKm === "" ? null : Number(source.toKm);
    return {
      fromKm: boundedDecimal(source.fromKm, Number.NaN, 0, 10000),
      toKm: toKmValue === null ? null : boundedDecimal(toKmValue, Number.NaN, 0, 10000),
      rateType: source.rateType === "fixed" ? "fixed" as const : "per_km" as const,
      ratePaise: boundedInteger(source.ratePaise, -1, 0, 100_000_000)
    };
  });
  return validateAssistantDistanceSlabs(slabs) ? fallback.map((slab) => ({ ...slab })) : slabs;
}

export function normalizeAssistantMasterSettings(value: unknown): AssistantMasterSettings {
  const source = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  return {
    broadcastTimeSeconds: boundedInteger(
      source.broadcastTimeSeconds,
      DEFAULT_ASSISTANT_MASTER_SETTINGS.broadcastTimeSeconds,
      5,
      600
    ),
    autoArrivedRadiusMeters: boundedInteger(
      source.autoArrivedRadiusMeters,
      DEFAULT_ASSISTANT_MASTER_SETTINGS.autoArrivedRadiusMeters,
      10,
      5000
    ),
    dryRunDistanceKm: boundedDecimal(
      source.dryRunDistanceKm,
      DEFAULT_ASSISTANT_MASTER_SETTINGS.dryRunDistanceKm,
      0,
      500
    ),
    travelCostSlabs: normalizedSlabs(source.travelCostSlabs, DEFAULT_ASSISTANT_MASTER_SETTINGS.travelCostSlabs),
    assistantTravelPayoutSlabs: normalizedSlabs(
      source.assistantTravelPayoutSlabs,
      DEFAULT_ASSISTANT_MASTER_SETTINGS.assistantTravelPayoutSlabs
    )
  };
}

export function calculateAssistantDistanceSlabs(slabs: AssistantDistanceSlab[], distanceKm: number) {
  const normalizedDistanceKm = Math.max(0, Number.isFinite(distanceKm) ? distanceKm : 0);
  const lines = slabs.map((slab) => {
    const upperBound = slab.toKm === null ? normalizedDistanceKm : slab.toKm;
    const billableKm = Math.max(0, Math.min(normalizedDistanceKm, upperBound) - slab.fromKm);
    const amountPaise = billableKm <= 0
      ? 0
      : slab.rateType === "fixed"
        ? slab.ratePaise
        : Math.round(billableKm * slab.ratePaise);
    return { ...slab, billableKm, amountPaise };
  });
  return {
    distanceKm: normalizedDistanceKm,
    totalPaise: lines.reduce((total, line) => total + line.amountPaise, 0),
    lines
  };
}
