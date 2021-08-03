import * as rx from '../common/rx.core'
// import { filterInit } from './filter3'
// import { select } from 'd3-selection'
// import { dofetch2, Menu } from '../client'
// import { getFilterItemByTag } from '../common/filter'

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
		this.activeCohort = -1
		// 0 = cohort tab, will switch to 1 = filter tab if there are no cohorts
		this.activeTab = 0
		// this.searching = false
		this.hideSubheader = false
		this.samplecounts = {}
		this.initUI()

		this.components = {
			/*filter: filterInit(
				this.app,
				{
					holder: this.dom.subheader.filter.append('div'),
					hideLabel: this.opts.show_tabs,
					emptyLabel: '+Add new filter'
				},
				this.app.opts.filter
			)*/
		}
	}
	getState(appState) {
		console.log(44, appState)
		//this.cohortKey = appState.termdbConfig.selectCohort && appState.termdbConfig.selectCohort.term.id
		return {
			genome: appState.genome,
			dslabel: appState.dslabel,
			//searching: this.searching, // for detection of internal state change
			nav: appState.nav,
			activeCohort: appState.activeCohort,
			//termdbConfig: appState.termdbConfig,
			filter: appState.termfilter.filter
		}
	}
	reactsTo(action) {
		return (
			action.type.startsWith('tab_') ||
			action.type.startsWith('filter_') ||
			action.type.startsWith('cohort_') ||
			action.type == 'app_refresh'
		)
	}
	async main() {
		this.dom.tabDiv.style('display', this.state.nav.show_tabs ? 'inline-block' : 'none')
		console.log(65, this.state.nav.show_tabs)
		this.activeTab = this.state.nav.activeTab
		this.prevCohort = this.activeCohort
		this.activeCohort = this.state.activeCohort
		//this.filterUiRoot = getFilterItemByTag(this.state.filter, 'filterUiRoot')
		//this.cohortFilter = getFilterItemByTag(this.state.filter, 'cohortFilter')
		/*if (!this.dom.cohortTable) this.initCohort()
		if (this.cohortNames) this.activeCohortName = this.cohortNames[this.activeCohort]
		this.filterJSON = JSON.stringify(this.state.filter)
		this.hideSubheader = false

		if (this.state.nav.show_tabs) {
			const promises = []
			if (!(this.activeCohortName in this.samplecounts)) promises.push(this.getCohortSampleCount())
			if (!(this.filterJSON in this.samplecounts)) promises.push(this.getFilteredSampleCount())
			if (promises.length) await Promise.all(promises)
		}
		this.updateUI()*/
	}
	async getCohortSampleCount() {
		if (this.activeCohort == -1) return
		const lst = [
			'genome=' + this.state.genome,
			'dslabel=' + this.state.dslabel,
			'getcohortsamplecount=' + this.activeCohortName,
			'cohortValues=' + this.activeCohortName
		]
		const data = await dofetch2('termdb?' + lst.join('&'), {}, this.app.opts.fetchOpts)
		if (!data) throw `missing data`
		else if (data.error) throw data.error
		else {
			this.samplecounts[this.activeCohortName] = data[0].samplecount
		}
	}
	async getFilteredSampleCount() {
		if (!this.filterUiRoot || !this.filterUiRoot.lst.length) {
			this.samplecounts[this.filterJSON] = this.samplecounts[this.activeCohortName]
			return
		}
		const lst = [
			'genome=' + this.state.genome,
			'dslabel=' + this.state.dslabel,
			'getsamplecount=' + this.activeCohortName,
			'filter=' + encodeURIComponent(this.filterJSON)
		]
		const data = await dofetch2('termdb?' + lst.join('&'), {}, this.app.opts.fetchOpts)
		if (!data) throw `missing data`
		else if (data.error) throw data.error
		else {
			this.samplecounts[this.filterJSON] = data[0].samplecount
		}
	}
}

export const navInit = rx.getInitFxn(TdbNav)

