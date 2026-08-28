import { App } from 'obsidian';

/**
 * Namespaced ID for this plugin's OpenAI key.
 *
 * `SecretStorage.listSecrets()` returns a flat list, so IDs appear to share one
 * namespace across plugins. Prefix ours to avoid colliding with anyone else.
 * The API requires a lowercase alphanumeric ID with optional dashes.
 */
export const OPENAI_API_KEY_SECRET_ID = 'openaugi-openai-api-key';

/**
 * The slice of Obsidian's `SecretStorage` API this plugin uses.
 *
 * Declared locally rather than imported from `obsidian` so the plugin keeps
 * working on versions below 1.11.4, where `app.secretStorage` does not exist.
 * Every access is feature-detected at runtime.
 */
interface SecretStorageApi {
  getSecret(id: string): string | null;
  setSecret(id: string, secret: string): void;
}

interface AppWithSecretStorage {
  secretStorage?: SecretStorageApi;
}

/** Return Obsidian's secret storage, or `null` on versions that lack it. */
function getSecretStorage(app: App): SecretStorageApi | null {
  const storage = (app as unknown as AppWithSecretStorage).secretStorage;
  if (!storage || typeof storage.getSecret !== 'function' || typeof storage.setSecret !== 'function') {
    return null;
  }
  return storage;
}

/** True when this Obsidian build can store secrets in the OS credential store. */
export function isSecretStorageAvailable(app: App): boolean {
  return getSecretStorage(app) !== null;
}

/** Outcome of resolving the API key at plugin load. */
export interface ResolvedApiKey {
  /** The key to use for this session. */
  apiKey: string;
  /**
   * True when a key was moved out of `data.json` into secret storage and the
   * caller must re-persist settings so the plaintext copy is dropped.
   */
  migrated: boolean;
}

/**
 * Resolve the effective API key at load time.
 *
 * On Obsidian 1.11.4+ the key lives in the OS credential store. A key still
 * sitting in `data.json` from an older version is migrated across on first
 * load; the caller then saves settings to drop the plaintext copy. On older
 * Obsidian builds `data.json` remains the only store.
 *
 * @param app The Obsidian app
 * @param storedKey The `apiKey` value read from `data.json` (may be empty)
 */
export function resolveApiKey(app: App, storedKey: string): ResolvedApiKey {
  const storage = getSecretStorage(app);
  if (!storage) {
    return { apiKey: storedKey, migrated: false };
  }

  try {
    if (storedKey) {
      // Legacy plaintext key wins — it is what the user last entered.
      storage.setSecret(OPENAI_API_KEY_SECRET_ID, storedKey);
      return { apiKey: storedKey, migrated: true };
    }
    return { apiKey: storage.getSecret(OPENAI_API_KEY_SECRET_ID) ?? '', migrated: false };
  } catch {
    // Credential store unavailable (locked, permission denied). Fall back to
    // data.json rather than locking the user out of their own key.
    return { apiKey: storedKey, migrated: false };
  }
}

/**
 * Persist the API key to the most secure store available.
 *
 * @returns the value that should be written to `data.json` — empty when the key
 *          was handed to secret storage, the key itself otherwise.
 */
export function persistApiKey(app: App, apiKey: string): string {
  const storage = getSecretStorage(app);
  if (!storage) {
    return apiKey;
  }

  try {
    storage.setSecret(OPENAI_API_KEY_SECRET_ID, apiKey);
    return '';
  } catch {
    return apiKey;
  }
}
