# OpenAugi Obsidian Plugin - Technical Overview

## Project Purpose
OpenAugi is an Obsidian plugin that transforms voice notes and linked notes into organized, atomic notes using AI. It helps users process unstructured thoughts into a structured "second brain" by breaking down content into self-contained ideas.

The goal is to help humans process information faster.

Read the docs/CODEBASE_MAP.md to understand the project at a high level. Be sure to update this map as we make any siginficant changes.

## Architecture Overview

### Project Structure
```
/
├── src/
│   ├── main.ts                 # Plugin entry point, command registration
│   ├── services/
│   │   ├── openai.service.ts   # AI processing logic
│   │   ├── file.service.ts     # File operations, output management
│   │   └── distill.service.ts  # Linked note extraction, content aggregation
│   ├── ui/
│   │   └── settings.ts         # Settings tab UI component
│   └── utils/
│       └── filename.utils.ts   # Filename sanitization, backlink mapping
├── manifest.json               # Obsidian plugin metadata
├── package.json                # Dependencies and scripts
├── tsconfig.json              # TypeScript configuration
└── esbuild.config.mjs         # Build configuration
```

## Key Features

### 1. Voice Transcript Parsing
- Processes voice transcripts into atomic notes (one idea per note)
- Extracts actionable tasks and creates summaries
- Supports "auggie" voice commands for special behaviors
- Estimates token usage before processing

### 2. Linked Notes Distillation
- Analyzes a root note and all its linked notes
- Supports both standard Obsidian links and Dataview queries
- Deduplicates and merges overlapping ideas
- Creates comprehensive summaries with source attribution

### 3. Custom Context Instructions
- Users can add `context:` sections to notes for focused extraction
- Context instructions guide AI processing behavior

## Development Guidelines

### Build Commands

**Important:** `npm` is not on the default PATH in this environment. Source nvm first:
```bash
export PATH="$HOME/.nvm/versions/node/$(ls $HOME/.nvm/versions/node/ | head -1)/bin:$PATH"
```

Then run commands as normal:
```bash
# Development build with hot reload
npm run dev

# Production build (includes typecheck)
npm run build
```

There is no standalone `typecheck` script — `npm run build` runs `tsc -noEmit -skipLibCheck` before bundling.

```bash
# Obsidian community-directory scan (same checks as the automated review)
npm run lint
npm run lint:fix
```

`npm run lint` must report **0 errors** before a release — `scripts/release.sh`
and the tag workflow both enforce it. See [docs/COMPLIANCE.md](docs/COMPLIANCE.md).

### Code Standards
- TypeScript with strict mode enabled
- No external runtime dependencies (only Obsidian API)
- `npm run lint` runs the official `eslint-plugin-obsidianmd`; its errors are the
  findings that fail Obsidian's automated review, so they block a release

### Community-directory conventions

These are the house rules the directory scan enforces. Follow them when writing
new code — retrofitting them across the codebase is far more work than getting
them right the first time.

**Command IDs must not repeat the plugin ID.** Obsidian namespaces every command
as `openaugi:<id>` automatically, so `id: 'process-notes'` is correct and
`id: 'openaugi-process-notes'` is redundant. Same for command *names*: don't
prefix them with "OpenAugi" or include the word "command".

> Renaming an existing command ID silently drops any hotkey a user has bound to
> it. Get new IDs right on the first release; only rename in a deliberate,
> release-noted change.

**No inline styles.** Never assign `element.style.*`. Add a CSS class to
[styles.css](styles.css) using the `openaugi-` prefix and pass it via
`createEl(tag, { cls })` / `addClass()` / `toggleClass()`. For a genuinely
dynamic value, set a custom property with `setCssProps()` and consume it in CSS.

**Secrets go through `app.secretStorage`.** The OpenAI key is stored in the OS
credential store on Obsidian 1.11.4+ and falls back to `data.json` on older
builds — see [secret-storage.ts](src/utils/secret-storage.ts). Access it through
that shim's feature detection, never by importing `SecretStorage` from
`obsidian` (that would trip `no-unsupported-api` at our `minAppVersion` of
1.8.9). Never read a credential from a file path or an environment variable.

**No static Node.js imports.** Node built-ins must be loaded with a dynamic
`import()` behind a `Platform.isDesktop` guard — see `loadNodeApis()` in
[task-dispatch-service.ts](src/services/task-dispatch-service.ts). Static
imports break the bundle on mobile and fail the scan.

**Use `requestUrl`, not `fetch`,** for all network calls — it works on mobile and
sidesteps CORS. Any new endpoint must also be documented in the README's
"Network use and privacy" table.

