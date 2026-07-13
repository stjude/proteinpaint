import tape from 'tape'
import { fetchOmnisearch } from '../search.ts'

/* Tests
	- gene search returns gene matches with their available data types
	- typed coordinate (with candidates) resolves to chr/start/stop
	- typed coordinate WITHOUT candidates is not resolved (server gates coord resolution on the client regex)
	- dictionary term search returns matching terms

	fetchOmnisearch() is the server-call half of the mass omnisearch (see client/mass/search.ts, where it
	is separated from the rendering). These tests hit the termdb/chat omnisearch route directly against the
	TermdbTest / hg38-test dataset (no app/DOM). TermdbTest has snvindel/cnv/svfusion (so genomeBrowser is
	available and coordinates resolve) and uses selectCohort, so dictionary search needs a valid cohortStr.
*/

/*************************
 reusable helper functions
**************************/

const genome = 'hg38-test'
const dslabel = 'TermdbTest'
// TP53 locus on hg38 (= hg38-test defaultcoord); used for the gene and coordinate cases
const TP53_COORD = { chr: 'chr17', start: 7666657, stop: 7688274 }
const coordPrompt = `${TP53_COORD.chr}:${TP53_COORD.start}-${TP53_COORD.stop}`

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- mass/omnisearch fetchOmnisearch -***-')
	test.end()
})

tape('gene search returns gene matches with data types', async function (test) {
	test.timeoutAfter(10000)
	const data = await fetchOmnisearch({ genome, dslabel, prompt: 'TP53' })

	test.ok(Array.isArray(data.genes), 'genes should be an array')
	const tp53 = data.genes.find(g => g.gene == 'TP53')
	test.ok(tp53, 'genes should include TP53')
	test.equal(
		tp53?.dataTypes?.genomeBrowser,
		true,
		'TP53 should have the genomeBrowser data type (TermdbTest has snvindel/cnv/svfusion)'
	)
	test.notOk(data.coord, 'no coordinate should be resolved for a gene prompt (no coordCandidates sent)')
	test.end()
})

tape('typed coordinate (with candidates) resolves to chr/start/stop', async function (test) {
	test.timeoutAfter(10000)
	// the client (parseCoordCandidates) sends both "chr"-prefixed and bare spellings
	const bareChr = TP53_COORD.chr.replace(/^chr/, '') // "chr17" -> "17"
	const data = await fetchOmnisearch({
		genome,
		dslabel,
		prompt: coordPrompt,
		coordCandidates: [coordPrompt, `${bareChr}:${TP53_COORD.start}-${TP53_COORD.stop}`]
	})

	test.ok(data.coord, 'coord should be resolved when coordCandidates are sent')
	test.equal(data.coord?.chr, TP53_COORD.chr, 'resolved chr should match')
	test.equal(data.coord?.start, TP53_COORD.start, 'resolved start should match')
	test.equal(data.coord?.stop, TP53_COORD.stop, 'resolved stop should match')
	test.end()
})

tape('typed coordinate without candidates is not resolved (server gates on the client regex)', async function (test) {
	test.timeoutAfter(10000)
	const data = await fetchOmnisearch({ genome, dslabel, prompt: coordPrompt })
	test.notOk(data.coord, 'coord should NOT be resolved when no coordCandidates are sent')
	test.end()
})

tape('dictionary term search returns matching terms', async function (test) {
	test.timeoutAfter(10000)
	// TermdbTest uses selectCohort, so dictionary search needs a valid cohortStr
	const data = await fetchOmnisearch({
		genome,
		dslabel,
		prompt: 'sex',
		cohortStr: 'ABC',
		usecase: { target: 'dictionary', detail: 'term' }
	})

	test.ok(Array.isArray(data.dictionaryTerms), 'dictionaryTerms should be an array')
	test.ok(
		data.dictionaryTerms.some((t: any) => /sex/i.test(t?.name || '')),
		'dictionaryTerms should include a term whose name matches "sex" (e.g. "Sex")'
	)
	test.end()
})
