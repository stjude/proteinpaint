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