function setRenderers(self) {
	self.initUI = () => {
		const header = self.opts.holder
			.append('div')
			.style('font-family', 'Arial, sans-serif')
			.style('border-bottom', '1px solid #000')

		self.dom = {
			holder: self.opts.holder.style('padding', '5px'),
			header,
			tabDiv: header
				.append('div')
				//.style('display', 'none')
				.style('vertical-align', 'bottom'),
			/*searchDiv: header
				.append('div')
				.style('display', 'inline-block')
				.style('width', '300px')
				.style('margin', '10px')
				.style('vertical-align', 'top'),*/
			sessionDiv: header.append('div'),
			subheaderDiv: self.opts.holder
				.append('div')
				//.style('display', 'none')
				.style('padding-top', '5px')
				.style('border-bottom', '1px solid #000')
			//tip: new Menu({ padding: '5px' })
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
			{ top: 'CHARTS', mid: 'NONE', btm: '' },
			{ top: 'COHORT', mid: 'NONE', btm: '' },
			{ top: 'FILTER', mid: 'NONE', btm: '' },
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
			//.style('display', 'none') // d => (d.colNum === 0 || self.activeCohort !== -1 ? '' : 'none'))
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
		self.subheaderKeys = ['cohort', 'filter', 'cart']
	}
	self.updateUI = () => {
		const selectCohort = self.state.termdbConfig.selectCohort
		self.dom.searchDiv.style('display', selectCohort && self.activeCohort == -1 ? 'none' : 'inline-block')
		self.dom.holder.style('margin-bottom', self.state.nav.show_tabs ? '20px' : '')
		self.dom.header.style('border-bottom', self.state.nav.show_tabs ? '1px solid #000' : '')
		self.dom.tds
			.style(
				'display',
				d => ''
				/*(self.activeCohort !== -1 || !selectCohort) && d.colNum !== 0
					? ''
					: !selectCohort && d.colNum === 0
					? 'none'
					: d.colNum === 0 || self.activeCohort !== -1
					? ''
					: 'none'*/
			)
			.style('color', d => (d.colNum == self.activeTab && !self.hideSubheader ? '#000' : '#aaa'))
			.style('background-color', d => (d.colNum == self.activeTab && !self.hideSubheader ? '#ececec' : 'transparent'))
			.html(function(d, i) {
				if (d.key == 'top') return this.innerHTML
				if (d.colNum === 0) {
					if (self.activeCohortName in self.samplecounts) {
						return d.key == 'top'
							? this.innerHTML
							: d.key == 'mid'
							? self.activeCohortName
							: 'n=' + self.samplecounts[self.activeCohortName]
					} else {
						return d.key == 'mid' ? 'NONE' : this.innerHTML // d.key == 'mid' ? '<span style="font-size: 16px; color: red">SELECT<br/>BELOW</span>' : ''
					}
				} else if (d.colNum === 1) {
					const filter = self.filterUiRoot ? self.filterUiRoot : { lst: [] }
					if (filter.lst.length === 0) {
						return d.key === 'mid' ? 'NONE' : '&nbsp;'
					} else {
						return d.key === 'mid' ? filter.lst.length : 'n=' + self.samplecounts[self.filterJSON]
					}
				} else {
					return d.key === 'mid' ? this.innerHTML : '&nbsp;'
				}
			})

		self.dom.subheaderDiv.style(
			'display',
			self.hideSubheader ? 'none' : !self.state.nav.show_tabs && self.activeTab !== 1 ? 'none' : 'block'
		)

		const visibleSubheaders = []
		for (const key in self.dom.subheader) {
			const display =
				/*key == 'cohort' && self.prevCohort == -1 && self.activeCohort != -1
					? 'none'
					:*/ key == 'search' ||
				self.activeTab == 1 ||
				self.subheaderKeys.indexOf(key)
					? 'block'
					: 'none'

			self.dom.subheader[key].style('display', display)
			if (display != 'none' && key != 'search') visibleSubheaders.push(key)
		}
		self.dom.subheaderDiv.style(
			'border-bottom',
			self.state.nav.show_tabs && visibleSubheaders.length && (self.activeCohort != -1 || !selectCohort)
				? '1px solid #000'
				: ''
		)
		if (self.highlightCohortBy && self.activeCohort != -1) {
			const activeCohort = selectCohort.values[self.activeCohort]
			const activeSelector = activeCohort[self.highlightCohortBy]
			for (const cohort of selectCohort.values) {
				if (cohort[self.highlightCohortBy] !== activeSelector) {
					self.dom.cohortTable.selectAll(cohort[self.highlightCohortBy]).style('background-color', 'transparent')
				}
			}
			self.dom.cohortTable.selectAll(activeSelector).style('background-color', 'yellow')
		}
		if (self.dom.cohortPrompt) self.dom.cohortPrompt.style('display', self.activeCohort == -1 ? '' : 'none')
	}
	self.initCohort = () => {
		if (self.dom.cohortTable) return
		const selectCohort = self.state.termdbConfig.selectCohort
		if (!selectCohort) {
			if (self.activeTab === 0) self.activeTab = 1
			return
		}
		self.dom.tds.filter(d => d.colNum === 0).style('display', '')
		self.cohortNames = selectCohort.values.map(d => d.keys.join(','))

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
		console.log(356, d)
		if (d.colNum == self.activeTab && !self.searching) {
			self.hideSubheader = /*self.prevCohort != -1 &&*/ !self.hideSubheader
			self.prevCohort = self.activeCohort
			self.updateUI()
			// since the app.dispatch() is not called directly,
			// must trigger the event bus here
			if (self.bus) self.bus.emit('postRender')
			return
		}
		self.activeTab = d.colNum
		self.searching = false
		self.hideSubheader = false
		self.app.dispatch({ type: 'tab_set', activeTab: self.activeTab })
	}
}
