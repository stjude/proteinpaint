import { getCompInit, multiInit } from '#rx'
import { recoverInit } from '../rx/src/recover'
import { searchInit } from './search'
import { chartsInit, getActiveCohortStr } from './charts'
import { groupsInit } from './groups'
import { sessionBtnInit } from './sessionBtn'
import { aboutInit } from './about.ts'
import { select } from 'd3-selection'
import { dofetch3 } from '#common/dofetch'
import { Menu } from '#dom/menu'
import { getFilterItemByTag, filterRxCompInit } from '#filter/filter'
import { renderTable } from '../dom/table'

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
					usecase: { target: 'summary', detail: 'term' },
					targetType: 'Dictionary Variables'
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
				}),
				sessionBtn: sessionBtnInit({
					app: this.app,
					button: this.dom.saveBtn,
					massSessionDuration: this.opts.massSessionDuration,
					sessionDaysLeft: this.app.opts.sessionDaysLeft || null
				}),
				about: appState.termdbConfig.about
					? aboutInit({
							app: this.app,
							holder: this.dom.subheader.about,
							features: appState.termdbConfig.about
					  })
					: []
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
		if (this.state.termdbConfig.selectCohort && this.state.termdbConfig.about) {
			console.error('Cohort(s) and an About tab are defined. Only one can be used.')
			return
		}
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

		/** Custom config to show an ABOUT tab */
		if (this.state.termdbConfig.about) this.about = this.state.termdbConfig.about

		if (this.state.nav.header_mode === 'with_tabs') {
			if (!(this.activeCohortName in this.samplecounts)) {
				const count = await this.app.vocabApi.getCohortSampleCount(this.activeCohortName)
				this.samplecounts[this.activeCohortName] = count
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
		let titleDiv = header
			.append('div')
			.style('display', 'inline-block')
			.style('float', 'right')
			.style('font-size', '1.1em')
			.style('margin-top', '50px')
			.text(appState.termdbConfig?.title?.text) //this line will be executed in update UI to reflect cohort changes

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
			titleDiv,
			tip: new Menu({ padding: '5px' })
		}

		if (appState.nav.header_mode == 'only_buttons') {
			self.dom.tabDiv.style('display', 'none')
			self.dom.recoverDiv.style('display', 'none')
			titleDiv.style('margin-top', '95px').style('font-size', '0.9em')
			if (appState.termdbConfig.title?.link)
				titleDiv
					.on('click', () => window.open(appState.termdbConfig.title.link, '_blank'))
					.on('mouseover', () => titleDiv.style('cursor', 'pointer'))
		}

		if (self.opts.header_mode === 'with_cohortHtmlSelect') {
			// not part of filter div
			self.dom.cohortStandaloneDiv = header
				.append('div')
				.style('display', 'inline-block')
				.style('margin', '10px')
				.style('vertical-align', 'top')

			self.dom.cohortStandaloneDiv.append('label').html('Cohort: ')
			self.dom.cohortSelect = self.dom.cohortStandaloneDiv.append('select').on('change', async function () {
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
			filter: self.dom.subheaderDiv.append('div').style('display', 'none'),
			cart: self.dom.subheaderDiv
				.append('div')
				.style('display', 'none')
				.html('<br/>Cart feature under construction - work in progress<br/>&nbsp;<br/>'),
			// For either the COHORT or ABOUT tab
			about: self.dom.subheaderDiv.append('div').style('display', 'none').attr('data-testid', 'sjpp-mass-about')
		})
		if (appState.termdbConfig?.tabs) {
			chartTab.top = appState.termdbConfig.tabs.charts
			filterTab.top = appState.termdbConfig.tabs.filter
		}
		self.tabs = [chartTab, groupsTab, filterTab /*, cartTab*/]
		if (appState.termdbConfig.hideGroupsTab) self.tabs.splice(1, 1)
		/** Adds either the COHORT or ABOUT tab
		 * COHORT is added over ABOUT if both are defined
		 */
		const cohortTabTop = appState.termdbConfig?.tabs?.cohort || 'COHORT'
		if (appState.termdbConfig?.selectCohort || appState.termdbConfig?.about) {
			const aboutTab = appState.termdbConfig?.about?.tab || {}
			const topLabel = appState.termdbConfig.selectCohort ? cohortTabTop : aboutTab.topLabel || ''
			const midLabel = aboutTab.midLabel || (aboutTab ? 'ABOUT' : '')
			const btmLabel = aboutTab.btmLabel || ''

			const tab = {
				top: topLabel.toUpperCase(),
				mid: midLabel.toUpperCase(),
				btm: btmLabel,
				subheader: 'about'
			}
			const tabIdx = appState.termdbConfig?.selectCohort ? 0 : aboutTab.order || 0
			self.tabs.splice(tabIdx, 0, tab)
		}

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
			// hide the about (e.g. cohort tab) until there is termdbConfig.selectCohort or termdbCongif.about
			.style('display', 'none') // d => (d.colNum === 0 || self.activeCohort !== -1 ? '' : 'none'))
			.style('width', '100px')
			.style('padding', d => (d.rowNum === 0 ? '12px 12px 3px 12px' : '3px 12px'))
			.style('text-align', 'center')
			.style('border-left', '1px solid #ccc')
			.style('border-right', '1px solid #ccc')
			.style('color', '#aaa')
			.style('cursor', 'pointer')
			.html(d => d.label)
			.on('click', (event, d) => {
				self.setTab(event, d)
			})

		self.dom.trs = table.selectAll('tr')
		self.dom.tds = table.selectAll('td')
		self.subheaderKeys = self.tabs.map(d => d.subheader)

		self.dom.saveBtn = self.dom.sessionDiv.append('button').style('margin', '10px').text('Session ▼')

		//.on('click', self.getSessionUrl)

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
				`<u>${self.sessionDaysLeft} days</u> left until this session is removed. Click the "Save Session" button to create a new one.`
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
		self.dom.searchDiv.style(
			'display',
			(selectCohort && self.activeCohort == -1) || self.state.nav.header_mode == 'only_buttons'
				? 'none'
				: 'inline-block'
		)
		//self.dom.holder.style('margin-bottom', self.state.nav.header_mode === 'with_tabs' ? '20px' : '')//To be checked why it was needed
		self.dom.header.style('border-bottom', self.state.nav.header_mode === 'with_tabs' ? '1px solid #000' : '')
		self.dom.tds
			.style('display', '')
			.style('color', d => (d.colNum == self.activeTab ? '#000' : '#aaa'))
			.style('background-color', d =>
				d.colNum == self.activeTab && self.dom.subheaderDiv.style('display') != 'none' ? '#ececec' : 'transparent'
			)
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
				} else if (d.subheader === 'about') {
					if (self.activeCohortName && self.activeCohortName in self.samplecounts) {
						const aboutMap = {
							top: this.innerHTML,
							mid: self.activeCohortLabel,
							btm: self.samplecounts[self.activeCohortName]
						}
						return aboutMap[d.key] || ''
					} else if (self.about) {
						const aboutMap = {
							top: self.about?.tab?.topLabel ? self.about.tab.topLabel.toUpperCase() : this.innerHTML,
							mid: self.about?.tab?.midLabel ? self.about.tab.midLabel.toUpperCase() : 'ABOUT',
							btm: self.about?.tab?.btmLabel || this.innerHTML
						}
						return aboutMap[d.key] || ''
					} else {
						return d.key === 'mid' ? 'NONE' : this.innerHTML
					}
				} else if (d.subheader === 'filter') {
					const filter = self.filterUiRoot ? self.filterUiRoot : { lst: [] }
					if (filter.lst.length === 0) {
						return d.key === 'mid' ? 'NONE' : self.samplecounts['undefined'] ? `${self.samplecounts['undefined']}` : ''
					} else {
						const n = self.samplecounts[self.filterJSON] != undefined ? '' + self.samplecounts[self.filterJSON] : ''
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
		if (!result.cfeatures.length) return
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
			self.dom.cohortTitle = self.dom.subheader.about.append('h2').style('margin-left', '10px').text(selectCohort.title)
		}

		if (selectCohort.description) {
			self.dom.cohortDescription = self.dom.subheader.about
				.append('div')
				.style('margin-left', '10px')
				.html(selectCohort.description)
		}

		if (selectCohort.prompt) {
			self.dom.cohortPrompt = self.dom.subheader.about
				.append('div')
				.style('margin-left', '10px')
				.style('padding-top', '30px')
				.style('padding-bottom', '10px')
				.style('font-weight', 'bold')
				.text(selectCohort.prompt)
		}

		self.dom.cohortOpts = self.dom.subheader.about
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
					.on('click', async () => {
						const state = self.app.getState()
						//the terms used in the plots are not always the same for the profile.
						//Therefore when switching cohorts, it is necessary to delete the plots opened
						if (state.vocab.dslabel == 'profile')
							for (const plot of state.plots) {
								await self.app.dispatch({
									type: 'plot_delete',
									id: plot.id
								})
							}
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
		self.dom.cohortTable = self.dom.subheader.about.append('div')

		if (selectCohort.asterisk) {
			self.dom.cohortAsterisk = self.dom.subheader.about
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
		const chartsIdx = self.subheaderKeys.indexOf('charts')
		if (self.activeTab == chartsIdx && self.activeCohort != -1 && !self.state.plots.length) {
			// show dictionary or default plot in charts tab if no other
			// plots have been created
			const defaultChartType = self.state.termdbConfig.defaultChartType || 'dictionary'
			self.app.dispatch({
				type: 'plot_create',
				id: getId(),
				config: { chartType: defaultChartType }
			})
		}
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
