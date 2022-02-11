import { getCompInit, multiInit } from '../common/rx.core'
import { searchInit } from './search'
import { filterRxCompInit } from '../common/filter'
import { chartsInit } from './charts'
import { select } from 'd3-selection'
import { dofetch3 } from '../common/dofetch'
import { Menu } from '../dom/menu'
import { getNormalRoot, getFilterItemByTag } from '../common/filter'

// to be used for assigning unique
// radio button names by object instance
// otherwise termdp app popups
let instanceNum = 0

class TdbNav {
	constructor(opts) {
		this.type = 'nav'
		this.instanceNum = instanceNum++
		// 0 = cohort tab, will switch to 1 = filter tab if there are no cohorts
		this.activeTab = 0
		this.activeCohort = -1
		this.searching = false
		this.samplecounts = {}
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
					holder: this.dom.searchDiv
				}),
				filter: filterRxCompInit({
					app: this.app,
					vocab: this.opts.vocab,
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
				})
			})
		} catch (e) {
			throw e
		}
	}

	/* for now, make the nav react to all state changes
	reactsTo(action) {
		return true 
	}*/

	getState(appState) {
		return {
			searching: this.searching, // for detection of internal state change
			nav: appState.nav,
			activeCohort: appState.activeCohort,
			termdbConfig: appState.termdbConfig,
			filter: appState.termfilter.filter,
			plots: appState.plots
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

		if (this.state.nav.header_mode === 'with_tabs') {
			if (!(this.activeCohortName in this.samplecounts)) {
				this.samplecounts[this.activeCohortName] = await this.app.vocabApi.getCohortSampleCount(this.activeCohortName)
			}
			if (!(this.filterJSON in this.samplecounts)) {
				if (!this.filterUiRoot || !this.filterUiRoot.lst.length) {
					this.samplecounts[this.filterJSON] = this.samplecounts[this.activeCohortName]
				} else {
					this.samplecounts[this.filterJSON] = await this.app.vocabApi.getFilteredSampleCount(
						this.activeCohortName,
						this.filterJSON
					)
				}
			}
		}
		this.updateUI()
	}
}

export const navInit = getCompInit(TdbNav)

