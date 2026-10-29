import { existsSync, realpathSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

// The packed Figma plugin sits beside the bundle (dist/ and figma-plugin/ share a parent), wherever the package was installed.
export const figmaPluginManifest = (): string | null => {
  try {
    const manifest = resolve(dirname(realpathSync(process.argv[1])), '..', 'figma-plugin', 'manifest.json');
    return existsSync(manifest) ? manifest : null;
  } catch {
    return null;
  }
};

export const nextStep = (connected: boolean): string =>
  connected
    ? 'Connected. Select a frame in Figma, then read it with get_selection.'
    : 'In Figma, import the plugin once (Plugins → Development → Import plugin from manifest, then choose figmaPlugin), ' +
      'and run Plugins → Development → FrameLink. Keep its window open; it connects on its own.';
