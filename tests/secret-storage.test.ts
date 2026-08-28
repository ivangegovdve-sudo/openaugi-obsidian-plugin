import { describe, it, expect, vi } from 'vitest';
import { App } from './mocks/obsidian-module';
import {
  OPENAI_API_KEY_SECRET_ID,
  isSecretStorageAvailable,
  persistApiKey,
  resolveApiKey,
} from '../src/utils/secret-storage';

/** An app whose Obsidian build predates the SecretStorage API (< 1.11.4). */
function legacyApp(): App {
  return new App();
}

/** An app on Obsidian 1.11.4+, backed by an in-memory credential store. */
function modernApp(seed: Record<string, string> = {}) {
  const store = new Map(Object.entries(seed));
  const app = new App() as App & { secretStorage: unknown };
  app.secretStorage = {
    getSecret: vi.fn((id: string) => store.get(id) ?? null),
    setSecret: vi.fn((id: string, secret: string) => {
      store.set(id, secret);
    }),
    listSecrets: vi.fn(() => Array.from(store.keys())),
  };
  return { app: app as App, store };
}

/** An app whose credential store rejects every call (locked / denied). */
function failingApp() {
  const app = new App() as App & { secretStorage: unknown };
  app.secretStorage = {
    getSecret: () => { throw new Error('keychain locked'); },
    setSecret: () => { throw new Error('keychain locked'); },
  };
  return app as App;
}

describe('secret storage availability', () => {
  it('reports unavailable on Obsidian builds without the API', () => {
    expect(isSecretStorageAvailable(legacyApp())).toBe(false);
  });

  it('reports available when app.secretStorage is present', () => {
    expect(isSecretStorageAvailable(modernApp().app)).toBe(true);
  });

  it('reports unavailable when the API is present but malformed', () => {
    const app = new App() as App & { secretStorage: unknown };
    app.secretStorage = { getSecret: 'not a function' };
    expect(isSecretStorageAvailable(app as App)).toBe(false);
  });
});

describe('resolveApiKey', () => {
  it('passes the data.json key straight through on older Obsidian', () => {
    expect(resolveApiKey(legacyApp(), 'sk-legacy')).toEqual({
      apiKey: 'sk-legacy',
      migrated: false,
    });
  });

  it('migrates a legacy data.json key into secret storage', () => {
    const { app, store } = modernApp();

    const result = resolveApiKey(app, 'sk-from-data-json');

    expect(result).toEqual({ apiKey: 'sk-from-data-json', migrated: true });
    expect(store.get(OPENAI_API_KEY_SECRET_ID)).toBe('sk-from-data-json');
  });

  it('reads from secret storage when data.json has no key', () => {
    const { app } = modernApp({ [OPENAI_API_KEY_SECRET_ID]: 'sk-stored' });

    expect(resolveApiKey(app, '')).toEqual({ apiKey: 'sk-stored', migrated: false });
  });

  it('returns an empty key when neither store has one', () => {
    expect(resolveApiKey(modernApp().app, '')).toEqual({ apiKey: '', migrated: false });
  });

  it('prefers the data.json key when both stores have one', () => {
    // The data.json value is whatever the user last entered on this device.
    const { app, store } = modernApp({ [OPENAI_API_KEY_SECRET_ID]: 'sk-old' });

    expect(resolveApiKey(app, 'sk-new').apiKey).toBe('sk-new');
    expect(store.get(OPENAI_API_KEY_SECRET_ID)).toBe('sk-new');
  });

  it('falls back to data.json when the credential store throws', () => {
    expect(resolveApiKey(failingApp(), 'sk-fallback')).toEqual({
      apiKey: 'sk-fallback',
      migrated: false,
    });
  });
});

describe('persistApiKey', () => {
  it('keeps the key in data.json on older Obsidian', () => {
    expect(persistApiKey(legacyApp(), 'sk-legacy')).toBe('sk-legacy');
  });

  it('stores the key in secret storage and blanks the data.json copy', () => {
    const { app, store } = modernApp();

    expect(persistApiKey(app, 'sk-secret')).toBe('');
    expect(store.get(OPENAI_API_KEY_SECRET_ID)).toBe('sk-secret');
  });

  it('clears the stored secret when the user empties the field', () => {
    const { app, store } = modernApp({ [OPENAI_API_KEY_SECRET_ID]: 'sk-old' });

    expect(persistApiKey(app, '')).toBe('');
    expect(store.get(OPENAI_API_KEY_SECRET_ID)).toBe('');
  });

  it('falls back to data.json when the credential store throws', () => {
    expect(persistApiKey(failingApp(), 'sk-fallback')).toBe('sk-fallback');
  });
});
