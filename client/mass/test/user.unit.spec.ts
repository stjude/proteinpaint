import tape from 'tape'
import { datasetRequiresAuth, getDeletionBatches, getAuthStatus, getDaysLeft } from '../user.ts'
import {
	jwtAuth,
	basicAuth,
	getUser,
	getOptionLabels,
	withStoredSessions,
	withoutWarnings,
	mockFetch
} from './user.helpers.ts'

/**
 * Tests
 *  - datasetRequiresAuth()
 *  - getDeletionBatches()
 *  - getAuthStatus()
 *  - MassUser setRequiredAuth()
 *  - getDaysLeft()
 *  - MassUser getSessionOptions()
 *  - MassUser setServerCachedSessions(): only successful results are kept
 *  - MassUser main() after the user signs in
 *  - MassUser getState() for a session
 *  - MassUser getState() for a session saves the parts that make up a session
 *  - MassUser getState() for a session does not change the app state
 *  - MassUser refuses()
 *  - MassUser destroy() cancels pending cleanup
 */

tape('\n', test => {
	test.comment('-***- mass/user -***-')
	test.end()
})

tape('datasetRequiresAuth()', test => {
	test.equal(datasetRequiresAuth(undefined), false, 'should be false for a missing termdbConfig')
	test.equal(datasetRequiresAuth({}), false, 'should be false without requiredAuth')
	test.equal(datasetRequiresAuth({ requiredAuth: [] }), false, 'should be false for an empty requiredAuth[]')
	test.equal(datasetRequiresAuth({ requiredAuth: [jwtAuth] }), true, 'should be true for a jwt credential')
	test.equal(datasetRequiresAuth({ requiredAuth: [basicAuth] }), true, 'should be true for a basic credential')
	test.end()
})

tape('getDeletionBatches()', test => {
	test.deepEqual(getDeletionBatches([]), [], 'should return no batches for no ids')
	test.deepEqual(getDeletionBatches(['a', 'b', 'c']), [['a', 'b', 'c']], 'should keep a few short ids in one batch')

	const ids = Array.from({ length: 100 }, (_, i) => `session-${String(i).padStart(3, '0')}-${'x'.repeat(20)}`)
	const batches = getDeletionBatches(ids)
	test.true(batches.length > 1, 'should split many ids into several batches')
	test.deepEqual(batches.flat(), ids, 'should keep every id, in order, exactly once')
	test.true(
		batches.every(b => encodeURIComponent(JSON.stringify(b)).length <= 1000),
		'should keep the encoded ids of each batch within the url length limit'
	)

	const longId = 'y'.repeat(2000)
	test.deepEqual(
		getDeletionBatches(['a', longId, 'b']),
		[['a'], [longId], ['b']],
		'should send an id that is too long alone'
	)
	test.end()
})

tape('getAuthStatus()', test => {
	test.equal(getAuthStatus(false), 'Requires sign-in', 'should require sign-in when not signed in')
	test.equal(
		getAuthStatus(false, true),
		'Requires sign-in',
		'should require sign-in for public access when not signed in'
	)
	test.equal(getAuthStatus(true), 'You are signed in.', 'should read You are signed in.')
	test.equal(
		getAuthStatus(true, false),
		'You are signed in.',
		'should read You are signed in. when the access is not public'
	)
	test.equal(getAuthStatus(true, true), 'Public access', 'should read Public access for a user with only public access')
	test.equal(getAuthStatus(true, 'true' as any), 'You are signed in.', 'should only accept true for public access')
	test.end()
})

