/**
 * Sugestão "você quis dizer?" para nomes digitados errado.
 *
 * Reescrita enxuta do utilitário equivalente do projeto de referência (/base):
 * distância de Levenshtein pura, sem dependências. Usada pelos comandos que
 * resolvem uma change/spec por nome (show, validate) para orientar o usuário
 * quando o nome não bate.
 */

/** Distância de edição (Levenshtein) entre duas strings. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  // Uma linha só de DP: O(min(a,b)) de memória.
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array<number>(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // remoção
        curr[j - 1] + 1, // inserção
        prev[j - 1] + cost // substituição
      );
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

/**
 * Retorna os candidatos mais próximos de `input`, ordenados por proximidade.
 * Ignora candidatos distantes demais (relativo ao tamanho) para não sugerir
 * lixo. Retorna no máximo `limit` nomes.
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
    // Tolerância proporcional: nomes curtos exigem mais precisão.
    .filter(({ candidate, distance }) => distance <= Math.max(2, Math.floor(candidate.length / 2)))
    .sort((a, b) => a.distance - b.distance || a.candidate.localeCompare(b.candidate));

  return scored.slice(0, limit).map((s) => s.candidate);
}
