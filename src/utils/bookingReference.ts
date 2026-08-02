import { randomInt } from "node:crypto";

const serviceCodeMap: Array<[RegExp, "U" | "H" | "O" | "I" | "T"]> = [
  [/\b(urgent|emergency|priority|quick)\b/i, "U"],
  [/\b(health|medical|care|doctor|nurse)\b/i, "H"],
  [/\b(outdoor|outside|field|market|travel|pickup|delivery)\b/i, "O"],
  [/\b(tell\s*us|need|custom|other)\b/i, "T"],
  [/\b(indoor|home|house|personal|family|assistant|business)\b/i, "I"]
];

export function zigoBookingTypeCode(value: unknown) {
  return String(value || "").toLowerCase() === "schedule" ? "S" : "I";
}

export function zigoServiceTypeCode(input: {
  serviceCode?: unknown;
  serviceName?: unknown;
  categoryCode?: unknown;
  categoryName?: unknown;
}) {
  const source = [
    input.serviceCode,
    input.serviceName,
    input.categoryCode,
    input.categoryName
  ].map((value) => String(value || "")).join(" ");
  const match = serviceCodeMap.find(([pattern]) => pattern.test(source));
  return match?.[1] || "I";
}

export function isZigoBookingReference(value: unknown) {
  return /^Z[UHOIT][IS]\d{18}$/.test(String(value || "").trim());
}

export function generateZigoBookingReference(input: {
  serviceTypeCode?: "U" | "H" | "O" | "I" | "T";
  bookingType?: unknown;
  now?: Date;
}) {
  const now = input.now || new Date();
  const year = String(now.getFullYear()).slice(-2);
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  const randomDigits = String(randomInt(0, 100_000_000)).padStart(8, "0");
  return `Z${input.serviceTypeCode || "I"}${zigoBookingTypeCode(input.bookingType)}${year}${month}${day}${hour}${minute}${randomDigits}`;
}
