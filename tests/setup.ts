/**
 * Test environment shim.
 *
 * Plugin code targets Obsidian's renderer process, where `window` is always
 * present (and is what `prefer-window-timers` requires it to use). Vitest runs
 * in a plain Node environment, so alias `window` to the global object.
 */
if (typeof globalThis.window === 'undefined') {
  (globalThis as unknown as { window: typeof globalThis }).window = globalThis;
}
