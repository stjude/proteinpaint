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

/* a geneVariant tw as a plot config holds one: a filled term paired with a q. only the
properties that mayRememberGvQ() reads are filled in */
function getGvTw(gene: string, groupNames: string[]) {
	return {
		type: 'GvCustomGsTW',
		term: {
			type: 'geneVariant',
			id: gene,
			name: gene,
			genes: [{ kind: 'gene', id: gene, gene, name: gene, type: 'geneVariant' }]
		},
		q: {
			type: 'custom-groupset',
			isAtomic: true,
			customset: { groups: groupNames.map(name => ({ name, type: 'filter', filter: {} })) }
		}
	}
}

function addPlot(store, id, config) {
	store.state.plots.push({ id, ...config })
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

tape('plot_edit remembers a geneVariant setting by gene', async test => {
	const store = await getStore()
	addPlot(store, 'p1', { chartType: 'summary', term: { term: { id: 'agedx' }, q: {} } })
	const tw = getGvTw('BCR', ['BCR-ABL1 fusion', 'Others'])
	store.actions.plot_edit.call(store, { type: 'plot_edit', id: 'p1', config: { term2: tw } })

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
	const predefined = getGvTw('KRAS', [])
	predefined.q = { type: 'predefined-groupset', predefined_groupset_idx: 0, isAtomic: true } as any
	store.actions.plot_edit.call(store, { type: 'plot_edit', id: 'p1', config: { term2: predefined } })
	test.equal('KRAS' in store.state.reuse.gvQByGene, false, 'does not remember a predefined groupset')
	test.end()
})

tape('remembered geneVariant settings de-duplicate and stay in recency order', async test => {
	const store = await getStore()
	addPlot(store, 'p1', { chartType: 'summary' })
	const fusion = getGvTw('BCR', ['BCR-ABL1 fusion', 'Others'])
	const other = getGvTw('BCR', ['BCR-JAK2 fusion', 'Others'])

	store.actions.plot_edit.call(store, { type: 'plot_edit', id: 'p1', config: { term2: fusion } })
	store.actions.plot_edit.call(store, { type: 'plot_edit', id: 'p1', config: { term2: other } })
	let lst = store.state.reuse.gvQByGene.BCR
	test.deepEqual(
		lst.map(entry => entry.label),
		['BCR-JAK2 fusion / Others', 'BCR-ABL1 fusion / Others'],
		'lists two distinct settings of one gene, most recent first'
	)

	// the same setting again, from a tw that carries derived properties the trim drops
	const again = getGvTw('BCR', ['BCR-ABL1 fusion', 'Others'])
	;(again.q as any).hiddenValues = { WT: 1 }
	;(again.q as any).dtLst = [2]
	store.actions.plot_edit.call(store, { type: 'plot_edit', id: 'p1', config: { term2: again } })
	lst = store.state.reuse.gvQByGene.BCR
	test.equal(lst.length, 2, 'does not store an equivalent setting twice')
	test.equal(lst[0].label, 'BCR-ABL1 fusion / Others', 'moves a setting the user returned to back to the front')
	test.end()
})

tape('remembered geneVariant settings are bounded', async test => {
	const store = await getStore()
	addPlot(store, 'p1', { chartType: 'summary' })
	for (let i = 0; i < 8; i++) {
		store.actions.plot_edit.call(store, {
			type: 'plot_edit',
			id: 'p1',
			config: { term2: getGvTw('BCR', [`group ${i}`, 'Others']) }
		})
	}
	test.equal(store.state.reuse.gvQByGene.BCR.length, 5, 'keeps at most 5 settings per gene')
	test.equal(store.state.reuse.gvQByGene.BCR[0].label, 'group 7 / Others', 'keeps the most recent ones')

	for (let i = 0; i < 40; i++) {
		store.actions.plot_edit.call(store, {
			type: 'plot_edit',
			id: 'p1',
			config: { term2: getGvTw(`GENE${i}`, ['mutated', 'Others']) }
		})
	}
	const keys = Object.keys(store.state.reuse.gvQByGene)
	test.equal(keys.length, 30, 'keeps at most 30 genes')
	test.equal(keys.includes('BCR'), false, 'evicts the least recently used gene')
	test.equal(keys.includes('GENE39'), true, 'keeps the most recently used gene')
	test.end()
})

tape('a geneVariant setting is remembered wherever a chart keeps its tws', async test => {
	const store = await getStore()
	// a matrix keeps its tws in termgroups[].lst[], which no per-chartType getter is declared for
	addPlot(store, 'p1', { chartType: 'matrix' })
	store.actions.plot_edit.call(store, {
		type: 'plot_edit',
		id: 'p1',
		config: { termgroups: [{ name: 'group1', lst: [getGvTw('BCR', ['BCR-ABL1 fusion', 'Others'])] }] }
	})
	test.equal(store.state.reuse.gvQByGene.BCR?.length, 1, 'finds a tw nested in a matrix term group')
	test.end()
})
