---
description: Connect FrameLink to Figma (starts the local bridge and shows how to open the plugin)
---

Call the FrameLink `connection_diagnostics` tool now. It starts the local bridge.

Then tell me, in a few short steps:

1. If `pluginConnected` is false: how to import the Figma plugin (first time only) using the exact `figmaPlugin` path from the result, and to run it from Plugins → Development → FrameLink and keep its window open.
2. When I say it is open, call `connection_diagnostics` again to confirm `pluginConnected` is true.
3. Once connected, tell me I can select a frame in Figma and ask you to build it.

If `figmaPlugin` is null, say the packed plugin was not found next to the server and ask me for the repo's `figma-plugin/` folder.
