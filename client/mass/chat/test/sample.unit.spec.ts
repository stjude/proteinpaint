import tape from 'tape'
import { SampleHandler, SAMPLE_ACTIONS, type SampleRow } from '../handlers/sample.ts'

/* Tests
	init() / enabled
		- enabled only when the dataset displays sample ids
	plan()
		- searched only on Enter, and only when enabled
		- the request always carries includeSamples (true or false)
	buildRows()
		- maps server fields, drops unnamed entries
	SAMPLE_ACTIONS
		- an action is available only when the server confirmed it for this sample
		- configs launch the expected charts
*/

function makeHandler(termdbConfig: any) {
	const h = new SampleHandler()
	h.init({ app: {}, termdbConfig })
	return h
}

tape('\n', t => {
	t.comment('-***- mass/chat/handlers/sample -***-')
	t.end()
})

tape('init() enabled only when the dataset displays sample ids', t => {
	t.equal(makeHandler({ displaySampleIds: true }).enabled, true)
	t.equal(makeHandler({ displaySampleIds: false }).enabled, false)
	t.equal(makeHandler({}).enabled, false)
	t.equal(makeHandler(undefined).enabled, false, 'a missing config is not an error')
	t.end()
})

tape('plan() searches samples only on Enter', t => {
	const h = makeHandler({ displaySampleIds: true })
	t.deepEqual(h.plan({ prompt: '2646', enter: true }), { active: true, request: { includeSamples: true } })
	const typing = h.plan({ prompt: '2646', enter: false })
	t.equal(typing.active, false, 'never searched while typing')
	t.deepEqual(typing.request, { includeSamples: false }, 'and switched off server-side')
	t.end()
})

tape('plan() a disabled handler never searches, even on Enter', t => {
	const plan = makeHandler({}).plan({ prompt: '2646', enter: true })
	t.equal(plan.active, false)
	t.deepEqual(plan.request, { includeSamples: false })
	t.end()
})

tape('buildRows() maps server fields and drops unnamed entries', t => {
	const rows = makeHandler({ displaySampleIds: true }).buildRows({
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
