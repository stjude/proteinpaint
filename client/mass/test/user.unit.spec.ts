import tape from 'tape'
import { select } from 'd3-selection'
import { MassUser, datasetRequiresAuth, getDeletionBatches, getAuthStatus } from '../user.ts'

/**
 * Tests
 *  - datasetRequiresAuth()
 *  - getDeletionBatches()
 *  - getAuthStatus()
 *  - MassUser constructor
 *  - MassUser setRequiredAuth()
 *  - MassUser renderAuthInfo()
 *  - MassUser renderAuthInfo() role info
 *  - MassUser renderSessionOptions()
 *  - MassUser init() with sessions saved in the browser
 *  - MassUser getSavableState()
 *  - MassUser refuses()
 *  - MassUser open()
 *  - MassUser save()
 *  - MassUser delete()
 */

/**************
 helpers
***************/

const storageKey = 'savedMassSessions'

const jwtAuth = { route: 'termdb', type: 'jwt', headerKey: 'x-ds-access-token' }
const basicAuth = { route: 'termdb', type: 'basic', headerKey: 'x-ds-access-token' }

/** Mock the app and vocabApi that MassUser uses. Does not make any server requests. */
function getMockApp(opts: { termdbConfig?: any; verified?: boolean; tokenMessage?: string } = {}) {
	const calls = { errors: [] as any[], dispatched: [] as any[] }
	const state: any = {
		vocab: { dslabel: 'TermdbTest', genome: 'hg38-test' },
		termdbConfig: opts.termdbConfig || {},
		plots: [],
		nav: { activeTab: 3 }
	}
	const app: any = {
		getState: () => state,
		dispatch: (action: any) => calls.dispatched.push(action),
		printError: (e: any) => calls.errors.push(e),
		vocabApi: {
			hasVerifiedToken: () => !!opts.verified,
			mayGetAuthHeaders: async () => ({}),
			tokenVerificationMessage: opts.tokenMessage
		}
	}
	return { app, state, calls }
}

/** Returns a MassUser rendered in a detached holder. serverCachedSessions is set so that no server request is made. */
function getUser(
	opts: {
		termdbConfig?: any
		verified?: boolean
		tokenMessage?: string
		sessionDaysLeft?: number | null
		sessionId?: string | null
		savedSessions?: any
		serverCachedSessions?: string[]
	} = {}
) {
	const { app, state, calls } = getMockApp(opts)
	const holder = select('body').append('div').style('position', 'absolute').style('left', '-9999px')
	const user = new MassUser({
		app,
		subheader: holder,
		massSessionDuration: 30,
		sessionDaysLeft: opts.sessionDaysLeft ?? null,
		sessionId: opts.sessionId ?? null
	} as any)
	user.dslabel = state.vocab.dslabel
	user.savedSessions = opts.savedSessions || {}
	user.serverCachedSessions = opts.serverCachedSessions || []
	user.state = { termdbConfig: state.termdbConfig, nav: state.nav }
	user.setRequiredAuth(state.termdbConfig)
	return { user, holder, app, state, calls }
}

/** The labels of the buttons that select a session option, in rendered order */
function getOptionLabels(holder: any): string[] {
	return holder
		.selectAll('[data-testid^="sjpp-session-btn-"]')
		.nodes()
		.map((n: HTMLElement) => n.textContent)
}

function getOptionBtn(holder: any, label: string): HTMLElement {
	return holder.select(`[data-testid="sjpp-session-btn-${label.toLowerCase().replace(/\s/g, '-')}"]`).node()
}

/** Runs fn with localStorage[savedMassSessions] set to value, then restores the previous value */
async function withStoredSessions(value: any, fn: () => any) {
	const prev = localStorage.getItem(storageKey)
	if (value === undefined) localStorage.removeItem(storageKey)
	else localStorage.setItem(storageKey, JSON.stringify(value))
	try {
		return await fn()
	} finally {
		if (prev === null) localStorage.removeItem(storageKey)
		else localStorage.setItem(storageKey, prev)
	}
}