tape('MassUser setRequiredAuth()', test => {
	const { user, holder } = getUser()
	test.equal(user.requiredAuth, undefined, 'should not set requiredAuth for a public dataset')

	user.setRequiredAuth({ requiredAuth: [jwtAuth] })
	test.deepEqual(user.requiredAuth, jwtAuth, 'should set requiredAuth to the jwt credential of the termdb route')

	user.setRequiredAuth({ requiredAuth: [basicAuth] })
	test.equal(user.requiredAuth, undefined, 'should ignore a basic credential, only jwt allows server sessions')

	user.setRequiredAuth({ requiredAuth: [{ ...jwtAuth, route: 'other' }] })
	test.equal(user.requiredAuth, undefined, 'should ignore a jwt credential of another route')

	user.setRequiredAuth({ requiredAuth: [{ ...jwtAuth, route: 'other' }, jwtAuth] })
	test.deepEqual(user.requiredAuth, jwtAuth, 'should find the termdb route among several credentials')

	user.setRequiredAuth(undefined)
	test.equal(user.requiredAuth, undefined, 'should clear requiredAuth for a missing termdbConfig')
	holder.remove()
	test.end()
})

tape('MassUser renderAuthInfo()', test => {
	// public dataset
	{
		const { user, holder } = getUser()
		user.renderAuthInfo()
		test.equal(
			holder.select('[data-testid="sjpp-massnav-user-auth"]').style('display'),
			'none',
			'should hide auth info'
		)
		test.equal(holder.select('[data-testid="sjpp-massnav-user-auth-status"]').size(), 0, 'should not render a status')
		holder.remove()
	}

	// requires auth, not signed in
	{
		const { user, holder } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: false })
		user.renderAuthInfo()
		test.equal(
			holder.select('[data-testid="sjpp-massnav-user-auth"]').style('display'),
			'block',
			'should show auth info'
		)
		test.equal(
			holder.select('[data-testid="sjpp-massnav-user-auth-status"]').text(),
			'Requires sign-in',
			'should prompt to sign in when there is no verified token'
		)
		holder.remove()
	}

	// requires auth, failed sign-in with a reason
	{
		const { user, holder } = getUser({
			termdbConfig: { requiredAuth: [jwtAuth] },
			verified: false,
			tokenMessage: 'token expired'
		})
		user.renderAuthInfo()
		test.true(
			holder.select('[data-testid="sjpp-massnav-user-auth"]').text().includes('token expired'),
			'should show the reason'
		)
		holder.remove()
	}

	// requires auth, signed in
	{
		const { user, holder } = getUser({
			termdbConfig: { requiredAuth: [jwtAuth] },
			verified: true,
			tokenMessage: 'stale message'
		})
		user.renderAuthInfo()
		test.equal(
			holder.select('[data-testid="sjpp-massnav-user-auth-status"]').text(),
			'You are signed in.',
			'should show signed in'
		)
		test.false(
			holder.select('[data-testid="sjpp-massnav-user-auth"]').text().includes('stale message'),
			'should not show a sign-in failure reason when signed in'
		)
		holder.remove()
	}

	// re-rendering replaces, and does not append to, the previous content
	{
		const { user, holder } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		user.renderAuthInfo()
		user.renderAuthInfo()
		test.equal(
			holder.selectAll('[data-testid="sjpp-massnav-user-auth-status"]').size(),
			1,
			'should render the status once'
		)
		holder.remove()
	}
	test.end()
})

