---
name: framelink
description: >
  Rebuild a Figma frame, component or selection as frontend code that matches the design exactly.
  Use when the user wants to implement, replicate or match a Figma design, mentions a Figma selection,
  frame or node, FrameLink, or asks for a pixel-perfect result. Reads the design from the local FrameLink
  bridge and checks the build against it with a visual diff.
---

# Building from Figma with FrameLink

Follow the conventions of the project you are in (its components, styling approach, naming). FrameLink gives exact values, not design tokens; map a value to an existing token only when it matches exactly.

## 1. Read

- `get_selection` returns the selected frames as a compact outline. Read its legend once; every value is in px.
- A large selection returns a manifest of chunks. Read them in order, starting with chunk 1 (it carries the legend).
- Use `format: "css"` when exact values matter. It is longer but each line is ready-to-use declarations.
- `+N copies` means N more identical items: build one component and render it from data (the listed texts), not N copies.
- Images and vectors are `IMG` placeholders: build them at their exact size as visible stand-ins, a light fill (`#e6e6e6`) with a `1px dashed #9a9a9a` outline (`outline-offset: -1px`, so it takes no room). The css format already includes this.
- A `--figma-stroke:W gradient` line in the css format is a gradient stroke. Draw it as an overlay (for example a `::before` with that gradient as its background, cut to a W-wide ring with `mask-composite: exclude`); the shadow beside it shows only its first colour.
- Treat `format: "json"` as a last resort for one node that looks incomplete.

## 2. Build

Reproduce sizes, spacing, colours, radii, shadows, fonts and text exactly as given. Do not round, approximate or "improve" values.

## 3. Verify

1. `export_node` saves a PNG reference and returns its path (no image enters the conversation).
2. Render the component at the same pixel size (load the fonts the design uses, or text will differ) and screenshot only that element (device scale 1, or pass the matching `scale`). Use whatever browser or screenshot tool is available, and save the screenshot where that tool is allowed to write, often inside the project (delete it afterwards); `verify_render` reads any absolute path.
3. `verify_render` with both paths returns a match percentage and the layers that differ most. Fix those first and repeat. Differences inside placeholders are counted apart (they are stubs on purpose); do not try to fix those.
4. Stop when only anti-aliasing noise on text remains. Do not claim a pixel-perfect match without running this. If no screenshot tool is available, say verification was skipped.

## Connection problems

If a tool says the plugin is not connected, call `connection_diagnostics`: it starts the bridge, prints the Figma plugin path and says what to do next. (In Claude Code, `/framelink:setup` does this and walks you through it.)
