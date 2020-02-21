import * as rx from '../common/rx.core'
import { searchInit } from './search'
import { filterInit } from './filter3'
import { select } from 'd3-selection'
import { dofetch2, Menu } from '../client'

// to be used for assigning unique
// radio button names by object instance
// otherwise termdp app popups
let instanceNum = 0

class TdbNav {
	constructor(app, opts) {
		this.type = 'nav'
		this.app = app
		this.opts = opts
		this.id = opts.id
		this.api = rx.getComponentApi(this)
		this.instanceNum = instanceNum++

		setInteractivity(this)
		setRenderers(this)
		this.eventTypes = ['postInit', 'postRender']
		this.activeCohort = 0
		// 0 = cohort tab, will switch to 1 = filter tab if there are no cohorts
		this.activeTab = 0
		this.searching = false
		this.hideSubheader = false
		this.samplecounts = {}
		this.initUI()

		this.components = {
			search: searchInit(
				this.app,
				{
					holder: this.dom.searchDiv,
					resultsHolder: this.opts.show_tabs ? this.dom.tip.d : null
				},
				rx.copyMerge(
					{
						click_term: this.app.opts.tree && this.app.opts.tree.click_term,
						disable_terms: this.app.opts.tree && this.app.opts.tree.disable_terms,
						callbacks: {
							'postSearch.nav': data => {
								if (!data || !data.lst || !data.lst.length) this.dom.tip.hide()
								else this.dom.tip.showunder(this.dom.searchDiv.node())
							}
						}
					},
					this.app.opts.search
				)
			),

			filter: filterInit(
				this.app,
				{
					holder: this.dom.subheader.filter.append('div'),
					hideLabel: this.opts.show_tabs,
					newBtn: this.dom.tds.filter(d => d.colNum === 1)
				},
				this.opts.filter
			)
		}
	}
	getState(appState) {
		//console.log(64, appState.nav.activeCohort)
		return {
			genome: appState.genome,
			dslabel: appState.dslabel,
			searching: this.searching, // for detection of internal state change
			nav: appState.nav,
			termdbConfig: appState.termdbConfig,
			filter: appState.termfilter.filter
		}
	}
	reactsTo(action) {
		//return true // console.log(58, action.type == 'app_refresh')
		return (
			action.type.startsWith('tab_') ||
			action.type.startsWith('filter_') ||
			action.type.startsWith('cohort_') ||
			action.type == 'app_refresh'
		)
	}
	async main() {
		this.dom.tabDiv.style('display', this.state.nav.show_tabs ? 'inline-block' : 'none')
		this.activeTab = this.state.nav.activeTab
		this.prevCohort = this.activeCohort
		this.activeCohort = this.state.nav.activeCohort
		if (!this.dom.cohortTable) this.initCohort()
		if (this.cohortNames) this.activeCohortName = this.cohortNames[this.activeCohort]
		//this.hideSubheader = false
		if (this.state.nav.show_tabs) await this.getSampleCount()
		this.updateUI()
	}
	async getSampleCount() {
		const lst = [
			'genome=' + this.state.genome,
			'dslabel=' + this.state.dslabel,
			'getsamplecount=' + this.activeCohortName,
			'filter=' + encodeURIComponent(JSON.stringify(this.state.filter))
		]
		const data = await dofetch2('termdb?' + lst.join('&'), {}, this.app.opts.fetchOpts)
		if (!data) throw `missing data`
		else if (data.error) throw data.error
		else {
			for (const row of data) {
				this.samplecounts[row.subcohort] = row.samplecount
			}
		}
	}
}

export const navInit = rx.getInitFxn(TdbNav)

