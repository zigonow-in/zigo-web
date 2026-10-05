const base = "https://maps.olakrutrim.com";
const html = await (await fetch(`${base}/docs/sdks/web-sdk/latest/setup`)).text();
const sources = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((match) => new URL(match[1], base));
for (const source of sources) {
  const code = await (await fetch(source)).text();
  if (!code.includes("styleName") && !code.includes("@olahq")) continue;
  console.log("Documentation asset:", source.pathname);
  const snippets = [...code.matchAll(/code:`([\s\S]*?)`/g)];
  for (const snippet of snippets.slice(0,8)) console.log(snippet[1].replace(/apiKey\s*:\s*["'][^"']+["']/g, "apiKey: '[redacted]'"));
}