tape('MassUser renderAuthInfo() userTab', test => {
	const infoTestId = '[data-testid="sjpp-massnav-user-auth-info"]'

	// the message is under the status
	for (const verified of [true, false]) {
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified })
		state.termdbConfig.userTab = { msg: 'msg' }
		user.renderAuthInfo()
		const children = Array.from(
			(holder.select('[data-testid="sjpp-massnav-user-auth"]').node() as HTMLElement).children
		) as HTMLElement[]
		test.equal(
			children[0].getAttribute('data-testid'),
			'sjpp-massnav-user-auth-status',
			`should show the status first, verified=${verified}`
		)
		test.equal(
			children[0].textContent,
			verified ? 'You are signed in.' : 'Requires sign-in',
			`should show the status, verified=${verified}`
		)
		test.equal(
			children[1].getAttribute('data-testid'),
			'sjpp-massnav-user-auth-info',
			`should show the message under it, verified=${verified}`
		)
		test.equal(children[1].textContent, 'msg', `should show the message, verified=${verified}`)
		holder.remove()
	}

	// text is not interpreted as html
	{
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		state.termdbConfig.userTab = { msg: '<b>bold</b>' }
		user.renderAuthInfo()
		test.equal(holder.select(infoTestId).text(), '<b>bold</b>', 'should show the text as it is')
		test.equal(holder.select(`${infoTestId} b`).size(), 0, 'should not render html from the text')
		holder.remove()
	}

	// no message
	for (const userTab of [undefined, {}, { msg: '' }, { isPublic: true }]) {
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		state.termdbConfig.userTab = userTab
		user.renderAuthInfo()
		test.equal(holder.select(infoTestId).size(), 0, `should not show a message for userTab=${JSON.stringify(userTab)}`)
		test.equal(holder.select('[data-testid="sjpp-massnav-user-auth-status"]').size(), 1, 'should still show the status')
		holder.remove()
	}

	// replaced on re-render
	{
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		state.termdbConfig.userTab = { msg: 'first' }
		user.renderAuthInfo()
		state.termdbConfig.userTab = { msg: 'second' }
		user.renderAuthInfo()
		test.equal(holder.selectAll(infoTestId).size(), 1, 'should render the message once')
		test.equal(holder.select(infoTestId).text(), 'second', 'should show the latest message')
		holder.remove()
	}

	// a public dataset has no auth info, even if there is a message
	{
		const { user, holder, state } = getUser()
		state.termdbConfig.userTab = { msg: 'x', isPublic: true }
		user.renderAuthInfo()
		test.equal(holder.select(infoTestId).size(), 0, 'should not show a message when authorization is not required')
		holder.remove()
	}

	// the status for a user with only public access
	for (const [verified, isPublic, status] of [
		[true, true, 'Public access'],
		[true, false, 'You are signed in.'],
		[true, undefined, 'You are signed in.'],
		[false, true, 'Requires sign-in']
	] as [boolean, boolean | undefined, string][]) {
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified })
		state.termdbConfig.userTab = { msg: 'msg', isPublic }
		user.renderAuthInfo()
		test.equal(
			holder.select('[data-testid="sjpp-massnav-user-auth-status"]').text(),
			status,
			`should show '${status}' for verified=${verified} and isPublic=${isPublic}`
		)
		test.equal(holder.select(infoTestId).text(), 'msg', 'should still show the message')
		holder.remove()
	}

	// the status from the ds replaces the default status
	for (const [verified, isPublic] of [
		[true, true],
		[true, undefined],
		[false, undefined]
	] as [boolean, boolean | undefined][]) {
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified })
		state.termdbConfig.userTab = { status: 'Public Access', isPublic }
		user.renderAuthInfo()
		test.equal(
			holder.select('[data-testid="sjpp-massnav-user-auth-status"]').text(),
			'Public Access',
			`should show the status from the ds for verified=${verified} and isPublic=${isPublic}`
		)
		holder.remove()
	}

	// the list is after the message
	{
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		state.termdbConfig.userTab = {
			msg: 'msg',
			list: { label: 'Sites', items: ['A (India)', 'B (Nepal)'] }
		}
		user.renderAuthInfo()
		const testids = Array.from(
			(holder.select('[data-testid="sjpp-massnav-user-auth"]').node() as HTMLElement).children
		).map(c => c.getAttribute('data-testid'))
		test.deepEqual(
			testids,
			['sjpp-massnav-user-auth-status', 'sjpp-massnav-user-auth-info', 'sjpp-massnav-user-auth-list'],
			'should show the status, message, and list in this order'
		)
		test.equal(holder.select('[data-testid="sjpp-massnav-user-auth-info"]').text(), 'msg', 'should show the message')
		test.equal(holder.select('[data-testid="sjpp-massnav-user-auth-info"] a').size(), 0, 'should not add a link')
		const list = holder.select('[data-testid="sjpp-massnav-user-auth-list"]')
		test.equal(list.select('div').text(), 'Sites', 'should show the list label')
		test.deepEqual(
			list
				.selectAll('li')
				.nodes()
				.map((n: any) => n.textContent),
			['A (India)', 'B (Nepal)'],
			'should show the list items'
		)
		holder.remove()
	}

	// an email address in the message is a mailto link
	{
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		state.termdbConfig.userTab = { msg: 'Please contact A.b@c.org. Or x+y@d.e.org' }
		user.renderAuthInfo()
		const info = holder.select('[data-testid="sjpp-massnav-user-auth-info"]')
		test.equal(info.text(), 'Please contact A.b@c.org. Or x+y@d.e.org', 'should show the whole message')
		test.deepEqual(
			info
				.selectAll('a')
				.nodes()
				.map((n: any) => [n.getAttribute('href'), n.textContent]),
			[
				['mailto:A.b@c.org', 'A.b@c.org'],
				['mailto:x+y@d.e.org', 'x+y@d.e.org']
			],
			'should link each email, without the sentence-ending period'
		)
		holder.remove()
	}

	// the text of the status, message, and list is not interpreted as html
	{
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		state.termdbConfig.userTab = {
			status: '<b>s</b>',
			msg: '<b>m</b>',
			list: { label: '<b>l</b>', items: ['<b>i</b>'] }
		}
		user.renderAuthInfo()
		const auth = holder.select('[data-testid="sjpp-massnav-user-auth"]')
		test.equal(auth.selectAll('b').size(), 0, 'should not render html from the text')
		test.equal(
			auth.select('[data-testid="sjpp-massnav-user-auth-status"]').text(),
			'<b>s</b>',
			'should show the status as it is'
		)
		test.equal(auth.select('li').text(), '<b>i</b>', 'should show a list item as it is')
		holder.remove()
	}

	// no list
	for (const userTab of [undefined, {}, { msg: 'msg' }]) {
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		state.termdbConfig.userTab = userTab
		user.renderAuthInfo()
		test.equal(
			holder.select('[data-testid="sjpp-massnav-user-auth-list"]').size(),
			0,
			`should not show a list for userTab=${JSON.stringify(userTab)}`
		)
		holder.remove()
	}
	test.end()
})

