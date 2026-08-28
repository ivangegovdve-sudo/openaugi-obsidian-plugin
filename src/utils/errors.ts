/**
 * Extract a human-readable message from an unknown thrown value.
 *
 * `catch` binds `unknown`, so this is the single place that narrows it rather
 * than each call site reaching into `.message` on an untyped value.
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
