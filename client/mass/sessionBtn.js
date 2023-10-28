import { getCompInit } from '#rx'
import { Menu } from '#dom/menu'
import { to_textfile } from '#dom/downloadTextfile'
import { dofetch3 } from '#common/dofetch'

class MassSessionBtn {
	constructor() {
		this.type = 'sessionBtn'
		this.route = 'termdb'
		this.embedderOrigin = window.location.origin
		this.hostURL = sessionStorage.getItem('hostURL') || this.embedderOrigin
	}

	async init(appState) {
		const tip = new Menu({ padding: '0px' })
		this.dom = {
			button: this.opts.button,
			tip
		}

		this.dom.button.on('click', () => {
			this.dom.tip.clear()
			this.showMenu()
		})

		this.savedSessions = JSON.parse(localStorage.getItem('savedMassSessions') || `{}`)
		this.requiredAuth = appState.termdbConfig?.requiredAuth?.find(a => a.route == this.route && a.type == 'jwt')
	}

	showMenu() {
		this.dom.tip.clear().d.style('padding', 0)
		const gt = `<span style='margin-left: 24px; float: right'>&gt;</span>`
		const options = [
			{ label: `Open ${gt}`, callback: this.open },
			{ label: `Save ${gt}`, callback: this.save },
			{ label: `Share ${gt}`, callback: this.share }
			//{ label: 'Download', callback: this.download }
		]

		this.dom.tip
			.clear()
			.d.selectAll('.sja_menuoption sja_sharp_border')
			.data(options)
			.enter()
			.append('div')
			.attr('class', 'sja_menuoption sja_sharp_border')
			.html(d => d.label)
			.on('click', (event, d) => {
				this.dom.tip.clear().d.style('padding', '10px')
				this.showBackBtn()
				d.callback.call(this)
			})

		this.dom.tip.showunder(this.dom.button.node())
	}

	async open() {
		this.dom.tip.d.append('div').style('padding', '3px 5px').style('font-weight', 600).html('Open a session from')
		const table = this.dom.tip.d.append('table')

		const tr0 = table.append('tr')
		tr0.append('td').style('padding', '3px 5px').html('Browser cache:')
		const sessionNames = Object.keys(this.savedSessions)
		if (!this.sessionName) sessionNames.unshift('')
		const select = tr0
			.append('td')
			.append('select')
			.style('min-width', '180px')
			.on('change', event => {
				const name = select.property('value')
				if (!name) return
				this.sessionName = name
				const state = this.savedSessions[name]
				this.app.dispatch({ type: 'app_refresh', state })
				this.dom.tip.hide()
			})

		select
			.selectAll('option')
			.data(sessionNames)
			.enter()
			.append('option')
			.html(d => d)
			.attr('value', d => d)
			.property('selected', d => d === this.sessionName)

		const tr1 = table.append('tr')
		tr1.append('td').style('padding', '3px 5px').html('Local file:')
		const label = tr1.append('td').append('label')

		label.append('span').style('text-decoration', 'underline').style('cursor', 'pointer').html('Choose File')

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
				this.savedSessions[file.name] = state
				this.app.dispatch({ type: 'app_refresh', state })
				this.dom.tip.hide()
			})

		const state = this.app.getState()
		this.requiredAuth = state.termdbConfig?.requiredAuth?.find(a => a.route == this.route && a.type == 'jwt')
		if (this.requiredAuth) {
			const tr2 = table.append('tr')
			tr2.append('td').style('padding', '3px 5px').html('Server: ')
			if (!this.app.vocabApi.hasVerifiedToken()) {
				tr2.append('td').style('padding', '3px 5px').html('Requires sign-in')
			} else {
				const select = tr2
					.append('td')
					.append('select')
					.style('min-width', '180px')
					.on('change', async event => {
						const id = select.property('value')
						if (!id) return
						console.log(133, id)
						const headers = this.app.vocabApi.mayGetAuthHeaders(this.route)
						const body = { id, route: this.route, dslabel: state.vocab.dslabel, embedder: window.location.hostname }
						const res = await dofetch3(`/massSession?`, { headers, body })
						if (!res.state) throw res.error || 'unable to get the cached session from the server'
						this.savedSessions[id] = res.state
						this.app.dispatch({ type: 'app_refresh', state: res.state })
						this.dom.tip.hide()
					})

				if (!this.serverCachedSessions) {
					const headers = this.app.vocabApi.mayGetAuthHeaders(this.route)
					const body = { route: this.route, dslabel: state.vocab.dslabel, embedder: window.location.hostname }
					const res = await dofetch3('/sessionIds', { headers, body })
					this.serverCachedSessions = res.sessionIds
				}

				select
					.selectAll('option')
					.data(['', ...this.serverCachedSessions])
					.enter()
					.append('option')
					.html(d => d)
					.attr('value', d => d)
					.property('selected', d => d === this.sessionName)
			}
		}
	}

	save(d) {
		const div = this.dom.tip.d
		const inputDiv = div.append('div')
		inputDiv.append('span').html('Save as')
		const sessionNames = Object.keys(this.savedSessions)
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
			.on('click', () => {
				const name = input.property('value') || placeholder
				this.savedSessions[name] = this.app.getState()
				this.download(name)
				this.confirmAction(`Downloaded '<b>${name}</b>'`)
			})

		// assume that a jwt-type credential will include the user email in the jwt payload,
		// which could be trusted for saving sessions under cachedir/termdbSessions/[embedderHostName]/[email]
		if (this.requiredAuth) {
			submitDiv
				.append('button')
				.style('min-width', '80px')
				.html('Server')
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

	async share() {
		this.dom.tip.d.append('div').style('max-width', '300px').html(`<b>Share this session:</b>`)

		this.dom.tip.d
			.append('button')
			.style('margin', '10px')
			.html('Get URL link')
			.on('click', () => this.getSessionUrl())

		this.dom.tip.d
			.append('div')
			.style('max-width', '300px')
			.html(
				`NOTE: A recovered session may hide data or views to users that are not authorized to access the saved datasets or features.`
			)

		// TODO: should filter the targets based on various checks including signed-in status, etc;
		// this can reuse the current /massSession route as applicable/appropriate
		// const targets = [window.location.hostname]
		// if (targets[0].includes('localhost')) targets.push('ppr', 'pp-irt')
		// if (targets[0].includes('proteinpaint.stjude.org')) targets.push('proteinpaint.stjude.org')
		// this.dom.tip.d
		// 	.append('ul')
		// 	.selectAll('li')
		// 	.data(targets)
		// 	.enter()
		// 	.append('li')
		// 	.style('cursor', 'pointer')
		// 	.html(d => d)
		// 	.on('click', () => {
		// 		alert('TODO!!!')
		// 	})
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
				dslabel: state.vocab.dslabel,
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
			this.dom.tip.clear().showunder(this.dom.button.node())
			this.dom.tip.d
				.append('div')
				.style('margin', '10px')
				.html(
					`<a href='${url}' target=_blank>${res.id}</a><br><div style="font-size:.8em;opacity:.6"><span>Click the link to recover this session. Bookmark or share this link.</span><br><span>This session will be saved for ${this.opts.massSessionDuration} days.</span></div>`
				)
			setTimeout(() => {
				this.dom.button.property('disabled', false)
			}, 1000)
		}
	}

	showBackBtn() {
		this.dom.tip.d
			.append('div')
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

export const sessionBtnInit = getCompInit(MassSessionBtn)
