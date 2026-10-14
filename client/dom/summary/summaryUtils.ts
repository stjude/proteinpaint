import type { DescrStats, TermWrapper } from '#types'

/** This is file is intended to capture utility functions related to
 * violin, box plot, and barchart to avoid code duplication and improve maintainability.
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

/** Builds a 'Term\tStatistic\tValue' TSV string from each term's descriptive stats,
 * for use in the plot download menus' 'Descriptive statistics' text option. */
export function descrStatsToTSV(statsByTerm: { name: string; stats: Record<string, { label: string; value: any }> }[]) {
	const lines = ['Term\tStatistic\tValue']
	for (const { name, stats } of statsByTerm) {
		for (const stat of Object.values(stats)) lines.push(`${name}\t${stat.label}\t${stat.value}`)
	}
	return lines.join('\n')
}

/** Builds a TSV string of group-comparison/association-test rows, for use in the plot
 * download menus' 'Group comparisons'/'Association test' text option. Each row cell is
 * expected to be `{ value }` or `{ html }` (see TableRow), as returned by the pvalue/wilcoxon
 * table builders. */
export function testRowsToTSV(
	testLabel: string,
	columns: string[],
	groups: { chartLabel: string; rows: { value?: string; html?: string }[][] }[]
) {
	const lines = [testLabel, ['Chart', ...columns].join('\t')]
	for (const { chartLabel, rows } of groups) {
		for (const row of rows) lines.push([chartLabel, ...row.map(cell => cell.value ?? cell.html)].join('\t'))
	}
	return lines.join('\n')
}