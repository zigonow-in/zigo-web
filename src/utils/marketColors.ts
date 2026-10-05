export function blendMarketColors(colors: string[], fallback = '#dc2626') {
  const valid = colors.filter(color => /^#[0-9a-f]{6}$/i.test(color));
  if (!valid.length) return fallback;
  return '#' + [1,3,5].map(offset => Math.round(valid.reduce((sum,color) => sum + parseInt(color.slice(offset,offset+2),16),0) / valid.length).toString(16).padStart(2,'0')).join('');
}
