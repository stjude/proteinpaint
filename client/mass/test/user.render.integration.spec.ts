import tape from 'tape'
import { select } from 'd3-selection'
import { MassUser } from '../user.ts'
import {
	storageKey,
	jwtAuth,
	basicAuth,
	getMockApp,
	getUser,
	getOptionLabels,
	getOptionBtn,
	withStoredSessions,
	mockSessionIds,
	withoutWarnings,
	mockFetch,
	destroyLikeRx,
	stubDownloads,
	stubWindowOpen
} from './user.helpers.ts'

/**
 * Renders MassUser in a detached holder with a mocked app, and clicks its buttons. This is not a unit test, since
 * it needs the rendered dom.
 */
/**
 * Tests
 *  - MassUser constructor
 *  - MassUser renderAuthInfo()
 *  - MassUser renderAuthInfo() userTab
 *  - MassUser init() with sessions saved in the browser
 *  - MassUser init() with an optional lookup of the sessions on the server
 *  - MassUser Delete is shown only when there are sessions to delete
 *  - MassUser destroy()
 *  - MassUser getState()
 *  - MassUser File save
 *  - MassUser ids in urls
 *  - MassUser Server save
 *  - MassUser clearContent() and confirmAction()
 *  - Literal display values
 *  - MassUser open()
 *  - MassUser open() a session in the browser
 *  - MassUser open() a session that is refused
 *  - MassUser save() for a public dataset
 *  - MassUser save() for a dataset that requires a jwt
 *  - MassUser delete()
 */

tape('\n', test => {
	test.comment('-***- mass/user render -***-')
	test.end()
})

