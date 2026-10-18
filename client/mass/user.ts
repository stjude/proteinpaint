import { getCompInit, type AppApi, type RxComponent } from '#rx'
import { Menu } from '#dom/menu'
import { sayerror } from '#dom/sayerror'
import { to_textfile } from '#dom/downloadTextfile'
import { dofetch3 } from '#common/dofetch'
import { parentCorsMessage } from '#common/embedder-helpers'
import { select } from 'd3-selection'
import { importPlot } from '#plots/importPlot.js'
import { trimGvTermsForSave } from '#shared/terms.js'
import type { Elem } from '../types/d3'
import type { MassUserOpts, MassUserDom, SessionOption, SessionLocation } from './types/user'
import { markSavedState, getSavedStateRefusal } from './sessionForm.ts'

/*
"user" tab will display following contents inside this.subheader:
- the user authorization information, if the dataset requires authorization
- the session open/save/share/delete functionality, moved from the former session button. The options are always
  shown as buttons, and the selected option renders into dom.contentDiv

The nav tab label is 'USER' if the dataset requires authorization, otherwise 'SESSION'. nav.ts sets it.
*/

/** A dataset requires authorization if the server sent a non-empty termdbConfig.requiredAuth[] */
export function datasetRequiresAuth(termdbConfig: any): boolean {
	return !!termdbConfig?.requiredAuth?.length
}

/**
 * The sign-in status line.
 * isPublic: termdbConfig.userTab.isPublic, from the optional ds hook massNav.tabs.user.isPublic(), true if the
 * signed-in user has only public access, such as a public role
 */
export function getAuthStatus(signedIn: boolean, isPublic?: boolean): string {
	if (!signedIn) return 'Requires sign-in'
	return isPublic === true ? 'Public access' : 'Signed in'
}

export class MassUser implements RxComponent {
	static type = 'user'

	type: string
	app: AppApi
	id!: string
	opts: MassUserOpts
	dom: MassUserDom
	state: any
	subheader: Elem
	/** The termdb route that is checked for a required credential */
	route = 'termdb'
	/** Matching termdbConfig.requiredAuth[] entry, with type 'jwt'. Enables saving sessions to the server */
	requiredAuth?: any
	sessionOptions: SessionOption[]
	embedderOrigin: string
	hostURL: string
	dslabel!: string
	sessionName!: string
	/** Sessions saved in this browser, by session name. Mirrors localStorage 'savedMassSessions' */
	savedSessions: { [name: string]: any } = {}
	/** Ids of the sessions saved on the server. Undefined until first requested */
	serverCachedSessions?: string[]
	/** The lookup of serverCachedSessions that is in progress, shared by everything that needs the result */
	serverSessionsRequest?: Promise<void>
	/** Whether the user was signed in at the last check, to detect a sign-in after the launch */
	signedIn = false
	confirmationTimer?: ReturnType<typeof setTimeout>
	/** Hides the tip that confirms a copied link */
	copyTipTimer?: ReturnType<typeof setTimeout>

	constructor(opts: MassUserOpts) {
		this.type = MassUser.type
		this.opts = opts
		this.app = opts.app
		this.subheader = opts.subheader
		// no margin, so that the option buttons have the same spacing as the chart buttons in the charts tab,
		// which are appended directly to that subheader
		const sessionDiv = this.subheader.append('div').attr('data-testid', 'sjpp-massnav-user-session')
		// states the purpose of the option buttons, on the same row. the left margin is the same as the buttons
		sessionDiv
			.append('span')
			.attr('data-testid', 'sjpp-massnav-user-session-label')
			.style('margin-left', '10px')
			.style('font-weight', 'bold')
			.style('opacity', 0.65)
			.text('SESSION')
		this.dom = {
			authDiv: this.subheader.append('div').attr('data-testid', 'sjpp-massnav-user-auth').style('margin', '10px'),
			sessionDiv,
			// inline-block, to be on the same row as the label
			optionsDiv: sessionDiv
				.append('div')
				.attr('data-testid', 'sjpp-massnav-user-session-options')
				.style('display', 'inline-block'),
			// aligned with the edge of the option buttons, which have a 10px margin
			contentDiv: sessionDiv
				.append('div')
				.attr('id', 'sjpp-massnav-user-session-menu')
				.attr('data-testid', 'sjpp-massnav-user-session-content')
				.style('margin', '0 10px'),
			// how long the server keeps a session that was opened from a `mass-session-id` URL, under the options
			// and what an option renders
			daysLeftDiv: sessionDiv
				.append('div')
				.attr('data-testid', 'sjpp-massnav-user-session-days-left')
				.style('display', 'none')
				.style('margin', '0 10px 10px 10px')
				.style('font-size', '0.9em')
				.style('opacity', 0.65),
			copytip: new Menu({ padding: '5px' })
		}
		this.sessionOptions = [
			{ label: `Open`, title: 'Recover a saved session', callback: () => this.open() },
			{ label: `Save`, title: 'Save the current view', callback: () => this.save() },
			{ label: `Share`, title: 'Share the current view', callback: () => this.getSessionUrl() }
		]
		this.embedderOrigin = window.location.origin
		this.hostURL = sessionStorage.getItem('hostURL') || this.embedderOrigin
	}

