import tape from 'tape'
import {
	parseCoordCandidates,
	planSearch,
	MAX_PROMPT_LENGTH_FOR_OMNISEARCH,
	MIN_PROMPT_LENGTH_FOR_GENE_SEARCH
} from '../search.ts'

/* Tests
	parseCoordCandidates()
		- chr-prefixed range -> typed spelling then unprefixed
		- unprefixed range -> typed spelling then chr-prefixed
		- commas and spaces are accepted
		- non-coordinates return null
	planSearch()
		- empty / whitespace -> null
		- typing: below the gene minimum -> null; at it, genes only; at 3 chars adds dictionary; samples never
		- typing: over the max length -> null, but a coordinate is still planned
		- Enter: samples included; length cutoffs do not apply
*/

tape('\n', t => {
	t.comment('-***- mass/chat/search -***-')
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

tape('planSearch() returns null for an empty prompt', t => {
	t.equal(planSearch('', { enter: false }), null)
	t.equal(planSearch('   ', { enter: true }), null)
	t.end()
})

tape('planSearch() typing: below the gene minimum is not searched', t => {
	t.equal(planSearch('p'.repeat(MIN_PROMPT_LENGTH_FOR_GENE_SEARCH - 1), { enter: false }), null)
	t.end()
})

tape('planSearch() typing: the gene minimum is a gene-only search', t => {
	const plan = planSearch('p'.repeat(MIN_PROMPT_LENGTH_FOR_GENE_SEARCH), { enter: false })
	t.ok(plan, 'searched at the gene minimum length')
	t.equal(plan?.includeDict, false, 'dictionary not searched below its own minimum')
	t.equal(plan?.includeSamples, false, 'samples never searched while typing')
	t.end()
})

tape('planSearch() typing: 3 chars adds dictionary but never samples', t => {
	const plan = planSearch(' ris ', { enter: false })
	t.equal(plan?.prompt, 'ris', 'prompt is trimmed')
	t.equal(plan?.includeDict, true)
	t.equal(plan?.includeSamples, false)
	t.equal(plan?.coordCandidates, null)
	t.end()
})

tape('planSearch() typing: over the max length is not searched, a coordinate still is', t => {
	t.equal(planSearch('a'.repeat(MAX_PROMPT_LENGTH_FOR_OMNISEARCH + 1), { enter: false }), null)
	const coord = planSearch('chr17:7666657-7688274', { enter: false })
	t.ok(coord, 'a long coordinate is searched')
	t.deepEqual(coord?.coordCandidates, ['chr17:7666657-7688274', '17:7666657-7688274'])
	t.equal(coord?.includeSamples, false, 'a coordinate typed without Enter still does not search samples')
	t.end()
})

tape('planSearch() Enter: includes samples and ignores length cutoffs', t => {
	const short = planSearch('a', { enter: true })
	t.equal(short?.includeSamples, true, 'samples searched on Enter')
	t.equal(short?.includeDict, true, 'dictionary searched on Enter even for 1 char')
	t.ok(
		planSearch('a'.repeat(MAX_PROMPT_LENGTH_FOR_OMNISEARCH + 10), { enter: true }),
		'a long sample name can be searched'
	)
	t.end()
})
