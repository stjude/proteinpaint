import tape from 'tape'
import * as helpers from '../../test/front.helpers.js'
import { detectOne, sleep } from '../../test/test.helpers.js'
import { dofetch, dofetch3, clearServerDataCache } from '#common/dofetch'

/**
 * Tests
 *  - user tab for a public dataset
 *  - Share creates a session on the server
 *  - Save to the browser, Open, and Delete a session
 *  - user tab for a dataset that requires authorization
 *  - launch when the lookup of the sessions on the server fails
 *  - user tab when no cohort is selected
 *  - Download and days left tab text for a session opened from a url
 */

/*************************
 reusable helper functions
**************************/

const storageKey = 'savedMassSessions'

const runpp = helpers.getRunPp('mass', {
	state: {
		dslabel: 'TermdbTest',
		genome: 'hg38-test',
		nav: {
			header_mode: 'with_tabs'
		}
	},
	debug: 1
})

/** The tab cells in the nav, with the text of each column */
function getTabLabels(nav: any): string[] {
	return nav.Inner.tabs.map((t: any) => t.top)
}

/** The MassUser instance of the nav */
function getUser(nav: any) {
	return nav.getComponents('user').Inner
}

/** Wait for the buttons of the user tab, which render after the init of the component */
async function detectOptionBtn(nav: any, label: string): Promise<HTMLElement> {
	return (await detectOne({
		elem: nav.Inner.dom.subheader.user.node(),
		selector: `[data-testid="sjpp-massnav-user-session-btn-${label.toLowerCase().replace(/\s/g, '-')}"]`
	})) as HTMLElement
}

function getContent(nav: any) {
	return nav.Inner.dom.subheader.user.select('[data-testid="sjpp-massnav-user-session-content"]')
}

/** Clicks the tab cell of the user tab, as a user would */
function clickUserTab(nav: any) {
	const idx = nav.Inner.subheaderKeys.indexOf('user')
	const td = nav.Inner.dom.tabDiv.selectAll('td').filter((d: any) => d.colNum === idx && d.key === 'top')
	;(td.node() as HTMLElement).click()
}

// /** Runs fn with localStorage[savedMassSessions] set to value, then restores the previous value */
// async function withStoredSessions(value: any, fn: () => any) {
// 	const prev = localStorage.getItem(storageKey)
// 	if (value === undefined) localStorage.removeItem(storageKey)
// 	else localStorage.setItem(storageKey, JSON.stringify(value))
// 	try {
// 		return await fn()
// 	} finally {
// 		if (prev === null) localStorage.removeItem(storageKey)
// 		else localStorage.setItem(storageKey, prev)
// 	}
// }

/** The number of /sessionIds requests that mockRequiredAuth() received, since it was last called */
let sessionIdRequests = 0

const jwtAuth = { route: 'termdb', type: 'jwt', headerKey: 'x-ds-access-token' }

/**
 * The test server does not require authorization for the TermdbTest dataset. To test the tab of
 * a dataset that does, this adds a jwt credential to the termdb/config response, and replies to the
 * request for the server sessions of the user, with no request to the server.
 * signedIn: also reports an active session for the dataset, so that the user is signed in.
 * Returns a function that restores fetch().
 */
function mockRequiredAuth(serverSessionIds: string[] = [], failSessionIds = false, signedIn = false) {
	// the responses are cached across tests, so that the mocked one is not reused by other tests
	const clearCache = () => clearServerDataCache({ serverData: (dofetch as any).serverData })
	clearCache()
	sessionIdRequests = 0
	const origFetch = window.fetch
	window.fetch = async function (url: any, init?: any) {
		const path = typeof url == 'string' ? url : url?.url || String(url)
		if (path.includes('sessionIds')) sessionIdRequests++
		if (path.includes('sessionIds') && failSessionIds) throw new TypeError('Failed to fetch') // network failure
		if (path.includes('sessionIds')) {
			return new Response(JSON.stringify({ sessionIds: serverSessionIds }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		}
		const res = await origFetch.call(window, url, init)
		if (signedIn && /\/genomes(\?|$)/.test(path)) {
			// the server reports an active session for the dataset
			const data = await res.clone().json()
			data.dsAuth = [...(data.dsAuth || []), { dslabel: 'TermdbTest', ...jwtAuth, insession: true }]
			return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } })
		}
		if (path.includes('termdb/config')) {
			const data = await res.clone().json()
			data.termdbConfig.requiredAuth = [jwtAuth]
			return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } })
		}
		return res
	}
	return () => {
		window.fetch = origFetch
		clearCache()
	}
}

