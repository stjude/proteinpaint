import { select } from 'd3-selection'
import { MassUser } from '../user.ts'
import { clearServerDataCache } from '#common/dofetch'

/** Helpers shared by user.unit.spec.ts and user.render.integration.spec.ts. Mock the app, so no server is needed */

export const storageKey = 'savedMassSessions'

export const jwtAuth = { route: 'termdb', type: 'jwt', headerKey: 'x-ds-access-token' }
export const basicAuth = { route: 'termdb', type: 'basic', headerKey: 'x-ds-access-token' }

/** Mock the app and vocabApi that MassUser uses. Does not make any server requests. */
export function getMockApp(opts: { termdbConfig?: any; verified?: boolean; tokenMessage?: string } = {}) {
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
export function getUser(
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

/** The labels of the session options, in order */
export function getOptionLabels(user: any): string[] {
	return user.getSessionOptions().map((o: any) => o.label)
}

export function getOptionBtn(holder: any, label: string): HTMLElement {
	return holder
		.select(`[data-testid="sjpp-massnav-user-session-btn-${label.toLowerCase().replace(/\s/g, '-')}"]`)
		.node()
}

/** Runs fn with localStorage[savedMassSessions] set to value, then restores the previous value */
export async function withStoredSessions(value: any, fn: () => any) {
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

/** Replaces fetch() to answer the /sessionIds request with the ids. Returns a function to restore fetch(). */
export function mockSessionIds(ids: string[]) {
	const origFetch = window.fetch
	clearServerDataCache()
	window.fetch = async () =>
		new Response(JSON.stringify({ status: 'ok', sessionIds: ids }), {
			status: 200,
			headers: { 'content-type': 'application/json' }
		})
	return () => {
		window.fetch = origFetch
		clearServerDataCache()
	}
}

/** Silences the warning of a failed lookup while running fn */
export async function withoutWarnings(fn: (warnings: string[]) => any) {
	const warn = console.warn
	const warnings: string[] = []
	console.warn = (...args: any[]) => warnings.push(args.join(' '))
	try {
		return await fn(warnings)
	} finally {
		console.warn = warn
	}
}

/**
 * Replaces fetch() to answer each request with respond(), which returns {status, body}.
 * Returns the number of requests, and a function to restore fetch().
 */
export function mockFetch(respond: (n: number) => { status?: number; body: any }) {
	const origFetch = window.fetch
	const counter = { requests: 0, urls: [] as string[], restore: () => {} }
	clearServerDataCache()
	window.fetch = async (url: any) => {
		counter.urls.push(typeof url == 'string' ? url : url?.url || String(url))
		const { status = 200, body } = respond(++counter.requests)
		return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
	}
	counter.restore = () => {
		window.fetch = origFetch
		clearServerDataCache()
	}
	return counter
}

/** What ComponentApi.destroy() does to a component */
export function destroyLikeRx(user: any, holder: any) {
	user.destroy()
	for (const key in user.dom) {
		if (typeof user.dom[key]?.remove == 'function') user.dom[key].remove()
		delete user.dom[key]
	}
	holder.remove()
}

/** Replaces the click of a link, which would download a file, to record the downloads. Returns a function to restore it. */
export function stubDownloads() {
	const downloads: { filename: string | null; text: string }[] = []
	const click = HTMLAnchorElement.prototype.click
	HTMLAnchorElement.prototype.click = function (this: HTMLAnchorElement) {
		const href = this.getAttribute('href') || ''
		downloads.push({
			filename: this.getAttribute('download'),
			text: decodeURIComponent(href.slice(href.indexOf(',') + 1))
		})
	}
	return {
		downloads,
		restore: () => {
			HTMLAnchorElement.prototype.click = click
		}
	}
}

/** Replaces window.open() to record the urls. Returns a function to restore it. */
export function stubWindowOpen() {
	const urls: string[] = []
	const open = window.open
	window.open = ((url: string) => {
		urls.push(url)
		return null
	}) as any
	return {
		urls,
		restore: () => {
			window.open = open
		}
	}
}
