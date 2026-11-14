import { resolve } from 'node:path';
import { build } from 'esbuild';

const root = process.cwd();
const options = {
  absWorkingDir: root,
  bundle: true,
  minify: true,
  format: 'iife',
  target: ['es2020'],
  legalComments: 'eof'
};

await build({ ...options, entryPoints: [resolve(root, 'src/client/location-map-editor.js')], outfile: resolve(root, 'public/assets/location-map-editor.js') });
await build({ ...options, entryPoints: [resolve(root, 'public/live-map.js')], outfile: resolve(root, 'public/assets/live-map.js') });
