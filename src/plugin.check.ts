// Run with: npm run check. The Claude Code plugin files must agree with the package and with the tools the server really has.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

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

// The README documents every tool the server has, and nothing that was removed.
const readme = readFileSync('README.md', 'utf8');
[...server.matchAll(/^    name: '([a-z_]+)',$/gm)].forEach((match) => assert.ok(readme.includes(`\`${match[1]}\``), `the README documents ${match[1]}`));
['framelink-bridge', 'read_my_design', 'scan_text_nodes', 'get_styles'].forEach((gone) => assert.ok(!readme.includes(gone), `the README no longer mentions ${gone}`));

console.log('plugin check passed');