/**************
 test sections
***************/

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
	test.equal(getAuthStatus(false, 'user'), 'Requires sign-in', 'should not use the role when not signed in')
	test.equal(getAuthStatus(true), 'Signed in', 'should read Signed in without a role')
	test.equal(getAuthStatus(true, ''), 'Signed in', 'should read Signed in for an empty role')
	test.equal(getAuthStatus(true, 'user'), 'User signed in', 'should capitalize the role')
	test.equal(getAuthStatus(true, 'Admin'), 'Admin signed in', 'should keep a capitalized role')
	test.equal(getAuthStatus(true, 'public'), 'Public access', 'should read Public access for the public role')
	test.equal(getAuthStatus(true, 'Public'), 'Public access', 'should ignore the case of the public role')
	test.equal(getAuthStatus(true, 7 as any), 'Signed in', 'should ignore a role that is not a string')
	test.end()
})

tape('MassUser constructor', test => {
	const { user, holder } = getUser()
	test.equal(user.type, 'user', 'should set the component type')
	test.equal(MassUser.type, 'user', 'should have static type=user')
	test.equal(user.route, 'termdb', 'should check the termdb route')
	test.equal(holder.select('[data-testid="sjpp-user-auth"]').size(), 1, 'should create the auth div')
	test.equal(holder.select('[data-testid="sjpp-user-session"]').size(), 1, 'should create the session div')
	test.equal(
		holder.select('[data-testid="sjpp-user-session"] [data-testid="sjpp-user-session-options"]').size(),
		1,
		'should create the options div inside the session div'
	)
	test.equal(
		holder.select('[data-testid="sjpp-user-session"] [data-testid="sjpp-user-session-content"]').size(),
		1,
		'should create the content div inside the session div'
	)
	test.deepEqual(
		user.sessionOptions.map(o => o.label),
		['Open', 'Save', 'Share'],
		'should define the Open, Save, and Share options'
	)
	holder.remove()
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
		test.equal(holder.select('[data-testid="sjpp-user-auth"]').style('display'), 'none', 'should hide auth info')
		test.equal(holder.select('[data-testid="sjpp-user-auth-status"]').size(), 0, 'should not render a status')
		holder.remove()
	}

	// requires auth, not signed in
	{
		const { user, holder } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: false })
		user.renderAuthInfo()
		test.equal(holder.select('[data-testid="sjpp-user-auth"]').style('display'), 'block', 'should show auth info')
		test.equal(
			holder.select('[data-testid="sjpp-user-auth-status"]').text(),
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
			holder.select('[data-testid="sjpp-user-auth"]').text().includes('token expired'),
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
		test.equal(holder.select('[data-testid="sjpp-user-auth-status"]').text(), 'Signed in', 'should show signed in')
		test.false(
			holder.select('[data-testid="sjpp-user-auth"]').text().includes('stale message'),
			'should not show a sign-in failure reason when signed in'
		)
		holder.remove()
	}

	// re-rendering replaces, and does not append to, the previous content
	{
		const { user, holder } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		user.renderAuthInfo()
		user.renderAuthInfo()
		test.equal(holder.selectAll('[data-testid="sjpp-user-auth-status"]').size(), 1, 'should render the status once')
		holder.remove()
	}
	test.end()
})