function setRenderers(self) {
	self.initUI = appState => {
		const header = self.opts.holder.append('div')
		self.dom = {
			holder: self.opts.holder,
			header,
			tabDiv: header
				.append('div')
				.style('display', 'none')
				.style('vertical-align', 'bottom'),
			searchDiv: header
				.append('div')
				//.style('display', 'none')
				.style('margin', '10px')
				.style('vertical-align', 'top'),
			sessionDiv: header
				.append('div')
				.style('display', 'inline-block')
				.style('vertical-align', 'top'),
			subheaderDiv: self.opts.holder
				.append('div')
				.style('display', 'block')
				.style('padding-top', '5px')
				.style('border-bottom', '1px solid #000'),
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
			self.dom.cohortSelect = self.dom.cohortStandaloneDiv.append('select').on('change', function() {
				return self.app.dispatch({ type: 'cohort_set', activeCohort: +this.value })
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
			charts: self.dom.subheaderDiv.append('div').style('display', 'none'),
			cohort: self.dom.subheaderDiv.append('div').style('display', 'none'),
			filter: self.dom.subheaderDiv.append('div').style('display', 'none'),
			cart: self.dom.subheaderDiv
				.append('div')
				.html('<br/>Cart feature under construction - work in progress<br/>&nbsp;<br/>')
		})

		const table = self.dom.tabDiv.append('table').style('border-collapse', 'collapse')
		const chartTab = { top: 'CHARTS', mid: 'NONE', btm: '', subheader: 'charts' }
		const cohortTab = { top: 'COHORT', mid: 'NONE', btm: '', subheader: 'cohort' }
		const filterTab = { top: 'FILTER', mid: 'NONE', btm: '', subheader: 'filter' }
		const cartTab = { top: 'CART', mid: 'NONE', btm: '', subheader: 'cart' }
		self.tabs = appState.termdbConfig.selectCohort
			? [chartTab, cohortTab, filterTab, cartTab]
			: [chartTab, filterTab, cartTab]

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
			.text('Save')
			.on('click', self.getSessionUrl)
	}

	self.updateUI = () => {
		const selectCohort = self.state.termdbConfig.selectCohort
		self.dom.searchDiv.style('display', selectCohort && self.activeCohort == -1 ? 'none' : 'inline-block')
		self.dom.holder.style('margin-bottom', self.state.nav.header_mode === 'with_tabs' ? '20px' : '')
		self.dom.header.style('border-bottom', self.state.nav.header_mode === 'with_tabs' ? '1px solid #000' : '')
		self.dom.tds
			.style('display', '')
			.style('color', d => (d.colNum == self.activeTab ? '#000' : '#aaa'))
			.style('background-color', d => (d.colNum == self.activeTab ? '#ececec' : 'transparent'))
			.html(function(d, i) {
				if (d.key == 'top') return this.innerHTML

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
						return d.key === 'mid' ? 'NONE' : '&nbsp;'
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

		if (self.highlightCohortBy && self.activeCohort != -1) {
			const activeCohort = selectCohort.values[self.activeCohort]
			const activeSelector = activeCohort[self.highlightCohortBy]
			for (const cohort of selectCohort.values) {
				if (cohort[self.highlightCohortBy] !== activeSelector) {
					self.dom.cohortTable.selectAll(cohort[self.highlightCohortBy]).style('background-color', 'transparent')
				}
			}
			self.dom.cohortTable.selectAll(activeSelector).style('background-color', 'yellow')
			self.dom.cohortInputs.property('checked', (d, i) => i === self.activeCohort)
		}
		if (self.dom.cohortPrompt) self.dom.cohortPrompt.style('display', self.activeCohort == -1 ? '' : 'none')

		if (self.opts.header_mode === 'with_cohort_select') {
			self.dom.cohortSelect.selectAll('option').property('value', appState.activeCohort)
		}
	}

	self.initCohort = appState => {
		const selectCohort = appState.termdbConfig.selectCohort
		if (!selectCohort) {
			if (self.activeTab === 1) self.activeTab = 0
			return
		}
		self.dom.tds.filter(d => d.colNum === 0).style('display', '')
		self.cohortNames = selectCohort.values.map(d =>
			d.keys
				.slice()
				.sort()
				.join(',')
		)

		self.dom.cohortPrompt = self.dom.subheader.cohort
			.append('div')
			.html(`<h4 style="margin-left: 30px;">${selectCohort.showMessageWhenNotSelected}</h4>`)

		self.dom.cohortOpts = self.dom.subheader.cohort.append('div')
		const trs = self.dom.cohortOpts
			.append('table')
			.style('margin', '20px')
			.selectAll('tr')
			.data(selectCohort.values)
			.enter()
			.append('tr')
			.each(function(d, i) {
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
					.style('margin-right', '3px')
					.on('click', () => self.app.dispatch({ type: 'cohort_set', activeCohort: i }))

				td0
					.append('label')
					.attr('for', radioId)
					.style('cursor', 'pointer')
					.html(d => d.label)

				if (!d.note) {
					td0.attr('colspan', 2)
				} else {
					tr.append('td').html(d.note)
				}

				tr.selectAll('td')
					.style('max-width', '600px')
					.style('padding', '10px')
					.style('vertical-align', 'top')
			})

		self.dom.cohortInputs = self.dom.cohortOpts.selectAll('input')

		self.dom.cohortTable = self.dom.subheader.cohort.append('div').html(selectCohort.htmlinfo)

		self.dom.cohortTable
			.select('table')
			.style('border-collapse', 'collapse')
			.style('margin', '20px')

		self.dom.cohortTable
			.select('thead')
			.selectAll('tr')
			.style('text-align', 'center')
			.style('background-color', 'rgba(20, 20, 180, 0.8)')
			.style('color', '#fff')

		self.dom.cohortTable.select('tbody').selectAll('tr')
		//.style('background-color', (d, i) => (i % 2 == 0 ? 'rgba(220, 180, 0, 0.4)' : '#fff'))

		self.dom.cohortTable.selectAll('td').style('padding', '5px')

		self.dom.cohortTable.selectAll('td').style('border', 'solid 2px rgba(220, 180, 0, 1)')

		self.highlightCohortBy = selectCohort.highlightCohortBy
	}
}

function setInteractivity(self) {
	self.setTab = d => {
		if (d.colNum == self.activeTab && !self.searching) {
			self.prevCohort = self.activeCohort
			self.updateUI()
			// since the app.dispatch() is not called directly,
			// must trigger the event bus here
			if (self.bus) self.bus.emit('postRender')
			return
		}
		self.activeTab = d.colNum
		self.searching = false
		self.app.dispatch({ type: 'tab_set', activeTab: self.activeTab })
	}

	self.getSessionUrl = async () => {
		const res = await dofetch3('/massSession', {
			method: 'POST',
			body: JSON.stringify(self.app.getState())
		})
		const url = `${window.location.protocol}//${window.location.host}/?mass-session-id=${res.id}&noheader=1`
		self.dom.tip.clear().showunder(self.dom.saveBtn.node())
		self.dom.tip.d
			.append('div')
			.style('margin', '10px')
			.html(
				`<a href='${url}' target=_blank>${url}</a><br><span style="font-size:.8em;opacity:.5">Click URL to recover this session. You can bookmark or share this URL.</span>`
			)
	}
}