	/**
	 * By default, only what this component renders from. rx compares the returned object with the previous state
	 * on every dispatch, so it must not include the whole termdbConfig, which can be very large.
	 *
	 * forSession=true: the parts of the app state that make up a saved session instead, copied so that the app
	 * state, which is deeply frozen and shared, is not changed. app_refresh merges a reopened session into the
	 * current state, so what is not saved, such as the dataset config that init() in mass/store.ts fetches
	 * again, keeps its current value. The derived properties of a geneVariant term are re-filled by every path
	 * that opens a session, see trimGvTermsForSave().
	 */
	getState(appState: any, forSession = false) {
		if (forSession) {
			const { vocab, activeCohort, termfilter, plots, groups, customTerms, reuse, nav } = appState
			const state = structuredClone({ vocab, activeCohort, termfilter, plots, groups, customTerms, reuse, nav })
			return markSavedState(trimGvTermsForSave(state))
		}
		return {
			termdbConfig: {
				requiredAuth: appState.termdbConfig?.requiredAuth,
				userTab: appState.termdbConfig?.userTab
			}
		}
	}

	/** Render static contents once on launching mass ui */
	async init(appState: any) {
		this.dslabel = appState.vocab.dslabel
		this.savedSessions = JSON.parse(localStorage.getItem('savedMassSessions') || `{}`)
		this.setRequiredAuth(appState.termdbConfig)
		this.initSessionOptions()
		this.renderDaysLeft()
	}

	async main() {
		this.setRequiredAuth(this.state.termdbConfig)
		this.renderAuthInfo()
		this.mayLookupAfterSignIn()
	}

	/**
	 * The sessions on the server are not looked up while the user is not signed in. So when the user signs in
	 * after the launch, look them up then. Only a change to signed in triggers this, so that a lookup that keeps
	 * failing is not repeated on every update of the app.
	 */
	mayLookupAfterSignIn() {
		const signedIn = !!this.app.vocabApi.hasVerifiedToken()
		const justSignedIn = signedIn && !this.signedIn
		this.signedIn = signedIn
		if (justSignedIn && this.requiredAuth && !this.serverCachedSessions) {
			this.setServerCachedSessions()
		}
	}

	setRequiredAuth(termdbConfig: any) {
		this.requiredAuth = termdbConfig?.requiredAuth?.find((a: any) => a.route == this.route && a.type == 'jwt')
	}

	/** Show the sign-in status when the dataset requires authorization. Hidden for a public dataset */
	renderAuthInfo() {
		const div = this.dom.authDiv
		div.selectAll('*').remove()
		if (!datasetRequiresAuth(this.state.termdbConfig)) {
			div.style('display', 'none')
			return
		}
		div.style('display', 'block')
		const vocabApi: any = this.app.vocabApi
		const signedIn = vocabApi.hasVerifiedToken()
		// computed by the optional ds hooks in massNav.tabs.user, from the auth of the user
		const userTab = this.state.termdbConfig.userTab
		div
			.append('div')
			.attr('data-testid', 'sjpp-massnav-user-auth-status')
			.style('font-weight', 'bold')
			.style('font-size', '1.2em')
			.text(getAuthStatus(signedIn, userTab?.isPublic))
		// reason for a failed sign-in, if any
		const msg = vocabApi.tokenVerificationMessage
		if (!signedIn && msg) div.append('div').style('opacity', 0.65).text(msg)
		// the message from massNav.tabs.user.getMsg(), under the status. text, not html
		if (userTab?.msg)
			div
				.append('div')
				.attr('data-testid', 'sjpp-massnav-user-auth-info')
				.style('margin', '5px 0 0 8px')
				.style('font-size', '0.95em')
				.style('opacity', 0.75)
				.text(userTab.msg)
	}

