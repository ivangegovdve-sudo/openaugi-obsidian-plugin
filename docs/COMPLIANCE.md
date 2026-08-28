# Community-directory compliance

**Use when:** before every release, and any time the Obsidian team opens an
"Action required: your plugin release failed automated review" issue.

## What it is

Obsidian scans every published release of every community plugin. The scan
checks developer-policy adherence, best practices, known vulnerabilities, and
malware. Results land on the
[entry dashboard](https://community.obsidian.md/account/plugins/openaugi) as a
scorecard split into **Risks**, **Warnings**, and **Other**.

For entries that predate the directory launch the scan is informational until
**October 30, 2026**. After that, a latest release that still fails is de-listed
and no longer installable from inside Obsidian.

## Running the scan locally

The best-practices half of the scan is the official
[`eslint-plugin-obsidianmd`](https://github.com/obsidianmd/eslint-plugin), wired
into this repo:

```bash
npm run lint        # report
npm run lint:fix    # apply the autofixable subset
```

Configuration lives in [`eslint.config.mjs`](../eslint.config.mjs). It extends
`obsidianmd.configs.recommended` with two deliberate additions:

- a `brands`/`acronyms` list for `ui/sentence-case` (product names and path
  placeholders it would otherwise try to lowercase);
- explicit file blocks for `manifest.json` and `LICENSE`. **The recommended
  config registers `validate-manifest` and `validate-license` but matches no
  file for either, so out of the box neither ever runs.** Both rules read a
  TypeScript-ESLint AST, so `manifest.json` is parsed with `tseslint.parser`
  (as a bare object literal) rather than `@eslint/json`, with type-aware linting
  disabled for those files. Without this, a malformed manifest passes `npm run
  lint` and fails the real scan.

**Errors are the findings that fail the scan.** Warnings are advisory. The
release pipeline enforces the distinction in two places:

- `scripts/release.sh` runs `npm run lint` before it will bump versions or tag.
- `.github/workflows/release.yml` runs it again on the tag build.

Neither can produce a release while the scan reports an error.

## What the scan checks that ESLint cannot

Three dashboard items have no local equivalent — verify them on the dashboard
after publishing:

| Item | How this repo satisfies it |
|------|----------------------------|
| **Network-call disclosure** | README ["Network use and privacy"](../README.md#network-use-and-privacy) documents every `api.openai.com` request, when it fires, and what it sends. Update it whenever a request is added or changed. |
| **Artifact attestations** | `release.yml` runs `actions/attest-build-provenance` over `main.js` and `styles.css`, so users can verify the assets were built from this repo. Requires the `id-token: write` and `attestations: write` permissions on the job. |
| **Malware / vulnerability scan** | Nothing to do locally; keep dependencies current and pinned. |

## The store description

The description shown in the community directory comes from `manifest.json`.
`community-plugins.json` in `obsidianmd/obsidian-releases` is an automated
mirror of it (with a review-status suffix appended), refreshed several times a
day — it is not PR-driven, so there is nothing to submit there. Update
`manifest.json`, publish a release, and the listing follows.

`validate-manifest` enforces the description format, and the constraints are
tighter than they look:

- 10–250 characters
- starts with a capital letter, ends with a period
- matches `^[A-Za-z0-9\s.,!?'"-]+$` — **no parentheses, colons, slashes, em-dashes, or emoji**
- must not contain the words "obsidian" or "plugin"

The dashboard's longer "About" field is separate and is edited on the
[entry dashboard](https://community.obsidian.md/account/plugins/openaugi), not
in this repo.

## Known remaining warnings

These are accepted, not oversights:

- **`ui/sentence-case`** on folder-path placeholders (`OpenAugi/Summaries`), date
  tokens (`YYYY-MM-DD`), `sk-...`, and multi-line tooltips. The rule cannot tell
  these apart from prose.
- **`settings-tab/prefer-setting-definitions`** — adopting the declarative
  settings API requires `minAppVersion` 1.13.0, above the current 1.8.9.

If you add a new accepted warning, record it here with the reason.

## Secrets

The OpenAI API key is user data. It reaches the plugin only through the settings
tab; nothing in `src/` reads a file path or an environment variable to get it.

Where it is persisted depends on the running Obsidian version, handled by
[`src/utils/secret-storage.ts`](../src/utils/secret-storage.ts):

| Obsidian | Store |
|----------|-------|
| 1.11.4+ | OS credential store via `app.secretStorage` (macOS Keychain, Windows Credential Manager, Linux libsecret), under the ID `openaugi-openai-api-key` |
| below 1.11.4 | `data.json` in the plugin folder, as before |

`app.secretStorage` is feature-detected through a locally declared interface
rather than imported from `obsidian`. That keeps `minAppVersion` at 1.8.9, avoids
bumping the `obsidian` devDependency (which `eslint-plugin-obsidianmd`
peer-pins to 1.8.7), and keeps `no-unsupported-api` quiet. If the credential
store throws — locked, permission denied — the code falls back to `data.json`
rather than locking the user out of their own key.

A key left in `data.json` by an older version is migrated on first load and the
plaintext copy is blanked. Covered by `tests/secret-storage.test.ts` and
`tests/main-settings.test.ts`.

OS credential stores do not sync between devices, so on 1.11.4+ the key is
entered once per device. This is intended.

Do **not** add an environment-variable fallback. `process.env` does not exist on
Obsidian mobile, and reading identity-related environment variables is itself a
finding the directory scan reports.