tape('getDaysLeft()', test => {
	for (const [days, text] of [
		[12, '12 days left'],
		[1, '1 day left'],
		[0, '0 days left']
	] as [number, string][]) {
		const res = getDaysLeft(days)!
		test.equal(res.text, text, `should show '${text}'`)
		test.true(res.tip.includes('"Save"'), `should explain how to save a new session for ${days} days left`)
	}
	for (const days of [null, undefined, NaN, '12' as any]) {
		test.equal(getDaysLeft(days), undefined, `should not show days left for ${days}`)
	}
	test.end()
})

tape('MassUser getSessionOptions()', test => {
	{
		const { user } = getUser()
		test.deepEqual(getOptionLabels(user), ['Open', 'Save', 'Share'], 'should have Open, Save, and Share only')
		const save = user.getSessionOptions().find(o => o.label == 'Save')!
		test.equal(save.title, 'Save the current view', 'should set the title')
	}

	{
		const { user } = getUser({ savedSessions: { a: {} } })
		test.deepEqual(
			getOptionLabels(user),
			['Open', 'Save', 'Share', 'Delete'],
			'should add Delete when a session is saved in the browser'
		)
	}

	{
		const { user } = getUser({ serverCachedSessions: ['s1'] })
		test.true(getOptionLabels(user).includes('Delete'), 'should add Delete when a session is saved on the server')
	}

	{
		const { user } = getUser({ sessionDaysLeft: 30, sessionId: 'abc' })
		test.true(
			getOptionLabels(user).includes('Download'),
			'should add Download for a session opened from a mass-session-id url'
		)
	}

	{
		const { user } = getUser({ sessionDaysLeft: 30, sessionId: null })
		test.false(getOptionLabels(user).includes('Download'), 'should not add Download without a session id')
	}

	{
		const { user } = getUser({ sessionDaysLeft: null, sessionId: 'abc' })
		test.false(getOptionLabels(user).includes('Download'), 'should not add Download without days left')
	}

	{
		const { user } = getUser()
		user.savedSessions = { a: {} }
		test.true(getOptionLabels(user).includes('Delete'), 'should have Delete after a session is added')
		user.savedSessions = {}
		test.false(getOptionLabels(user).includes('Delete'), 'should not have Delete after all sessions are removed')
	}
	test.end()
})

