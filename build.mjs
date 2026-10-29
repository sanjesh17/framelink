import { cpSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { build } from 'esbuild';

const { version } = JSON.parse(readFileSync('package.json', 'utf8'));

// The MCP server and the bridge it carries, as one file with nothing to install.
await build({
  entryPoints: ['src/mcp/server.ts'],
  outfile: 'dist/mcp.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  external: ['bufferutil', 'utf-8-validate'], // ws's optional native speedups
  define: { __VERSION__: JSON.stringify(version) },
  banner: { js: '#!/usr/bin/env node' },
});

// The Figma plugin, packed so its folder can be imported as is: Plugins → Development → Import plugin from manifest.
mkdirSync('figma-plugin', { recursive: true });
await build({ entryPoints: ['plugin/src/code.ts'], outfile: 'figma-plugin/code.js', bundle: true, target: 'es6' });
const manifest = JSON.parse(readFileSync('plugin/manifest.json', 'utf8'));
writeFileSync('figma-plugin/manifest.json', `${JSON.stringify({ ...manifest, main: 'code.js', ui: 'ui.html' }, null, 2)}\n`);
cpSync('plugin/src/ui.html', 'figma-plugin/ui.html');

console.log('Build complete → dist/mcp.cjs, figma-plugin/');