tape('MassUser renderAuthInfo() role info', test => {
	const infoTestId = '[data-testid="sjpp-user-auth-info"]'

	// the status names the role, and the text is under it
	for (const [role, status] of [
		['user', 'User signed in'],
		['public', 'Public access']
	]) {
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		state.termdbConfig.clientAuthResult = { userTab: { role, intro: `intro for ${role}` } }
		user.renderAuthInfo()
		const children = Array.from(
			(holder.select('[data-testid="sjpp-user-auth"]').node() as HTMLElement).children
		) as HTMLElement[]
		test.equal(
			children[0].getAttribute('data-testid'),
			'sjpp-user-auth-status',
			`should show the status first, ${role}`
		)
		test.equal(children[0].textContent, status, `should show '${status}'`)
		test.equal(children[1].getAttribute('data-testid'), 'sjpp-user-auth-info', `should show the text under it, ${role}`)
		test.equal(children[1].textContent, `intro for ${role}`, `should show the text of the ${role} role`)
		holder.remove()
	}

	// text without a role
	{
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		state.termdbConfig.clientAuthResult = { userTab: { intro: 'intro' } }
		user.renderAuthInfo()
		test.equal(holder.select('[data-testid="sjpp-user-auth-status"]').text(), 'Signed in', 'should read Signed in')
		test.equal(holder.select(infoTestId).text(), 'intro', 'should still show the text')
		holder.remove()
	}

	// role without text, and not signed in
	{
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		state.termdbConfig.clientAuthResult = { userTab: { role: 'user' } }
		user.renderAuthInfo()
		test.equal(holder.select('[data-testid="sjpp-user-auth-status"]').text(), 'User signed in', 'should show the role')
		test.equal(holder.select(infoTestId).size(), 0, 'should not show text when there is none')
		holder.remove()
	}
	{
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: false })
		state.termdbConfig.clientAuthResult = { userTab: { role: 'user', intro: 'intro' } }
		user.renderAuthInfo()
		test.equal(
			holder.select('[data-testid="sjpp-user-auth-status"]').text(),
			'Requires sign-in',
			'should not show the role when not signed in'
		)
		holder.remove()
	}

	// text is not interpreted as html
	{
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		state.termdbConfig.clientAuthResult = { userTab: { intro: '<b>bold</b>' } }
		user.renderAuthInfo()
		test.equal(holder.select(infoTestId).text(), '<b>bold</b>', 'should show the text as it is')
		test.equal(holder.select(`${infoTestId} b`).size(), 0, 'should not render html from the text')
		holder.remove()
	}

	// no info
	for (const clientAuthResult of [undefined, {}, { userTab: {} }, { userTab: { intro: '' } }]) {
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		state.termdbConfig.clientAuthResult = clientAuthResult
		user.renderAuthInfo()
		test.equal(
			holder.select(infoTestId).size(),
			0,
			`should not show info for clientAuthResult=${JSON.stringify(clientAuthResult)}`
		)
		test.equal(holder.select('[data-testid="sjpp-user-auth-status"]').size(), 1, 'should still show the status')
		holder.remove()
	}

	// replaced on re-render, for a different role
	{
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		state.termdbConfig.clientAuthResult = { userTab: { intro: 'public' } }
		user.renderAuthInfo()
		state.termdbConfig.clientAuthResult = { userTab: { intro: 'user' } }
		user.renderAuthInfo()
		test.equal(holder.selectAll(infoTestId).size(), 1, 'should render the info once')
		test.equal(holder.select(infoTestId).text(), 'user', 'should show the latest info')
		holder.remove()
	}

	// a public dataset has no auth info, even if the payload has info
	{
		const { user, holder, state } = getUser()
		state.termdbConfig.clientAuthResult = { userTab: { intro: 'x' } }
		user.renderAuthInfo()
		test.equal(holder.select(infoTestId).size(), 0, 'should not show info when authorization is not required')
		holder.remove()
	}
	test.end()
})

