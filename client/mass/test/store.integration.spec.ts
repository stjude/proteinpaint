import tape from 'tape'
import { storeInit } from '../store.ts'
import { vocabInit } from '#termdb/vocabulary'

/*************************
 reusable helper functions
**************************/

async function getStore() {
	const state = {
		vocab: {
			genome: 'hg38-test',
			dslabel: 'TermdbTest'
		}
	}

	const app: any = { state, opts: {} }

	app.vocabApi = await vocabInit({ app, state })

	app.store = await storeInit({
		debug: true,
		app,
		state,
		vocabApi: app.vocabApi
	})

	return app.store.Inner
}

/* the term and q that the geneVariant edit menu hands to vocabApi.rememberGvQ() when Apply
is clicked, reduced to the properties remember_gvq() reads */
function getGvTerm(gene: string) {
	return {
		type: 'geneVariant',
		id: gene,
		name: gene,
		genes: [{ kind: 'gene', id: gene, gene, name: gene, type: 'geneVariant' }]
	}
}

function getCustomGsQ(groupNames: string[]) {
	return {
		type: 'custom-groupset',
		isAtomic: true,
		customset: { groups: groupNames.map(name => ({ name, type: 'filter', filter: {} })) }
	}
}

function rememberGvQ(store, gene: string, groupNames: string[], q?: any) {
	store.actions.remember_gvq.call(store, {
		type: 'remember_gvq',
		term: getGvTerm(gene),
		q: q || getCustomGsQ(groupNames)
	})
}

/**************
 test sections
***************/
tape('\n', function (test) {
	test.comment('-***- mass/store -***-')
	test.end()
})

tape('app_refresh()', async test => {
	const store = await getStore()
	const filter = {
		type: 'tvslst',
		in: false,
		join: '',
		tag: 'filterUiRoot',
		lst: []
	}
	const activeCohort = 1
	const action = {
		type: 'app_refresh',
		subactions: [
			{
				type: 'filter_replace',
				filter: structuredClone(filter)
			},
			{
				type: 'cohort_set',
				activeCohort
			}
		]
	}
	await store.actions.app_refresh.call(store, action)
	test.deepEqual(store.state.termfilter.filter.lst[1], filter, `should run subactions and reset the filter`)
	test.equal(store.state.activeCohort, 1, `should run subactions and set the activeCohort to ${activeCohort}`)
	test.end()
})

tape('custom term actions upsert and delete by stable id', async test => {
	const store = await getStore()
	const first = { id: 'junction:j1', name: 'Junction 1', tw: { term: { id: 'j1' } } }
	const updated = { ...first, name: 'Updated junction 1' }

	store.actions.add_customTerm.call(store, { type: 'add_customTerm', obj: first })
	store.actions.add_customTerm.call(store, { type: 'add_customTerm', obj: updated })
	test.equal(store.state.customTerms.length, 1, 'does not duplicate a custom term with the same id')
	test.equal(store.state.customTerms[0].name, 'Updated junction 1', 'replaces the matching custom term')

	store.actions.delete_customTerm.call(store, { type: 'delete_customTerm', id: first.id })
	test.equal(store.state.customTerms.length, 0, 'deletes a custom term by id')
	test.end()
})

tape('custom term deletion retains name-based compatibility', async test => {
	const store = await getStore()
	store.actions.add_customTerm.call(store, {
		type: 'add_customTerm',
		obj: { name: 'Legacy custom term', tw: { term: { id: 'legacy' } } }
	})

	store.actions.delete_customTerm.call(store, { type: 'delete_customTerm', name: 'Legacy custom term' })
	test.equal(store.state.customTerms.length, 0, 'deletes a legacy custom term by name')
	test.end()
})

tape('remember_gvq remembers a geneVariant setting by gene', async test => {
	const store = await getStore()
	rememberGvQ(store, 'BCR', ['BCR-ABL1 fusion', 'Others'])

	const lst = store.state.reuse.gvQByGene.BCR
	test.equal(lst?.length, 1, 'remembers the setting under the gene of the term')
	test.equal(lst[0].label, 'BCR-ABL1 fusion / Others', 'labels the entry by its groups')
	test.equal('isAtomic' in lst[0].q, false, 'stores a trimmed q')
	test.deepEqual(
		lst[0].q.customset.groups.map(g => g.name),
		['BCR-ABL1 fusion', 'Others'],
		'stores the groups the user built'
	)

	// a predefined groupset is what the gene search radio already offers, see isCustomizedGvQ()
	rememberGvQ(store, 'KRAS', [], { type: 'predefined-groupset', predefined_groupset_idx: 0, isAtomic: true })
	test.equal('KRAS' in store.state.reuse.gvQByGene, false, 'ignores a predefined groupset')

	rememberGvQ(store, 'TP53', [], { type: 'custom-groupset', customset: { groups: [] } })
	test.equal('TP53' in store.state.reuse.gvQByGene, false, 'ignores a custom groupset with no groups')
	test.end()
})

tape('remembered geneVariant settings de-duplicate and stay in recency order', async test => {
	const store = await getStore()
	rememberGvQ(store, 'BCR', ['BCR-ABL1 fusion', 'Others'])
	rememberGvQ(store, 'BCR', ['BCR-JAK2 fusion', 'Others'])
	let lst = store.state.reuse.gvQByGene.BCR
	test.deepEqual(
		lst.map(entry => entry.label),
		['BCR-JAK2 fusion / Others', 'BCR-ABL1 fusion / Others'],
		'lists two distinct settings of one gene, most recent first'
	)

	// the same setting again, from a q that carries derived properties the trim drops
	const again: any = getCustomGsQ(['BCR-ABL1 fusion', 'Others'])
	again.hiddenValues = { WT: 1 }
	again.dtLst = [2]
	rememberGvQ(store, 'BCR', [], again)
	lst = store.state.reuse.gvQByGene.BCR
	test.equal(lst.length, 2, 'does not store an equivalent setting twice')
	test.equal(lst[0].label, 'BCR-ABL1 fusion / Others', 'moves a setting the user returned to back to the front')
	test.end()
})

tape('remembered geneVariant settings are bounded', async test => {
	const store = await getStore()
	for (let i = 0; i < 8; i++) rememberGvQ(store, 'BCR', [`group ${i}`, 'Others'])
	test.equal(store.state.reuse.gvQByGene.BCR.length, 5, 'keeps at most 5 settings per gene')
	test.equal(store.state.reuse.gvQByGene.BCR[0].label, 'group 7 / Others', 'keeps the most recent ones')

	for (let i = 0; i < 40; i++) rememberGvQ(store, `GENE${i}`, ['mutated', 'Others'])
	const keys = Object.keys(store.state.reuse.gvQByGene)
	test.equal(keys.length, 30, 'keeps at most 30 genes')
	test.equal(keys.includes('BCR'), false, 'evicts the least recently used gene')
	test.equal(keys.includes('GENE39'), true, 'keeps the most recently used gene')
	test.end()
})
