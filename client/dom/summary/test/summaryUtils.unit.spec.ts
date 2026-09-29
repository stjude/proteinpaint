import tape from 'tape'
import { setDescrStatsByTerm, descrStatsToTSV, testRowsToTSV } from '../summaryUtils'

/** Tests
 *  - setDescrStatsByTerm sets descrStats on terms
 *  - descrStatsToTSV builds a 'Term\tStatistic\tValue' TSV from stats by term
 *  - testRowsToTSV builds a test-header + 'Chart\t...' TSV from grouped rows
 */

/**************
 test section
***************/

tape('\n', function (test) {
	test.comment('-***- dom/summary/summaryUtils -***-')
	test.end()
})

tape('setDescrStatsByTerm sets descrStats on terms', t => {
	const terms = [
		{ $id: 'term1', q: {} },
		{ $id: 'term2', q: {} },
		undefined
	] as any
	const descrStatsByTerm = {
		term1: { mean: 1, median: 1 },
		term2: { mean: 2, median: 2 }
	} as any

	setDescrStatsByTerm(terms, descrStatsByTerm)

	t.deepEqual((terms[0].q as any).descrStats, descrStatsByTerm.term1, 'term1 descrStats set correctly')
	t.deepEqual((terms[1].q as any).descrStats, descrStatsByTerm.term2, 'term2 descrStats set correctly')
	t.notOk((terms[2] as any)?.q?.descrStats, 'undefined term does not have descrStats')
	t.notOk((terms[0].q as any).descrStats === undefined, 'term1 descrStats is defined')
	t.notOk((terms[1].q as any).descrStats === undefined, 'term2 descrStats is defined')
	t.end()
})

tape('descrStatsToTSV builds header + one line per stat per term', t => {
	const statsByTerm: { name: string; stats: Record<string, { label: string; value: any }> }[] = [
		{
			name: 'Age',
			stats: {
				mean: { label: 'Mean', value: 42 },
				median: { label: 'Median', value: 40 }
			}
		},
		{
			name: 'Sex',
			stats: {
				total: { label: 'Total', value: 100 }
			}
		}
	]

	const tsv = descrStatsToTSV(statsByTerm)
	const lines = tsv.split('\n')

	t.equal(lines[0], 'Term\tStatistic\tValue', 'Should start with the column header line')
	t.equal(lines.length, 4, 'Should have a header line plus one line per stat')
	t.equal(lines[1], 'Age\tMean\t42', 'Should format the first term-stat as Term\\tStatistic\\tValue')
	t.equal(lines[2], 'Age\tMedian\t40', 'Should format the second stat for the same term')
	t.equal(lines[3], 'Sex\tTotal\t100', 'Should format the stat for the second term')
	t.end()
})

tape('descrStatsToTSV returns only the header line when statsByTerm is empty', t => {
	const tsv = descrStatsToTSV([])
	t.equal(tsv, 'Term\tStatistic\tValue', 'Should return just the header line for no terms')
	t.end()
})

tape('testRowsToTSV builds test label + column header + rows using value or html fallback', t => {
	const groups = [
		{
			chartLabel: 'chart1',
			rows: [
				[{ value: 'A' }, { value: 'B' }, { html: '0.05' }],
				[{ value: 'C' }, { value: 'D' }, { value: '0.02' }]
			]
		},
		{
			chartLabel: 'chart2',
			rows: [[{ value: 'E' }, { value: 'F' }, { html: 'N/A' }]]
		}
	]

	const tsv = testRowsToTSV('Wilcoxon\'s rank sum test', ['Group 1', 'Group 2', 'P-value'], groups)
	const lines = tsv.split('\n')

	t.equal(lines[0], "Wilcoxon's rank sum test", 'Should start with the test label line')
	t.equal(lines[1], 'Chart\tGroup 1\tGroup 2\tP-value', 'Should prefix the given columns with a Chart column')
	t.equal(lines.length, 5, 'Should have test label + column header + one line per row across all groups')
	t.equal(lines[2], 'chart1\tA\tB\t0.05', 'Should use cell.html when cell.value is not set')
	t.equal(lines[3], 'chart1\tC\tD\t0.02', 'Should use cell.value when set')
	t.equal(lines[4], 'chart2\tE\tF\tN/A', 'Should prefix rows from the second group with its own chartLabel')
	t.end()
})

tape('testRowsToTSV returns just the label and header lines when there are no groups', t => {
	const tsv = testRowsToTSV('Fisher\'s exact test', ['Row 1', 'Row 2', 'Column 1', 'Column 2', 'P-value'], [])
	t.equal(
		tsv,
		"Fisher's exact test\nChart\tRow 1\tRow 2\tColumn 1\tColumn 2\tP-value",
		'Should return only the label and header lines when no groups are given'
	)
	t.end()
})