tape('MassUser renderSessionOptions()', test => {
	{
		const { user, holder } = getUser()
		user.renderSessionOptions()
		test.deepEqual(getOptionLabels(holder), ['Open', 'Save', 'Share'], 'should show Open, Save, and Share only')
		const btn = getOptionBtn(holder, 'Save')
		test.equal(btn.getAttribute('title'), 'Save the current view', 'should set the button title')
		test.equal(btn.getAttribute('aria-label'), 'Save the current view', 'should set the button aria-label')
		test.equal(btn.style.borderRadius, '20px', 'should use the chart button style')
		holder.remove()
	}

	{
		const { user, holder } = getUser({ savedSessions: { a: {} } })
		user.renderSessionOptions()
		test.deepEqual(
			getOptionLabels(holder),
			['Open', 'Save', 'Share', 'Delete'],
			'should add Delete when a session is saved in the browser'
		)
		holder.remove()
	}

	{
		const { user, holder } = getUser({ serverCachedSessions: ['s1'] })
		user.renderSessionOptions()
		test.true(getOptionLabels(holder).includes('Delete'), 'should add Delete when a session is saved on the server')
		holder.remove()
	}

	{
		const { user, holder } = getUser({ sessionDaysLeft: 30, sessionId: 'abc' })
		user.renderSessionOptions()
		test.true(
			getOptionLabels(holder).includes('Export Session'),
			'should add Export Session for a session opened from a mass-session-id url'
		)
		holder.remove()
	}

	{
		const { user, holder } = getUser({ sessionDaysLeft: 30, sessionId: null })
		user.renderSessionOptions()
		test.false(getOptionLabels(holder).includes('Export Session'), 'should not add Export Session without a session id')
		holder.remove()
	}

	{
		const { user, holder } = getUser({ sessionDaysLeft: null, sessionId: 'abc' })
		user.renderSessionOptions()
		test.false(getOptionLabels(holder).includes('Export Session'), 'should not add Export Session without days left')
		holder.remove()
	}

	{
		const { user, holder } = getUser()
		user.renderSessionOptions()
		user.savedSessions = { a: {} }
		user.renderSessionOptions()
		test.equal(
			holder.selectAll('[data-testid="sjpp-session-btn-open"]').size(),
			1,
			'should replace, and not append to, the buttons on re-render'
		)
		test.true(getOptionLabels(holder).includes('Delete'), 'should show Delete after a session is added')
		user.savedSessions = {}
		user.renderSessionOptions()
		test.false(getOptionLabels(holder).includes('Delete'), 'should hide Delete after all sessions are removed')
		holder.remove()
	}
	test.end()
})

tape('MassUser init() with sessions saved in the browser', async test => {
	await withStoredSessions({ saved1: { plots: [] }, saved2: { plots: [] } }, async () => {
		const { app, state } = getMockApp()
		const holder = select('body').append('div')
		const user = new MassUser({ app, subheader: holder } as any)
		await user.init(state)
		test.equal(user.dslabel, 'TermdbTest', 'should set the dslabel from the state')
		test.deepEqual(Object.keys(user.savedSessions), ['saved1', 'saved2'], 'should read the saved sessions')
		test.deepEqual(user.serverCachedSessions, [], 'should not have server sessions for a public dataset')
		test.true(getOptionLabels(holder).includes('Delete'), 'should show Delete for the saved sessions')
		holder.remove()
	})

	await withStoredSessions(undefined, async () => {
		const { app, state } = getMockApp()
		const holder = select('body').append('div')
		const user = new MassUser({ app, subheader: holder } as any)
		await user.init(state)
		test.deepEqual(user.savedSessions, {}, 'should have no saved sessions when there is nothing in localStorage')
		test.deepEqual(getOptionLabels(holder), ['Open', 'Save', 'Share'], 'should not show Delete')
		holder.remove()
	})
	test.end()
})