tape('MassUser setServerCachedSessions(): only successful results are kept', async test => {
	await withoutWarnings(async warnings => {
		// not signed in: no request, nothing is kept, and no side effect on the sign-in message
		{
			const { user, holder, app } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: false })
			user.serverCachedSessions = undefined
			let headerRequests = 0
			app.vocabApi.mayGetAuthHeaders = async () => {
				headerRequests++
				return {}
			}
			const counter = mockFetch(() => ({ body: { status: 'ok', sessionIds: ['a'] } }))
			await user.setServerCachedSessions()
			test.equal(counter.requests, 0, 'should not send a request when the user is not signed in')
			test.equal(headerRequests, 0, 'should not ask for the auth headers when the user is not signed in')
			test.equal(user.serverCachedSessions, undefined, 'should not keep anything when the user is not signed in')
			test.equal(warnings.length, 0, 'should not warn when the lookup is skipped')

			// signed in later
			app.vocabApi.hasVerifiedToken = () => true
			await user.setServerCachedSessions()
			test.equal(counter.requests, 1, 'should send the request once the user is signed in')
			test.deepEqual(user.serverCachedSessions, ['a'], 'should keep the sessions once the user is signed in')
			counter.restore()
			holder.remove()
		}

		// a public dataset has no sessions on the server, and needs no request
		{
			const { user, holder } = getUser()
			user.serverCachedSessions = undefined
			const counter = mockFetch(() => ({ body: { sessionIds: ['a'] } }))
			await user.setServerCachedSessions()
			test.equal(counter.requests, 0, 'should not send a request for a dataset that has no jwt credential')
			test.deepEqual(
				user.serverCachedSessions,
				[],
				'should keep an empty list for a dataset that has no jwt credential'
			)
			counter.restore()
			holder.remove()
		}

		// an error response is not kept as an empty list
		{
			const { user, holder } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
			user.serverCachedSessions = undefined
			warnings.length = 0
			let counter = mockFetch(() => ({ status: 401, body: { error: 'invalid credentials: no jwt.email' } }))
			await user.setServerCachedSessions()
			test.equal(user.serverCachedSessions, undefined, 'should not keep an error response as the sessions')
			test.true(
				warnings.some(w => w.includes('invalid credentials')),
				'should warn with the error of the response'
			)
			counter.restore()

			counter = mockFetch(() => ({ body: { status: 'ok' } })) // not a list
			await user.setServerCachedSessions()
			test.equal(user.serverCachedSessions, undefined, 'should not keep a response without a list of ids')
			counter.restore()

			// a list that is empty is kept, and is not looked up again
			counter = mockFetch(() => ({ body: { status: 'ok', sessionIds: [] } }))
			await user.setServerCachedSessions()
			test.deepEqual(user.serverCachedSessions, [], 'should keep a list of ids that is empty')
			test.equal(counter.requests, 1, 'should send one request')
			counter.restore()
			holder.remove()
		}

		// callers that arrive during a lookup share it
		{
			const { user, holder } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
			user.serverCachedSessions = undefined
			const counter = mockFetch(() => ({ body: { status: 'ok', sessionIds: ['a', 'b'] } }))
			const requests = [user.setServerCachedSessions(), user.setServerCachedSessions(), user.setServerCachedSessions()]
			test.equal(requests[0], requests[1], 'should return the lookup that is in progress')
			await Promise.all(requests)
			test.equal(counter.requests, 1, 'should send one request for callers that arrive during the lookup')
			test.deepEqual(user.serverCachedSessions, ['a', 'b'], 'should keep the sessions')
			test.equal(user.serverSessionsRequest, undefined, 'should clear the lookup when it is done')
			counter.restore()
			holder.remove()
		}
	})
	test.end()
})

