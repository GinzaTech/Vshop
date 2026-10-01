/** A confirmed absence differs from an outage; keep that distinction for polling. */
export function nullableCombatResponse<T>(response: { status: number; data: T }): T | null {
  if (response.status === 200) return response.data;
  if (response.status === 404) return null;
  throw new Error(`Combat resource read failed (${response.status})`);
}