/**************
 test sections
***************/

tape('\n', test => {
	test.comment('-***- mass/user.integration -***-')
	test.end()
})

tape('user tab for a public dataset', test => {
	test.timeoutAfter(5000)
	runpp({
		nav: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(nav: any) {
		nav.on('postRender.test', null)
		const labels = getTabLabels(nav)
		test.true(labels.includes('SESSION'), 'should label the tab SESSION')

		const user = getUser(nav)
		test.equal(user.requiredAuth, undefined, 'should not require authorization')
		test.equal(
			nav.Inner.dom.subheader.user.select('[data-testid="sjpp-massnav-user-auth"]').style('display'),
			'none',
			'should hide the authorization info'
		)

		for (const label of ['Open', 'Save', 'Share']) {
			const btn = await detectOptionBtn(nav, label)
			test.equal((btn as any).__data__.label, label, `should show the ${label} button`)
		}
		test.equal(
			nav.Inner.dom.subheader.user.select('[data-testid="sjpp-massnav-user-session-btn-download"]').size(),
			0,
			'should not show Download for a session that was not opened from a url'
		)

		// the tab is shown on click, and the other subheaders are hidden
		clickUserTab(nav)
		await sleep(100)
		test.notEqual(nav.Inner.dom.subheader.user.style('display'), 'none', 'should show the user subheader on click')
		test.equal(nav.Inner.dom.subheader.about.style('display'), 'none', 'should hide the about subheader')

		if ((test as any)._ok) nav.Inner.app.destroy()
		test.end()
	}
})

tape('Share creates a session on the server', test => {
	test.timeoutAfter(8000)
	runpp({
		nav: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(nav: any) {
		nav.on('postRender.test', null)
		const shareBtn = await detectOptionBtn(nav, 'Share')
		shareBtn.click()

		const link = (await detectOne({
			elem: getContent(nav).node(),
			selector: 'a'
		})) as HTMLAnchorElement
		const id = link.textContent!
		test.true(id.length > 0, 'should show the id of the new session')
		test.true(
			link.getAttribute('href')!.includes(`mass-session-id=${id}`),
			'should link to the session by its id with mass-session-id'
		)
		const btnLabels = getContent(nav)
			.selectAll('button')
			.nodes()
			.map((n: any) => n.textContent)
		test.deepEqual(btnLabels, ['Open link', 'Copy link'], 'should offer to open and copy the link')
		test.true(getContent(nav).text().includes('30 days'), 'should show how long the session is saved')

		// the session is in the server
		const res = await dofetch3(`/massSession?id=${id}`)
		test.true(res.state, 'should be able to get the saved session from the server')
		test.false('termdbConfig' in res.state, 'should not save the dataset config')
		test.equal(res.state.vocab.dslabel, 'TermdbTest', 'should save the state of the app')

		if ((test as any)._ok) nav.Inner.app.destroy()
		test.end()
	}
})

tape('Save to the browser, Open, and Delete a session', test => {
	test.timeoutAfter(10000)
	const prev = localStorage.getItem(storageKey)
	localStorage.removeItem(storageKey)
	runpp({
		nav: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(nav: any) {
		nav.on('postRender.test', null)
		const user = getUser(nav)
		test.false(
			nav.Inner.dom.subheader.user.select('[data-testid="sjpp-massnav-user-session-btn-delete"]').node(),
			'should not show Delete before there are any sessions'
		)

		// Save
		const saveBtn = await detectOptionBtn(nav, 'Save')
		saveBtn.click()
		const input = (await detectOne({
			elem: getContent(nav).node(),
			selector: 'input[type="text"]'
		})) as HTMLInputElement
		input.value = 'integration-test-session'
		const browserBtn = Array.from(getContent(nav).node().querySelectorAll('button')).find(
			(b: any) => b.textContent == 'Browser'
		) as HTMLElement
		browserBtn.click()

		const stored = JSON.parse(localStorage.getItem(storageKey) || '{}')
		test.deepEqual(Object.keys(stored), ['integration-test-session'], 'should save the session in the browser')
		test.equal(stored['integration-test-session'].vocab.dslabel, 'TermdbTest', 'should save the app state')
		test.false('termdbConfig' in stored['integration-test-session'], 'should not save the dataset config')
		test.equal(user.sessionName, 'integration-test-session', 'should remember the session name')
		test.true(
			nav.Inner.dom.subheader.user.select('[data-testid="sjpp-massnav-user-session-btn-delete"]').node(),
			'should show Delete after saving a session'
		)

		// Open lists the saved session
		const openBtn = await detectOptionBtn(nav, 'Open')
		openBtn.click()
		const row = (await detectOne({
			elem: getContent(nav).node(),
			selector: 'tbody tr:nth-child(2)'
		})) as HTMLElement
		test.true(
			row.textContent!.includes('browser') && row.textContent!.includes('integration-test-session'),
			'should list the saved session'
		)

		// Delete the session
		const deleteBtn = await detectOptionBtn(nav, 'Delete')
		deleteBtn.click()
		const checkbox = (await detectOne({
			elem: getContent(nav).node(),
			selector: 'input[type="checkbox"]'
		})) as HTMLInputElement
		;(checkbox.closest('tr') as HTMLElement).click()
		const submit = Array.from(getContent(nav).node().querySelectorAll('button')).find(
			(b: any) => b.textContent == 'Delete selected sessions'
		) as HTMLButtonElement
		test.false(submit.disabled, 'should enable the delete button once a session is selected')
		submit.click()
		await sleep(100)

		test.deepEqual(
			JSON.parse(localStorage.getItem(storageKey) || '{}'),
			{},
			'should delete the session from the browser'
		)
		test.false(
			nav.Inner.dom.subheader.user.select('[data-testid="sjpp-massnav-user-session-btn-delete"]').node(),
			'should hide Delete when there are no sessions'
		)

		if (prev === null) localStorage.removeItem(storageKey)
		else localStorage.setItem(storageKey, prev)
		if ((test as any)._ok) nav.Inner.app.destroy()
		test.end()
	}
})

tape('Open a session that is saved in the browser', test => {
	test.timeoutAfter(10000)
	const prev = localStorage.getItem(storageKey)
	runpp({
		nav: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	// a session that was saved with a filter, to recognize that it was opened
	const filter = {
		type: 'tvslst',
		in: true,
		join: '',
		lst: [
			{
				type: 'tvs',
				tvs: {
					term: { id: 'sex', name: 'Sex', type: 'categorical', values: { '1': { label: 'Male' } } },
					values: [{ key: '1', label: 'Male' }]
				}
			}
		]
	}

	async function runTests(nav: any) {
		nav.on('postRender.test', null)
		const app = nav.Inner.app
		// the session is read from the browser when the tab initializes, so set it for the open
		const state = structuredClone(app.getState())
		delete state.termdbConfig
		state.termfilter = { filter }
		state.sampleGroupsForm = 2
		const user = getUser(nav)
		user.savedSessions = { 'filtered-session': state }

		const openBtn = await detectOptionBtn(nav, 'Open')
		openBtn.click()
		const rows = await detectOne({ elem: getContent(nav).node(), selector: 'tbody tr:nth-child(2)' })
		;(rows as HTMLElement).click()
		await sleep(500)

		test.deepEqual(
			app.getState().termfilter.filter.lst.map((f: any) => f.tvs.term.id),
			['sex'],
			'should restore the filter of the saved session'
		)

		if (prev === null) localStorage.removeItem(storageKey)
		else localStorage.setItem(storageKey, prev)
		if ((test as any)._ok) app.destroy()
		test.end()
	}
})

tape('user tab for a dataset that requires authorization', test => {
	test.timeoutAfter(8000)
	const restoreFetch = mockRequiredAuth(['server-session-1'])
	runpp({
		nav: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(nav: any) {
		nav.on('postRender.test', null)
		const labels = getTabLabels(nav)
		test.true(labels.includes('SESSION'), 'should label the tab SESSION when authorization is required')

		const user = getUser(nav)
		test.deepEqual(user.requiredAuth, jwtAuth, 'should find the jwt credential from the termdb config')

		const authDiv = nav.Inner.dom.subheader.user.select('[data-testid="sjpp-massnav-user-auth"]')
		test.equal(authDiv.style('display'), 'block', 'should show the authorization info')
		test.equal(
			authDiv.select('[data-testid="sjpp-massnav-user-auth-status"]').text(),
			'Requires sign-in',
			'should prompt to sign in when there is no token'
		)
		test.equal(
			authDiv.select('[data-testid="sjpp-massnav-user-auth-label"]').text(),
			'ACCESS',
			'should label the authorization info ACCESS'
		)
		test.equal(
			authDiv.select('[data-testid="sjpp-massnav-user-auth-label"]').node().parentNode,
			authDiv.select('[data-testid="sjpp-massnav-user-auth-status"]').node().parentNode,
			'should show the label and the status on the same row'
		)

		// the sessions on the server are not looked up before the user is signed in, the request would be rejected
		await sleep(100)
		test.equal(sessionIdRequests, 0, 'should not request the sessions on the server when not signed in')
		const openBtn = await detectOptionBtn(nav, 'Open')
		test.equal(
			nav.Inner.dom.subheader.user.select('[data-testid="sjpp-massnav-user-session-btn-delete"]').size(),
			0,
			'should not show Delete, since there are no sessions to delete'
		)
		openBtn.click()
		await sleep(100)
		test.true(
			getContent(nav).text().includes('requires sign-in'),
			'should say that the sessions on the server require sign-in'
		)
		test.equal(sessionIdRequests, 0, 'should still not request the sessions on the server')
		test.equal(getUser(nav).serverCachedSessions, undefined, 'should not keep an empty list as the sessions')

		const saveBtn = await detectOptionBtn(nav, 'Save')
		saveBtn.click()
		const serverBtn = (await detectOne({
			elem: getContent(nav).node(),
			selector: 'button[title^="Requires sign-in."]'
		})) as HTMLButtonElement
		test.equal(serverBtn.textContent, 'Server', 'should show the Server button')
		test.true(serverBtn.disabled, 'should disable saving to the server when not signed in')

		restoreFetch()
		if ((test as any)._ok) nav.Inner.app.destroy()
		test.end()
	}
})

tape('launch when the lookup of the sessions on the server fails', test => {
	test.timeoutAfter(8000)
	const restoreFetch = mockRequiredAuth(['unused'], true, true)
	const warn = console.warn
	console.warn = () => {}
	runpp({
		nav: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(nav: any) {
		nav.on('postRender.test', null)
		console.warn = warn
		restoreFetch()
		test.true(nav.Inner.dom.subheader.user, 'should launch the nav, since the sessions on the server are optional')
		test.true(getTabLabels(nav).includes('SESSION'), 'should show the user tab')
		for (const label of ['Open', 'Save', 'Share']) {
			test.true(await detectOptionBtn(nav, label), `should show the ${label} button`)
		}
		test.equal(
			nav.Inner.dom.subheader.user.select('[data-testid="sjpp-massnav-user-auth-status"]').text(),
			'You are signed in.',
			'should show that the user is signed in'
		)
		test.equal(sessionIdRequests, 1, 'should have tried the lookup of the sessions on the server')
		test.equal(getUser(nav).serverCachedSessions, undefined, 'should not keep a failed lookup')
		if ((test as any)._ok) nav.Inner.app.destroy()
		test.end()
	}
})

tape('sessions on the server for a signed in user', test => {
	test.timeoutAfter(8000)
	const restoreFetch = mockRequiredAuth(['server-session-1'], false, true)
	runpp({
		nav: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(nav: any) {
		nav.on('postRender.test', null)
		test.equal(
			nav.Inner.dom.subheader.user.select('[data-testid="sjpp-massnav-user-auth-status"]').text(),
			'You are signed in.',
			'should show that the user is signed in'
		)
		// Delete is added when the lookup is done
		test.true(await detectOptionBtn(nav, 'Delete'), 'should show Delete for the sessions on the server')
		test.equal(sessionIdRequests, 1, 'should look up the sessions on the server once')
		test.deepEqual(getUser(nav).serverCachedSessions, ['server-session-1'], 'should keep the sessions of the server')

		const openBtn = await detectOptionBtn(nav, 'Open')
		openBtn.click()
		const rows = await detectOne({ elem: getContent(nav).node(), selector: 'tbody tr:nth-child(2)' })
		test.true((rows as HTMLElement).textContent!.includes('server-session-1'), 'should list the session on the server')
		test.equal(sessionIdRequests, 1, 'should reuse the sessions that were looked up')

		const saveBtn = await detectOptionBtn(nav, 'Save')
		saveBtn.click()
		const serverBtn = (await detectOne({
			elem: getContent(nav).node(),
			selector: 'button[title^="Save the session into a remote server"]'
		})) as HTMLButtonElement
		test.false(serverBtn.disabled, 'should enable saving to the server when signed in')

		restoreFetch()
		if ((test as any)._ok) nav.Inner.app.destroy()
		test.end()
	}
})

tape('user tab when no cohort is selected', test => {
	test.timeoutAfter(8000)
	runpp({
		nav: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	/*
	A dataset with a cohort selection and no selected cohort does not launch yet, since charts.ts throws for
	activeCohort=-1, so the state is set on the nav and its updateUI() is called.
	*/
	async function runTests(nav: any) {
		nav.on('postRender.test', null)
		const self = nav.Inner
		test.true(self.state.termdbConfig.selectCohort, 'should be a dataset that has a cohort selection')
		self.activeCohort = -1
		const filterIdx = self.subheaderKeys.indexOf('filter')
		const userIdx = self.subheaderKeys.indexOf('user')

		// the tabs that need a cohort are hidden, with a message
		self.activeTab = filterIdx
		await self.updateUI()
		test.equal(self.dom.subheaderDiv.style('display'), 'none', 'should hide the subheader of the filter tab')
		test.notEqual(self.dom.messageDiv.style('display'), 'none', 'should show the message to select a cohort')
		test.true(self.dom.messageDiv.text().includes('No cohort selected'), 'should tell the user to select a cohort')

		// the user tab is not
		self.activeTab = userIdx
		await self.updateUI()
		test.notEqual(self.dom.subheaderDiv.style('display'), 'none', 'should show the subheader of the user tab')
		test.equal(self.dom.messageDiv.style('display'), 'none', 'should not show the message to select a cohort')
		const td = self.dom.tabDiv.selectAll('td').filter((d: any) => d.colNum === userIdx && d.key === 'top')
		test.equal(td.style('background-color'), 'rgb(236, 236, 236)', 'should show the user tab as the active tab')

		// the session controls are available
		for (const label of ['Open', 'Save', 'Share']) {
			const btn = await detectOptionBtn(nav, label)
			test.true(btn.offsetParent !== null, `should show the ${label} button`)
		}
		const saveBtn = await detectOptionBtn(nav, 'Save')
		saveBtn.click()
		test.true(
			await detectOne({ elem: getContent(nav).node(), selector: 'input[type="text"]' }),
			'should show the options to save the session'
		)

		// the other tabs are still hidden, including the first tab of the cohort selection
		self.activeTab = filterIdx
		await self.updateUI()
		test.equal(self.dom.subheaderDiv.style('display'), 'none', 'should hide the filter tab again')
		self.activeTab = 0
		await self.updateUI()
		test.notEqual(
			self.dom.subheaderDiv.style('display'),
			'none',
			'should show the cohort tab, where a cohort is selected'
		)

		if ((test as any)._ok) self.app.destroy()
		test.end()
	}
})

tape('Download and days left tab text for a session opened from a url', test => {
	test.timeoutAfter(5000)
	runpp({
		sessionDaysLeft: 12,
		sessionId: 'test-session-id',
		nav: {
			callbacks: {
				'postRender.test': runTests
			}
		}
	})

	async function runTests(nav: any) {
		nav.on('postRender.test', null)
		const downloadBtn = await detectOptionBtn(nav, 'Download')
		test.equal((downloadBtn as any).__data__.label, 'Download', 'should show Download in the user tab')
		test.equal(downloadBtn.getAttribute('title'), 'Download this session as a file', 'should set the button title')
		test.equal(downloadBtn.getAttribute('aria-label'), 'Download this session as a file', 'should set the aria-label')
		test.equal(
			nav.Inner.dom.controlsDiv.selectAll('[data-testid="sjpp-nav-file-btn"]').size(),
			0,
			'should not show Download in the nav controls'
		)

		const tab = nav.Inner.dom.tds.filter((d: any) => d.subheader == 'user' && d.key == 'btm').node()
		test.equal(tab.textContent, '12 days left', 'should show the number of days left in the user tab')
		tab.dispatchEvent(new MouseEvent('mouseover'))
		test.true(
			Array.from(document.querySelectorAll('.sja_menu_div')).some(d => d.textContent!.includes('"Save"')),
			'should explain how to save a new session in the tooltip'
		)
		tab.dispatchEvent(new MouseEvent('mouseout'))

		if ((test as any)._ok) nav.Inner.app.destroy()
		test.end()
	}
})
