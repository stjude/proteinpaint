import tape from 'tape'
import { buildResultRows, buildGeneRows, buildSampleRows, hasAnyGeneAction, formatCoord } from '../rows.ts'

/* Tests
	hasAnyGeneAction()
	formatCoord()
	buildGeneRows()
		- skips genes with no available action
		- skips genes already present among dictionary names (case-insensitive)
		- dedupes case-insensitively; a missing coord becomes null
	buildSampleRows()
		- drops entries without a name; maps server fields
	buildResultRows()
		- empty result -> no rows
		- groups get headings in display order: Dictionary, Genes, Samples, Genomic region
		- dictionary rows: ancestors joined; type-less terms not selectable
		- truncation note only when the server total exceeds what it returned
		- gene note compares against the raw server count, reports the displayed count
*/

const noTypes = {
	geneExpression: false,
	dnaMethylation: false,
	snvindel: false,
	cnv: false,
	svfusion: false,
	genomeBrowser: false
}
const expOnly = { ...noTypes, geneExpression: true }

tape('\n', t => {
	t.comment('-***- mass/chat/rows -***-')
	t.end()
})

tape('hasAnyGeneAction()', t => {
	t.equal(hasAnyGeneAction(noTypes), false, 'no data types -> no action')
	t.equal(hasAnyGeneAction(undefined), false, 'undefined -> no action')
	t.equal(hasAnyGeneAction({ ...noTypes, dnaMethylation: true }), true, 'methylation is an action')
	t.equal(hasAnyGeneAction({ ...noTypes, genomeBrowser: true }), true, 'genome browser is an action')
	t.end()
})

tape('formatCoord() localizes positions', t => {
	const expected = `chr7:${(1000).toLocaleString()}-${(2000000).toLocaleString()}`
	t.equal(formatCoord({ chr: 'chr7', start: 1000, stop: 2000000 }), expected)
	t.end()
})

tape('buildGeneRows() filters and dedupes', t => {
	const coord = { chr: 'chr17', start: 1, stop: 2 }
	const rows = buildGeneRows(
		[
			{ gene: 'TP53', dataTypes: expOnly, coord },
			{ gene: 'tp53', dataTypes: expOnly, coord: null }, // duplicate (case-insensitive); the last one wins
			{ gene: 'NOACTION', dataTypes: noTypes, coord: null },
			{ gene: 'AKT1', dataTypes: expOnly, coord: null },
			{ gene: 'RISK', dataTypes: expOnly, coord: null } // also a dictionary name
		],
		new Set(['RISK'])
	)
	t.deepEqual(
		rows.map(r => r.gene),
		['tp53', 'AKT1'],
		'no-action, dictionary-duplicate and repeated genes are removed'
	)
	t.equal(rows[0].coord, null, 'a missing coord is null')
	t.equal(rows[0].kind, 'gene')
	t.deepEqual(buildGeneRows(undefined, new Set()), [], 'undefined genes -> []')
	t.end()
})

tape('buildSampleRows() maps server fields and drops unnamed entries', t => {
	const rows = buildSampleRows([
		{ id: 41, name: '2646', singleCell: { sID: '2646' }, assays: [{ facet: 'f', names: ['a'] }], wsimages: true },
		{ id: 5, name: '' } as any
	])
	t.equal(rows.length, 1, 'the unnamed sample is dropped')
	t.deepEqual(rows[0], {
		kind: 'sample',
		name: '2646',
		sampleId: 41,
		singleCell: { sID: '2646' },
		facetTracks: [{ facet: 'f', names: ['a'] }],
		wsimages: true
	})
	t.deepEqual(buildSampleRows(undefined), [], 'undefined samples -> []')
	t.end()
})

tape('buildResultRows() empty result has no rows', t => {
	t.deepEqual(buildResultRows({ dictionaryTerms: [], genes: [], samples: [] }), [])
	t.end()
})

tape('buildResultRows() groups results under headings in display order', t => {
	const rows = buildResultRows({
		dictionaryTerms: [{ id: 'sex', name: 'Sex', type: 'categorical', __ancestorNames: ['Demographics', 'Basic'] }],
		genes: [{ gene: 'TP53', dataTypes: expOnly, coord: null }],
		samples: [{ id: 1, name: 's1' }],
		coord: { chr: 'chr7', start: 1, stop: 2 }
	})
	t.deepEqual(
		rows.map(r => (r.kind == 'heading' ? `#${r.name}` : r.kind)),
		['#Dictionary', 'dict', '#Genes', 'gene', '#Samples', 'sample', '#Genomic region', 'coord']
	)
	const dict: any = rows[1]
	t.equal(dict.ancestors, 'Demographics > Basic', 'ancestors are joined')
	t.equal(dict.selectable, true, 'a typed term is selectable')
	t.end()
})

tape('buildResultRows() dictionary terms without a type are not selectable', t => {
	const rows = buildResultRows({ dictionaryTerms: [{ id: 'folder', name: 'Folder' }], genes: [], samples: [] })
	t.equal((rows[1] as any).selectable, false)
	t.end()
})

tape('buildResultRows() adds a truncation note only when the server capped a type', t => {
	const term = { id: 'a', name: 'A', type: 'categorical' }
	const capped = buildResultRows({
		dictionaryTerms: [term],
		genes: [],
		samples: [],
		totals: { dictionaryTerms: 25, genes: 0, samples: 0 }
	})
	const note: any = capped.find(r => r.kind == 'note')
	t.equal(note?.name, 'Displaying 1 out of a total of 25 dictionary variable matches')
	t.equal(note?.testid, 'sjpp-mass-chat-note-dictionary')

	const notCapped = buildResultRows({
		dictionaryTerms: [term],
		genes: [],
		samples: [],
		totals: { dictionaryTerms: 1, genes: 0, samples: 0 }
	})
	t.notOk(
		notCapped.some(r => r.kind == 'note'),
		'no note when the total equals what was returned'
	)
	t.end()
})

tape('buildResultRows() gene truncation compares against the raw server count', t => {
	// the server returned 2 genes of 5 total; one is dropped client-side (no action). The note must still
	// appear (5 > 2) and report the 1 displayed row.
	const rows = buildResultRows({
		dictionaryTerms: [],
		genes: [
			{ gene: 'A', dataTypes: expOnly, coord: null },
			{ gene: 'B', dataTypes: noTypes, coord: null }
		],
		samples: [],
		totals: { dictionaryTerms: 0, genes: 5, samples: 0 }
	})
	const note: any = rows.find(r => r.kind == 'note')
	t.equal(note?.name, 'Displaying 1 out of a total of 5 gene matches')
	t.end()
})
