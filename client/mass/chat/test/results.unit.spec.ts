import tape from 'tape'
import { buildResultList, describeSearchable } from '../results.ts'
import type { OmnisearchHandler } from '../handlers/types.ts'
import { initHandlers } from '../handlers/index.ts'

/* Tests (generic list logic, with fake handlers: it must not depend on any real result kind)
	buildResultList()
		- no rows -> empty list
		- each enabled handler with rows gets a heading then its items, in handler order
		- disabled handlers contribute nothing and are not asked to build rows
		- truncation note only when the server total exceeds what the handler reports as returned
		- countReturned overrides rows.length when comparing with the total
		- later handlers see the rows built by earlier ones
	describeSearchable()
		- lists enabled handlers with their hints
	initHandlers()
		- display order and which handlers a dataset enables
*/

function fake(id: string, rows: any[], opts: Partial<OmnisearchHandler> = {}): OmnisearchHandler {
	return {
		id,
		key: 'genes',
		heading: id.toUpperCase(),
		noun: id,
		label: id,
		enabled: true,
		init() {},
		plan: () => ({ active: true, request: {} }),
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
	t.deepEqual(buildResultList([fake('a', [])], data()), [])
	t.deepEqual(buildResultList([], data()), [])
	t.end()
})

tape('buildResultList() headings and items in handler order', t => {
	const a = fake('a', [{ n: 1 }, { n: 2 }])
	const b = fake('b', [{ n: 3 }])
	const list = buildResultList([a, b], data())
	t.deepEqual(
		list.map(e => (e.type == 'heading' ? `#${e.name}` : e.type == 'item' ? e.row.n : e.type)),
		['#A', 1, 2, '#B', 3]
	)
	t.equal((list[1] as any).handler, a, 'an item carries its handler for rendering')
	t.end()
})

tape('buildResultList() skips disabled handlers without building rows', t => {
	let called = false
	const off = fake('off', [{ n: 1 }], {
		enabled: false,
		buildRows: () => {
			called = true
			return [{ n: 1 }]
		}
	})
	t.deepEqual(buildResultList([off], data()), [])
	t.equal(called, false, 'buildRows is not called')
	t.end()
})

tape('buildResultList() truncation note', t => {
	const h = fake('a', [{}, {}], { key: 'genes', noun: 'gene' })
	const capped: any = buildResultList([h], data({ genes: 7 })).find(e => e.type == 'note')
	t.equal(capped?.name, 'Displaying 2 out of a total of 7 gene matches')
	t.equal(capped?.testid, 'sjpp-mass-chat-note-a')
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
	const h = fake('a', [{}], { key: 'genes', noun: 'gene', countReturned: () => 2 })
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
	const a = fake('a', [{ name: 'x' }])
	const b = fake('b', [{ n: 1 }], {
		buildRows: (_d, earlier) => {
			seen = { ...earlier } // snapshot: the map keeps growing as later handlers are built
			return [{ n: 1 }]
		}
	})
	buildResultList([a, b], data())
	t.deepEqual(seen, { a: [{ name: 'x' }] })
	t.end()
})

tape('describeSearchable() lists enabled handlers with their hints', t => {
	t.equal(
		describeSearchable([
			fake('a', [], { label: 'Dictionary variables' }),
			fake('b', [], { label: 'Samples', hint: 'press Enter to search' }),
			fake('c', [], { label: 'Off', enabled: false })
		]),
		'Searchable: Dictionary variables, Samples (press Enter to search)'
	)
	t.end()
})

tape('initHandlers() order and per-dataset enablement', t => {
	const all = initHandlers({
		app: {},
		termdbConfig: { allowedTermTypes: ['geneExpression'], displaySampleIds: true, queries: { snvindel: {} } }
	})
	t.deepEqual(
		all.map(h => h.id),
		['dictionary', 'genes', 'samples', 'coord'],
		'display order'
	)
	t.equal(
		describeSearchable(all),
		'Searchable: Dictionary variables, Genes, Samples (press Enter to search), Genomic regions (chr:start-stop)'
	)
	const minimal = initHandlers({ app: {}, termdbConfig: {} })
	t.equal(describeSearchable(minimal), 'Searchable: Dictionary variables', 'dictionary is always searchable')
	t.end()
})
