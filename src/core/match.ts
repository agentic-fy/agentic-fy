/**
 * "Did you mean?" suggestion for mistyped names.
 *
 * A lean rewrite of the equivalent utility from the reference project (/base):
 * pure Levenshtein distance, no dependencies. Used by the commands that resolve
 * a change/spec by name (show, validate) to guide the user when the name
 * doesn't match.
 */

/** Edit distance (Levenshtein) between two strings. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Single-row DP: O(min(a,b)) memory.
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * Returns the candidates closest to `input`, ordered by proximity.
 * Ignores candidates that are too far (relative to length) so as not to suggest
 * garbage. Returns at most `limit` names.
 */
export function nearestMatches(
  input: string,
  candidates: readonly string[],
  limit = 3
): string[] {
  const needle = input.toLowerCase();
  const scored = candidates
    .map((candidate) => ({
      candidate,
      distance: editDistance(needle, candidate.toLowerCase()),
    }))
    // Proportional tolerance: short names require more precision.
    .filter(({ candidate, distance }) => distance <= Math.max(2, Math.floor(candidate.length / 2)))
    .sort((a, b) => a.distance - b.distance || a.candidate.localeCompare(b.candidate));

  return scored.slice(0, limit).map((s) => s.candidate);
}
