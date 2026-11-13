import tape from 'tape'
import {
	SearchResultHandler as SampleHandler,
	includeResult,
	SAMPLE_ACTIONS,
	type SampleRow
} from '../handlers/samples.ts'

/* Tests
	includeResult()
		- only when the dataset displays sample ids
	includeInSearch()
		- searched only on Enter
	buildRows()
		- maps server fields, drops unnamed entries
	SAMPLE_ACTIONS
		- an action is available only when the server confirmed it for this sample
		- configs launch the expected charts
*/

tape('\n', t => {
	t.comment('-***- mass/search/handlers/samples -***-')
	t.end()
})

tape('includeResult() only when the dataset displays sample ids', t => {
	t.equal(includeResult({ displaySampleIds: true }), true)
	t.equal(includeResult({ displaySampleIds: false }), false)
	t.equal(includeResult({}), false)
	t.equal(includeResult(undefined), false, 'a missing config is not an error')
	t.end()
})

tape('includeInSearch() searches samples only on Enter', t => {
	const h = new SampleHandler()
	t.equal(h.includeInSearch({ prompt: '2646', enter: true }), true)
	t.equal(h.includeInSearch({ prompt: '2646', enter: false }), false, 'never searched while typing')
	t.end()
})

tape('buildRows() maps server fields and drops unnamed entries', t => {
	const rows = new SampleHandler().buildRows({
		dictionaryTerms: [],
		genes: [],
		samples: [
			{ id: 41, name: '2646', singleCell: { sID: '2646' }, assays: [{ facet: 'f', names: ['a'] }], wsimages: true },
			{ id: 5, name: '' } as any
		]
	})
	t.deepEqual(rows, [
		{
			name: '2646',
			sampleId: 41,
			singleCell: { sID: '2646' },
			facetTracks: [{ facet: 'f', names: ['a'] }],
			wsimages: true
		}
	])
	t.end()
})

tape('SAMPLE_ACTIONS availability follows what the server confirmed', t => {
	const labels = (row: SampleRow) => SAMPLE_ACTIONS.filter(a => a.available(row)).map(a => a.label)
	t.deepEqual(labels({ name: 's', sampleId: 1 }), ['Sample View'], 'Sample View is always offered')
	t.deepEqual(
		labels({
			name: 's',
			sampleId: 1,
			singleCell: { sID: 's' },
			wsimages: true,
			facetTracks: [{ facet: 'f', names: ['a'] }]
		}),
		['Sample View', 'Single cell', 'Whole Slide Images', 'Facet Table']
	)
	t.deepEqual(
		labels({ name: 's', sampleId: 1, facetTracks: [] }),
		['Sample View'],
		'empty facet list -> no Facet Table'
	)
	t.end()
})

tape('SAMPLE_ACTIONS configs', async t => {
	const row: SampleRow = { name: '2646', sampleId: 41, singleCell: { sID: '2646', eID: 'e1' } }
	const cfg = (label: string) => SAMPLE_ACTIONS.find(a => a.label == label)!.config(row)
	t.deepEqual(cfg('Sample View'), { chartType: 'sampleView', sample: { sampleId: 41, sampleName: '2646' } })
	t.deepEqual(cfg('Single cell'), { chartType: 'sc', settings: { sc: { item: { sID: '2646', eID: 'e1' } } } })
	t.deepEqual(cfg('Whole Slide Images'), { chartType: 'wsi', sample: { sID: '2646' }, imageType: 'wsi' })
	t.end()
})
