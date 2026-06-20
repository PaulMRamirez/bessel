// Shell-side resolution of plugin-declared panel ids to React components. A
// MissionPlugin declares panel ids as inert data (panels: ['plugins', ...]); the
// shell, not packages/catalog, maps those ids to concrete components, the same
// way the engine resolves an instrument id to its loaded FOV. This keeps the
// dependency rule intact: the catalog layer never imports UI.

import { lazy, type ComponentType } from 'react';
import type { PluginsPanelProps } from '../panels/PluginsPanel.tsx';

/** Props every shell-resolved plugin panel receives. */
export type PluginPanelProps = PluginsPanelProps;

// The plugins panel is code-split: it loads on demand the first time the Plugins menu
// opens, not at first paint. The viewer renders the resolved component inside a Suspense
// boundary (PanelSuspense). React.lazy needs a default export, so the dynamic import maps
// the named PluginsPanel export to `default`.
const PANEL_COMPONENTS: Readonly<Record<string, ComponentType<PluginPanelProps>>> = {
  plugins: lazy(() =>
    import('../panels/PluginsPanel.tsx').then((m) => ({ default: m.PluginsPanel })),
  ),
};

/** Resolve a plugin-declared panel id to its component, or null when unknown. */
export function resolvePanel(id: string): ComponentType<PluginPanelProps> | null {
  return PANEL_COMPONENTS[id] ?? null;
}

/** All panel ids a registry's plugins contribute, de-duplicated in order. */
export function pluginPanelIds(
  plugins: readonly { readonly panels?: readonly string[] }[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const plugin of plugins) {
    for (const id of plugin.panels ?? []) {
      if (!seen.has(id)) {
        seen.add(id);
        out.push(id);
      }
    }
  }
  return out;
}
