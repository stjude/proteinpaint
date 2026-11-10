import tape from 'tape'
import { planSearch } from '../search.ts'
import { initHandlers } from '../handlers/index.ts'
import {
	MAX_PROMPT_LENGTH_FOR_OMNISEARCH,
	MIN_PROMPT_LENGTH_FOR_GENE_SEARCH,
	MIN_PROMPT_LENGTH_FOR_DICT_SEARCH
} from '../handlers/constants.ts'

/* Tests (planSearch merges every handler's contribution into one request; the real handlers are used)
	- empty / whitespace -> null
	- typing: below the gene minimum -> null; at it, genes only; at the dictionary minimum adds dictionary
	- samples are never searched while typing, only on Enter
	- over the max length -> null, but a coordinate is still planned
	- Enter: every enabled kind is searched, length gates ignored
	- disabled kinds are switched off in the request
*/

const config = {
	allowedTermTypes: ['geneExpression'],
	displaySampleIds: true,
	queries: { snvindel: {} }
}
const handlers = initHandlers({ app: {}, termdbConfig: config })

tape('\n', t => {
	t.comment('-***- mass/chat/search -***-')
	t.end()
})

tape('planSearch() returns null for an empty prompt', t => {
	t.equal(planSearch(handlers, '', { enter: false }), null)
	t.equal(planSearch(handlers, '   ', { enter: true }), null)
	t.end()
})

tape('planSearch() typing: below the gene minimum is not searched', t => {
	t.equal(planSearch(handlers, 'p'.repeat(MIN_PROMPT_LENGTH_FOR_GENE_SEARCH - 1), { enter: false }), null)
	t.end()
})

tape('planSearch() typing: the gene minimum is a gene-only search', t => {
	const plan = planSearch(handlers, 'p'.repeat(MIN_PROMPT_LENGTH_FOR_GENE_SEARCH), { enter: false })
	t.deepEqual(plan?.request, { includeDict: false, includeGenes: true, includeSamples: false })
	t.end()
})

tape('planSearch() typing: the dictionary minimum adds dictionary but never samples', t => {
	const plan = planSearch(handlers, ` ${'r'.repeat(MIN_PROMPT_LENGTH_FOR_DICT_SEARCH)} `, { enter: false })
	t.equal(plan?.prompt, 'r'.repeat(MIN_PROMPT_LENGTH_FOR_DICT_SEARCH), 'prompt is trimmed')
	t.deepEqual(plan?.request, { includeDict: true, includeGenes: true, includeSamples: false })
	t.end()
})

tape('planSearch() typing: over the max length is not searched, a coordinate still is', t => {
	t.equal(planSearch(handlers, 'a'.repeat(MAX_PROMPT_LENGTH_FOR_OMNISEARCH + 1), { enter: false }), null)
	const plan = planSearch(handlers, 'chr17:7666657-7688274', { enter: false })
	t.ok(plan, 'a long coordinate is searched')
	t.deepEqual(plan?.request.coordCandidates, ['chr17:7666657-7688274', '17:7666657-7688274'])
	t.equal(plan?.request.includeSamples, false, 'a coordinate typed without Enter still does not search samples')
	t.equal(plan?.request.includeDict, false, 'nor the dictionary, which is over its length gate')
	t.end()
})

tape('planSearch() Enter: searches every enabled kind and ignores length gates', t => {
	const short = planSearch(handlers, 'a', { enter: true })
	t.deepEqual(short?.request, { includeDict: true, includeGenes: true, includeSamples: true })
	t.ok(planSearch(handlers, 'a'.repeat(MAX_PROMPT_LENGTH_FOR_OMNISEARCH + 10), { enter: true }), 'a long sample name')
	t.end()
})

tape('planSearch() disabled kinds are switched off in the request', t => {
	const minimal = initHandlers({ app: {}, termdbConfig: {} })
	const plan = planSearch(minimal, 'abc', { enter: true })
	t.equal(plan?.request.includeSamples, false, 'samples are off when the dataset does not display sample ids')
	t.equal(plan?.request.includeGenes, false, 'genes are off when the dataset has no gene data')
	t.equal(plan?.request.includeDict, true)
	t.notOk('coordCandidates' in (plan?.request || {}))
	t.end()
})
