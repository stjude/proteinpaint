import type { DescrStats, TermWrapper } from '#types'

export function setDescrStatsByTerm(
	terms: Array<TermWrapper | undefined>,
	descrStatsByTerm: Record<string, DescrStats>
): void {
	for (const term of terms) {
		if (!term?.$id) continue
		const descrStats = descrStatsByTerm[term.$id]
		if (descrStats && Object.keys(descrStats).length) (term.q as any).descrStats = descrStats
	}
}