function setRenderers(self) {
	self.initUI = () => {
		const header = self.opts.holder.append('div')
		self.dom = {
			holder: self.opts.holder,
			header,
			tabDiv: header.append('div').style('display', 'none'),
			searchDiv: header
				.append('div')
				.style('display', 'inline-block')
				.style('width', '300px')
				.style('margin', '10px')
				.style('vertical-align', 'top'),
			sessionDiv: header.append('div'),
			subheaderDiv: self.opts.holder
				.append('div')
				.style('display', 'none')
				.style('padding-top', '5px')
				.style('border-bottom', '1px solid #000'),
			tip: new Menu({ padding: '5px' })
		}
		self.dom.subheader = Object.freeze({
			search: self.dom.subheaderDiv.append('div'),
			cohort: self.dom.subheaderDiv.append('div'),
			filter: self.dom.subheaderDiv.append('div'),
			cart: self.dom.subheaderDiv
				.append('div')
				.html('<br/>Cart feature under construction - work in progress<br/>&nbsp;<br/>')
		})

		const table = self.dom.tabDiv.append('table').style('border-collapse', 'collapse')
		self.tabs = [
			{ top: 'COHORT', mid: 'SJLIFE', btm: '' }, //, hidetab: !self.state.termdbConfig.selectCohort },
			{ top: 'FILTER', mid: '+NEW', btm: '' },
			{ top: 'CART', mid: 'NONE', btm: '' }
		]
		table
			.selectAll('tr')
			.data(['top', 'mid', 'btm'])
			.enter()
			.append('tr')
			.style('font-size', (d, i) => (i == 1 ? '20px' : '12px'))
			.selectAll('td')
			.data((key, i) =>
				self.tabs
					.filter(d => !d.hidetab)
					.map((row, colNum) => {
						return { rowNum: i, key, colNum, label: row[key] }
					})
			)
			.enter()
			.append('td')
			// hide the cohort tab until there is termdbConfig.selectCohort
			.style('display', d => (d.colNum === 0 ? 'none' : ''))
			.style('width', '100px')
			.style('padding', '5px 12px')
			.style('text-align', 'center')
			.style('border-left', '1px solid #ccc')
			.style('border-right', '1px solid #ccc')
			.style('color', '#aaa')
			.style('cursor', 'pointer')
			.html(d => d.label)
			.on('click', self.setTab)

		self.dom.trs = table.selectAll('tr')
		self.dom.tds = table.selectAll('td')
		self.subheaderKeys = ['cohort', 'filter', 'cart']
	}
	self.updateUI = () => {
		self.dom.holder.style('margin-bottom', self.state.nav.show_tabs ? '20px' : '')
		self.dom.header.style('border-bottom', self.state.nav.show_tabs ? '1px solid #000' : '')
		self.dom.tds
			.style('color', d =>
				d.colNum == self.activeTab && !self.hideSubheader && self.prevCohort != -1 ? '#000' : '#aaa'
			)
			.html(function(d, i) {
				if (d.key == 'top') return this.innerHTML
				if (d.colNum === 0) {
					if (self.activeCohortName in self.samplecounts) {
						return d.key == 'mid' ? self.activeCohortName : 'n=' + self.samplecounts[self.activeCohortName]
					} else {
						return d.key == 'mid' ? '<span style="font-size: 16px; color: red">SELECT<br/>BELOW</span>' : ''
					}
				} else if (d.colNum === 1) {
					if (self.state.filter.lst.length === 0) {
						return d.key === 'mid' ? '+NEW' : '&nbsp;'
					} else {
						return d.key === 'mid' ? self.state.filter.lst.length : 'n=' + self.samplecounts['FILTERED_COHORT']
					}
				} else {
					return d.key === 'mid' ? this.innerHTML : '&nbsp;'
				}
			})

		self.dom.subheaderDiv.style(
			'display',
			self.hideSubheader
				? 'none'
				: self.searching || (self.activeTab === 1 && !self.state.filter.lst.length)
				? 'none'
				: !self.state.nav.show_tabs && self.activeTab !== 1
				? 'none'
				: 'block'
		)

		const visibleSubheaders = []
		for (const key in self.dom.subheader) {
			const display =
				key == 'cohort' && self.prevCohort == -1 && self.activeCohort != -1
					? 'none'
					: key == 'search' || self.activeTab == self.subheaderKeys.indexOf(key)
					? 'block'
					: 'none'

			self.dom.subheader[key].style('display', display)
			if (display != 'none' && key != 'search') visibleSubheaders.push(key)
		}
		self.dom.subheaderDiv.style(
			'border-bottom',
			self.state.nav.show_tabs && visibleSubheaders.length ? '1px solid #000' : ''
		)
	}
	self.initCohort = () => {
		if (self.dom.cohortTable) return
		const selectCohort = self.state.termdbConfig && self.state.termdbConfig.selectCohort
		if (!selectCohort) {
			if (self.activeTab === 0) self.activeTab = 1
			return
		}
		self.dom.tds.filter(d => d.colNum === 0).style('display', '')
		self.cohortNames = selectCohort.values.map(d => d.keys.join(','))
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
				td0
					.append('input')
					.attr('type', 'radio')
					.attr('name', radioName)
					.attr('id', radioName + '-' + i)
					.attr('value', i)
					.property('checked', i === self.activeCohort)
					.style('margin-right', '3px')
					.on('click', () => self.app.dispatch({ type: 'cohort_set', activeCohort: i }))

				td0
					.append('label')
					.attr('for', 'sja-termdb-cohort' + i)
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

		self.dom.cohortTable
			.select('tbody')
			.selectAll('tr')
			.style('background-color', (d, i) => (i % 2 == 0 ? 'rgba(220, 180, 0, 0.4)' : '#fff'))

		self.dom.cohortTable.selectAll('td').style('padding', '5px')

		self.dom.cohortTable.selectAll('td').style('border', 'solid 2px rgba(220, 180, 0, 1)')
	}
}

function setInteractivity(self) {
	self.setTab = d => {
		if (d.colNum == self.activeTab && !self.searching) {
			self.hideSubheader = self.prevCohort != -1 && !self.hideSubheader
			self.prevCohort = self.activeCohort
			self.updateUI()
			return
		}
		self.activeTab = d.colNum
		self.searching = false
		self.app.dispatch({ type: 'tab_set', activeTab: self.activeTab })
	}
}
