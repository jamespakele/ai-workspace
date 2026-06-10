export const DEFAULT_CONTEXT_WINDOW = 200_000;

const WARN_THRESHOLD = 0.7;
const CRITICAL_THRESHOLD = 0.9;

// Percentage of the context window consumed, clamped to [0, 100], with a
// severity level the status bar colors by.
export function computeContextUsage(tokenCount, contextWindow) {
  const limit =
    Number.isFinite(contextWindow) && contextWindow > 0
      ? contextWindow
      : DEFAULT_CONTEXT_WINDOW;
  const tokens = Number.isFinite(tokenCount) && tokenCount > 0 ? tokenCount : 0;

  const ratio = Math.min(tokens / limit, 1);
  const percent = Math.round(ratio * 100);

  let level = "ok";
  if (ratio >= CRITICAL_THRESHOLD) {
    level = "critical";
  } else if (ratio >= WARN_THRESHOLD) {
    level = "warn";
  }

  return { percent, level };
}
