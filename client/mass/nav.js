import { getCompInit, multiInit } from '#rx'
import { recoverInit } from '../rx/src/recover'
import { searchInit } from './search'
import { chartsInit } from './charts'
import { groupsInit } from './groups'
import { select } from 'd3-selection'
import { dofetch3 } from '#common/dofetch'
import { Menu } from '#dom/menu'
import { getFilterItemByTag, filterRxCompInit } from '#filter/filter'
import { renderTable } from '#dom/table'

/*
nav {}
	.tabs[]

todo: steps to add a new tab
*/

// to be used for assigning unique
// radio button names by object instance
// otherwise termdp app popups
let instanceNum = 0

// to distinguish from IDs assigned by other code or users
const idPrefix = '_MASS_AUTOID_' + Math.random().toString().slice(-6)
let id = (+new Date()).toString().slice(-8)

const headtip = new Menu({ padding: '0px', offsetX: 0, offsetY: 0 })
headtip.d.style('z-index', 5555)
// headtip must get a crazy high z-index so it can stay on top of all, no matter if server config has base_zindex or not

// data elements for navigation header tabs
const cohortTab = { top: 'COHORT', mid: 'NONE', btm: '', subheader: 'cohort' }
const chartTab = { top: 'CHARTS', mid: 'NONE', btm: '', subheader: 'charts' }
const groupsTab = { top: 'GROUPS', mid: 'NONE', btm: '', subheader: 'groups' }
const filterTab = { top: 'FILTER', mid: 'NONE', btm: '', subheader: 'filter' }
const cartTab = { top: 'CART', mid: 'NONE', btm: '', subheader: 'cart' }

export function getId() {
	return idPrefix + '_' + id++
}

class TdbNav {
	constructor(opts) {
		this.type = 'nav'
		this.instanceNum = instanceNum++
		this.activeTab = 0 // 0 = cohort tab if present, otherwise charts tab
		this.activeCohort = 0 // -1 = unselected, 0,1,2... = selected
		this.searching = false
		this.samplecounts = {}
		this.massSessionDuration = opts.massSessionDuration
		this.sessionDaysLeft = opts.app.opts.sessionDaysLeft || null
		this.sessionId = opts.app.opts.sessionId || null
		setInteractivity(this)
		setRenderers(this)
	}

	async init(appState) {
		try {
			this.cohortFilter = getFilterItemByTag(appState.termfilter.filter, 'cohortFilter')
			this.initUI(appState)
			this.initCohort(appState)
			this.components = await multiInit({
				search: searchInit({
					app: this.app,
					holder: this.dom.searchDiv,
					usecase: { target: 'barchart', detail: 'term' }
				}),
				filter: filterRxCompInit({
					app: this.app,
					vocabApi: this.app.vocabApi,
					holder: this.dom.subheader.filter.append('div'),
					hideLabel: this.opts.header_mode === 'with_tabs',
					emptyLabel: '+Add new filter',
					callback: filter => {
						this.app.dispatch({
							type: 'filter_replace',
							filter
						})
					}
				}),
				charts: chartsInit({
					app: this.app,
					holder: this.dom.subheader.charts,
					vocab: this.opts.vocab
				}),
				groups: groupsInit({
					app: this.app,
					holder: this.dom.subheader.groups,
					vocab: this.opts.vocab
				}),
				recover: recoverInit({
					app: this.app,
					holder: this.dom.recoverDiv,
					// TODO: ???? may limit the tracked state to only the filter, activeCohort ???
					getState: appState => appState,
					reactsTo: action => action.type != 'plot_edit',
					maxHistoryLen: 5
				})
			})
			this.mayShowMessage_sessionDaysLeft()
		} catch (e) {
			throw e
		}
	}

	reactsTo(action) {
		if (action.type.includes('cache_termq')) return true
		if (action.type.startsWith('filter')) return true
		if (action.type.startsWith('cohort')) return true
		if (action.type.startsWith('tab')) return true
		if (action.type == 'plot_create') return true
		if (action.type == 'plot_delete') return true
		if (action.type == 'app_refresh') return true
		if (action.type.endsWith('_customTerm')) return true
		if (action.type.endsWith('_group')) return true
	}

	getState(appState) {
		return {
			searching: this.searching, // for detection of internal state change
			nav: appState.nav,
			activeCohort: appState.activeCohort,
			termdbConfig: appState.termdbConfig,
			filter: appState.termfilter.filter,
			plots: appState.plots,
			groups: appState.groups
		}
	}

