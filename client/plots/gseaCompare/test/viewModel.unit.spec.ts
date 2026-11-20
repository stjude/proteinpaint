import tape from 'tape'
import {
	buildGrid,
	formatSetName,
	gridTable,
	toNumber,
	NEG_LOG_CAP,
	type Column,
	type ColumnResult
} from '../viewModel'

/*
Tests:
	- formatSetName strips the collection prefix and keeps symbols
	- toNumber reads the NES shapes blitzgsea emits
	- buildGrid keeps rows significant in any column, shared ones first
	- buildGrid with rowFilter 'all' keeps every set and caps rows
	- buildGrid sorts by a column, cells without a value last in both directions
	- an unscored set (NES 0) is never significant
	- a pending or failed column leaves empty cells
	- gridTable writes NES and q per column
*/

const cols: Column[] = [
	{ key: 'a\tgeneExpression', caseName: 'A', controlName: 'ref', termType: 'geneExpression', dataLabel: 'Expression' },
	{ key: 'b\tgeneExpression', caseName: 'B', controlName: 'ref', termType: 'geneExpression', dataLabel: 'Expression' }
]
const done = (sets): ColumnResult => ({ status: 'done', sets })
const results: ColumnResult[] = [
	done({
		HALLMARK_IL2_STAT5_SIGNALING: { nes: 3.1, fdr: 0.001, geneset_size: 199, leading_edge: 'CCND2,IRF8' },
		HALLMARK_E2F_TARGETS: { nes: -2.0, fdr: 0.01 },
		HALLMARK_APOPTOSIS: { nes: 0.4, fdr: 0.6 },
		HALLMARK_GLYCOLYSIS: { nes: 0, fdr: 0.01 }
	}),
	done({
		HALLMARK_IL2_STAT5_SIGNALING: { nes: 2.0, fdr: 0.02 },
		HALLMARK_E2F_TARGETS: { nes: 1.0, fdr: 0.4 },
		HALLMARK_APOPTOSIS: { nes: 'Infinity', fdr: 0 }
	})
]
const settings = {
	fdrCutoff: 0.05,
	rowFilter: 'significant' as const,
	maxRows: 50,
	sortCol: null,
	sortDir: 'descending' as const
}

tape('formatSetName strips the collection prefix and keeps symbols', t => {
	t.equal(formatSetName('HALLMARK_IL2_STAT5_SIGNALING'), 'IL2 STAT5 signaling')
	t.equal(
		formatSetName('HALLMARK_TNFA_SIGNALING_VIA_NFKB'),
		'TNFα signaling via NF-κB',
		'known acronyms keep their spelling'
	)
	t.equal(formatSetName('HALLMARK_KRAS_SIGNALING_DN'), 'KRAS signaling down')
	t.equal(formatSetName('GOBP_DNA_REPAIR'), 'DNA repair')
	t.equal(formatSetName('MY_CUSTOM_SET'), 'My custom set', 'an unknown prefix is kept')
	t.end()
})

tape('toNumber reads the NES shapes blitzgsea emits', t => {
	t.equal(toNumber(2.5), 2.5)
	t.equal(toNumber('-1.25'), -1.25)
	t.equal(toNumber('Infinity'), 10, 'Infinity is capped')
	t.equal(toNumber('-Infinity'), -10)
	t.equal(toNumber(undefined), null)
	t.equal(toNumber('nan'), null)
	t.end()
})

tape('buildGrid keeps rows significant in any column, shared ones first', t => {
	const g = buildGrid(cols, results, settings)
	t.deepEqual(
		g.rows.map(r => r.key),
		['HALLMARK_IL2_STAT5_SIGNALING', 'HALLMARK_APOPTOSIS', 'HALLMARK_E2F_TARGETS'],
		'significant in 2 columns first, then by the strongest |NES| (capped Infinity beats 2.0)'
	)
	t.equal(g.totalRows, 3)
	t.deepEqual(g.rows[0].cells[0].leadingEdge, ['CCND2', 'IRF8'])
	t.equal(g.rows[1].cells[1].negLog, NEG_LOG_CAP, 'q 0 is capped')
	t.end()
})

tape('buildGrid with rowFilter all keeps every set and caps rows', t => {
	const g = buildGrid(cols, results, { ...settings, rowFilter: 'all', maxRows: 2 })
	t.equal(g.totalRows, 4)
	t.equal(g.rows.length, 2)
	t.end()
})

tape('buildGrid sorts by a column, cells without a value last in both directions', t => {
	const all = { ...settings, rowFilter: 'all' as const }
	const desc = buildGrid(cols, results, { ...all, sortCol: 1, sortDir: 'descending' })
	t.deepEqual(
		desc.rows.map(r => r.key),
		['HALLMARK_APOPTOSIS', 'HALLMARK_IL2_STAT5_SIGNALING', 'HALLMARK_E2F_TARGETS', 'HALLMARK_GLYCOLYSIS']
	)
	const asc = buildGrid(cols, results, { ...all, sortCol: 1, sortDir: 'ascending' })
	t.equal(asc.rows[0].key, 'HALLMARK_E2F_TARGETS')
	t.equal(asc.rows[3].key, 'HALLMARK_GLYCOLYSIS', 'no value in column 1: last')
	t.end()
})

tape('an unscored set (NES 0) is never significant', t => {
	const g = buildGrid(cols, results, { ...settings, rowFilter: 'all' })
	const gly = g.rows.find(r => r.key == 'HALLMARK_GLYCOLYSIS')!
	t.equal(gly.cells[0].significant, false)
	t.notOk(buildGrid(cols, results, settings).rows.some(r => r.key == 'HALLMARK_GLYCOLYSIS'))
	t.end()
})

tape('a pending or failed column leaves empty cells', t => {
	const g = buildGrid(cols, [results[0], { status: 'error', error: 'x' }], settings)
	t.ok(g.rows.every(r => r.cells[1].nes == null))
	const p = buildGrid(cols, [{ status: 'pending' }, { status: 'pending' }], settings)
	t.equal(p.rows.length, 0)
	t.end()
})

tape('gridTable writes NES and q per column', t => {
	const { rows, cols: header } = gridTable(buildGrid(cols, results, settings), cols)
	t.equal(header.length, 5)
	t.equal(header[1].label, 'A vs ref, Expression: NES')
	t.deepEqual(
		rows[0].map(c => c.value),
		['HALLMARK_IL2_STAT5_SIGNALING', 3.1, 0.001, 2, 0.02]
	)
	t.end()
})
