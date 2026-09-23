import type { DescrStats, TermWrapper } from '#types'

/** This is file is intended to capture utility functions related to 
 * violin and box plot to avoid code duplication and improve maintainability.
 * As the number of helpers increase, may consider splitting them 
 * by domain (e.g. data formatting, rendering, etc.). for ease of use.
 */

export function setDescrStatsByTerm(
	terms: Array<TermWrapper | undefined>,
	descrStatsByTerm: Record<string, DescrStats>
): void {
	if (!terms || !terms.length) return
	for (const term of terms) {
		if (!term?.$id) continue
		const descrStats = descrStatsByTerm[term.$id]
		if (descrStats && Object.keys(descrStats).length) (term.q as any).descrStats = descrStats
		else delete (term.q as any).descrStats
	}
}