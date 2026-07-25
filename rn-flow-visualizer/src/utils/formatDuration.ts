export function formatTimestamp(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const millis = String(ms % 1000).padStart(3, '0');
  return `00:${String(seconds).padStart(2, '0')}.${millis}`;
}

export function formatDuration(ms?: number) {
  if (ms === undefined) {
    return 'n/a';
  }

  return ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${ms}ms`;
}
