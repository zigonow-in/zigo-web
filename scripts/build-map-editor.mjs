import { build } from 'esbuild';
await build({ entryPoints: ['src/client/location-map-editor.js'], outfile: 'public/assets/location-map-editor.js', bundle: true, minify: true, format: 'iife', target: ['es2020'], legalComments: 'eof' });