	async main() {
		this.dom.tabDiv.style('display', this.state.nav.header_mode === 'with_tabs' ? 'inline-block' : 'none')
		this.dom.tip.hide()
		this.activeTab = this.state.nav.activeTab
		this.prevCohort = this.activeCohort
		this.activeCohort = +this.state.activeCohort
		this.filterUiRoot = getFilterItemByTag(this.state.filter, 'filterUiRoot')
		this.cohortFilter = getFilterItemByTag(this.state.filter, 'cohortFilter')
		if (this.cohortNames) {
			this.activeCohortName = this.cohortNames[this.activeCohort]
			if (this.activeCohort !== -1)
				this.activeCohortLabel = this.state.termdbConfig.selectCohort.values[this.activeCohort].shortLabel
		}
		this.filterJSON = JSON.stringify(this.state.filter)

		this.cohortsData = await this.app.vocabApi.getCohortsData()

		if (this.state.nav.header_mode === 'with_tabs') {
			if (!(this.activeCohortName in this.samplecounts)) {
				this.samplecounts[this.activeCohortName] = await this.app.vocabApi.getCohortSampleCount(this.activeCohortName)
			}
			if (!(this.filterJSON in this.samplecounts)) {
				if (!this.filterUiRoot || !this.filterUiRoot.lst.length) {
					this.samplecounts[this.filterJSON] = this.samplecounts[this.activeCohortName]
				} else {
					const n = await this.app.vocabApi.getFilteredSampleCount(this.filterJSON)
					this.samplecounts[this.filterJSON] = n
				}
			}
		}
		this.updateUI()
	}
}

export const navInit = getCompInit(TdbNav)

