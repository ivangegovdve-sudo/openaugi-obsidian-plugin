/**
 * Minimal structural types for the parts of the Dataview plugin API this
 * plugin uses. Dataview ships no type definitions, so these describe only the
 * shape we actually read — everything else is treated as unknown.
 */

/** A Dataview `Link` value; `path` is the vault-relative path of the target. */
export interface DataviewLink {
  path: string;
}

/** Result of `dv.query()` — either a list of values or a table of rows. */
export interface DataviewQueryResult {
  successful: boolean;
  value?: {
    type: string;
    values: unknown[];
  };
}

export interface DataviewApi {
  query(source: string, originFile?: string): Promise<DataviewQueryResult>;
}

interface DataviewPlugin {
  api?: DataviewApi;
}

/** Obsidian's internal plugin registry, which is not part of the public API. */
interface AppWithPlugins {
  plugins?: {
    plugins?: Record<string, DataviewPlugin | undefined>;
  };
}

/** Look up the Dataview plugin instance, or `null` when it is not installed. */
export function getDataviewPlugin(app: unknown): DataviewPlugin | null {
  const plugins = (app as AppWithPlugins).plugins?.plugins;
  return plugins?.['dataview'] ?? null;
}

/** True when the Dataview plugin is installed and enabled. */
export function isDataviewInstalled(app: unknown): boolean {
  return getDataviewPlugin(app) !== null;
}

/** Narrow an unknown Dataview value to a `Link`-like object with a path. */
export function asDataviewLink(value: unknown): DataviewLink | null {
  if (value && typeof value === 'object' && 'path' in value) {
    const { path } = value;
    if (typeof path === 'string') {
      return { path };
    }
  }
  return null;
}
