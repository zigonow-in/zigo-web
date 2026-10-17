export const BUSINESS_TIME_ZONE = "Asia/Kolkata";
const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;
const businessDateFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: BUSINESS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
});
function assertIsoDate(value) {
    const parsed = new Date(`${value}T00:00:00Z`);
    if (!isoDatePattern.test(value) || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
        throw new RangeError(`Invalid calendar date: ${value}`);
    }
}
export function businessDate(date = new Date()) {
    const parts = businessDateFormatter.formatToParts(date);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}
export function addCalendarDays(value, days) {
    assertIsoDate(value);
    const date = new Date(`${value}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
}
export function inclusiveCalendarDateRange(startDate, endDate) {
    const start = startDate || endDate || null;
    const end = endDate || startDate || null;
    if (!start || !end) {
        return { startDate: null, endDate: null, endDateExclusive: null };
    }
    assertIsoDate(start);
    assertIsoDate(end);
    if (start > end)
        throw new RangeError("From date cannot be after To date.");
    return {
        startDate: start,
        endDate: end,
        endDateExclusive: addCalendarDays(end, 1)
    };
}