function setRenderers(self) {
	self.initUI = appState => {
		const header = self.opts.holder.append('div').style('white-space', 'nowrap')
		const tabDiv = header.append('div').style('display', 'none').style('vertical-align', 'bottom')
		const controlsDiv = header
			//Fix for adding message underneath the search bar and buttons
			.append('div')
			.style('vertical-align', 'top')
			.style('margin', '10px')
			.style('display', 'inline-block')
		self.opts.holder.attr('class', 'sjpp-nav')
		self.dom = {
			holder: self.opts.holder,
			header,
			tabDiv,
			controlsDiv,
			searchDiv: controlsDiv
				.append('div')
				//.style('display', 'none')
				.style('margin', '10px'),
			sessionDiv: controlsDiv.append('div').style('display', 'inline-block'),
			recoverDiv: controlsDiv.append('div').style('display', 'inline-block'),
			helpDiv: controlsDiv.append('div').style('display', 'none'),
			sessionElapsedMessageDiv: controlsDiv.append('div').style('display', 'none'),
			subheaderDiv: self.opts.holder
				.append('div')
				.style('display', 'block')
				.style('padding-top', '5px')
				.style('border-bottom', '1px solid #000'),
			messageDiv: self.opts.holder.append('div').style('margin', '30px').style('display', 'none'),
			tip: new Menu({ padding: '5px' })
		}

		if (self.opts.header_mode === 'with_cohortHtmlSelect') {
			// not part of filter div
			self.dom.cohortStandaloneDiv = header
				.append('div')
				.style('display', 'inline-block')
				.style('margin', '10px')
				.style('vertical-align', 'top')

			self.dom.cohortStandaloneDiv.append('label').html('Cohort: ')
			self.dom.cohortSelect = self.dom.cohortStandaloneDiv.append('select').on('change', function () {
				self.app.dispatch({ type: 'cohort_set', activeCohort: +this.value })
			})

			self.dom.cohortSelect
				.selectAll('option')
				.data(appState.termdbConfig.selectCohort.values)
				.enter()
				.append('option')
				.attr('value', (d, i) => i)
				.property('selected', (d, i) => i === appState.activeCohort)
				.html(d => d.shortLabel)
		}

		self.dom.subheader = Object.freeze({
			search: self.dom.subheaderDiv.append('div').style('display', 'none'),
			groups: self.dom.subheaderDiv.append('div').style('display', 'none'),
			charts: self.dom.subheaderDiv.append('div').style('display', 'none'),
			cohort: self.dom.subheaderDiv.append('div').style('display', 'none'),
			filter: self.dom.subheaderDiv.append('div').style('display', 'none'),
			cart: self.dom.subheaderDiv
				.append('div')
				.style('display', 'none')
				.html('<br/>Cart feature under construction - work in progress<br/>&nbsp;<br/>')
		})

		self.tabs = [chartTab, groupsTab, filterTab /*, cartTab*/]
		if (appState.termdbConfig.selectCohort) self.tabs.unshift(cohortTab) // dataset has "sub-cohorts", show the Cohort tab at the beginning

		const table = self.dom.tabDiv.append('table').style('border-collapse', 'collapse')

		// using a table layout for tabs, iterate through each tab
		// once for each of [top, mid, btm] row
		table
			.selectAll('tr')
			.data(['top', 'mid', 'btm'])
			.enter()
			.append('tr')
			.style('font-size', (d, i) => (i == 1 ? '20px' : '12px'))
			.selectAll('td')
			.data((key, i) =>
				self.tabs.map((row, colNum) => {
					return { rowNum: i, key, colNum, label: row[key], subheader: row.subheader }
				})
			)
			.enter()
			.append('td')
			// hide the cohort tab until there is termdbConfig.selectCohort
			.style('display', 'none') // d => (d.colNum === 0 || self.activeCohort !== -1 ? '' : 'none'))
			.style('width', '100px')
			.style('padding', d => (d.rowNum === 0 ? '12px 12px 3px 12px' : '3px 12px'))
			.style('text-align', 'center')
			.style('border-left', '1px solid #ccc')
			.style('border-right', '1px solid #ccc')
			.style('color', '#aaa')
			.style('cursor', 'pointer')
			.html(d => d.label)
			.on('click', self.setTab)

		self.dom.trs = table.selectAll('tr')
		self.dom.tds = table.selectAll('td')
		self.subheaderKeys = self.tabs.map(d => d.subheader)

		self.dom.saveBtn = self.dom.sessionDiv
			.append('button')
			.style('margin', '10px')
			.text('New Session')
			.on('click', self.getSessionUrl)

		if (self.sessionDaysLeft != null) {
			//Only show if called from `mass-session-id` URL
			self.dom.fileBtn = self.dom.sessionDiv
				.append('button')
				.style('margin', '10px')
				.text('Export Session')
				.on('click', event => {
					self.getSessionFile(event)
				})
		}

		const helpPages = appState.termdbConfig.helpPages
		if (helpPages) {
			// if help pages are defined, then show a help button
			self.dom.helpBtn = self.dom.helpDiv
				.style('display', 'inline-block')
				.append('button')
				.style('margin', '10px')
				.html('Help &#9660;')
				.on('click', event => {
					const p = event.target.getBoundingClientRect()
					const div = headtip
						.clear()
						.show(p.left - 0, p.top + p.height + 5)
						.d.append('div')
					for (const page of helpPages) {
						div
							.append('div')
							.style('margin', '15px')
							.append('a')
							.attr('href', page.url)
							.attr('target', '_blank')
							.text(page.label)
					}
				})
		}
	}

	self.mayShowMessage_sessionDaysLeft = () => {
		if (!Number.isFinite(self.sessionDaysLeft)) {
			// info not available, do not show msg
			return
		}
		self.dom.sessionElapsedMessageDiv.style('display', 'block')
		self.dom.remainingDaysMessage = self.dom.sessionElapsedMessageDiv
			.append('div')
			.style('display', 'block')
			.style('opacity', '0.65')
			.html(
				`<u>${self.sessionDaysLeft} days</u> left till this session is removed. Click the New Session button to create a new one.`
			)
	}

	self.updateUI = async (toggleSubheaderdiv = false) => {
		if (!self.dom.subheaderDiv) return
		if (self.activeTab && self.state.termdbConfig.selectCohort && self.activeCohort == -1) {
			// showing charts or filter tab; cohort selection is enabled but no cohort is selected
			self.dom.subheaderDiv.style('display', 'none')
			self.dom.messageDiv.selectAll('text').remove()
			self.dom.messageDiv.style('display', '').text('No cohort selected. Please select a cohort in the "COHORT" tab.')
		} else {
			let display = 'block'
			if (toggleSubheaderdiv) {
				display = self.dom.subheaderDiv.style('display') == 'none' ? 'block' : 'none'
			}
			if (self.dom.subheaderDiv) self.dom.subheaderDiv.style('display', display)
			if (self.dom.messageDiv) self.dom.messageDiv.style('display', 'none')
		}
		const selectCohort = self.state.termdbConfig.selectCohort
		self.dom.searchDiv.style('display', selectCohort && self.activeCohort == -1 ? 'none' : 'inline-block')
		//self.dom.holder.style('margin-bottom', self.state.nav.header_mode === 'with_tabs' ? '20px' : '')//To be checked why it was needed
		self.dom.header.style('border-bottom', self.state.nav.header_mode === 'with_tabs' ? '1px solid #000' : '')
		self.dom.tds
			.style('display', '')
			.style('color', d => (d.colNum == self.activeTab ? '#000' : '#aaa'))
			.style('background-color', d => (d.colNum == self.activeTab ? '#ececec' : 'transparent'))
			.html(function (d, i) {
				if (d.key == 'top') return this.innerHTML

				if (d.subheader == 'groups') {
					if (d.key == 'mid') return self.state.groups.length || 'NONE'
					return ''
				}

				if (d.subheader === 'charts') {
					const n = self.state.plots.length
					if (d.key == 'mid') return !n ? 'NONE' : n
					else return ''
				} else if (d.subheader === 'cohort') {
					if (self.activeCohortName && self.activeCohortName in self.samplecounts) {
						return d.key == 'top'
							? this.innerHTML
							: d.key == 'mid'
							? self.activeCohortLabel
							: 'n=' + self.samplecounts[self.activeCohortName]
					} else {
						return d.key == 'mid' ? 'NONE' : this.innerHTML // d.key == 'mid' ? '<span style="font-size: 16px; color: red">SELECT<br/>BELOW</span>' : ''
					}
				} else if (d.subheader === 'filter') {
					const filter = self.filterUiRoot ? self.filterUiRoot : { lst: [] }
					if (filter.lst.length === 0) {
						return d.key === 'mid'
							? 'NONE'
							: self.samplecounts['undefined']
							? `n=${self.samplecounts['undefined']}`
							: ''
					} else {
						const n = self.samplecounts[self.filterJSON] != undefined ? 'n=' + self.samplecounts[self.filterJSON] : ''
						return d.key === 'mid' ? filter.lst.length : n
					}
				} else {
					return d.key === 'mid' ? this.innerHTML : '&nbsp;'
				}
			})

		const visibleSubheaders = []
		for (const key in self.dom.subheader) {
			self.dom.subheader[key].style('display', self.tabs[self.activeTab].subheader === key ? 'block' : 'none')
		}
		self.renderCohortsTable()

		if (self.opts.header_mode === 'with_cohort_select') {
			self.dom.cohortSelect.selectAll('option').property('value', appState.activeCohort)
		}
	}

	self.renderCohortsTable = () => {
		if (!self.dom.cohortTable) return
		self.dom.cohortTable.selectAll('*').remove()
		const columns = [{ label: 'Feature' }]
		const rows = []
		const result = self.cohortsData
		if ('error' in result) throw result.error
		for (const feature of result.features) rows.push([{ value: feature.name }])
		for (const cohort of result.cohorts) {
			columns.push({ label: cohort.cohort ? `${cohort.name} (${cohort.cohort})` : cohort.name })
			for (const [i, feature] of result.features.entries()) {
				const cf = result.cfeatures.find(cf => cf.idfeature === feature.idfeature && cf.cohort === cohort.cohort)
				if (cf) rows[i].push({ value: cf.value })
			}
		}

		renderTable({
			rows,
			columns,
			div: self.dom.cohortTable,
			showLines: false,
			maxHeight: '60vh'
		})

		self.dom.cohortTable.select('table').style('border-collapse', 'collapse')
		self.dom.cohortTable.selectAll(`tbody > tr > td`).style('background-color', 'transparent')
		const selectCohort = self.state.termdbConfig.selectCohort
		const keys = selectCohort.values[self.activeCohort].keys
		let selector = `tbody > tr > td:nth-child(${self.activeCohort + 2})`
		const combined = keys.length > 1
		if (combined) {
			selector = ''
			for (const key of keys) {
				const i = result.cohorts.map(c => c.cohort).indexOf(key)
				if (selector !== '') selector += ','
				selector += `tbody > tr > td:nth-child(${i + 2})`
			}
		}
		const activeColumns = self.dom.cohortTable.selectAll(selector)
		activeColumns.style('background-color', 'yellow')
		self.dom.cohortInputs.property('checked', (d, i) => i === self.activeCohort)
	}

	self.initCohort = async appState => {
		const selectCohort = appState.termdbConfig.selectCohort
		if (!selectCohort) return
		self.dom.tds.filter(d => d.colNum === 0).style('display', '')
		self.cohortNames = selectCohort.values.map(d => d.keys.slice().sort().join(','))

		if (selectCohort.title) {
			self.dom.cohortTitle = self.dom.subheader.cohort
				.append('h2')
				.style('margin-left', '10px')
				.text(selectCohort.title)
		}

		if (selectCohort.description) {
			self.dom.cohortDescription = self.dom.subheader.cohort
				.append('div')
				.style('margin-left', '10px')
				.html(selectCohort.description)
		}

		if (selectCohort.prompt) {
			self.dom.cohortPrompt = self.dom.subheader.cohort
				.append('div')
				.style('margin-left', '10px')
				.style('padding-top', '30px')
				.style('padding-bottom', '10px')
				.style('font-weight', 'bold')
				.text(selectCohort.prompt)
		}

		self.dom.cohortOpts = self.dom.subheader.cohort
			.append('div')
			.style('margin-bottom', '30px')
			.style('margin-left', '10px')

		const trs = self.dom.cohortOpts
			.append('table')
			.selectAll('tr')
			.data(selectCohort.values)
			.enter()
			.append('tr')
			.each(function (d, i) {
				const tr = select(this)
				const td0 = tr.append('td')
				const radioName = 'sja-termdb-cohort-' + self.instanceNum
				const radioId = radioName + '-' + i
				td0
					.append('input')
					.attr('type', 'radio')
					.attr('name', radioName)
					.attr('id', radioId)
					.attr('value', i)
					.property('checked', i === self.activeCohort)
					.style('margin-right', '5px')
					.style('margin-left', '0px')
					.on('click', () => {
						self.app.dispatch({ type: 'cohort_set', activeCohort: i })
					})

				td0
					.append('label')
					.attr('for', radioId)
					.attr('colspan', 2)
					.style('cursor', 'pointer')
					.html(d => d.label)

				tr.selectAll('td')
					.style('max-width', '600px')
					.style('padding-bottom', '10px')
					.style('padding-right', '20px')
					.style('vertical-align', 'top')
			})

		self.dom.cohortInputs = self.dom.cohortOpts.selectAll('input')
		self.dom.cohortTable = self.dom.subheader.cohort.append('div')

		if (selectCohort.asterisk) {
			self.dom.cohortAsterisk = self.dom.subheader.cohort
				.append('div')
				.style('margin-left', '10px')
				.style('padding-top', '20px')
				.style('padding-bottom', '20px')
				.style('font-size', 'small')
				.text(selectCohort.asterisk)
		}
	}
}

