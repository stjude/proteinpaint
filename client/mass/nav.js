import { getCompInit, multiInit } from '#rx'
import { recoverInit } from '../rx/src/recover'
import { searchInit } from './search'
import { chartsInit } from './charts'
import { groupsInit } from './groups'
import { sessionBtnInit } from './sessionBtn'
import { aboutInit } from './about.ts'
import { dofetch3 } from '#common/dofetch'
import { Menu, icons as icon_functions } from '#dom'
import { getFilterItemByTag, filterRxCompInit } from '#filter/filter'

/*
todo: steps to add a new tab
*/

const activeTabBgColor = '#ececec', // default bg color of active tab; inactive tab is transparent
	activeTabBgColorHover = '#e0e0e0',
	activeTabTextColor = 'black',
	inactiveTabBgColorHover = '#fcfced',
	inactiveTabTextColor = 'gray'

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
const aboutTab = { top: 'ABOUT', mid: '', btm: '', subheader: 'about' }
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
		this.tabs = [] // array of tab objects corresponding to what's shown on header, based on ds customization. hidden tabs are not in this array. filled in initUI()
		this.activeTab = 0 // array index for .tabs[]; -1 for no active tabs and all closed
		this.activeCohort = 0 // -1 = unselected, 0,1,2... = selected
		this.samplecounts = {} // tracks sample count by .activeCohort value and stringified filter json
		this.searching = false
		this.massSessionDuration = opts.massSessionDuration
		this.sessionDaysLeft = opts.app.opts.sessionDaysLeft || null
		this.sessionId = opts.app.opts.sessionId || null
		this.pkgver = opts.pkgver || null //Release version
		setInteractivity(this)
		setRenderers(this)
	}

	async init(appState) {
		try {
			this.cohortFilter = getFilterItemByTag(appState.termfilter.filter, 'cohortFilter')
			this.initUI(appState)
			if (appState?.termdbConfig?.selectCohort) {
				this.dom.tds.filter(d => d.colNum === 0).style('display', '')
				this.cohortNames = appState.termdbConfig.selectCohort.values.map(d => d.keys.slice().sort().join(','))
			}

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
				about: aboutInit({
					app: this.app,
					subheader: this.dom.subheader.about,
					instanceNum: this.instanceNum,
					aboutOverrides: appState?.termdbConfig?.massNav?.tabs?.about || null,
					selectCohort: appState?.termdbConfig?.selectCohort || null
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

		// do not use startsWith('plot_') to exclude 'plot_edit' as no need for nav to react to that
		if (action.type == 'plot_prep') return true
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
			if (!(this.activeCohort in this.samplecounts)) {
				this.samplecounts[this.activeCohort] = await this.app.vocabApi.getCohortSampleCount(this.activeCohortName)
			}
			if (!(this.filterJSON in this.samplecounts)) {
				if (!this.filterUiRoot || !this.filterUiRoot.lst.length) {
					this.samplecounts[this.filterJSON] = this.samplecounts[this.activeCohort]
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
		const verifiedToken = self.app.vocabApi.verifiedToken
		const invalidTokenErrorHandling = appState.termdbConfig.invalidTokenErrorHandling
		//Show error message if login failed and all charts require login. If the dataset does not require login verifiedToken is true
		//Currently only the profile and sjcares always require a token.
		// Note that if the user did not login the public token was used. So only if the user did login and the token passed was invalid this error is shown
		if (!verifiedToken && invalidTokenErrorHandling?.affectedCharts?.includes('*'))
			throw new Error(appState.termdbConfig.invalidTokenErrorHandling.errorMessage)
		const header = self.opts.holder.append('div').style('white-space', 'nowrap')
		const massNav = appState.termdbConfig?.massNav || {}
		let titleDiv = header
			.append('div')
			.style('display', 'inline-block')
			.style('float', 'right')
			.style('font-size', '1.1em')
			.style('margin-top', '50px')
			.text(massNav?.title?.text) //this line will be executed in update UI to reflect cohort changes

		const tabDiv = header.append('div').style('display', 'none').style('vertical-align', 'bottom')
		const controlsDiv = header
			//Fix for adding message underneath the search bar and buttons
			.append('div')
			.style('vertical-align', 'top')
			.style('margin', '10px')
			.style('display', 'inline-block')
			.style('float', 'right')

		if (self.opts.header_mode === 'only_buttons') {
			// if header_mode is only_buttons, show only buttons
			tabDiv.style('display', 'none')
			titleDiv.style('display', 'none')
			controlsDiv.style('display', 'none')
		}
		self.opts.holder.attr('class', 'sjpp-nav')
		self.dom = {
			holder: self.opts.holder,
			header,
			tabDiv,
			controlsDiv,
			searchDiv: controlsDiv.append('div').style('margin', '10px'),
			sessionDiv: controlsDiv.append('div').style('display', 'inline-block'),
			recoverDiv: controlsDiv.append('div').style('display', 'inline-block'),
			deleteAllDiv: controlsDiv
				.append('div')
				.style('display', 'inline-block')
				.style('padding-top', '4px')
				.style('vertical-align', 'middle'),
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
		icon_functions['trash'](self.dom.deleteAllDiv, {
			handler: self.deletePlots,
			title: 'Delete all plots. To revert, click Undo button'
		})

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
			// For either the COHORT or ABOUT tab
			about: self.dom.subheaderDiv.append('div').style('display', 'none').attr('data-testid', 'sjpp-mass-about'),
			search: self.dom.subheaderDiv.append('div').style('display', 'none'),
			groups: self.dom.subheaderDiv.append('div').style('display', 'none'),
			charts: self.dom.subheaderDiv.append('div').style('display', 'none'),
			filter: self.dom.subheaderDiv.append('div').style('display', 'none')
			// cart: self.dom.subheaderDiv.append('div').style('display', 'none').html('<br/>Cart feature under construction - work in progress<br/>&nbsp;<br/>'),
		})

		if (!massNav.tabs?.about?.hide) {
			// about tab is not hidden
			self.tabs.push(aboutTab)
			// about tab contents are conditionally determined by 1) override 2) ds using or not using cohort.
			// furbish an override object with default properties based on conditions if those properties are missing
			const override = Object.assign({}, massNav.tabs?.about)
			if (appState.termdbConfig?.selectCohort) {
				// ds has cohort selection and no customization to about tab
				if (!override.top) override.top = 'COHORT'
				// do not assign "mid" here as it will be dynamically assigned with active cohort name
			} else {
				// ds doesn't use cohort selection. if mid is missing, use dslabel
				if (!override.mid) override.mid = self.pickDatasetLabel(appState)
			}
			Object.assign(aboutTab, override) // apply ds customizations
		}
		if (!massNav.tabs?.charts?.hide) {
			// charts tab is not hidden
			self.tabs.push(chartTab)
			Object.assign(chartTab, massNav.tabs?.charts)
		}
		if (!massNav.tabs?.groups?.hide) {
			// group tab is not hidden
			self.tabs.push(groupsTab)
			Object.assign(groupsTab, massNav.tabs?.groups)
		}
		if (!massNav.tabs?.filter?.hide) {
			// filter tab is not hidden
			self.tabs.push(filterTab)
			Object.assign(filterTab, massNav.tabs?.filter)
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
			// hide the about (e.g. cohort tab) until there is termdbConfig.selectCohort or termdbCongfig.massNav.tabs.about
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
			.on('mouseover', (event, d) => {
				self.mouseover(event, d)
			})
			.on('mouseout', () => {
				self.mouseout()
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
	}

	self.deletePlots = () => {
		const state = self.app.getState()
		const subactions = []
		for (const plot of state.plots) subactions.push({ type: 'plot_delete', id: plot.id })

		self.app.dispatch({ type: 'app_refresh', subactions })
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

	self.updateUI = async () => {
		if (!self.dom.subheaderDiv) return
		if (self.activeTab && self.state.termdbConfig.selectCohort && self.activeCohort == -1) {
			// showing charts or filter tab; cohort selection is enabled but no cohort is selected
			self.dom.subheaderDiv.style('display', 'none')
			self.dom.messageDiv.selectAll('text').remove()
			self.dom.messageDiv.style('display', '').text('No cohort selected. Please select a cohort in the "COHORT" tab.')
		} else {
			if (self.dom.subheaderDiv) self.dom.subheaderDiv.style('display', self.activeTab != -1 ? 'block' : 'none')
			if (self.dom.messageDiv) self.dom.messageDiv.style('display', 'none')
		}
		const selectCohort = self.state.termdbConfig.selectCohort
		const massNav = self.state.termdbConfig.massNav
		self.dom.searchDiv.style('display', selectCohort && self.activeCohort == -1 ? 'none' : 'inline-block')
		//self.dom.holder.style('margin-bottom', self.state.nav.header_mode === 'with_tabs' ? '20px' : '')//To be checked why it was needed
		self.dom.header.style('border-bottom', self.state.nav.header_mode === 'with_tabs' ? '1px solid #000' : '')
		self.dom.tds
			.style('display', '')
			//Only show black text when the tab is active and the subheader is displayed
			.style('color', d => (d.colNum == self.activeTab ? activeTabTextColor : inactiveTabTextColor))
			.style('background-color', d =>
				d.colNum == self.activeTab && self.dom.subheaderDiv.style('display') != 'none'
					? self.state.termdbConfig.massNav?.activeColor || activeTabBgColor
					: 'transparent'
			)
			.html(function (d, i) {
				if (d.key == 'top') return this.innerHTML

				if (d.subheader == 'groups') {
					if (d.key == 'mid') return self.state.groups.length || 'NONE'
					return ''
				}

				if (d.subheader === 'charts') {
					// only a plot in it's own sandbox will be counted; do not separately count child plots in the same sandbox
					const n = self.state.plots.filter(p => !p.parentId).length
					if (d.key == 'mid') return !n ? 'NONE' : n
					else return ''
				} else if (d.subheader === 'about') {
					if (self.activeCohort != -1 && self.activeCohort in self.samplecounts) {
						const aboutMap = {
							top: this.innerHTML,
							mid: self.activeCohortLabel,
							btm: self.samplecounts[self.activeCohort]
						}
						return aboutMap[d.key] || ''
					} else if (!selectCohort) {
						const aboutMap = {
							top: massNav?.tabs?.about?.top || 'ABOUT',
							mid: massNav?.tabs?.about?.mid || this.innerHTML,
							btm: massNav?.tabs?.about?.btm || self.samplecounts[self.activeCohort]
						}
						return aboutMap[d.key] || ''
					} else {
						return d.key === 'mid' ? 'NONE' : this.innerHTML
					}
				} else if (d.subheader === 'filter') {
					const filter = self.filterUiRoot ? self.filterUiRoot : { lst: [] }
					if (filter.lst.length === 0) {
						// Do not show number of samples at bottom of FILTER tab when no filter applied
						return d.key === 'mid' ? 'NONE' : ''
					} else {
						const n = self.samplecounts[self.filterJSON] != undefined ? '' + self.samplecounts[self.filterJSON] : ''
						return d.key === 'mid' ? filter.lst.length : n
					}
				} else {
					return d.key === 'mid' ? this.innerHTML : '&nbsp;'
				}
			})

		// const visibleSubheaders = []
		for (const key in self.dom.subheader) {
			self.dom.subheader[key].style(
				'display',
				self.activeTab == -1 ? 'none' : self.tabs[self.activeTab].subheader === key ? 'block' : 'none'
			)
		}

		if (self.opts.header_mode === 'with_cohortHtmlSelect') {
			self.dom.cohortSelect.selectAll('option').property('value', self.activeCohort)
		}
	}
}

function setInteractivity(self) {
	self.setTab = async (event, d) => {
		//Reset the activeTab to the current tab if no tab is selected
		if (self.activeTab == -1) self.activeTab == d.colNum
		if (d.colNum === self.activeTab && !self.searching) {
			// The about tab should not be hidden on double click with or without plots
			if (self.activeTab == 0) return
			self.prevCohort = self.activeCohort
			await self.updateUI()

			// if the user double-clicks on the same tab, hide the subheader
			self.app.dispatch({ type: 'tab_set', activeTab: -1 })
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

	self.mouseover = (event, d) => {
		const defaultActiveColor = self.state.termdbConfig.massNav?.activeColor || activeTabBgColor
		self.dom.tds.style('background-color', t => {
			//light yellow for inactive tabs and grey-yellow for this active tab
			if (t.colNum === d.colNum)
				return self.activeTab == t.colNum
					? self.state.termdbConfig.massNav?.activeColorHover || activeTabBgColorHover
					: inactiveTabBgColorHover
			return self.activeTab == t.colNum ? defaultActiveColor : 'transparent'
		})
	}

	self.mouseout = () => {
		const defaultActiveColor = self.state.termdbConfig.massNav?.activeColor || activeTabBgColor
		self.dom.tds.style('background-color', t => (self.activeTab == t.colNum ? defaultActiveColor : 'transparent'))
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

	self.pickDatasetLabel = appState => {
		const dslabel = appState.vocab.dslabel.toUpperCase()
		return dslabel.length > 10 ? `${dslabel.slice(0, 10)}...` : dslabel
	}
}