tape('MassUser constructor', test => {
	const { user, holder } = getUser()
	test.equal(user.type, 'user', 'should set the component type')
	test.equal(MassUser.type, 'user', 'should have static type=user')
	test.equal(user.route, 'termdb', 'should check the termdb route')
	test.equal(holder.select('[data-testid="sjpp-massnav-user-auth"]').size(), 1, 'should create the auth div')
	test.equal(holder.select('[data-testid="sjpp-massnav-user-session"]').size(), 1, 'should create the session div')
	const sessionDiv = holder.select('[data-testid="sjpp-massnav-user-session"]').node() as HTMLElement
	test.equal(
		(sessionDiv.firstElementChild as HTMLElement).getAttribute('data-testid'),
		'sjpp-massnav-user-session-label',
		'should show the label before the options'
	)
	test.equal(
		holder.select('[data-testid="sjpp-massnav-user-session-label"]').text(),
		'SESSION',
		'should label the options'
	)
	test.equal(
		holder.select('[data-testid="sjpp-massnav-user-session"] [data-testid="sjpp-massnav-user-session-options"]').size(),
		1,
		'should create the options div inside the session div'
	)
	test.equal(
		holder.select('[data-testid="sjpp-massnav-user-session"] [data-testid="sjpp-massnav-user-session-content"]').size(),
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

const userTabs = (state: any) => (state.termdbConfig.massNav ||= { tabs: {} }).tabs

tape('MassUser renderAuthInfo() userTab', test => {
	const infoTestId = '[data-testid="sjpp-massnav-user-auth-info"]'

	// text is not interpreted as html
	{
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		userTabs(state).user = { msgs: [{ txt: '<b>bold</b>' }] }
		user.renderAuthInfo()
		test.equal(holder.select(infoTestId).text(), '<b>bold</b>', 'should show the text as it is')
		test.equal(holder.select(`${infoTestId} b`).size(), 0, 'should not render html from the text')
		holder.remove()
	}

	// no message
	for (const userTab of [undefined, {}, { msgs: [] }, { isPublic: true }]) {
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		userTabs(state).user = userTab
		user.renderAuthInfo()
		test.equal(holder.select(infoTestId).size(), 0, `should not show a message for userTab=${JSON.stringify(userTab)}`)
		test.equal(holder.select('[data-testid="sjpp-massnav-user-auth-status"]').size(), 1, 'should still show the status')
		holder.remove()
	}

	// replaced on re-render
	{
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		userTabs(state).user = { msgs: [{ txt: 'first' }] }
		user.renderAuthInfo()
		userTabs(state).user = { msgs: [{ txt: 'second' }] }
		user.renderAuthInfo()
		test.equal(holder.selectAll(infoTestId).size(), 1, 'should render the message once')
		test.equal(holder.select(infoTestId).text(), 'second', 'should show the latest message')
		holder.remove()
	}

	// a public dataset has no auth info, even if there is a message
	{
		const { user, holder, state } = getUser()
		userTabs(state).user = { msgs: [{ txt: 'x' }], isPublic: true }
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
		userTabs(state).user = { msgs: [{ txt: 'msg' }], isPublic }
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
		userTabs(state).user = { status: 'Public Access', isPublic }
		user.renderAuthInfo()
		test.equal(
			holder.select('[data-testid="sjpp-massnav-user-auth-status"]').text(),
			'Public Access',
			`should show the status from the ds for verified=${verified} and isPublic=${isPublic}`
		)
		holder.remove()
	}

	// the list is under the row of the status and message
	{
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		userTabs(state).user = {
			msgs: [{ txt: 'msg' }],
			list: { label: 'Sites', items: ['A (India)', 'B (Nepal)'] }
		}
		user.renderAuthInfo()
		const [row, infoDiv, listDiv] = Array.from(
			(holder.select('[data-testid="sjpp-massnav-user-auth"]').node() as HTMLElement).children
		)
		test.deepEqual(
			Array.from(row.children).map(c => c.getAttribute('data-testid')),
			['sjpp-massnav-user-auth-label', 'sjpp-massnav-user-auth-status'],
			'should show the label and status on the same row'
		)
		test.equal(
			infoDiv?.querySelector('table')?.getAttribute('data-testid'),
			'sjpp-massnav-user-auth-info',
			'should show the messages as a table under the row'
		)
		test.equal(
			listDiv?.getAttribute('data-testid'),
			'sjpp-massnav-user-auth-list',
			'should show the list under the messages'
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

	// an email or link targets exactly its value, and nothing is parsed from the text. each message is a row
	{
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		userTabs(state).user = {
			msgs: [
				{ txt: 'Write to a\'b@c.org or "x@y.org" in a sentence, not linked' },
				{ label: 'Access', txt: 'Public' },
				{ label: 'Questions?', email: "o'connor@example.org" },
				{ label: 'Docs', link: 'https://example.org/a?b=1' },
				{ email: 'x+y@d.e.org' }
			]
		}
		user.renderAuthInfo()
		const rows = holder.selectAll(`${infoTestId} tr`).nodes() as HTMLElement[]
		test.deepEqual(
			rows.map(r => Array.from(r.children).map(c => c.textContent)),
			[
				['Write to a\'b@c.org or "x@y.org" in a sentence, not linked'],
				['Access', 'Public'],
				['Questions?', "o'connor@example.org"],
				['Docs', 'https://example.org/a?b=1'],
				['', 'x+y@d.e.org']
			],
			'should show a row for each message, with the label in the first column'
		)
		test.equal(rows[0].children[0].getAttribute('colspan'), '2', 'should span a message with only text')
		test.deepEqual(
			holder
				.selectAll(`${infoTestId} a`)
				.nodes()
				.map((n: any) => [n.getAttribute('href'), n.textContent]),
			[
				["mailto:o'connor@example.org", "o'connor@example.org"],
				['https://example.org/a?b=1', 'https://example.org/a?b=1'],
				['mailto:x+y@d.e.org', 'x+y@d.e.org']
			],
			'should link the whole address with an apostrophe, and not an address in text'
		)
		holder.remove()
	}

	// the content of the active cohort
	{
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		userTabs(state).user = {
			byCohort: { 0: { status: 'Admin', msgs: [{ txt: 'zero' }] }, 1: { status: 'Public', msgs: [{ txt: 'one' }] } }
		}
		for (const [activeCohort, status, msg] of [
			[0, 'Admin', 'zero'],
			[1, 'Public', 'one']
		] as [number, string, string][]) {
			user.state.activeCohort = activeCohort
			user.renderAuthInfo()
			test.equal(
				holder.select('[data-testid="sjpp-massnav-user-auth-status"]').text(),
				status,
				`status for cohort ${activeCohort}`
			)
			test.equal(holder.select(infoTestId).text(), msg, `message for cohort ${activeCohort}`)
		}
		user.state.activeCohort = -1
		user.renderAuthInfo()
		test.equal(holder.select(infoTestId).size(), 0, 'should show no message without a content for the cohort')
		holder.remove()
	}

	// the text of the status, message, and list is not interpreted as html
	{
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		userTabs(state).user = {
			status: '<b>s</b>',
			msgs: [{ txt: '<b>m</b>' }],
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
	for (const userTab of [undefined, {}, { msgs: [{ txt: 'msg' }] }]) {
		const { user, holder, state } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		userTabs(state).user = userTab
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

tape('MassUser init() with sessions saved in the browser', async test => {
	await withStoredSessions({ saved1: { plots: [] }, saved2: { plots: [] } }, async () => {
		const { app, state } = getMockApp()
		const holder = select('body').append('div')
		const user = new MassUser({ app, subheader: holder } as any)
		await user.init(state)
		test.equal(user.dslabel, 'TermdbTest', 'should set the dslabel from the state')
		test.deepEqual(Object.keys(user.savedSessions), ['saved1', 'saved2'], 'should read the saved sessions')
		test.deepEqual(user.serverCachedSessions, [], 'should not have server sessions for a public dataset')
		test.true(getOptionLabels(user).includes('Delete'), 'should show Delete for the saved sessions')
		holder.remove()
	})

	await withStoredSessions(undefined, async () => {
		const { app, state } = getMockApp()
		const holder = select('body').append('div')
		const user = new MassUser({ app, subheader: holder } as any)
		await user.init(state)
		test.deepEqual(user.savedSessions, {}, 'should have no saved sessions when there is nothing in localStorage')
		test.deepEqual(getOptionLabels(user), ['Open', 'Save', 'Share'], 'should not show Delete')
		holder.remove()
	})
	test.end()
})

tape('MassUser init() with an optional lookup of the sessions on the server', async test => {
	await withStoredSessions({ saved1: {} }, async () => {
		// a failed lookup does not throw, and the options are shown
		await withoutWarnings(async warnings => {
			const { user, holder, state, app } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
			user.serverCachedSessions = undefined
			app.vocabApi.mayGetAuthHeaders = async () => {
				throw new Error('token callback failed')
			}
			let error
			try {
				await user.init(state)
				await new Promise(resolve => setTimeout(resolve, 50))
			} catch (e) {
				error = e
			}
			test.equal(error, undefined, 'should not throw when the lookup of the server sessions fails')
			test.deepEqual(getOptionLabels(user), ['Open', 'Save', 'Share', 'Delete'], 'should show the options')
			test.equal(user.serverCachedSessions, undefined, 'should not cache a failed lookup')
			test.true(
				warnings.some(w => w.includes('token callback failed')),
				'should warn with the reason'
			)
			holder.remove()
		})

		// init() does not wait for the lookup
		{
			const { user, holder, state, app } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
			localStorage.removeItem(storageKey) // init() reads the saved sessions of the browser, the wrapper restores them
			user.serverCachedSessions = undefined
			let release: () => void = () => {}
			app.vocabApi.mayGetAuthHeaders = () => new Promise(resolve => (release = () => resolve({})))
			const restore = mockSessionIds(['server1'])
			await user.init(state) // would never return if it waited for the headers
			test.deepEqual(
				getOptionLabels(user),
				['Open', 'Save', 'Share'],
				'should show the options before the lookup is done'
			)

			// the options are rendered again when the lookup is done
			release()
			await new Promise(resolve => setTimeout(resolve, 100))
			test.deepEqual(user.serverCachedSessions, ['server1'], 'should keep the sessions of the server')
			test.deepEqual(
				getOptionLabels(user),
				['Open', 'Save', 'Share', 'Delete'],
				'should add Delete when the lookup finds sessions'
			)
			restore()
			holder.remove()
		}
	})

	// an earlier failure is tried again when Open is used
	await withoutWarnings(async () => {
		const { user, holder, app } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		user.serverCachedSessions = undefined
		user.savedSessions = {}
		let fail = true
		app.vocabApi.mayGetAuthHeaders = async () => {
			if (fail) throw new Error('offline')
			return {}
		}
		await user.setServerCachedSessions()
		test.equal(user.serverCachedSessions, undefined, 'should leave the sessions undefined after a failure')

		fail = false
		const restore = mockSessionIds(['server1'])
		user.renderSessionOptions()
		getOptionBtn(holder, 'Open').click()
		await new Promise(resolve => setTimeout(resolve, 100))
		const text = holder.select('[data-testid="sjpp-massnav-user-session-content"]').text()
		test.true(text.includes('server1'), 'should list the server session once the lookup works')
		restore()
		holder.remove()
	})

	// the sessions are used when the lookup failed
	await withoutWarnings(async () => {
		const { user, holder, app } = getUser({
			termdbConfig: { requiredAuth: [jwtAuth] },
			verified: true,
			savedSessions: { local1: {} }
		})
		user.serverCachedSessions = undefined
		app.vocabApi.mayGetAuthHeaders = async () => {
			throw new Error('offline')
		}
		user.renderSessionOptions()
		getOptionBtn(holder, 'Open').click()
		await new Promise(resolve => setTimeout(resolve, 50))
		test.true(
			holder.select('[data-testid="sjpp-massnav-user-session-content"]').text().includes('local1'),
			'should still list the sessions of the browser in Open'
		)
		getOptionBtn(holder, 'Save').click()
		await new Promise(resolve => setTimeout(resolve, 50))
		test.equal(
			holder.selectAll('[data-testid="sjpp-massnav-user-session-content"] button').size(),
			3,
			'should still show the Save options'
		)
		holder.remove()
	})
	test.end()
})

tape('MassUser Delete is shown only when there are sessions to delete', async test => {
	await withoutWarnings(async () => {
		// after a lookup, Delete is shown for the sessions of the browser or the server
		for (const [browser, server, expected] of [
			[false, false, false],
			[true, false, true],
			[false, true, true],
			[true, true, true]
		]) {
			const { user, holder } = getUser({
				termdbConfig: { requiredAuth: [jwtAuth] },
				verified: true,
				savedSessions: browser ? { local1: {} } : {}
			})
			user.serverCachedSessions = undefined
			user.renderSessionOptions()
			const counter = mockFetch(() => ({ body: { status: 'ok', sessionIds: server ? ['server1'] : [] } }))
			await user.setServerCachedSessions()
			test.equal(
				getOptionLabels(user).includes('Delete'),
				expected,
				`should ${expected ? 'show' : 'hide'} Delete after the lookup, browser=${browser}, server=${server}`
			)
			counter.restore()
			holder.remove()
		}

		// a lookup that fails does not show Delete, and the sessions of the browser still do
		for (const [browser, expected] of [
			[false, false],
			[true, true]
		]) {
			const { user, holder, app } = getUser({
				termdbConfig: { requiredAuth: [jwtAuth] },
				verified: true,
				savedSessions: browser ? { local1: {} } : {}
			})
			user.serverCachedSessions = undefined
			app.vocabApi.mayGetAuthHeaders = async () => {
				throw new Error('offline')
			}
			user.renderSessionOptions()
			await user.setServerCachedSessions()
			test.equal(
				getOptionLabels(user).includes('Delete'),
				expected,
				`should ${expected ? 'show' : 'hide'} Delete after a failed lookup, browser=${browser}`
			)
			holder.remove()
		}

		// a lookup that is made when Open is clicked also updates the options, not only the lookup at the launch
		{
			const { user, holder } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
			user.serverCachedSessions = undefined
			user.renderSessionOptions()
			test.false(getOptionLabels(user).includes('Delete'), 'should not show Delete before the lookup')
			const counter = mockFetch(() => ({ body: { status: 'ok', sessionIds: ['server1'] } }))
			getOptionBtn(holder, 'Open').click()
			await new Promise(resolve => setTimeout(resolve, 100))
			test.true(getOptionLabels(user).includes('Delete'), 'should show Delete when the lookup of Open finds sessions')
			counter.restore()
			holder.remove()
		}

		// Delete is hidden after the last session is deleted
		{
			const { user, holder } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
			user.serverCachedSessions = ['server1']
			user.renderSessionOptions()
			test.true(getOptionLabels(user).includes('Delete'), 'should show Delete for the session of the server')
			user.serverCachedSessions = []
			user.renderSessionOptions()
			test.false(getOptionLabels(user).includes('Delete'), 'should hide Delete when no session is left')
			holder.remove()
		}
	})
	test.end()
})

tape('MassUser destroy()', async test => {
	const countMenus = () => document.querySelectorAll('.sja_menu_div').length

	// the copytip menu is removed from the document body
	{
		const before = countMenus()
		const { user, holder } = getUser()
		test.equal(countMenus(), before + 1, 'should have a menu in the document body while the component exists')
		destroyLikeRx(user, holder)
		test.equal(countMenus(), before, 'should remove the copytip menu from the document body')
	}

	// a lookup of the server sessions that is done after destroy does not throw
	await withoutWarnings(async () => {
		const { user, holder, state, app } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		user.serverCachedSessions = undefined
		let release: () => void = () => {}
		app.vocabApi.mayGetAuthHeaders = () => new Promise(resolve => (release = () => resolve({})))
		const restore = mockSessionIds(['server1'])
		const rejections: string[] = []
		const onRejection = (e: PromiseRejectionEvent) => rejections.push(String(e.reason))
		window.addEventListener('unhandledrejection', onRejection)

		user.init(state)
		destroyLikeRx(user, holder)
		release()
		await new Promise(resolve => setTimeout(resolve, 150))
		window.removeEventListener('unhandledrejection', onRejection)
		restore()
		test.deepEqual(rejections, [], 'should not have an unhandled rejection from a lookup that is done after destroy')
		test.equal(user.serverCachedSessions?.[0], 'server1', 'should still finish the lookup')
		let error
		try {
			user.renderSessionOptions()
		} catch (e) {
			error = e
		}
		test.equal(error, undefined, 'should not throw when the options are rendered after destroy')
	})

	// the timers are cleared
	{
		const { user, holder } = getUser()
		user.confirmAction('saved')
		test.true(user.confirmationTimer, 'should have a timer that clears the confirmation')
		let copyTipHidden = false
		user.dom.copytip.hide = () => (copyTipHidden = true)
		user.copyTipTimer = setTimeout(() => user.dom?.copytip?.hide(), 20)
		destroyLikeRx(user, holder)
		test.equal(user.confirmationTimer, undefined, 'should clear the timer of the confirmation')
		await new Promise(resolve => setTimeout(resolve, 80))
		test.equal(copyTipHidden, false, 'should clear the timer that hides the copy tip')
	}
	test.end()
})

tape('MassUser getState()', test => {
	const { user, holder } = getUser()
	const big = { terms: Array.from({ length: 1000 }, (_, i) => ({ id: i })), queries: { a: 1 }, massNav: {} }
	const userMassNav = { tabs: { user: { msgs: [{ txt: 'hi' }] } } }
	const appState: any = {
		vocab: { dslabel: 'x' },
		plots: [{ id: 'p1' }],
		nav: { activeTab: 3 },
		activeCohort: 1,
		termdbConfig: { ...big, requiredAuth: [jwtAuth], clientAuthResult: { datasets: ['a'] }, massNav: userMassNav }
	}
	test.deepEqual(
		user.getState(appState),
		{ activeCohort: 1, termdbConfig: { requiredAuth: [jwtAuth], massNav: userMassNav } },
		'should only have the activeCohort, requiredAuth and user tab that the component renders from'
	)
	test.deepEqual(
		user.getState({ vocab: {}, nav: {} }),
		{ activeCohort: undefined, termdbConfig: { requiredAuth: undefined, massNav: { tabs: { user: undefined } } } },
		'should handle a missing termdbConfig'
	)

	// a change to anything else in the app state is not a change to the state of the component
	const a = user.getState(appState)
	const b = user.getState({
		...appState,
		plots: [],
		nav: { activeTab: 0 },
		termdbConfig: { ...appState.termdbConfig, terms: [], queries: {} }
	})
	test.deepEqual(a, b, 'should not change when other parts of the app state change')

	// and what the component renders is rendered from this state
	const { user: user2, holder: holder2 } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
	user2.state = user2.getState({
		termdbConfig: {
			...big,
			requiredAuth: [jwtAuth],
			massNav: { tabs: { user: { msgs: [{ txt: 'hi' }], isPublic: true } } }
		}
	})
	user2.renderAuthInfo()
	test.equal(
		holder2.select('[data-testid="sjpp-massnav-user-auth-status"]').text(),
		'Public access',
		'should render the status'
	)
	test.equal(holder2.select('[data-testid="sjpp-massnav-user-auth-info"]').text(), 'hi', 'should render the message')
	holder.remove()
	holder2.remove()
	test.end()
})

tape('MassUser File save', async test => {
	await withStoredSessions(undefined, async () => {
		const { user, holder, state } = getUser({ savedSessions: { existing: {} } })
		state.plots = [{ id: 'p1', chartType: 'summary' }]
		const stub = stubDownloads()
		user.renderSessionOptions()
		const content = holder.select('[data-testid="sjpp-massnav-user-session-content"]')
		// the options to save are shown again after each save, which shows a confirmation instead
		const clickFile = async (name: string) => {
			getOptionBtn(holder, 'Save').click()
			await new Promise(resolve => setTimeout(resolve, 50))
			content.select('input[type="text"]').property('value', name)
			const buttons = Array.from((content.node() as HTMLElement).querySelectorAll('button'))
			;(buttons.find((b: HTMLButtonElement) => b.textContent == 'File') as HTMLButtonElement).click()
		}

		await clickFile('my-file')
		test.equal(stub.downloads.length, 1, 'should download one file')
		test.equal(stub.downloads[0].filename, 'my-file.txt', 'should name the file with the extension')
		const saved = JSON.parse(stub.downloads[0].text)
		test.deepEqual(saved.plots, state.plots, 'should have the session in the file')
		test.false('termdbConfig' in saved, 'should not have the dataset config in the file')
		test.true(saved.sampleGroupsForm >= 2, 'should have the session marked as saved by this version')

		await clickFile('named.txt')
		test.equal(stub.downloads[1].filename, 'named.txt', 'should not add the extension twice')

		test.deepEqual(Object.keys(user.savedSessions), ['existing'], 'should not keep the session of a file in memory')
		test.equal(localStorage.getItem(storageKey), null, 'should not save the session of a file in the browser storage')
		test.false(
			holder.select('[data-testid="sjpp-massnav-user-session-content"]').text().includes('Cache Location'),
			'should not list the session of a file as a session of the browser'
		)
		stub.restore()
		holder.remove()
	})
	test.end()
})

tape('MassUser ids in urls', async test => {
	const id = 'a&b=c #d%e'
	const encoded = 'a%26b%3Dc%20%23d%25e'

	// opening a session of the browser in a new tab, and a session on the server in a new tab
	for (const loc of ['browser', 'server']) {
		const { user, holder } = getUser({
			termdbConfig: { requiredAuth: [jwtAuth] },
			verified: true,
			savedSessions: loc == 'browser' ? { [id]: { plots: [], sampleGroupsForm: 2 } } : {},
			serverCachedSessions: loc == 'server' ? [id] : []
		})
		user.dslabel = 'ds&x=1'
		user.hostURL = window.location.origin // the session is opened in a new tab of this host, not through the embedder
		const open = stubWindowOpen()
		const counter = mockFetch(() => ({ body: { state: { plots: [], sampleGroupsForm: 2 } } }))
		user.renderSessionOptions()
		getOptionBtn(holder, 'Open').click()
		await new Promise(resolve => setTimeout(resolve, 100))
		const content = holder.select('[data-testid="sjpp-massnav-user-session-content"]')
		// the option to open in a new tab is not shown, the current tab is its default
		content.select('input[value="new"]').property('checked', true)
		const row = content
			.selectAll('tbody tr')
			.filter((_: any, i: number, nodes: any) => nodes[i].textContent.includes(id))
			.node() as HTMLElement
		row.click()
		await new Promise(resolve => setTimeout(resolve, 100))

		test.equal(open.urls.length, 1, `should open one window for a session in the ${loc}`)
		const params = new URL(open.urls[0], window.location.origin).searchParams
		test.equal(params.get('mass-session-id'), id, `should open the session id as it is, ${loc}`)
		test.equal([...params.keys()].length, loc == 'browser' ? 2 : 4, `should not add parameters from the id, ${loc}`)
		if (loc == 'server') {
			test.equal(params.get('dslabel'), 'ds&x=1', 'should encode the dslabel')
			test.equal(params.get('route'), 'termdb', 'should have the route')
		}
		test.true(open.urls[0].includes(`mass-session-id=${encoded}`), `should encode the id in the url, ${loc}`)
		open.restore()
		counter.restore()
		holder.remove()
	}

	// the link to share a session
	{
		const { user, holder } = getUser()
		const counter = mockFetch(() => ({ body: { id } }))
		user.renderSessionOptions()
		getOptionBtn(holder, 'Share').click()
		await new Promise(resolve => setTimeout(resolve, 100))
		const link = holder.select('[data-testid="sjpp-massnav-user-session-content"] a')
		test.true(
			link.attr('href').includes(`mass-session-id=${encoded}&noheader=1`),
			'should encode the id of a shared session'
		)
		test.equal(link.text(), id, 'should show the id as it is')
		counter.restore()
		holder.remove()
	}
	test.end()
})

tape('MassUser Server save', async test => {
	await withStoredSessions(undefined, async () => {
		const { user, holder, app } = getUser({ termdbConfig: { requiredAuth: [jwtAuth] }, verified: true })
		app.getState().plots = [{ id: 'p1' }]
		let calls = 0
		const getState = user.getState.bind(user)
		user.getState = (appState: any, forSession = false) => {
			if (forSession) calls++
			return getState(appState, forSession)
		}
		const counter = mockFetch(() => ({ body: { status: 'ok', id: 'on-server' } }))
		user.renderSessionOptions()
		getOptionBtn(holder, 'Save').click()
		await new Promise(resolve => setTimeout(resolve, 50))
		const content = holder.select('[data-testid="sjpp-massnav-user-session-content"]')
		content.select('input[type="text"]').property('value', 'on-server')
		const buttons = Array.from((content.node() as HTMLElement).querySelectorAll('button'))
		const serverBtn = buttons.find((b: HTMLButtonElement) => b.textContent == 'Server') as HTMLButtonElement
		serverBtn.click()
		await new Promise(resolve => setTimeout(resolve, 100))

		test.equal(calls, 1, 'should build the state of the session once')
		test.equal(counter.requests, 1, 'should send the session to the server once')
		test.equal(user.savedSessions['on-server'], undefined, 'should not keep a copy of a session that is on the server')
		test.deepEqual(user.serverCachedSessions, ['on-server'], 'should list the session as on the server')
		test.equal(
			localStorage.getItem(storageKey),
			null,
			'should not save a session that is on the server in the browser storage'
		)
		counter.restore()
		holder.remove()
	})
	test.end()
})

tape('MassUser clearContent() and confirmAction()', test => {
	const { user, holder } = getUser()
	const content = holder.select('[data-testid="sjpp-massnav-user-session-content"]')
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
	const option = content.select('[data-testid="sjpp-massnav-user-session-save-option"]')
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

	const content = holder.select('[data-testid="sjpp-massnav-user-session-content"]')
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
		.selectAll('[data-testid="sjpp-massnav-user-session-content"] tbody tr')
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
		holder.selectAll('[data-testid="sjpp-massnav-user-session-content"] table').size(),
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
		.selectAll('[data-testid="sjpp-massnav-user-session-content"] tbody tr')
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

		const content = holder.select('[data-testid="sjpp-massnav-user-session-content"]')
		const btnLabels = content
			.selectAll('button')
			.nodes()
			.map((n: any) => n.textContent)
		test.deepEqual(btnLabels, ['Browser', 'File'], 'should only offer to save to the browser and a file')
		const input = content.select('input[type="text"]')
		test.equal(input.attr('placeholder'), 'unnamed-session', 'should have a default session name')

		// typing a name shows matching saved names
		input.property('value', 'exi').dispatch('input')
		const options = content.selectAll('[data-testid="sjpp-massnav-user-session-save-option"]').nodes() as HTMLElement[]
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
		test.true(getOptionLabels(user).includes('Delete'), 'should refresh the options')
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
		const btns = holder
			.selectAll('[data-testid="sjpp-massnav-user-session-content"] button')
			.nodes() as HTMLButtonElement[]
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
		const btns = holder
			.selectAll('[data-testid="sjpp-massnav-user-session-content"] button')
			.nodes() as HTMLButtonElement[]
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
			.selectAll('[data-testid="sjpp-massnav-user-session-content"] button')
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

		const content = holder.select('[data-testid="sjpp-massnav-user-session-content"]')
		const submit = content.selectAll('button').filter(function (this: any) {
			return this.textContent == 'Delete selected sessions'
		})
		test.equal(submit.size(), 1, 'should show the delete button')
		test.true((submit.node() as HTMLButtonElement).disabled, 'should disable it until a session is selected')

		// the button is left aligned with the table, and is not centered in the width of the tab
		const btnLeft = (submit.node() as HTMLElement).getBoundingClientRect().left
		const tableLeft = (content.select('table').node() as HTMLElement).getBoundingClientRect().left
		test.true(Math.abs(btnLeft - tableLeft) < 2, 'should align the delete button with the left edge of the table')
		test.notEqual(
			getComputedStyle((submit.node() as HTMLElement).parentElement as HTMLElement).textAlign,
			'center',
			'should not center the delete button'
		)

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
		test.true(getOptionLabels(user).includes('Delete'), 'should keep Delete while a session remains')
		holder.remove()
	})
	test.end()
})
