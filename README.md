# FrameLink

FrameLink lets an AI coding agent read your Figma selection and rebuild it as code that matches the design, then check the result against Figma with a visual diff. It runs entirely on your machine: nothing is sent anywhere, and no screenshots are needed to read a design.

Works with any agent that supports MCP: Claude Code, Codex, Antigravity and others.

```
Figma Desktop (FrameLink plugin) ── WebSocket ──▶ FrameLink MCP server ── stdio ──▶ your agent
                                                  (also runs the local bridge)
```

The MCP server starts the bridge itself the first time the agent uses a FrameLink tool. You never run a separate process.

---

## Install

You need Node.js 18+ and **Figma Desktop**.

### 1. Add FrameLink to your agent

**Claude Code** (recommended: includes the `/framelink:setup` command and a skill that teaches the workflow)

```
/plugin marketplace add sanjesh17/framelink
/plugin install framelink@framelink
```

Or just the MCP server:

```sh
claude mcp add --scope user framelink -- npx -y @sanjeshh/framelink
```

**Codex** *(configuration documented, not yet tested)*

As a plugin, with the skill included and no npm needed:

```sh
codex plugin marketplace add sanjesh17/framelink
```

Then install FrameLink from the Plugins directory in Codex and ask the agent to call `connection_diagnostics`.

Or just the MCP server, from npm:

```sh
codex mcp add framelink -- npx -y @sanjeshh/framelink
```

or from a clone of this repo, without npm:

```sh
codex mcp add framelink -- node /path/to/framelink/dist/mcp.cjs
```

or in `~/.codex/config.toml`:

```toml
[mcp_servers.framelink]
command = "npx"
args = ["-y", "@sanjeshh/framelink"]
```

**Antigravity** *(configuration documented, not yet tested)*

Open the agent panel's **⋯ menu → MCP Servers → Manage MCP Servers → View raw config** and add:

```json
{
  "mcpServers": {
    "framelink": { "command": "npx", "args": ["-y", "@sanjeshh/framelink"] }
  }
}
```

**Any other MCP client** *(Cursor, VS Code, Gemini CLI, …)*: register a stdio server whose command is `npx` with arguments `-y @sanjeshh/framelink`.

### 2. Add the plugin to Figma (once)

In Figma Desktop: **Plugins → Development → Import plugin from manifest…** and choose `figma-plugin/manifest.json`.

Not sure where that is? Ask your agent to call `connection_diagnostics` (or run `/framelink:setup` in Claude Code). It prints the exact path.

### 3. Connect

1. Ask your agent to check the FrameLink connection. This starts the bridge.
2. In Figma, run **Plugins → Development → FrameLink** and keep its window open. It turns green when connected, and reconnects by itself if the agent restarts.

---

## Use

Select a frame or component in Figma, then ask:

```
Build my current Figma selection as a React component.
```

```
Match this Figma frame exactly and verify it against the design.
```

For a pixel-accurate result the agent follows this loop:

1. `get_selection` reads the design as a compact outline.
2. It builds the component.
3. `export_node` saves a PNG of the design as a reference. This does not put an image in the conversation.
4. It screenshots only the rendered component (any browser or screenshot tool the agent has) at the same size.
5. `verify_render` compares the two and reports a match percentage and the layers that differ most, so the agent fixes the right thing. Repeat until it matches.

Step 4 needs an agent that can screenshot a page. If it cannot, it should say verification was skipped.

---

## Tools

| Tool | Description |
|------|-------------|
| `get_selection` | Returns the current selection as a compact text outline for code generation. Large selections come back in numbered chunks. `format: "css"` returns the same tree as CSS declarations (longer, ready to paste) |
| `get_node_info` | Returns one node by ID as the same outline. `format: "json"` returns the raw tree as a last resort |
| `get_nodes_info` | Returns several nodes by ID as one outline |
| `get_document_info` | Returns document name, page list, and active page |
| `export_node` | Saves a PNG of a node (default: the selection) as the pixel reference and returns its path and size |
| `verify_render` | Compares a screenshot of your rendered component with that reference and returns a text report: match percentage and the layers that differ most. Differences inside image and icon placeholders are reported separately, since they are stubs on purpose |
| `get_annotations` | Returns designer annotations attached to a node |
| `connection_diagnostics` | Starts the bridge if needed, reports whether the plugin is connected, and prints the plugin path and next step |