tape('MassUser getSavableState()', test => {
	const { user, state, holder } = getUser()
	state.termdbConfig = { massSessionDuration: 30, requiredAuth: [jwtAuth] }
	state.plots = [{ id: 'p1', chartType: 'summary' }]

	const saved = user.getSavableState()
	test.false('termdbConfig' in saved, 'should not include the dataset config')
	test.ok(state.termdbConfig, 'should not delete termdbConfig from the app state')
	test.equal(saved.vocab.dslabel, 'TermdbTest', 'should keep the rest of the state')
	test.deepEqual(saved.plots, state.plots, 'should keep the plots')
	test.notEqual(saved.plots, state.plots, 'should be a detached copy of the app state')
	test.true(saved.sampleGroupsForm >= 2, 'should mark the state as saved by this version')
	test.equal(user.refuses(saved), false, 'should be a state that is opened')
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

tape('MassUser clearContent() and confirmAction()', test => {
	const { user, holder } = getUser()
	const content = holder.select('[data-testid="sjpp-user-session-content"]')
	user.confirmAction(`Cached 'mysession' in browser`)
	test.equal(content.text(), `Cached 'mysession' in browser`, 'should show the confirmation message')
	test.equal(content.select('div').selectAll('*').size(), 0, 'should keep the message as text')
	user.clearContent()
	test.equal(user.confirmationTimer, undefined, 'should reset the pending confirmation timer')
	test.equal(content.selectAll('*').size(), 0, 'should clear the content')
	test.equal(content.style('opacity'), '1', 'should reset the opacity that the confirmation fades')
	holder.remove()
	test.end()
})

tape('MassUser destroy() cancels pending cleanup', async test => {
	test.timeoutAfter(6000)
	const { user, holder } = getUser()
	user.confirmAction('Saved')
	user.destroy()
	let cleanupCalls = 0
	user.clearContent = () => {
		cleanupCalls++
	}
	await new Promise(resolve => setTimeout(resolve, 4100))
	test.equal(cleanupCalls, 0, 'should not run delayed cleanup after destruction')
	holder.remove()
	test.end()
})

tape('Literal display values', async test => {
	const name = 'example <b>one</b> &amp; two'
	const { user, holder } = getUser({ savedSessions: { [name]: {} }, serverCachedSessions: [name] })
	const { tbody } = await user.listSessions()
	const names = tbody
		.selectAll('tr')
		.nodes()
		.map((row: any) => row.lastChild.textContent)
	test.deepEqual(names, [name, name], 'should display both stored values verbatim')
	test.equal(tbody.selectAll('b').size(), 0, 'should keep cell contents as text')

	user.clearContent()
	await user.save()
	const content = user.dom.contentDiv
	content.select('input[type="text"]').property('value', 'example').dispatch('input')
	const option = content.select('[data-testid="sjpp-save-session-option"]')
	test.equal(option.text(), name, 'should display the suggested value verbatim')
	test.equal(option.selectAll('*').size(), 0, 'should keep the suggested value as text')
	option.dispatch('click')
	test.equal(content.select('input[type="text"]').property('value'), name, 'should select the original value')
	holder.remove()
	test.end()
})

tape('MassUser open()', async test => {
	const { user, holder } = getUser({ savedSessions: { local1: { plots: [] } }, serverCachedSessions: ['server1'] })
	user.renderSessionOptions()
	getOptionBtn(holder, 'Open').click()
	// the click handler is async, wait for the table to render
	await new Promise(resolve => setTimeout(resolve, 50))

	const content = holder.select('[data-testid="sjpp-user-session-content"]')
	test.equal(content.selectAll('table').size(), 1, 'should list the sessions in a table')
	test.equal(content.select('thead th').text(), 'Open from', 'should label the first column')
	const rows = content.selectAll('tbody tr').nodes() as HTMLElement[]
	const rowText = rows.map(r => r.textContent)
	test.true(
		rowText.some(t => t?.includes('Local file')),
		'should offer to open a local file'
	)
	test.true(
		rowText.some(t => t?.includes('browser') && t?.includes('local1')),
		'should list a browser session'
	)
	test.true(
		rowText.some(t => t?.includes('server') && t?.includes('server1')),
		'should list a server session'
	)
	test.equal(content.selectAll('input[type="file"]').size(), 1, 'should have a file input')

	// clicking another option replaces the content
	getOptionBtn(holder, 'Save').click()
	await new Promise(resolve => setTimeout(resolve, 50))
	test.equal(content.selectAll('table').size(), 0, 'should remove the session list when another option is clicked')
	holder.remove()
	test.end()
})

tape('MassUser open() a session in the browser', async test => {
	const state = { plots: [], groups: [], customTerms: [], sampleGroupsForm: 2 }
	const { user, holder, calls } = getUser({ savedSessions: { local1: state } })
	user.renderSessionOptions()
	getOptionBtn(holder, 'Open').click()
	await new Promise(resolve => setTimeout(resolve, 50))

	const row = holder
		.selectAll('[data-testid="sjpp-user-session-content"] tbody tr')
		.filter((_: any, i: number, nodes: any) => nodes[i].textContent.includes('local1'))
		.node() as HTMLElement
	row.click()
	await new Promise(resolve => setTimeout(resolve, 50))

	test.equal(calls.dispatched.length, 1, 'should dispatch once')
	test.equal(calls.dispatched[0].type, 'app_refresh', 'should refresh the app with the session state')
	test.deepEqual(calls.dispatched[0].state, state, 'should dispatch the saved state')
	test.notEqual(calls.dispatched[0].state, state, 'should dispatch a copy, so the saved session is not modified')
	test.equal(user.sessionName, 'local1', 'should remember the session name')
	test.equal(
		holder.selectAll('[data-testid="sjpp-user-session-content"] table').size(),
		0,
		'should clear the session list after opening'
	)
	holder.remove()
	test.end()
})

tape('MassUser open() a session that is refused', async test => {
	const unmarked = { groups: [{ name: 'a', in: true, values: [{ sampleId: 1 }] }] }
	const { user, holder, calls } = getUser({ savedSessions: { old1: unmarked } })
	user.renderSessionOptions()
	getOptionBtn(holder, 'Open').click()
	await new Promise(resolve => setTimeout(resolve, 50))

	const row = holder
		.selectAll('[data-testid="sjpp-user-session-content"] tbody tr')
		.filter((_: any, i: number, nodes: any) => nodes[i].textContent.includes('old1'))
		.node() as HTMLElement
	row.click()
	await new Promise(resolve => setTimeout(resolve, 50))

	test.equal(calls.dispatched.length, 0, 'should not open a session from an earlier version')
	test.equal(calls.errors.length, 1, 'should print the reason')
	holder.remove()
	test.end()
})

tape('MassUser save() for a public dataset', async test => {
	await withStoredSessions(undefined, async () => {
		const { user, holder, state } = getUser({ savedSessions: { existing: {} } })
		state.plots = [{ id: 'p1', chartType: 'summary' }]
		user.renderSessionOptions()
		getOptionBtn(holder, 'Save').click()
		await new Promise(resolve => setTimeout(resolve, 50))

		const content = holder.select('[data-testid="sjpp-user-session-content"]')
		const btnLabels = content
			.selectAll('button')
			.nodes()
			.map((n: any) => n.textContent)
		test.deepEqual(btnLabels, ['Browser', 'File'], 'should only offer to save to the browser and a file')
		const input = content.select('input[type="text"]')
		test.equal(input.attr('placeholder'), 'unnamed-session', 'should have a default session name')

		// typing a name shows matching saved names
		input.property('value', 'exi').dispatch('input')
		const options = content.selectAll('[data-testid="sjpp-save-session-option"]').nodes() as HTMLElement[]
		test.deepEqual(
			options.map(o => o.textContent),
			['existing'],
			'should suggest saved sessions that match the typed name'
		)

		// save to the browser
		input.property('value', 'mysession')
		const browserBtn = content.selectAll('button').nodes()[0] as HTMLElement
		browserBtn.click()
		test.deepEqual(Object.keys(user.savedSessions).sort(), ['existing', 'mysession'], 'should add the session')
		test.equal(user.sessionName, 'mysession', 'should remember the session name')
		test.deepEqual(user.savedSessions.mysession.plots, state.plots, 'should save the plots')
		const stored = JSON.parse(localStorage.getItem(storageKey) || '{}')
		test.deepEqual(Object.keys(stored).sort(), ['existing', 'mysession'], 'should save to localStorage')
		test.false('termdbConfig' in stored.mysession, 'should not store the dataset config')
		test.true(content.html().includes('mysession'), 'should confirm the save')
		test.true(getOptionLabels(holder).includes('Delete'), 'should refresh the options')
		holder.remove()
	})
	test.end()
})

tape('MassUser save() for a dataset that requires a jwt', async test => {
	// not signed in
	{
		const { user, holder } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: false })
		user.renderSessionOptions()
		getOptionBtn(holder, 'Save').click()
		await new Promise(resolve => setTimeout(resolve, 50))
		const btns = holder.selectAll('[data-testid="sjpp-user-session-content"] button').nodes() as HTMLButtonElement[]
		test.deepEqual(
			btns.map(b => b.textContent),
			['Browser', 'File', 'Server'],
			'should offer to save on the server'
		)
		const server = btns[2]
		test.true(server.disabled, 'should disable saving on the server when not signed in')
		test.true(server.title.startsWith('Requires sign-in.'), 'should explain why it is disabled')
		holder.remove()
	}

	// signed in
	{
		const { user, holder } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		user.renderSessionOptions()
		getOptionBtn(holder, 'Save').click()
		await new Promise(resolve => setTimeout(resolve, 50))
		const btns = holder.selectAll('[data-testid="sjpp-user-session-content"] button').nodes() as HTMLButtonElement[]
		test.false(btns[2].disabled, 'should enable saving on the server when signed in')
		test.false(btns[2].title.startsWith('Requires sign-in'), 'should not say that sign-in is required')
		holder.remove()
	}

	// basic (password) credentials do not support server sessions
	{
		const { user, holder } = getUser({ termdbConfig: { requiredAuth: [basicAuth] }, verified: true })
		user.renderSessionOptions()
		getOptionBtn(holder, 'Save').click()
		await new Promise(resolve => setTimeout(resolve, 50))
		const labels = holder
			.selectAll('[data-testid="sjpp-user-session-content"] button')
			.nodes()
			.map((n: any) => n.textContent)
		test.deepEqual(labels, ['Browser', 'File'], 'should not offer to save on the server for a basic credential')
		holder.remove()
	}
	test.end()
})

