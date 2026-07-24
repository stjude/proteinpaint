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