tape('MassUser main() after the user signs in', async test => {
	await withStoredSessions(undefined, async () => {
		await withoutWarnings(async () => {
			const { user, holder, state, app } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: false })
			user.serverCachedSessions = undefined
			let signedIn = false
			app.vocabApi.hasVerifiedToken = () => signedIn
			const counter = mockFetch(() => ({ body: { status: 'ok', sessionIds: ['server1'] } }))

			user.init(state)
			await user.main()
			await new Promise(resolve => setTimeout(resolve, 50))
			test.equal(counter.requests, 0, 'should not look up the sessions on the server before the user signs in')
			test.equal(getOptionLabels(user).includes('Delete'), false, 'should not show Delete before the user signs in')

			// the user signs in after the launch
			signedIn = true
			await user.main()
			await new Promise(resolve => setTimeout(resolve, 100))
			test.equal(counter.requests, 1, 'should look up the sessions on the server when the user signs in')
			test.deepEqual(user.serverCachedSessions, ['server1'], 'should keep the sessions')
			test.true(getOptionLabels(user).includes('Delete'), 'should add Delete for the sessions on the server')

			// later updates do not look them up again
			await user.main()
			await user.main()
			await new Promise(resolve => setTimeout(resolve, 50))
			test.equal(counter.requests, 1, 'should not look up the sessions again on later updates')
			counter.restore()
			holder.remove()
		})

		// a lookup that fails after the user signs in is not repeated on every update
		await withoutWarnings(async () => {
			const { user, holder, state, app } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: false })
			user.serverCachedSessions = undefined
			let signedIn = false
			app.vocabApi.hasVerifiedToken = () => signedIn
			const counter = mockFetch(() => ({ status: 500, body: { error: 'server error' } }))
			user.init(state)
			signedIn = true
			for (let i = 0; i < 4; i++) await user.main()
			await new Promise(resolve => setTimeout(resolve, 100))
			test.equal(counter.requests, 1, 'should not repeat a failed lookup on every update of the app')
			test.equal(user.serverCachedSessions, undefined, 'should not keep the failed lookup')
			counter.restore()
			holder.remove()
		})
	})
	test.end()
})

tape('MassUser getState() for a session', test => {
	const { user, state, holder } = getUser()
	state.termdbConfig = { massSessionDuration: 30, requiredAuth: [jwtAuth] }
	state.plots = [{ id: 'p1', chartType: 'summary' }]

	const saved = user.getState(state, true)
	test.false('termdbConfig' in saved, 'should not include the dataset config')
	test.ok(state.termdbConfig, 'should not delete termdbConfig from the app state')
	test.equal(saved.vocab.dslabel, 'TermdbTest', 'should keep the rest of the state')
	test.deepEqual(saved.plots, state.plots, 'should keep the plots')
	test.notEqual(saved.plots, state.plots, 'should be a detached copy of the app state')
	test.true(saved.sampleGroupsForm >= 2, 'should mark the state as saved by this version')
	test.equal(user.refuses(saved), false, 'should be a state that is opened')

	// the dataset config is not cloned: a value that cannot be cloned in it would throw
	state.termdbConfig = { notCloneable: () => {} }
	let error
	let saved2: any
	try {
		saved2 = user.getState(state, true)
	} catch (e) {
		error = e
	}
	test.equal(error, undefined, 'should not clone the dataset config only to discard it')
	test.false('termdbConfig' in saved2, 'should still not include the dataset config')
	holder.remove()
	test.end()
})