**Settings headings** use `new Setting(containerEl).setName(...).setHeading()`,
never a raw `<h3>`. Don't put the word "Settings" in a settings heading.

**The `manifest.json` description is the store listing.** It is mirrored into
the community directory automatically, so it is user-facing copy, not metadata.
`validate-manifest` requires 10–250 characters, a capital first letter, a
trailing period, only `[A-Za-z0-9\s.,!?'"-]` (no parentheses, colons, or
em-dashes), and no "obsidian"/"plugin". Run `npm run lint` after editing it —
`manifest.json` and `LICENSE` are linted via explicit blocks in
`eslint.config.mjs` that the upstream recommended config does not provide.

**Sentence case for all UI text** — button labels, setting names, notices,
headings, tooltips. "Refresh models", not "Refresh Models".

**No regex lookbehind** — unsupported on iOS before 16.4. Use a capture group and
restore it in the replacement.

**Prefer Obsidian APIs** over native equivalents: `createEl`/`createDiv`/
`createSpan` over `document.createElement`, `window.setTimeout` over bare
`setTimeout`, `FileManager.trashFile()` over `Vault.delete()`.

**Async callbacks** passed where a `void` return is expected must discard the
promise explicitly: `.onClick(() => { void this.doThing(); })`.

### Testing

Automated test suite using Vitest with a mock Obsidian API. See [docs/TESTING.md](docs/TESTING.md) for full details.

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch
```

Tests cover: filename utils, OpenAI prompt building, link extraction, BFS traversal, content aggregation, file output, journal filtering, backlink discovery. New features should include test coverage.

## API Integration

### OpenAI Service
- Model: GPT-4.1-2025-04-14
- Temperature: 0.7 for parsing, 0.3 for distilling
- Structured output using JSON schema
- Token estimation before API calls

### File Operations
- Creates atomic notes in configurable folders
- Generates summaries with backlinks
- Handles special characters in filenames
- Maintains backlink mappings for navigation

## Configuration

### User Settings
- `apiKey`: Required for AI processing. Persisted to the OS credential store on
  Obsidian 1.11.4+ via `app.secretStorage`, falling back to `data.json` on older
  builds — see [src/utils/secret-storage.ts](src/utils/secret-storage.ts)
- `summaryFolderPath`: Default "OpenAugi/Summaries"
- `notesFolderPath`: Default "OpenAugi/Notes"
- `useDataview`: Enable/disable Dataview integration

### Build Configuration
- Target: ES2018/ES6
- Platform: Browser (Electron)
- External: Obsidian modules
- Sourcemaps enabled for development

## Output Structure

### Summary Files
- Format: `[original-name] - summary.md` or `[original-name] - distilled.md`
- Contains: Summary, atomic note links, extracted tasks
- For distilled notes: Shows source note references

### Atomic Notes
- Self-contained ideas with context
- Includes relevant backlinks
- Organized by timestamp or topic

## Common Development Tasks

### Adding New Features
1. Extend services in `/src/services/`
2. Update command registration in `main.ts`
3. Add settings if needed in `settings.ts`

### Debugging
- Use Obsidian's developer console (Ctrl+Shift+I)
- Check console for error messages
- Enable verbose logging in development

### Publishing
See [docs/PUBLISHING.md](docs/PUBLISHING.md) for the complete release process.

**Just run the script** (it bumps all three version files, publishes, and verifies):
```bash
# write docs/release-notes/X.Y.Z.md first, then:
./scripts/release.sh X.Y.Z
```

**Non-negotiables** (enforced by `tests/version-consistency.test.ts` and the release script):
- `npm run lint` reports 0 errors — a release that fails the directory scan gets
  de-listed after 2026-10-30.
- Bump **all THREE** version files together: `manifest.json`, `package.json`, and
  `versions.json` (add `"X.Y.Z": "<minAppVersion>"`). Forgetting `versions.json`
  is the classic mistake.
- Tag == `manifest.version`, no `v` prefix.
- **Publish the draft immediately** after CI — never leave the repo advertising a
  version with no published release.

## Important Considerations

- Always handle API errors gracefully
- Respect rate limits and token usage
- Sanitize filenames to prevent filesystem issues
- Maintain backwards compatibility with existing notes
- Test with various note structures and edge cases
- The OpenAI API key lives in the OS credential store (Obsidian 1.11.4+) or the
  gitignored `data.json` (older builds), never in source, an env var, or a
  committed file — see [docs/COMPLIANCE.md](docs/COMPLIANCE.md)

# Testing

My local testing vault is in: /Users/chris/zk-for-testing

Add any notes to /Users/chris/Documents/DEV-TESTING/Test to capture edge cases when relevant.