tape('MassUser delete()', async test => {
	await withStoredSessions({ a: {}, b: {}, c: {} }, async () => {
		const { user, holder } = getUser({ savedSessions: { a: {}, b: {}, c: {} } })
		user.renderSessionOptions()
		getOptionBtn(holder, 'Delete').click()
		await new Promise(resolve => setTimeout(resolve, 50))

		const content = holder.select('[data-testid="sjpp-user-session-content"]')
		const submit = content.selectAll('button').filter(function (this: any) {
			return this.textContent == 'Delete selected sessions'
		})
		test.equal(submit.size(), 1, 'should show the delete button')
		test.true((submit.node() as HTMLButtonElement).disabled, 'should disable it until a session is selected')

		const checkboxes = content.selectAll('input[type="checkbox"]').nodes() as HTMLInputElement[]
		test.deepEqual(
			checkboxes.map(c => c.value),
			['a', 'b', 'c'],
			'should have a checkbox for each session'
		)

		// select rows by clicking them, as a user would
		const rows = content.selectAll('tbody tr').nodes() as HTMLElement[]
		rows[0].click()
		rows[2].click()
		test.true(checkboxes[0].checked && checkboxes[2].checked, 'should check the clicked rows')
		test.false(checkboxes[1].checked, 'should not check the other row')
		test.false((submit.node() as HTMLButtonElement).disabled, 'should enable the delete button')

		rows[0].click()
		rows[2].click()
		test.true((submit.node() as HTMLButtonElement).disabled, 'should disable the delete button when none are selected')

		rows[0].click()
		rows[2].click()
		;(submit.node() as HTMLButtonElement).click()
		await new Promise(resolve => setTimeout(resolve, 50))

		test.deepEqual(Object.keys(user.savedSessions), ['b'], 'should delete the selected sessions from memory')
		test.deepEqual(
			Object.keys(JSON.parse(localStorage.getItem(storageKey) || '{}')),
			['b'],
			'should delete the selected sessions from localStorage'
		)
		test.equal(content.selectAll('table').size(), 0, 'should clear the list after deleting')
		test.true(getOptionLabels(holder).includes('Delete'), 'should keep Delete while a session remains')
		holder.remove()
	})
	test.end()
})
