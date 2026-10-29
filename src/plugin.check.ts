// Run with: npm run check. The Claude Code plugin files must agree with the package and with the tools the server really has.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const json = <T>(path: string): T => JSON.parse(readFileSync(path, 'utf8')) as T;
const pkg = json<{ version: string; bin: { framelink: string } }>('package.json');
const plugin = json<{ name: string; version: string }>('.claude-plugin/plugin.json');
const market = json<{ plugins: Array<{ name: string; source: string }> }>('.claude-plugin/marketplace.json');
const mcp = json<{ mcpServers: { framelink: { args: string[] } } }>('.mcp.json');

assert.equal(plugin.version, pkg.version, 'plugin.json and package.json carry the same version');
assert.deepEqual([market.plugins[0].name, market.plugins[0].source], [plugin.name, './'], 'the marketplace lists this plugin from the repo root');

const entry = String(mcp.mcpServers.framelink.args[0]).replace('${CLAUDE_PLUGIN_ROOT}/', '');
assert.ok(existsSync(entry), `the MCP server file ${entry} is committed`);
assert.ok(readFileSync(entry, 'utf8').includes(JSON.stringify(pkg.version)), 'the committed bundle was built at this version; run npm run build');
assert.equal(pkg.bin.framelink, `./${entry}`, 'npx and the plugin run the same file');

const figma = json<{ main: string; ui: string }>('figma-plugin/manifest.json');
assert.ok(existsSync(`figma-plugin/${figma.main}`) && existsSync(`figma-plugin/${figma.ui}`), 'the packed Figma plugin is self-contained');

const skill = readFileSync('skills/framelink/SKILL.md', 'utf8');
assert.match(skill, /^---\nname: framelink\n/, 'the skill is named after its folder');
assert.match(readFileSync('commands/setup.md', 'utf8'), /^---\ndescription: .+\n---/, 'the setup command has a description');

const server = readFileSync('src/mcp/server.ts', 'utf8');
const mentioned = new Set([...skill.matchAll(/`([a-z_]+)`/g), ...readFileSync('commands/setup.md', 'utf8').matchAll(/`([a-z_]+)`/g)].map((match) => match[1]));
['get_selection', 'export_node', 'verify_render', 'connection_diagnostics'].forEach((tool) => {
  assert.ok(mentioned.has(tool) && server.includes(`name: '${tool}'`), `${tool} is documented and exists`);
});

// The Codex plugin: same version, real files, and a launcher that finds the bundle in Codex's plugin cache (it cannot use ${CLAUDE_PLUGIN_ROOT}).
const codex = json<{ version: string; skills: string; mcpServers: string }>('.codex-plugin/plugin.json');
assert.equal(codex.version, pkg.version, 'the Codex plugin carries the same version');
assert.ok(existsSync(codex.skills) && existsSync(codex.mcpServers), 'the Codex plugin points at files that exist');
const codexMarket = json<{ plugins: Array<{ name: string; source: { source: string; path: string }; policy: { installation: string } }> }>('.agents/plugins/marketplace.json');
assert.deepEqual([codexMarket.plugins[0].name, codexMarket.plugins[0].source.path, codexMarket.plugins[0].policy.installation], [plugin.name, './', 'AVAILABLE'], 'the Codex marketplace lists this plugin from the repo root');

const launcher = json<{ mcpServers: { framelink: { command: string; args: string[] } } }>(codex.mcpServers).mcpServers.framelink;
const root = mkdtempSync(join(tmpdir(), 'framelink-codex-'));
const install = (home: string, market: string, version: string, marker: string): string => {
  const dir = join(home, 'plugins', 'cache', market, 'framelink', version, 'dist');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'mcp.cjs'), `#!/usr/bin/env node\nconsole.log('${marker} ' + process.argv[1]);`);
  return join(dir, 'mcp.cjs');
};
const launch = (env: Record<string, string>) => spawnSync(launcher.command, launcher.args, { encoding: 'utf8', env: { ...process.env, PLUGIN_ROOT: '', CLAUDE_PLUGIN_ROOT: '', ...env } });

const home = join(root, 'home');
install(home, 'framelink', '1.0.9', 'old');
const newest = install(home, 'framelink', '1.0.10', 'new');
const found = launch({ CODEX_HOME: home });
assert.equal(found.status, 0, 'the launcher starts the bundle from the Codex cache');
assert.equal(found.stdout.trim(), `new ${newest}`, 'it picks the newest version by number (1.0.10 over 1.0.9) and sets argv[1] so the plugin path can be found');

const explicit = install(join(root, 'elsewhere'), 'x', '1.0.0', 'explicit');
const viaRoot = launch({ CODEX_HOME: home, PLUGIN_ROOT: join(root, 'elsewhere', 'plugins', 'cache', 'x', 'framelink', '1.0.0') });
assert.equal(viaRoot.stdout.trim(), `explicit ${explicit}`, 'an explicit PLUGIN_ROOT wins over the cache');

const missing = launch({ CODEX_HOME: join(root, 'empty') });
assert.ok(missing.status === 1 && missing.stderr.includes('not found in the Codex plugin cache'), 'a missing install fails with a clear message');
rmSync(root, { recursive: true, force: true });

// The README documents every tool the server has, and nothing that was removed.
const readme = readFileSync('README.md', 'utf8');
[...server.matchAll(/^    name: '([a-z_]+)',$/gm)].forEach((match) => assert.ok(readme.includes(`\`${match[1]}\``), `the README documents ${match[1]}`));
['framelink-bridge', 'read_my_design', 'scan_text_nodes', 'get_styles'].forEach((gone) => assert.ok(!readme.includes(gone), `the README no longer mentions ${gone}`));

console.log('plugin check passed');