tape('MassUser getState() for a session saves the parts that make up a session', test => {
	const { user, holder, state } = getUser()
	Object.assign(state, {
		activeCohort: 1,
		termfilter: { filter: { type: 'tvslst', in: true, join: '', lst: [] } },
		plots: [{ id: 'p1', chartType: 'summary' }],
		groups: [{ name: 'g1' }],
		customTerms: [{ name: 'c1' }],
		reuse: { gvQByGene: {} },
		nav: { header_mode: 'with_tabs', activeTab: 2 },
		// not saved
		termdbConfig: { massSessionDuration: 30 },
		search: { isVisible: true },
		autoSave: true,
		somethingElse: { big: 'x'.repeat(100) }
	})
	const saved = user.getState(state, true)
	test.deepEqual(
		Object.keys(saved).sort(),
		['activeCohort', 'customTerms', 'groups', 'nav', 'plots', 'reuse', 'sampleGroupsForm', 'termfilter', 'vocab'],
		'should save the parts of the state that make up a session, marked as saved by this version'
	)
	test.deepEqual(saved.vocab, state.vocab, 'should save the vocab, to open the session in the right dataset')
	test.equal(saved.activeCohort, 1, 'should save the cohort')
	test.deepEqual(saved.termfilter, state.termfilter, 'should save the filter')
	test.deepEqual(saved.plots, state.plots, 'should save the plots')
	test.deepEqual(saved.groups, state.groups, 'should save the groups')
	test.deepEqual(saved.customTerms, state.customTerms, 'should save the custom terms')
	test.deepEqual(saved.reuse, state.reuse, 'should save the settings that are reused')
	test.deepEqual(saved.nav, state.nav, 'should save the nav')
	for (const key of ['termdbConfig', 'search', 'autoSave', 'somethingElse']) {
		test.false(key in saved, `should not save ${key}`)
	}
	test.notEqual(saved.plots, state.plots, 'should be a copy')
	test.notEqual(saved.plots[0], state.plots[0], 'should be a deep copy')
	holder.remove()
	test.end()
})

tape('MassUser getState() for a session does not change the app state', test => {
	const { user, holder, state } = getUser()
	const termdbConfig = { requiredAuth: [jwtAuth], massSessionDuration: 30, queries: { a: 1 } }
	state.termdbConfig = termdbConfig
	state.plots = [{ id: 'p1', chartType: 'summary' }]
	const deepFreeze = (o: any) => {
		if (o && typeof o == 'object' && !Object.isFrozen(o)) {
			Object.freeze(o)
			Object.values(o).forEach(deepFreeze)
		}
		return o
	}
	deepFreeze(state) // as the state of the app is
	const before = JSON.stringify(state)
	let error
	let saved: any
	try {
		saved = user.getState(state, true)
		user.getState(state, true)
	} catch (e) {
		error = e
	}
	test.equal(error, undefined, 'should save a state that is deeply frozen')
	test.equal(state.termdbConfig, termdbConfig, 'should keep the same termdbConfig in the app state')
	test.deepEqual(
		Object.keys(state.termdbConfig),
		['requiredAuth', 'massSessionDuration', 'queries'],
		'should not change it'
	)
	test.equal(JSON.stringify(state), before, 'should not change anything in the app state')
	test.false('termdbConfig' in saved, 'should leave the dataset config out of the saved copy only')
	test.deepEqual(saved.plots, state.plots, 'should keep the other parts in the saved copy')
	holder.remove()
	test.end()
})

tape('MassUser refuses()', test => {
	const { user, calls, holder } = getUser()
	test.equal(user.refuses({ plots: [] }), false, 'should not refuse a state without sample lists')
	test.equal(calls.errors.length, 0, 'should not print an error for a state that is opened')

	const listsSamples = { groups: [{ name: 'a', in: true, values: [{ sampleId: 1 }] }] }
	test.equal(user.refuses(listsSamples), true, 'should refuse an unmarked state that lists samples')
	test.equal(calls.errors.length, 1, 'should print the reason')
	test.true(String(calls.errors[0]).includes('earlier version'), 'should print the reason from the refusal')

	test.equal(
		user.refuses({ ...listsSamples, sampleGroupsForm: 2 }),
		false,
		'should not refuse a marked state that lists samples'
	)
	holder.remove()
	test.end()
})

tape('MassUser destroy() cancels pending cleanup', test => {
	const { user, holder } = getUser()
	user.confirmAction('Saved')
	test.notEqual(user.confirmationTimer, undefined, 'should schedule a delayed cleanup')
	user.destroy()
	test.equal(user.confirmationTimer, undefined, 'should cancel the delayed cleanup on destroy')
	holder.remove()
	test.end()
})