### Why the outline is small

The outline leaves out everything you can derive or that has no visual effect: hidden layers, default names, sizes that hugging or filling layouts decide, defaults like left alignment. Identical repeated items (list rows, cards, table rows) are written once with `+N copies` and each copy's text. A legend line is included only for the markers that appear. Images and vectors become `IMG` placeholders with their exact size and corner, stroke, opacity and effect details, drawn as light boxes with a dashed outline so they are visible.

---

## Several agents at once

Port 3333 is fixed, because the Figma plugin connects to it. The first FrameLink process to start becomes the bridge. Any other (a second Claude session, Codex, Antigravity) notices and sends its requests through the first. If the first one exits, another takes over and the plugin reconnects on its own. `connection_diagnostics` shows which role a process has.

---

## Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `FRAMELINK_PORT` | `3333` | Bridge port. The packed Figma plugin is fixed to 3333, so changing this also means editing the plugin's manifest and UI. For tests and advanced use |
| `LOG_LEVEL` | `info` | `debug` prints each request to stderr |

---

## Troubleshooting

**The plugin says "Bridge not found"**
The bridge starts on the agent's first FrameLink tool call. Ask the agent to call `connection_diagnostics`; the plugin reconnects within a few seconds.

**"Port 3333 is used by another program"**
Something that is not FrameLink holds the port. Find it with `lsof -ti :3333`.

**A read fails with "plugin is not connected"**
Open **Plugins → Development → FrameLink** in Figma and keep its window open.

**Tools do not appear in the agent**
Restart the agent after adding the server. In Claude Code, run `/mcp`.

**`verify_render` starts with `SIZE MISMATCH`**
The screenshot is not the same pixel size as the export. Screenshot only the component's element at device scale 1, or pass the matching `scale` to `export_node`.

**Large documents time out**
Select a smaller frame.

---

## Privacy and security

- The bridge listens on `127.0.0.1` only and makes no outside network requests.
- It refuses any request that comes from a web page (a request carrying an `Origin`, or a foreign `Host`), and only forwards the tool requests above to the plugin.
- Known limitation: a newly connecting plugin replaces the current one, so switching Figma files works. The plugin's page has no origin of its own, which a sandboxed web page also lacks; while a bridge is running, a hostile page could in principle displace the real plugin and supply fake design data.
- Design text and layer names are untrusted input to your agent, like any file it reads.

---

## Development

```sh
npm install
npm run build     # bundles dist/mcp.cjs and packs figma-plugin/
npm run check     # all tests
npm run bench     # token sizes of sample frames (SHOW="small card" FORMAT=css prints one)
```

`dist/` and `figma-plugin/` are committed so the Claude Code plugin runs straight from a checkout. Run `npm run build` and commit the result with any source change. CI rebuilds on every push and pull request and fails if the committed `dist/` or `figma-plugin/` differs from the fresh build; it also runs the typechecks and tests on Node 18, 20 and 22.

| Path | What it is |
|------|------------|
| `src/mcp/` | MCP server, the link to the bridge, image comparison |
| `src/bridge/` | The embedded WebSocket and HTTP bridge |
| `plugin/` | Figma plugin source: reads nodes, builds the outline and CSS |
| `figma-plugin/` | The packed plugin to import into Figma |
| `.claude-plugin/`, `.mcp.json`, `commands/`, `skills/` | The Claude Code plugin |
| `.codex-plugin/`, `.agents/`, `codex.mcp.json` | The Codex plugin and marketplace. Its MCP config finds the bundle in Codex's plugin cache, because `${CLAUDE_PLUGIN_ROOT}` is Claude-only |

## License

MIT
