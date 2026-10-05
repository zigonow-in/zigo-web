import assert from 'node:assert/strict';
import { blendMarketColors } from '../dist/utils/marketColors.js';
assert.equal(blendMarketColors([]),'#dc2626');
assert.equal(blendMarketColors(['invalid']),'#dc2626');
assert.equal(blendMarketColors(['#ff0000']),'#ff0000');
assert.equal(blendMarketColors(['#ff0000','#0000ff']),'#800080');
assert.equal(blendMarketColors(['#ff0000','#00ff00','#0000ff']),'#555555');
assert.equal(blendMarketColors(['#0000ff','#ff0000']),'#800080');
console.log('Market Type equal-share colour blending passed.');
