import "dotenv/config";
let token = null;
if (process.env.OLA_MAPS_CLIENT_ID && process.env.OLA_MAPS_CLIENT_SECRET) {
  const response = await fetch(process.env.OLA_MAPS_TOKEN_URL || "https://account.olamaps.io/realms/olamaps/protocol/openid-connect/token", {
    method: "POST", signal: AbortSignal.timeout(10000),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: process.env.OLA_MAPS_CLIENT_ID, client_secret: process.env.OLA_MAPS_CLIENT_SECRET })
  });
  const payload = await response.json();
  console.log("OAuth HTTP:", response.status);
  token = payload.access_token || null;
}
const probes = [
  ["style", "GET", "/tiles/vector/v1/styles/default-light-standard/style.json", {}],
  ["places", "GET", "/places/v1/autocomplete", { input: "Connaught Place Delhi" }],
  ["geocode", "GET", "/places/v1/geocode", { address: "Connaught Place Delhi" }],
  ["reverse-geocode", "GET", "/places/v1/reverse-geocode", { latlng: "28.6315,77.2167" }],
  ["routing", "POST", "/routing/v1/directions/basic", { origin: "28.6315,77.2167", destination: "28.6139,77.2090", mode: "driving" }]
];
for (const [name, method, path, params] of probes) {
  try {
    const url = new URL(path, "https://api.olamaps.io");
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    if (!token) url.searchParams.set("api_key", process.env.OLA_MAPS_API_KEY);
    const response = await fetch(url, { method, signal: AbortSignal.timeout(12000), headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const payload = await response.json();
    console.log(name, "HTTP:", response.status, "fields:", Object.keys(payload).join(", "));
    if (!response.ok) console.log("Reason:", String(payload.message || payload.error || "Unknown").replaceAll(process.env.OLA_MAPS_API_KEY, "[redacted]").slice(0,250));
  } catch (error) { console.log(name, "failed:", error.name); }
}
