import { describe, it, expect, vi, beforeEach } from 'vitest';
import { App } from './mocks/obsidian-module';
import OpenAugiPlugin from '../src/main';
import { OPENAI_API_KEY_SECRET_ID } from '../src/utils/secret-storage';

/**
 * End-to-end check of the settings load/save path: the API key must land in
 * the OS credential store where Obsidian supports it, and never be written
 * back into data.json once it has.
 */

/** Minimal App stand-in with the vault/metadata surface the services touch. */
function makeApp(secretStorage?: unknown): App {
  const app = new App() as App & Record<string, unknown>;
  app.vault = {
    adapter: { getBasePath: () => '/vault' },
    getMarkdownFiles: () => [],
    getAbstractFileByPath: () => null,
  };
  app.metadataCache = { getFileCache: () => null, getFirstLinkpathDest: () => null };
  if (secretStorage) app.secretStorage = secretStorage;
  return app as App;
}

/** In-memory stand-in for Obsidian 1.11.4+ secret storage. */
function makeSecretStorage(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  return {
    store,
    api: {
      getSecret: (id: string) => store.get(id) ?? null,
      setSecret: (id: string, secret: string) => { store.set(id, secret); },
      listSecrets: () => Array.from(store.keys()),
    },
  };
}

function makePlugin(app: App, savedData: unknown) {
  const plugin = new OpenAugiPlugin(app as never, { id: 'openaugi' } as never);
  const saveData = vi.fn().mockResolvedValue(undefined);
  (plugin as unknown as { loadData: unknown }).loadData = vi.fn().mockResolvedValue(savedData);
  (plugin as unknown as { saveData: unknown }).saveData = saveData;
  return { plugin, saveData };
}

describe('API key persistence', () => {
  describe('on Obsidian without SecretStorage (< 1.11.4)', () => {
    it('keeps the key in data.json', async () => {
      const { plugin, saveData } = makePlugin(makeApp(), { apiKey: 'sk-legacy' });

      await plugin.loadSettings();
      expect(plugin.settings.apiKey).toBe('sk-legacy');
      // Nothing to migrate, so load must not rewrite settings.
      expect(saveData).not.toHaveBeenCalled();

      await plugin.saveSettings();
      expect(saveData).toHaveBeenCalledWith(
        expect.objectContaining({ apiKey: 'sk-legacy' })
      );
    });
  });

  describe('on Obsidian with SecretStorage (1.11.4+)', () => {
    let secrets: ReturnType<typeof makeSecretStorage>;

    beforeEach(() => {
      secrets = makeSecretStorage();
    });

    it('migrates a legacy data.json key and strips the plaintext copy', async () => {
      const { plugin, saveData } = makePlugin(makeApp(secrets.api), { apiKey: 'sk-legacy' });

      await plugin.loadSettings();

      // Key still usable in memory...
      expect(plugin.settings.apiKey).toBe('sk-legacy');
      // ...now lives in the credential store...
      expect(secrets.store.get(OPENAI_API_KEY_SECRET_ID)).toBe('sk-legacy');
      // ...and data.json was rewritten without it.
      expect(saveData).toHaveBeenCalledTimes(1);
      expect(saveData.mock.calls[0][0]).toMatchObject({ apiKey: '' });
    });

    it('loads the key from the credential store on subsequent starts', async () => {
      secrets.store.set(OPENAI_API_KEY_SECRET_ID, 'sk-stored');
      const { plugin, saveData } = makePlugin(makeApp(secrets.api), { apiKey: '' });

      await plugin.loadSettings();

      expect(plugin.settings.apiKey).toBe('sk-stored');
      expect(saveData).not.toHaveBeenCalled();
    });

    it('never writes the key to data.json when saving settings', async () => {
      const { plugin, saveData } = makePlugin(makeApp(secrets.api), { apiKey: '' });
      await plugin.loadSettings();

      plugin.settings.apiKey = 'sk-entered-in-settings';
      await plugin.saveSettings();

      expect(secrets.store.get(OPENAI_API_KEY_SECRET_ID)).toBe('sk-entered-in-settings');
      const written = saveData.mock.calls.at(-1)?.[0] as { apiKey: string };
      expect(written.apiKey).toBe('');
      // Other settings still round-trip normally.
      expect(written).toHaveProperty('summaryFolder');
    });

    it('leaves other saved settings untouched by the migration', async () => {
      const { plugin, saveData } = makePlugin(
        makeApp(secrets.api),
        { apiKey: 'sk-legacy', summaryFolder: 'Custom/Summaries' }
      );

      await plugin.loadSettings();

      expect(plugin.settings.summaryFolder).toBe('Custom/Summaries');
      expect(saveData.mock.calls[0][0]).toMatchObject({
        apiKey: '',
        summaryFolder: 'Custom/Summaries',
      });
    });
  });
});
