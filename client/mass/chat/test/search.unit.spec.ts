import tape from 'tape'
import { planSearch } from '../search.ts'
import { initHandlers } from '../loadHandlers.ts'
import {
	MAX_PROMPT_LENGTH_FOR_OMNISEARCH,
	MIN_PROMPT_LENGTH_FOR_GENE_SEARCH,
	MIN_PROMPT_LENGTH_FOR_DICT_SEARCH
} from '../constants.ts'

/* Tests (planSearch builds one request whose `include` list is the keys of the handlers that search the text;
   the real handlers are used)
	- empty / whitespace -> null
	- typing: below the gene minimum -> null; at it, genes only; at the dictionary minimum adds dictionary
	- samples are never searched while typing, only on Enter
	- over the max length -> null, but a coordinate is still planned
	- Enter: every loaded kind is searched, length gates ignored
	- a kind the dataset cannot use has no handler, so its key is never included
*/

const config = {
	allowedTermTypes: ['geneExpression'],
	displaySampleIds: true,
	queries: { snvindel: {} }
}
const handlers = await initHandlers({ app: {}, termdbConfig: config })

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
	t.deepEqual(plan?.request, { include: ['genes'] })
	t.end()
})

tape('planSearch() typing: the dictionary minimum adds dictionary but never samples', t => {
	const plan = planSearch(handlers, ` ${'r'.repeat(MIN_PROMPT_LENGTH_FOR_DICT_SEARCH)} `, { enter: false })
	t.equal(plan?.prompt, 'r'.repeat(MIN_PROMPT_LENGTH_FOR_DICT_SEARCH), 'prompt is trimmed')
	t.deepEqual(plan?.request, { include: ['dictionaryTerms', 'genes'] })
	t.end()
})

tape('planSearch() typing: over the max length is not searched, a coordinate still is', t => {
	t.equal(planSearch(handlers, 'a'.repeat(MAX_PROMPT_LENGTH_FOR_OMNISEARCH + 1), { enter: false }), null)
	const plan = planSearch(handlers, 'chr17:7666657-7688274', { enter: false })
	t.ok(plan, 'a long coordinate is searched')
	t.deepEqual(plan?.request.coordCandidates, ['chr17:7666657-7688274', '17:7666657-7688274'])
	t.deepEqual(
		plan?.request.include,
		['coord'],
		'only the coordinate: not samples (no Enter), not the dictionary or genes (too long)'
	)
	t.end()
})

tape('planSearch() Enter: searches every loaded kind and ignores length gates', t => {
	const short = planSearch(handlers, 'a', { enter: true })
	t.deepEqual(short?.request, { include: ['dictionaryTerms', 'genes', 'samples'] }, 'not coord: "a" is no coordinate')
	t.ok(planSearch(handlers, 'a'.repeat(MAX_PROMPT_LENGTH_FOR_OMNISEARCH + 10), { enter: true }), 'a long sample name')
	t.end()
})

tape('planSearch() a kind the dataset cannot use has no handler, so its key is never included', async t => {
	// e.g. no gene data, no sample ids, no genomic data: only the dictionary remains
	const minimal = await initHandlers({ app: {}, termdbConfig: {} })
	t.deepEqual(planSearch(minimal, 'abc', { enter: true })?.request, { include: ['dictionaryTerms'] })
	t.end()
})
