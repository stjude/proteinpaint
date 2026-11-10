import tape from 'tape'
import { GenomicRegionHandler, parseCoordCandidates, formatCoord } from '../handlers/genomicRegion.ts'

/* Tests
	parseCoordCandidates()
		- chr-prefixed / unprefixed ranges try both spellings; commas and spaces accepted; non-coordinates -> null
	formatCoord()
	init() / enabled
		- needs genomic-alteration data and a genome browser that allows the genomic view
	plan()
		- searched whenever the text is a coordinate range, regardless of length, only when enabled
	buildRows()
*/

function makeHandler(termdbConfig: any) {
	const h = new GenomicRegionHandler()
	h.init({ app: {}, termdbConfig })
	return h
}

tape('\n', t => {
	t.comment('-***- mass/chat/handlers/genomicRegion -***-')
	t.end()
})

tape('parseCoordCandidates() chr-prefixed range', t => {
	t.deepEqual(parseCoordCandidates('chr7:100-200'), ['chr7:100-200', '7:100-200'])
	t.end()
})

tape('parseCoordCandidates() unprefixed range', t => {
	t.deepEqual(parseCoordCandidates('7:100-200'), ['7:100-200', 'chr7:100-200'])
	t.end()
})

tape('parseCoordCandidates() accepts commas and surrounding spaces', t => {
	t.deepEqual(parseCoordCandidates(' chrX : 1,000 - 2,000 '), ['chrX:1,000-2,000', 'X:1,000-2,000'])
	t.end()
})

tape('parseCoordCandidates() rejects non-coordinates', t => {
	for (const s of ['TP53', 'chr7', 'chr7:100', 'chr7:100-', 'chr7:a-b', '']) {
		t.equal(parseCoordCandidates(s), null, `"${s}" is not a coordinate range`)
	}
	t.end()
})

tape('formatCoord() localizes positions', t => {
	const expected = `chr7:${(1000).toLocaleString()}-${(2000000).toLocaleString()}`
	t.equal(formatCoord({ chr: 'chr7', start: 1000, stop: 2000000 }), expected)
	t.end()
})

tape('init() enabled needs genomic data and a genomic view', t => {
	t.equal(makeHandler({ queries: { snvindel: {} } }).enabled, true)
	t.equal(makeHandler({ queries: { cnv: {} } }).enabled, true)
	t.equal(makeHandler({ queries: { svfusion: {} } }).enabled, true)
	t.equal(makeHandler({ queries: { snvindel: {}, gbRestrictMode: 'genomic' } }).enabled, true)
	t.equal(makeHandler({ queries: {} }).enabled, false, 'no genomic-alteration data')
	t.equal(
		makeHandler({ queries: { snvindel: {}, gbRestrictMode: 'protein' } }).enabled,
		false,
		'a protein-only genome browser cannot open a typed region'
	)
	t.equal(makeHandler(undefined).enabled, false, 'a missing config is not an error')
	t.end()
})

tape('plan() searches a coordinate regardless of length', t => {
	const h = makeHandler({ queries: { snvindel: {} } })
	const plan = h.plan({ prompt: 'chr17:7666657-7688274', enter: false })
	t.equal(plan.active, true, 'a long coordinate typed without Enter is searched')
	t.deepEqual(plan.request, { coordCandidates: ['chr17:7666657-7688274', '17:7666657-7688274'] })
	t.equal(h.plan({ prompt: 'TP53', enter: true }).active, false, 'a gene name is not a coordinate, even on Enter')
	t.end()
})

tape('plan() a disabled handler never searches a coordinate', t => {
	const plan = makeHandler({ queries: {} }).plan({ prompt: 'chr7:100-200', enter: true })
	t.equal(plan.active, false)
	t.notOk('coordCandidates' in plan.request, 'no candidates are sent')
	t.end()
})

tape('buildRows() one row from the resolved coordinate', t => {
	const h = makeHandler({ queries: { snvindel: {} } })
	const coord = { chr: 'chr7', start: 1, stop: 2 }
	t.deepEqual(h.buildRows({ dictionaryTerms: [], genes: [], samples: [], coord }), [
		{ name: formatCoord(coord), coord }
	])
	t.deepEqual(h.buildRows({ dictionaryTerms: [], genes: [], samples: [], coord: null }), [], 'null -> no rows')
	t.end()
})