	/** For a session opened from a `mass-session-id` URL, the number of days before the server removes it */
	renderDaysLeft() {
		const days = this.opts.sessionDaysLeft
		// info not available, do not show the message
		if (typeof days != 'number' || !Number.isFinite(days)) return
		const div = this.dom.daysLeftDiv.style('display', 'block')
		div.append('u').text(`${days} ${days == 1 ? 'day' : 'days'}`)
		div.append('span').text(' left until this session is removed. Select "Save" to create a new one.')
	}

	/**
	 * Renders the session options right away. The lookup of the sessions on the server is optional, so it
	 * is not awaited, since it must not delay or block the launch of the mass ui. The options are
	 * rendered again when any lookup is done, since Delete is only shown when there is a session to delete.
	 */
	initSessionOptions() {
		this.signedIn = !!this.app.vocabApi.hasVerifiedToken()
		this.renderSessionOptions()
		if (!this.serverCachedSessions) this.setServerCachedSessions()
	}

	/** Render the Open, Save, Share, and Delete buttons. Delete is only available if there is something to delete */
	renderSessionOptions() {
		// a lookup of the sessions on the server may finish after the component is destroyed, which removes this.dom
		if (!this.dom?.optionsDiv) return
		const options = this.sessionOptions.slice()
		if (Object.keys(this.savedSessions).length || this.serverCachedSessions?.length) {
			options.push({ label: `Delete`, title: 'Delete a saved session', callback: () => this.delete() })
		}
		// only for a session opened from a `mass-session-id` URL
		if (this.opts.sessionDaysLeft != null && this.opts.sessionId) {
			options.push({
				label: `Export Session`,
				title: 'Download this session as a file',
				callback: () => this.exportSession()
			})
		}
		this.dom.optionsDiv.selectAll('*').remove()
		this.dom.optionsDiv
			.selectAll('button')
			.data(options)
			.enter()
			.append('button')
			// same style as the chart buttons in charts.ts
			.style('margin', '10px')
			.style('padding', '10px 15px')
			.style('border-radius', '20px')
			.style('border-color', '#ededed')
			.attr(
				'data-testid',
				(d: SessionOption) => `sjpp-massnav-user-session-btn-${d.label.toLowerCase().replace(/\s/g, '-')}`
			)
			.attr('aria-label', (d: SessionOption) => d.title)
			.attr('title', (d: SessionOption) => d.title)
			.text((d: SessionOption) => d.label)
			.on('click', async (event: MouseEvent, d: SessionOption) => {
				event.stopPropagation()
				this.clearContent()
				await d.callback()
				// space what the option rendered from what is under it. not when nothing was rendered, so that the
				// days left message stays right under the options. the component may be destroyed during the callback
				if (this.dom?.contentDiv?.node()?.hasChildNodes()) this.dom.contentDiv.style('padding-bottom', '10px')
			})
	}

