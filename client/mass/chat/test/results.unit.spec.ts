import tape from 'tape'
import { buildResultList, describeSearchable } from '../results.ts'
import type { OmnisearchResultKey } from '#types'
import type { OmnisearchHandler } from '../types.ts'
import { initHandlers } from '../loadHandlers.ts'

/* Tests (generic list logic, with fake handlers: it must not depend on any real result kind)
	buildResultList()
		- no rows -> empty list
		- each handler with rows gets a heading then its items, in handler order
		- truncation note only when the server total exceeds what the handler reports as returned
		- countReturned overrides rows.length when comparing with the total
		- later handlers see the rows built by earlier ones
	describeSearchable()
		- lists the loaded handlers with their hints
	initHandlers()
		- display order; handlers the dataset cannot use are dropped
*/

function fake(key: OmnisearchResultKey, rows: any[], opts: Partial<OmnisearchHandler> = {}): OmnisearchHandler {
	return {
		key,
		heading: key.toUpperCase(),
		noun: key,
		label: key,
		init() {},
		includeInSearch: () => true,
		buildRows: () => rows,
		renderRow() {},
		...opts
	}
}
const data = (totals?: any): any => ({ dictionaryTerms: [], genes: [], samples: [], totals })

tape('\n', t => {
	t.comment('-***- mass/chat/results -***-')
	t.end()
})

tape('buildResultList() empty', t => {
	t.deepEqual(buildResultList([fake('genes', [])], data()), [])
	t.deepEqual(buildResultList([], data()), [])
	t.end()
})

tape('buildResultList() headings and items in handler order', t => {
	const a = fake('dictionaryTerms', [{ n: 1 }, { n: 2 }])
	const b = fake('genes', [{ n: 3 }])
	const list = buildResultList([a, b], data())
	t.deepEqual(
		list.map(e => (e.type == 'heading' ? `#${e.name}` : e.type == 'item' ? e.row.n : e.type)),
		['#DICTIONARYTERMS', 1, 2, '#GENES', 3]
	)
	t.equal((list[1] as any).handler, a, 'an item carries its handler for rendering')
	t.end()
})

tape('buildResultList() truncation note', t => {
	const h = fake('genes', [{}, {}], { noun: 'gene' })
	const capped: any = buildResultList([h], data({ genes: 7 })).find(e => e.type == 'note')
	t.equal(capped?.name, 'Displaying 2 out of a total of 7 gene matches')
	t.equal(capped?.testid, 'sjpp-mass-chat-note-genes')
	t.notOk(
		buildResultList([h], data({ genes: 2 })).some(e => e.type == 'note'),
		'no note when the total equals what was returned'
	)
	t.notOk(
		buildResultList([h], data()).some(e => e.type == 'note'),
		'no note when the server sent no totals'
	)
	t.end()
})

tape('buildResultList() countReturned overrides rows.length', t => {
	// the server returned 2 of 5 total; one was dropped client-side. The note must still appear (5 > 2)
	// and report the 1 displayed row.
	const h = fake('genes', [{}], { noun: 'gene', countReturned: () => 2 })
	const note: any = buildResultList([h], data({ genes: 5 })).find(e => e.type == 'note')
	t.equal(note?.name, 'Displaying 1 out of a total of 5 gene matches')
	t.notOk(
		buildResultList([h], data({ genes: 2 })).some(e => e.type == 'note'),
		'raw count equals the total -> no note even though rows were filtered'
	)
	t.end()
})

tape('buildResultList() later handlers see earlier rows', t => {
	let seen: any
	const a = fake('dictionaryTerms', [{ name: 'x' }])
	const b = fake('genes', [{ n: 1 }], {
		buildRows: (_d, earlier) => {
			seen = { ...earlier } // snapshot: the map keeps growing as later handlers are built
			return [{ n: 1 }]
		}
	})
	buildResultList([a, b], data())
	t.deepEqual(seen, { dictionaryTerms: [{ name: 'x' }] })
	t.end()
})

tape('describeSearchable() lists handlers with their hints', t => {
	t.equal(
		describeSearchable([
			fake('dictionaryTerms', [], { label: 'Dictionary variables' }),
			fake('samples', [], { label: 'Samples', hint: 'press Enter to search' })
		]),
		'Searchable: Dictionary variables, Samples (press Enter to search)'
	)
	t.end()
})

tape('initHandlers() order, and handlers the dataset cannot use are dropped', async t => {
	const all = await initHandlers({
		app: {},
		termdbConfig: { allowedTermTypes: ['geneExpression'], displaySampleIds: true, queries: { snvindel: {} } }
	})
	t.deepEqual(
		all.map(h => h.key),
		['dictionaryTerms', 'genes', 'samples', 'coord'],
		'display order'
	)
	t.equal(
		describeSearchable(all),
		'Searchable: Dictionary variables, Genes, Samples (press Enter to search), Genomic regions (chr:start-stop)'
	)
	const minimal = await initHandlers({ app: {}, termdbConfig: {} })
	t.deepEqual(
		minimal.map(h => h.key),
		['dictionaryTerms'],
		'a dataset with no gene data, sample ids or genomic data keeps only the dictionary handler'
	)
	t.equal(describeSearchable(minimal), 'Searchable: Dictionary variables', 'dictionary is always searchable')
	const noGbGenomic = await initHandlers({
		app: {},
		termdbConfig: { allowedTermTypes: ['geneExpression'], queries: { snvindel: {}, gbRestrictMode: 'protein' } }
	})
	t.deepEqual(
		noGbGenomic.map(h => h.key),
		['dictionaryTerms', 'genes'],
		'a protein-only genome browser drops the genomic region handler'
	)
	t.end()
})
