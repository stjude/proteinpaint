import tape from 'tape'
import { skipPrevActionAbort } from '#mass/skipPrevActionAbort'

/*
skipPrevActionAbort() decides whether AppApi.dispatch() keeps the app-level AbortController
intact. true = keep the pending requests, false = abort them.
*/

/**************
 test sections
***************/

tape('\n', function (test) {
	test.comment('-***- mass/skipPrevActionAbort -***-')
	test.end()
})

tape('actions that affect all components', async function (test) {
	test.equal(skipPrevActionAbort(), false, 'should abort when there is no action, which re-renders everything')
	test.equal(skipPrevActionAbort({ type: 'filter_replace' }), false, 'should abort on filter_replace')
	test.equal(skipPrevActionAbort({ type: 'filter_add' }), false, 'should abort on any filter* action')
	test.equal(skipPrevActionAbort({ type: 'cohort_set' }), false, 'should abort on cohort_set')
	test.end()
})

tape('actions that affect one plot', async function (test) {
	test.equal(
		skipPrevActionAbort({ type: 'plot_delete', id: 'abc' }),
		true,
		'should not abort on plot_delete, so that closing a sandbox does not cancel another plot request'
	)
	test.equal(skipPrevActionAbort({ type: 'plot_create' }), true, 'should not abort on plot_create')
	test.equal(skipPrevActionAbort({ type: 'plot_edit', id: 'abc' }), true, 'should not abort on plot_edit')
	test.equal(skipPrevActionAbort({ type: 'tab_set' }), true, 'should not abort on tab_set')
	test.end()
})

tape('app_refresh with subactions', async function (test) {
	test.equal(
		skipPrevActionAbort({ type: 'app_refresh', subactions: [{ type: 'plot_delete', id: 'a' }] }),
		true,
		'should not abort when no subaction affects all components'
	)
	test.equal(
		skipPrevActionAbort({
			type: 'app_refresh',
			subactions: [{ type: 'plot_delete', id: 'a' }, { type: 'filter_replace' }]
		}),
		false,
		'should abort when a subaction is a filter change'
	)
	test.equal(
		skipPrevActionAbort({ type: 'app_refresh', subactions: [{ type: 'cohort_set' }] }),
		false,
		'should abort when a subaction is a cohort change'
	)
	test.end()
})

tape('app_refresh with both subactions and state', async function (test) {
	// as dispatched by regression.inputs.values.table.js to refresh the violin plot of a
	// regression input, where the state patch is the only sign that the filter changed
	test.equal(
		skipPrevActionAbort({
			type: 'app_refresh',
			state: { termfilter: {} },
			subactions: [{ type: 'plot_edit', id: 'a' }]
		}),
		false,
		'should abort on a global state patch even when no subaction affects all components'
	)
	test.equal(
		skipPrevActionAbort({
			type: 'app_refresh',
			state: { groups: [] },
			subactions: [{ type: 'plot_edit', id: 'a' }]
		}),
		true,
		'should not abort when neither the subactions nor the state patch affects all components'
	)
	test.equal(
		skipPrevActionAbort({
			type: 'app_refresh',
			state: { groups: [] },
			subactions: [{ type: 'filter_replace' }]
		}),
		false,
		'should abort on a global subaction even when the state patch is partial'
	)
	test.end()
})

tape('app_refresh without subactions', async function (test) {
	test.equal(
		skipPrevActionAbort({ type: 'app_refresh' }),
		false,
		'should abort when there is no state, as dispatched after a login'
	)
	test.equal(
		skipPrevActionAbort({ type: 'app_refresh', state: { groups: [] } }),
		true,
		'should not abort on a partial state patch that does not affect all components'
	)
	test.equal(
		skipPrevActionAbort({ type: 'app_refresh', state: { plots: [], termfilter: {}, activeCohort: 0 } }),
		false,
		'should abort on a wholesale state replacement, as dispatched when recovering a saved session'
	)
	test.equal(
		skipPrevActionAbort({ type: 'app_refresh', state: { termfilter: {} } }),
		false,
		'should abort when the replaced state includes termfilter'
	)
	test.equal(
		skipPrevActionAbort({ type: 'app_refresh', state: { activeCohort: 1 } }),
		false,
		'should abort when the replaced state includes activeCohort'
	)
	test.equal(
		skipPrevActionAbort({ type: 'app_refresh', state: { plots: [] } }),
		false,
		'should abort when the replaced state includes plots'
	)
	test.end()
})