	/** Download the opened `mass-session-id` session as a json file */
	async exportSession() {
		const res = await dofetch3(`/massSession?id=${encodeURIComponent(this.opts.sessionId!)}`)
		const a = document.createElement('a')
		const dataStr = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.state))
		a.setAttribute('href', dataStr)
		a.download = `${this.opts.sessionId}.json`
		a.click()
		a.remove()
	}

	clearContent() {
		clearTimeout(this.confirmationTimer)
		this.confirmationTimer = undefined
		this.dom.contentDiv.interrupt()
		this.dom.contentDiv.selectAll('*').remove()
		this.dom.contentDiv.style('opacity', 1).style('padding-bottom', null)
	}

	/**
	 * Removes what is not under this.dom of the component, which ComponentApi.destroy() removes. The copytip
	 * Menu is in the document body, with a listener on the body, so it must be destroyed here.
	 */
	destroy() {
		clearTimeout(this.copyTipTimer)
		this.clearContent()
		this.dom.copytip.destroy()
	}

	async open() {
		const radioName = `sjpp-massnav-user-session-open-radio-` + Math.random().toString().slice(-6)
		const div = this.dom.contentDiv
		// always open in the current tab for now, to avoid the tricky part of the code
		// that involves parent-child window messaging
		// TODO: re-enable when the new tab option works reliably
		div.append('div').style('display', 'none').style('padding', '3px 9px').html(`
					<b>Open in</b>
					<label>
						<input type='radio' name='${radioName}' value='new' style='margin-right: 0; vertical-align: bottom'/>
						<span>a new tab</span>
					</label>
					<label style='margin-left: 5px'>
						<input type='radio' name='${radioName}' value='current' checked=checked style='margin-right: 0; vertical-align: bottom'/>
						<span>current tab</span>
					</label>
				`)
		const getTargetWindow = () => (div.node()!.querySelector(`[name="${radioName}"]:checked`) as HTMLInputElement).value

		const t = await this.listSessions({
			trClickHandler: async (_event: MouseEvent, d: { loc: SessionLocation; id: string }) => {
				const { loc, id } = d
				if (!id) return
				if (loc == 'browser') {
					this.sessionName = id
					const state = structuredClone(this.savedSessions[id])
					if (this.refuses(state)) return
					await preprocessState(state, this.app)
					const targetWindow = getTargetWindow()
					if (targetWindow == 'current') {
						this.app.dispatch({ type: 'app_refresh', state })
					} else if (window.location.origin == this.hostURL) {
						window.open(`/?mass-session-id=${encodeURIComponent(id)}&src=browser`)
					} else {
						if (state.embedder) parentCorsMessage({ state })
						else {
							const { protocol, host, search, origin, href } = window.location
							const embedder = { protocol, host, search, origin, href }
							parentCorsMessage({ state: Object.assign({ embedder }, state) })
						}
					}
					this.clearContent()
				} else if (loc == 'server') {
					const headers = await this.app.vocabApi.mayGetAuthHeaders(this.route)
					const body = { id, route: this.route, dslabel: this.dslabel, embedder: window.location.hostname }
					const res = await dofetch3(`/massSession?`, { headers, body })
					if (!res.state) throw res.error || 'unable to get the cached session from the server'
					if (this.refuses(res.state)) return
					await preprocessState(res.state, this.app)
					this.savedSessions[id] = res.state

					const targetWindow = getTargetWindow()
					if (targetWindow == 'current') {
						this.app.dispatch({ type: 'app_refresh', state: res.state })
					} else if (window.location.origin == this.hostURL) {
						window.open(
							`/?mass-session-id=${encodeURIComponent(id)}&src=cred&dslabel=${encodeURIComponent(
								this.dslabel
							)}&route=${encodeURIComponent(this.route)}`
						)
					} else {
						// server-cached sessions should have an state.embedder object, no need to check
						parentCorsMessage(res)
					}
					this.clearContent()
				}
			}
		})

		t.headtr.select('th').text('Open from')

		// open session from a local file
		const tr1 = t.tbody.insert('tr', 'tr')
		tr1.append('td').style('text-align', 'center').style('padding', '3px 9px').text('Local file')
		const label = tr1.append('td').style('text-align', 'left').append('label')
		label
			.append('span')
			.style('padding', '3px 9px')
			.style('text-decoration', 'underline')
			.style('cursor', 'pointer')
			.text('Choose File')
		label
			.append('input')
			.attr('type', 'file')
			.attr('placeholder', 'file name')
			.style('opacity', 0)
			.style('width', '0.1px')
			.style('height', '0.1px')
			.style('position', 'absolute')
			.on('change', async (event: Event) => {
				const file = (event.target as HTMLInputElement).files!.item(0)!
				const json = await file.text()
				let sessionName: string | null = file.name
				if (this.savedSessions[sessionName]) {
					sessionName = prompt(
						`Leave as-is to overwrite a session with the same name, or enter a different session name.`,
						sessionName
					)
					// the prompt was cancelled
					if (!sessionName) return
				}
				this.sessionName = sessionName
				const state = JSON.parse(json)
				if (this.refuses(state)) return
				await preprocessState(state, this.app)
				this.savedSessions[sessionName] = state
				localStorage.setItem('savedMassSessions', JSON.stringify(this.savedSessions))
				const targetWindow = getTargetWindow()
				if (targetWindow == 'current') {
					this.app.dispatch({ type: 'app_refresh', state })
				} else if (window.location.origin == this.hostURL) {
					window.open(`/?mass-session-id=${encodeURIComponent(sessionName)}&src=browser`)
				} else {
					if (state.embedder) parentCorsMessage({ state })
					else {
						const { protocol, host, search, origin, href } = window.location
						const embedder = { protocol, host, search, origin, href }
						parentCorsMessage({ state: Object.assign({ embedder }, state) })
					}
				}
				this.clearContent()
			})
	}

	async listSessions(opts: { trClickHandler?: any } = {}) {
		const table = this.dom.contentDiv.append('table').attr('class', 'sjpp-controls-table')

		const headtr = table.append('thead').append('tr')
		headtr
			.selectAll('th')
			.data(['Cache Location', 'Session ID'])
			.enter()
			.append('th')
			.style('text-align', (_: string, i: number) => (i === 0 ? 'center' : 'left'))
			.style('padding', '3px 9px')
			.text((d: string) => d)

		const sessionIds: { loc: SessionLocation; id: string }[] = Object.keys(this.savedSessions).map(id => ({
			loc: 'browser',
			id
		}))
		if (!this.serverCachedSessions) await this.setServerCachedSessions()
		sessionIds.push(...(this.serverCachedSessions || []).map(id => ({ loc: 'server' as SessionLocation, id })))

		const tbody = table.append('tbody')
		const trs = tbody
			.selectAll('tr')
			.data(sessionIds)
			.enter()
			.append('tr')
			.on('click', opts.trClickHandler || null)

		trs
			.selectAll('td')
			.data((d: any) => [d, d])
			.enter()
			.append('td')
			.style('text-align', (_: any, i: number) => (i === 0 ? 'center' : 'left'))
			.style('padding', '3px 9px')
			.style('cursor', 'pointer')
			.text((d: any, i: number) => (i === 0 ? d.loc : d.id))

		if (!this.serverCachedSessions?.length && this.requiredAuth && !this.app.vocabApi.hasVerifiedToken()) {
			table
				.append('tbody')
				.append('tr')
				.selectAll('td')
				.data(['server', 'requires sign-in'])
				.enter()
				.append('td')
				.style('text-align', (_: string, i: number) => (i === 0 ? 'center' : 'left'))
				.style('padding', '3px 9px')
				.text((d: string) => d)
		}
		return { table, headtr, tbody, trs }
	}

	/**
	 * Looks up the ids of the sessions that the user saved on the server. This never throws, since the
	 * sessions on the server are optional: the sessions of the browser, and everything else in the mass ui,
	 * must work when the lookup fails, for example from a network error or a failure to get a token.
	 *
	 * Only a successful lookup is kept in serverCachedSessions. It stays undefined when the lookup is not made
	 * because the user is not signed in, or when it fails, so that it is tried again on the next use.
	 * Callers that arrive while a lookup is in progress share it instead of sending another request.
	 */
	setServerCachedSessions(): Promise<void> {
		if (this.serverSessionsRequest) return this.serverSessionsRequest
		// a lookup that is skipped is not shared, since a user that signs in right after it must not reuse it
		if (!this.mayLookupSessions()) return Promise.resolve()
		this.serverSessionsRequest = this.lookupServerSessions().finally(() => {
			this.serverSessionsRequest = undefined
			// Delete is only shown when there is a session to delete, which the lookup may have changed
			this.renderSessionOptions()
		})
		return this.serverSessionsRequest
	}

	/**
	 * Returns true when the sessions on the server should be looked up now. A dataset without a jwt
	 * credential has none, and the lookup is not made, so serverCachedSessions is an empty list.
	 * It is also not made before the user is signed in, when the server would reject the request.
	 */
	mayLookupSessions(): boolean {
		try {
			const state: any = this.app.getState()
			this.requiredAuth = state.termdbConfig?.requiredAuth?.find((a: any) => a.route == this.route && a.type == 'jwt')
			if (!this.requiredAuth) {
				this.serverCachedSessions = []
				return false
			}
			return !!this.app.vocabApi.hasVerifiedToken()
		} catch (e: any) {
			console.warn(`unable to get the sessions saved on the server: ${e?.message || e}`)
			return false
		}
	}

	async lookupServerSessions() {
		try {
			const headers = await this.app.vocabApi.mayGetAuthHeaders(this.route)
			const body = { route: this.route, dslabel: this.dslabel, embedder: window.location.hostname }
			const res = await dofetch3('/sessionIds', { headers, body })
			// an error response is not a list that is empty
			if (!Array.isArray(res?.sessionIds)) throw res?.error || 'unexpected response'
			this.serverCachedSessions = res.sessionIds
		} catch (e: any) {
			console.warn(`unable to get the sessions saved on the server: ${e?.message || e}`)
		}
	}

	async save() {
		const div = this.dom.contentDiv
		const inputDiv = div.append('div')
		inputDiv.append('span').text('Save as')
		const sessionNames = Object.keys(this.savedSessions)
		if (!this.serverCachedSessions) await this.setServerCachedSessions()
		sessionNames.push(...(this.serverCachedSessions || []).filter(d => !sessionNames.includes(d)))
		const placeholder = this.sessionName || 'unnamed-session'
		const input = inputDiv
			.append('input')
			.attr('type', 'text')
			.attr('placeholder', placeholder)
			.style('width', '220px')
			.on('input', () => {
				searchResultDiv.selectAll('*').remove()
				const value = input.property('value')
				const exactMatch = sessionNames.filter(s => s === value)
				const startsWith = sessionNames.filter(s => s.startsWith(value))
				const includes = sessionNames.filter(s => s.includes(value) && s !== value && !startsWith.includes(s))
				searchResultDiv
					.selectAll('div')
					.data([...exactMatch, ...startsWith, ...includes])
					.enter()
					.append('div')
					.attr('class', 'sja_menuoption')
					.attr('data-testid', `sjpp-massnav-user-session-save-option`)
					.text((d: string) => d)
					.on('click', (_: MouseEvent, d: string) => {
						input.property('value', d)
						searchResultDiv.selectAll('*').remove()
					})
			})

		const searchResultDiv = div.append('div')
		const submitDiv = div.append('div')
		submitDiv.append('span').html('Save to&nbsp;')
		submitDiv
			.append('button')
			.style('min-width', '80px')
			.text('Browser')
			.attr(
				'title',
				`Save the session in your current browser's cache. The session can be easily recovered, but not shared among your other devices`
			)
			.on('click', () => {
				this.sessionName = input.property('value') || placeholder
				this.savedSessions[this.sessionName] = this.getState(this.app.getState(), true)
				localStorage.setItem('savedMassSessions', JSON.stringify(this.savedSessions))
				this.renderSessionOptions()
				this.confirmAction(`Cached '${this.sessionName}' in browser`)
			})

		submitDiv
			.append('button')
			.style('min-width', '80px')
			.text('File')
			.attr(
				'title',
				`Save the session into a local file. The session can be easily recoved using the 'Open from local file' option.`
			)
			.on('click', () => {
				const name = input.property('value') || placeholder
				// the file is the copy of the session, which is not kept in this.savedSessions, for the browser
				this.download(name, this.getState(this.app.getState(), true))
				this.confirmAction(`Downloaded '${name}'`)
			})

		// assume that a jwt-type credential will include the user email in the jwt payload,
		// which could be trusted for saving sessions under cachedir/termdbSessions/[embedderHostName]/[email]
		if (this.requiredAuth) {
			const requiresSignIn = this.app.vocabApi.hasVerifiedToken() ? '' : 'Requires sign-in. '
			submitDiv
				.append('button')
				.style('min-width', '80px')
				.text('Server')
				.attr(
					'title',
					`${requiresSignIn}Save the session into a remote server. The session can be easily shared across your different devices and recovered using the 'Open from server' option.`
				)
				.property('disabled', !this.app.vocabApi.hasVerifiedToken())
				.on('click', async () => {
					if (!this.app.vocabApi.hasVerifiedToken()) {
						alert('Requires sign-in')
						return
					}
					const name = input.property('value') || placeholder
					// the state is sent to the server, and is not kept in this.savedSessions, which is for the browser
					const res = await this.getSessionUrl(name)
					if (res.error || res.id != name) {
						sayerror(submitDiv, `Unable to save '${name}' on the server: ${res.error || 'unexpected session id'}`)
						return
					}
					// if the lookup failed, the saved session is found by the next lookup
					if (this.serverCachedSessions && !this.serverCachedSessions.includes(name))
						this.serverCachedSessions.push(name)
					this.renderSessionOptions()
					this.confirmAction(`Saved '${name}' on the server`)
				})
		}
	}

	// true when a saved state is not opened, see sessionForm.ts. the reason is shown
	refuses(state: any) {
		const reason = getSavedStateRefusal(state)
		if (!reason) return false
		this.clearContent()
		this.app.printError(reason)
		return true
	}

	download(name: string, state: any) {
		const ext = name.endsWith('.txt') ? '' : '.txt'
		to_textfile(`${name}${ext}`, JSON.stringify(state))
	}

	/** With a filename, saves the session on the server under that name and returns the response.
	Without one, creates a shareable link and renders it. */
	async getSessionUrl(filename = ''): Promise<any> {
		const headers = await this.app.vocabApi.mayGetAuthHeaders(this.route)
		const state = this.getState(this.app.getState(), true)
		const { protocol, host, search, origin, href } = window.location
		state.embedder = { protocol, host, search, origin, href }
		if (filename) {
			// a non-empty filename value implies saving by email and having auth session,
			// since it's easy for different users to use the same non-random filename
			state.__sessionFor__ = {
				route: this.route,
				filename,
				dslabel: this.dslabel,
				embedder: window.location.hostname
			}
		}
		const res = await dofetch3('/massSession', {
			headers,
			method: 'POST',
			body: JSON.stringify(state)
		})

		if (filename) return res

		const div = this.dom.contentDiv
		if (res.error || !res.id) {
			// for example, a session state that is too large, or a server that does not enable saved sessions
			sayerror(div.append('div'), `Unable to create a session link: ${res.error || 'missing session id'}`)
			return
		}
		const url = `${this.hostURL}/?mass-session-id=${encodeURIComponent(res.id)}&noheader=1`
		const linkDiv = div.append('div').style('margin', '10px')
		linkDiv.append('div').style('display', 'flex').style('margin-bottom', '12px').text(`Open or copy the session link.`)

		const a = linkDiv.append('a').style('display', 'none').attr('href', url).attr('target', '_blank').text(res.id)

		// open button
		linkDiv
			.append('button')
			.style('cursor', 'pointer')
			.text('Open link')
			.on('click', () => {
				a.node()!.click()
			})

		// copy button
		linkDiv
			.append('button')
			.style('cursor', 'pointer')
			.style('margin-left', '10px')
			.text('Copy link')
			.on('click', async (event: MouseEvent) => {
				await navigator.clipboard.writeText(url)
				// the component may have been destroyed while the clipboard was written
				if (!this.dom?.copytip) return
				this.dom.copytip.clear().showunder(event.target)
				this.dom.copytip.d.append('div').html('&#10003;')
				clearTimeout(this.copyTipTimer)
				this.copyTipTimer = setTimeout(() => this.dom?.copytip?.hide(), 1000)
			})

		if (this.hostURL != window.location.origin) {
			// Avoid the multi-window/tab sequence to recover the session:
			// intercept the click on the URL link, so that the embedder URL is opened
			// instead of the hostURL with mass session id, and this window will post
			// a message to the child window with the link data instead
			//
			// NOTE: the multi-window/tab sequence is only necessary when the URL link
			// was not opened by the embedder window
			//
			a.on('click', (event: MouseEvent) => {
				event.preventDefault()
				parentCorsMessage({ state }, 'noredirect')
				return false
			})
		}

		linkDiv.append('div').html(`
							<br>
							<div style="font-size: 1em; opacity:.6">
							<span>NOTES</span>
							<ul>
							<li>A recovered session may hide data or views to users that are not authorized to access the saved datasets or features.</li>
							<li>This session will be saved for ${this.opts.massSessionDuration} days.</li>
							</ul>
							</div>`)
	}

	async delete() {
		const t = await this.listSessions({
			trClickHandler: function (this: any, event: MouseEvent) {
				const input = this.lastChild.querySelector('input')
				const checked = event.target == input ? input.checked : !input.checked
				select(this).style('text-decoration', checked ? 'line-through' : '')
				if (event.target != input) input.checked = checked
				const checkedRows = t.table.node()!.querySelectorAll('input:checked')
				submitBtn.property('disabled', checkedRows.length ? false : true)
			}
		})

		// add a 3rd column for the checkboxes
		t.headtr.append('th').text('Delete')
		t.trs.each(function (this: any, d: any) {
			select(this)
				.append('td')
				.style('text-align', 'center')
				.append('input')
				.attr('type', 'checkbox')
				.attr('value', d.id)
		})

		// left aligned with the table, the content is as wide as the tab
		const submitBtn = this.dom.contentDiv
			.append('div')
			.style('margin-top', '10px')
			.append('button')
			.text('Delete selected sessions')
			.property('disabled', true)
			.on('click', async () => {
				errorDiv.selectAll('*').remove()
				const inputs = t.table.node()!.querySelectorAll('input')
				const sessionIdsDeletedFromServer: string[] = []
				for (const input of inputs) {
					if (select(input).property('checked')) {
						const d = (input.parentNode!.parentNode as any).__data__
						if (d.loc == 'browser') {
							delete this.savedSessions[input.value]
						} else if (d.loc == 'server') {
							sessionIdsDeletedFromServer.push(input.value)
						} else throw `unknown cache location=${d.loc}`
					}
				}
				localStorage.setItem('savedMassSessions', JSON.stringify(this.savedSessions))
				if (sessionIdsDeletedFromServer.length) {
					submitBtn.property('disabled', true)
					let error: any, failedIds: string[] | undefined
					try {
						const headers = await this.app.vocabApi.mayGetAuthHeaders(this.route)
						const errors: string[] = []
						failedIds = []
						for (const ids of getDeletionBatches(sessionIdsDeletedFromServer)) {
							const body = { ids, route: this.route, dslabel: this.dslabel, embedder: window.location.hostname }
							try {
								const res = await dofetch3(`/massSession?`, { method: 'DELETE', headers, body })
								if (res.error) {
									errors.push(res.error)
									// without a list of failed ids, assume that none of the batch was deleted
									failedIds.push(...(res.failedIds || ids))
								}
							} catch (e: any) {
								errors.push(e.message || e)
								failedIds.push(...ids)
							}
						}
						if (errors.length) error = errors.join('; ')
					} catch (e: any) {
						error = e.message || e
						failedIds = sessionIdsDeletedFromServer
					}
					const deletedIds = sessionIdsDeletedFromServer.filter(id => !failedIds?.includes(id))
					this.serverCachedSessions = this.serverCachedSessions?.filter(id => !deletedIds.includes(id))
					if (error) {
						// keep the content open so that the error is visible, and allow a retry of only the failed ids,
						// by removing the rows of deleted sessions while the failed rows remain checked
						t.trs
							.filter((d: any) => (d.loc == 'browser' ? !this.savedSessions[d.id] : deletedIds.includes(d.id)))
							.remove()
						const checkedRows = t.table.node()!.querySelectorAll('input:checked')
						submitBtn.property('disabled', !checkedRows.length)
						sayerror(errorDiv, `Error deleting server session(s): ${error}`)
						this.renderSessionOptions()
						return
					}
				}
				this.renderSessionOptions()
				this.clearContent()
			})

		const errorDiv = this.dom.contentDiv.append('div')
	}

	/** Show a message that fades out, then clear the content */
	confirmAction(message: string) {
		this.clearContent()
		this.dom.contentDiv.append('div').text(message)
		this.dom.contentDiv.transition().delay(3000).duration(1000).style('opacity', 0)
		this.confirmationTimer = setTimeout(() => this.clearContent(), 4000)
	}
}

