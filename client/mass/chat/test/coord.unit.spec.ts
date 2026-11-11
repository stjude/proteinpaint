import tape from 'tape'
import { SearchResultHandler as CoordHandler, includeResult, parseCoordCandidates, formatCoord } from '../handlers/coord.ts'

/* Tests
	parseCoordCandidates()
		- chr-prefixed / unprefixed ranges try both spellings; commas and spaces accepted; non-coordinates -> null
	formatCoord()
	includeResult()
		- needs genomic-alteration data and a genome browser that allows the genomic view
	includeInSearch() / requestExtras()
		- searched whenever the text is a coordinate range, regardless of length; the candidates are sent
	buildRows()
*/

tape('\n', t => {
	t.comment('-***- mass/chat/handlers/coord -***-')
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

tape('includeResult() true only with genomic data and a genomic view', t => {
	t.equal(includeResult({ queries: { snvindel: {} } }), true)
	t.equal(includeResult({ queries: { cnv: {} } }), true)
	t.equal(includeResult({ queries: { svfusion: {} } }), true)
	t.equal(includeResult({ queries: { snvindel: {}, gbRestrictMode: 'genomic' } }), true)
	t.equal(includeResult({ queries: {} }), false, 'no genomic-alteration data')
	t.equal(
		includeResult({ queries: { snvindel: {}, gbRestrictMode: 'protein' } }),
		false,
		'a protein-only genome browser cannot open a typed region'
	)
	t.equal(includeResult(undefined), false, 'a missing config is not an error')
	t.end()
})

tape('includeInSearch() searches a coordinate regardless of length', t => {
	const h = new CoordHandler()
	const input = { prompt: 'chr17:7666657-7688274', enter: false }
	t.equal(h.includeInSearch(input), true, 'a long coordinate typed without Enter is searched')
	t.deepEqual(h.requestExtras(input), { coordCandidates: ['chr17:7666657-7688274', '17:7666657-7688274'] })
	t.equal(h.includeInSearch({ prompt: 'TP53', enter: true }), false, 'a gene name is not a coordinate, even on Enter')
	t.end()
})

tape('buildRows() one row from the resolved coordinate', t => {
	const h = new CoordHandler()
	const coord = { chr: 'chr7', start: 1, stop: 2 }
	t.deepEqual(h.buildRows({ dictionaryTerms: [], genes: [], samples: [], coord }), [
		{ name: formatCoord(coord), coord }
	])
	t.deepEqual(h.buildRows({ dictionaryTerms: [], genes: [], samples: [], coord: null }), [], 'null -> no rows')
	t.end()
})
