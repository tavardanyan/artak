/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits needed to change one word into another
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length
  const len2 = str2.length

  // Create a 2D array for dynamic programming
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0))

  // Initialize first column and row
  for (let i = 0; i <= len1; i++) {
    matrix[i][0] = i
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j
  }

  // Fill the matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      )
    }
  }

  return matrix[len1][len2]
}

/**
 * Calculate similarity percentage between two strings (0-100)
 * 100 means identical, 0 means completely different
 */
export function stringSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 100
  if (!str1 || !str2) return 0

  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase())
  const maxLength = Math.max(str1.length, str2.length)

  if (maxLength === 0) return 100

  const similarity = ((maxLength - distance) / maxLength) * 100
  return Math.round(similarity * 100) / 100 // Round to 2 decimal places
}

/**
 * Find the best matching item from a list of items
 * Returns the item with highest similarity score above the threshold
 */
export function findBestMatch(
  targetName: string,
  items: Array<{ id: number; name: string }>,
  thresholdPercent: number = 70
): { item: { id: number; name: string }; similarity: number } | null {
  let bestMatch: { item: { id: number; name: string }; similarity: number } | null = null

  for (const item of items) {
    const similarity = stringSimilarity(targetName, item.name)

    if (similarity >= thresholdPercent) {
      if (!bestMatch || similarity > bestMatch.similarity) {
        bestMatch = { item, similarity }
      }
    }
  }

  return bestMatch
}
