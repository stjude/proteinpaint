import { getCompInit } from '#rx'
import { Menu } from '#dom/menu'
import { to_textfile } from '#dom/downloadTextfile'
import { dofetch3 } from '#common/dofetch'
import { parentCorsMessage } from '#common/embedder-helpers'
import { select } from 'd3-selection'
import { importPlot } from '#plots/importPlot.js'

class MassSessionBtn {
	constructor() {
		this.type = 'sessionBtn'
		this.route = 'termdb'
		this.embedderOrigin = window.location.origin
		this.hostURL = sessionStorage.getItem('hostURL') || this.embedderOrigin
	}

	async init(appState) {
		const tip = new Menu({ padding: '0px' })
		const copytip = new Menu({ padding: '5px' })
		this.dom = {
			button: this.opts.button,
			tip,
			copytip
		}

		this.dom.button.on('click', () => {
			this.dom.tip.clear()
			this.showMenu()
		})

		this.dslabel = appState.vocab.dslabel
		this.savedSessions = JSON.parse(localStorage.getItem('savedMassSessions') || `{}`)
		this.requiredAuth = appState.termdbConfig?.requiredAuth?.find(a => a.route == this.route && a.type == 'jwt')
	}

	async showMenu() {
		this.dom.tip.clear().d.style('padding', 0)
		const gt = `<span style='margin-left: 24px; float: right'>&gt;</span>`
		const options = [
			{ label: `Open`, title: 'Recover a saved session', callback: this.open },
			{ label: `Save`, title: 'Save the current view', callback: this.save },
			{ label: `Share`, title: 'Share the current view', callback: this.getSessionUrl }
		]

		if (!this.serverCachedSessions) await this.setServerCachedSessions()
		if (Object.keys(this.savedSessions).length || Object.keys(this.serverCachedSessions).length) {
			options.push({ label: `Delete`, title: 'Delete a saved session', callback: this.delete })
		}

		this.dom.tip
			.clear()
			.d.selectAll('.sja_menuoption sja_sharp_border')
			.data(options)
			.enter()
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.attr('aria-label', d => d.title)
			.html(d => d.label)
			.on('click', (event, d) => {
				this.dom.tip.clear().d.style('padding', '10px')
				this.showBackBtn()
				d.callback.call(this)
			})

		this.dom.tip.showunder(this.dom.button.node())
	}