function setInteractivity(self) {
	self.setTab = async (event, d) => {
		if (d.colNum === self.activeTab && !self.searching) {
			self.prevCohort = self.activeCohort
			await self.updateUI(true)
			// since the app.dispatch() is not called directly,
			// must trigger the event bus here
			if (self.bus) self.bus.emit('postRender')
			return
		}
		self.activeTab = d.colNum
		self.searching = false
		self.app.dispatch({ type: 'tab_set', activeTab: self.activeTab })
		if (self.activeTab == 1 && self.activeCohort != -1 && !self.state.plots.length) {
			// show dictionary in charts tab if no other
			// plots have been created
			self.app.dispatch({
				type: 'plot_create',
				id: getId(),
				config: { chartType: 'dictionary' }
			})
		}
	}

	self.getSessionUrl = async () => {
		self.dom.saveBtn.property('disabled', true)
		const res = await dofetch3('/massSession', {
			method: 'POST',
			body: JSON.stringify(self.app.getState())
		})
		const host = sessionStorage.getItem('hostURL') || `${window.location.protocol}//${window.location.host}`
		const url = `${host}/?mass-session-id=${res.id}&noheader=1`
		self.dom.tip.clear().showunder(self.dom.saveBtn.node())
		self.dom.tip.d
			.append('div')
			.style('margin', '10px')
			.html(
				`<a href='${url}' target=_blank>${res.id}</a><br><div style="font-size:.8em;opacity:.6"><span>Click the link to recover this session. Bookmark or share this link.</span><br><span>This session will be saved for ${self.massSessionDuration} days.</span></div>`
			)
		setTimeout(() => {
			self.dom.saveBtn.property('disabled', false)
		}, 1000)
	}

	self.getSessionFile = async event => {
		//Download mass-session-id file
		const res = await dofetch3(`/massSession?id=${self.sessionId}`)
		const a = document.createElement('a')
		const dataStr = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(res.state))
		a.setAttribute('href', dataStr)
		a.download = `${self.sessionId}.json`
		a.click()
		a.remove()
	}
}
