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
 *  - Export Session and days left message for a session opened from a url
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
		selector: `[data-testid="sjpp-session-btn-${label.toLowerCase().replace(/\s/g, '-')}"]`
	})) as HTMLElement
}

function getContent(nav: any) {
	return nav.Inner.dom.subheader.user.select('[data-testid="sjpp-user-session-content"]')
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

const jwtAuth = { route: 'termdb', type: 'jwt', headerKey: 'x-ds-access-token' }

/**
 * The test server does not require authorization for the TermdbTest dataset. To test the tab of
 * a dataset that does, this adds a jwt credential to the termdb/config response, and replies to the
 * request for the server sessions of the user, with no request to the server.
 * Returns a function that restores fetch().
 */
function mockRequiredAuth(serverSessionIds: string[] = []) {
	// the responses are cached across tests, so that the mocked one is not reused by other tests
	const clearCache = () => clearServerDataCache({ serverData: (dofetch as any).serverData })
	clearCache()
	const origFetch = window.fetch
	window.fetch = async function (url: any, init?: any) {
		const path = typeof url == 'string' ? url : url?.url || String(url)
		if (path.includes('sessionIds')) {
			return new Response(JSON.stringify({ sessionIds: serverSessionIds }), {
				status: 200,
				headers: { 'content-type': 'application/json' }
			})
		}
		const res = await origFetch.call(window, url, init)
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
		test.false(labels.includes('USER'), 'should not label the tab USER')

		const user = getUser(nav)
		test.equal(user.requiredAuth, undefined, 'should not require authorization')
		test.equal(
			nav.Inner.dom.subheader.user.select('[data-testid="sjpp-user-auth"]').style('display'),
			'none',
			'should hide the authorization info'
		)

		for (const label of ['Open', 'Save', 'Share']) {
			const btn = await detectOptionBtn(nav, label)
			test.equal(btn.textContent, label, `should show the ${label} button`)
		}
		test.equal(
			nav.Inner.dom.subheader.user.select('[data-testid="sjpp-session-btn-export-session"]').size(),
			0,
			'should not show Export Session for a session that was not opened from a url'
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
			nav.Inner.dom.subheader.user.select('[data-testid="sjpp-session-btn-delete"]').node(),
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
			nav.Inner.dom.subheader.user.select('[data-testid="sjpp-session-btn-delete"]').node(),
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
			nav.Inner.dom.subheader.user.select('[data-testid="sjpp-session-btn-delete"]').node(),
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
		test.true(labels.includes('USER'), 'should label the tab USER')
		test.false(labels.includes('SESSION'), 'should not label the tab SESSION')

		const user = getUser(nav)
		test.deepEqual(user.requiredAuth, jwtAuth, 'should find the jwt credential from the termdb config')

		const authDiv = nav.Inner.dom.subheader.user.select('[data-testid="sjpp-user-auth"]')
		test.equal(authDiv.style('display'), 'block', 'should show the authorization info')
		test.equal(
			authDiv.select('[data-testid="sjpp-user-auth-status"]').text(),
			'Requires sign-in',
			'should prompt to sign in when there is no token'
		)

		// the sessions of the server are listed, and the server cannot be saved to
		user.savedSessions['browser-session-1'] = { plots: [] }
		const openBtn = await detectOptionBtn(nav, 'Open')
		test.true(await detectOptionBtn(nav, 'Delete'), 'should show Delete for the sessions on the server')
		openBtn.click()
		await detectOne({ elem: getContent(nav).node(), selector: 'tbody tr:nth-child(2)' })
		const serverRow = getContent(nav)
			.selectAll('tbody tr')
			.filter((d: any) => d?.loc === 'server' && d.id === 'server-session-1')
		test.deepEqual(
			serverRow
				.selectAll('td')
				.nodes()
				.map((node: HTMLElement) => node.textContent),
			['server', 'server-session-1'],
			'should list the session from the server'
		)

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

tape('Export Session and days left message for a session opened from a url', test => {
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
		const exportBtn = await detectOptionBtn(nav, 'Export Session')
		test.equal(exportBtn.textContent, 'Export Session', 'should show Export Session in the user tab')
		test.equal(
			nav.Inner.dom.controlsDiv.selectAll('[data-testid="sjpp-nav-file-btn"]').size(),
			0,
			'should not show Export Session in the nav controls'
		)

		const msg = nav.Inner.dom.sessionElapsedMessageDiv
		test.notEqual(msg.style('display'), 'none', 'should show the days left message')
		test.true(msg.text().includes('12 days'), 'should show the number of days left')
		test.true(
			parseFloat(msg.style('font-size')) < parseFloat(nav.Inner.dom.controlsDiv.style('font-size')),
			'should show the message in a smaller font than the controls'
		)
		test.equal(
			nav.Inner.dom.controlsDiv.node().contains(msg.node()),
			true,
			'should keep the message in the controls, beside the other nav controls'
		)

		if ((test as any)._ok) nav.Inner.app.destroy()
		test.end()
	}
})