	async open() {
		const radioName = `sjpp-session-open-radio-` + Math.random().toString().slice(-6)
		// always open in the current tab for now, to avoid the tricky part of the code
		// that involves parent-child window messaging
		// TODO: re-enable when the new tab option works reliably
		this.dom.tip.d.append('div').style('display', 'none').style('padding', '3px 9px').html(`
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

		const t = await this.listSessions({
			trClickHandler: async (event, d) => {
				const { loc, id } = d
				if (!id) return
				if (loc.includes('browser')) {
					this.sessionName = id
					const state = structuredClone(this.savedSessions[id])
					await preprocessState(state, this.app)
					const targetWindow = this.dom.tip.d.node().querySelector(`[name="${radioName}"]:checked`).value
					if (targetWindow == 'current') {
						this.app.dispatch({ type: 'app_refresh', state })
					} else if (window.location.origin == this.hostURL) {
						window.open(`/?mass-session-id=${id}&src=browser`)
					} else {
						if (state.embedder) parentCorsMessage({ state })
						else {
							const { protocol, host, search, origin, href } = window.location
							const embedder = { protocol, host, search, origin, href }
							parentCorsMessage({ state: Object.assign({ embedder }, state) })
						}
					}
					this.dom.tip.hide()
				} else if (loc == 'server') {
					const headers = this.app.vocabApi.mayGetAuthHeaders(this.route)
					const body = { id, route: this.route, dslabel: this.dslabel, embedder: window.location.hostname }
					const res = await dofetch3(`/massSession?`, { headers, body })
					if (!res.state) throw res.error || 'unable to get the cached session from the server'
					await preprocessState(res.state, this.app)
					this.savedSessions[id] = res.state

					const targetWindow = this.dom.tip.d.node().querySelector(`[name="${radioName}"]:checked`).value
					if (targetWindow == 'current') {
						this.app.dispatch({ type: 'app_refresh', state: res.state })
					} else if (window.location.origin == this.hostURL) {
						window.open(`/?mass-session-id=${id}&src=cred&dslabel=${this.dslabel}&route=${this.route}`)
					} else {
						// server-cached sessions should have an state.embedder object, no need to check
						parentCorsMessage(res)
					}
					this.dom.tip.hide()
				}
			}
		})

		t.headtr.select('th').html('Open from')

		// open session from a local file
		const tr1 = t.tbody.insert('tr', 'tr')
		tr1.append('td').style('text-align', 'center').style('padding', '3px 9px').html('Local file')
		const label = tr1.append('td').style('text-align', 'left').append('label')
		label
			.append('span')
			.style('padding', '3px 9px')
			.style('text-decoration', 'underline')
			.style('cursor', 'pointer')
			.html('Choose File')
		label
			.append('input')
			.attr('type', 'file')
			.attr('placeholder', 'file name')
			.style('opacity', 0)
			.style('width', '0.1px')
			.style('height', '0.1px')
			.style('position', 'absolute')
			.on('change', async () => {
				const file = event.target.files.item(0)
				const json = await file.text()
				let sessionName = file.name
				if (this.savedSessions[sessionName]) {
					sessionName = prompt(
						`Leave as-is to overwrite a session with the same name, or enter a different session name.`,
						sessionName
					)
				}
				this.sessionName = sessionName
				const state = JSON.parse(json)
				await preprocessState(state, this.app)
				this.savedSessions[sessionName] = state
				localStorage.setItem('savedMassSessions', JSON.stringify(this.savedSessions))
				const targetWindow = this.dom.tip.d.node().querySelector(`[name="${radioName}"]:checked`).value
				if (targetWindow == 'current') {
					this.app.dispatch({ type: 'app_refresh', state })
				} else if (window.location.origin == this.hostURL) {
					window.open(`/?mass-session-id=${sessionName}&src=browser`)
				} else {
					if (state.embedder) parentCorsMessage({ state })
					else {
						const { protocol, host, search, origin, href } = window.location
						const embedder = { protocol, host, search, origin, href }
						parentCorsMessage({ state: Object.assign({ embedder }, state) })
					}
				}
				this.dom.tip.hide()
			})
	}

	async listSessions(opts = {}) {
		const table = this.dom.tip.d.append('table').attr('class', 'sjpp-controls-table')

		const headtr = table.append('thead').append('tr')
		headtr
			.selectAll('th')
			.data(['Cache Location', 'Session ID'])
			.enter()
			.append('th')
			.style('text-align', (d, i) => (i === 0 ? 'center' : 'left'))
			.style('padding', '3px 9px')
			.html(d => d)

		const sessionIds = Object.keys(this.savedSessions).map(id => ({ loc: 'browser', id }))
		if (!this.serverCachedSessions) await this.setServerCachedSessions()
		sessionIds.push(...this.serverCachedSessions.map(id => ({ loc: 'server', id })))

		const tbody = table.append('tbody')
		const trs = tbody
			.selectAll('tr')
			.data(sessionIds)
			.enter()
			.append('tr')
			.on('click', opts.trClickHandler || null)

		trs
			.selectAll('td')
			.data(d => [d, d])
			.enter()
			.append('td')
			.style('text-align', (d, i) => (i === 0 ? 'center' : 'left'))
			.style('padding', '3px 9px')
			.style('cursor', 'pointer')
			.html((d, i) => (i === 0 ? d.loc : d.id))

		if (!this.serverCachedSessions.length && this.requiredAuth && !this.app.vocabApi.hasVerifiedToken()) {
			const tbody2 = table
				.append('tbody')
				.append('tr')
				.selectAll('td')
				.data(['server', 'requires sign-in'])
				.enter()
				.append('td')
				.style('text-align', (d, i) => (i === 0 ? 'center' : 'left'))
				.style('padding', '3px 9px')
				.html(d => d)
		}
		return { table, headtr, tbody, trs }
	}

	async setServerCachedSessions() {
		const state = this.app.getState()
		this.requiredAuth = state.termdbConfig?.requiredAuth?.find(a => a.route == this.route && a.type == 'jwt')
		if (!this.requiredAuth) {
			this.serverCachedSessions = []
			return
		}
		const headers = this.app.vocabApi.mayGetAuthHeaders(this.route)
		const body = { route: this.route, dslabel: this.dslabel, embedder: window.location.hostname }
		const res = await dofetch3('/sessionIds', { headers, body })
		this.serverCachedSessions = res.sessionIds || []
	}

	async save(d) {
		const div = this.dom.tip.d
		const inputDiv = div.append('div')
		inputDiv.append('span').html('Save as')
		const sessionNames = Object.keys(this.savedSessions)
		if (!this.serverCachedSessions) await this.setServerCachedSessions()
		sessionNames.push(...this.serverCachedSessions.filter(d => !sessionNames.includes(d)))
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
					.html(d => d)
					.on('click', (event, d) => {
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
			.html('Browser')
			.attr(
				'title',
				`Save the session in your current browser's cache. The session can be easily recovered, but not shared among your other devices`
			)
			.on('click', () => {
				this.sessionName = input.property('value') || placeholder
				this.savedSessions[this.sessionName] = this.app.getState()
				localStorage.setItem('savedMassSessions', JSON.stringify(this.savedSessions))
				this.confirmAction(`Cached '<b>${this.sessionName}</b>' in browser`)
			})

		submitDiv
			.append('button')
			.style('min-width', '80px')
			.html('File')
			.attr(
				'title',
				`Save the session into a local file. The session can be easily recoved using the 'Open from local file' option.`
			)
			.on('click', () => {
				const name = input.property('value') || placeholder
				this.savedSessions[name] = this.app.getState()
				this.download(name)
				this.confirmAction(`Downloaded '<b>${name}</b>'`)
			})

		// assume that a jwt-type credential will include the user email in the jwt payload,
		// which could be trusted for saving sessions under cachedir/termdbSessions/[embedderHostName]/[email]
		if (this.requiredAuth) {
			const requiresSignIn = this.app.vocabApi.hasVerifiedToken() ? '' : 'Requires sign-in. '
			submitDiv
				.append('button')
				.style('min-width', '80px')
				.html('Server')
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
					this.savedSessions[name] = this.app.getState()
					const res = await this.getSessionUrl(name)
					if (res.id != name) throw `error saving ${name}`
					// this.download(name)
					this.confirmAction(`Saved '<b>${name}</b>' on the server`)
				})
		}
	}

	download(name = '') {
		const sessionName = name || this.sessionName
		const ext = sessionName?.endsWith('.txt') ? '' : '.txt'
		const filename = `${sessionName}${ext}`
		to_textfile(filename, JSON.stringify(this.savedSessions[sessionName]))
	}

	async getSessionUrl(filename = '') {
		const headers = this.app.vocabApi.mayGetAuthHeaders('termdb')
		const state = structuredClone(this.app.getState())
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

		if (filename) {
			return res
		} else {
			const url = `${this.hostURL}/?mass-session-id=${res.id}&noheader=1`
			this.dom.tip.showunder(this.dom.button.node())
			const linkDiv = this.dom.tip.d.append('div').style('margin', '10px')
			linkDiv
				.append('div')
				.style('display', 'flex')
				.style('margin-bottom', '12px')
				.html(`Open or copy the session link.`)

			const a = linkDiv.append('a').style('display', 'none').attr('href', url).attr('target', '_blank').html(res.id)

			// open button
			linkDiv
				.append('button')
				.style('cursor', 'pointer')
				.text('Open link')
				.on('click', () => {
					a.node().click()
				})

			// copy button
			linkDiv
				.append('button')
				.style('cursor', 'pointer')
				.style('margin-left', '10px')
				.text('Copy link')
				.on('click', async event => {
					await navigator.clipboard.writeText(url)
					this.dom.copytip.clear().showunder(event.target)
					this.dom.copytip.d.append('div').html('&#10003;')
					setTimeout(() => {
						this.dom.copytip.hide()
					}, 1000)
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
				a.on('click', event => {
					event.preventDefault()
					parentCorsMessage({ state }, 'noredirect')
					return false
				})
			}

			linkDiv.append('div').html(`
					<br>
					<div style="max-width: 400px; font-size: 1em; opacity:.6">
					<span>NOTES</span>
					<ul>
					<li>A recovered session may hide data or views to users that are not authorized to access the saved datasets or features.</li>
					<li>This session will be saved for ${this.opts.massSessionDuration} days.</li>
					</ul>
					</div>`)
			setTimeout(() => {
				this.dom.button.property('disabled', false)
			}, 1000)
		}
	}

	async delete() {
		const t = await this.listSessions({
			trClickHandler: function (event) {
				const input = this.lastChild.querySelector('input')
				const checked = event.target == input ? input.checked : !input.checked
				select(this).style('text-decoration', checked ? 'line-through' : '')
				if (event.target != input) input.checked = checked
				const checkedRows = t.table.node().querySelectorAll('input:checked')
				submitBtn.property('disabled', checkedRows.length ? false : true)
			}
		})

		// add a 3rd column for the checkboxes
		t.headtr.append('th').html('Delete')
		t.trs.each(function (d) {
			select(this)
				.append('td')
				.style('text-align', 'center')
				.append('input')
				.attr('type', 'checkbox')
				.attr('value', d.id)
		})

		const submitBtn = this.dom.tip.d
			.append('div')
			.style('text-align', 'center')
			.append('button')
			.html('Delete selected sessions')
			.property('disabled', true)
			.on('click', async () => {
				const inputs = t.table.node().querySelectorAll('input')
				const sessionIdsDeletedFromServer = []
				for (const input of inputs) {
					if (select(input).property('checked')) {
						const d = input.parentNode.parentNode.__data__
						if (d.loc == 'browser') {
							delete this.savedSessions[input.value] //checkedIds.push(input.value)
						} else if (d.loc == 'server') {
							delete this.serverCachedSessions[input.value]
							sessionIdsDeletedFromServer.push(input.value)
						} else throw `unknown cache location=${d.loc}`
					}
				}
				localStorage.setItem('savedMassSessions', JSON.stringify(this.savedSessions))
				try {
					const headers = this.app.vocabApi.mayGetAuthHeaders('termdb')
					const body = {
						ids: sessionIdsDeletedFromServer,
						route: this.route,
						dslabel: this.dslabel,
						embedder: window.location.hostname
					}
					const res = dofetch3(`/massSession?`, { method: 'DELETE', headers, body })
				} catch (e) {
					throw e
				}
				this.dom.tip.hide()
			})
	}

	showBackBtn() {
		this.dom.tip.d
			.append('div')
			.attr('class', 'sja_clbtext2')
			.style('margin-bottom', '10px')
			.style('cursor', 'pointer')
			.html(`&lt; Session Menu`)
			.on('click', () => this.showMenu())
	}

	confirmAction(html) {
		this.dom.tip.clear().d.append('div').html(html).transition().delay(3000).duration(1000).style('opacity', 0)

		setTimeout(() => {
			this.dom.tip.hide()
		}, 3500)
	}
}

// may need to edit state based on updated expectations,
// such as new or deprecated plot settings keys/values
async function preprocessState(state, app) {
	delete state.termdbConfig
	if (state.plots) {
		const promises = []
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
		} catch (e) {
			console.log(e)
			app.printError(e)
		}
	}
}

export const sessionBtnInit = getCompInit(MassSessionBtn)