/*
	ids: session ids to delete from the server

	returns ids[] split into batches, so that each DELETE request URL
	stays below the length limit that dofetch3() allows for a non-GET request,
	since the ids[] are URL-encoded as a request parameter
*/
export function getDeletionBatches(ids: string[]): string[][] {
	// leave room in the URL for the host, path, and the other request parameters
	const maxEncodedIdsLength = 1000
	const batches: string[][] = []
	let batch: string[] = []
	for (const id of ids) {
		if (batch.length && encodeURIComponent(JSON.stringify([...batch, id])).length > maxEncodedIdsLength) {
			batches.push(batch)
			batch = []
		}
		// a single id that is too long will be sent alone, and dofetch3() will throw instead of converting to POST
		batch.push(id)
	}
	if (batch.length) batches.push(batch)
	return batches
}

// may need to edit state based on updated expectations,
// such as new or deprecated plot settings keys/values
async function preprocessState(state: any, app: AppApi) {
	delete state.termdbConfig
	if (state.plots) {
		const promises: Promise<any>[] = []
		for (const plot of state.plots) {
			promises.push(
				(async () => {
					const _ = await importPlot(plot.chartType)
					return await _.getPlotConfig(plot, app)
				})()
			)
		}
		try {
			await Promise.all(promises)
		} catch (e: any) {
			console.error(e)
			app.printError(e)
		}
	}
}

export const userInit = getCompInit(MassUser)
