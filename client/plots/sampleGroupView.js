import { getCompInit, copyMerge } from '#rx'
import { getTermValue } from '../termdb/tree.js'
import { select, selectAll } from 'd3-selection'

const childterm_indent = '25px'
export const root_ID = 'root'

// when the total number of children at one branch exceeds this limit, the <div class=cls_termchilddiv> will scroll
// this only count immediate children, not counting grandchildren
const minTermCount2scroll = 20
// max height of aforementioned scrolling <div>
let scrollDivMaxHeight = '400px'

// class names TODO they should be shared between test/tree.spec.js
const cls_termdiv = 'termdiv',
	cls_termchilddiv = 'termchilddiv',
	cls_termbtn = 'termbtn',
	cls_termlabel = 'termlabel',
	cls_termloading = 'termloading',
	cls_termcheck = 'termcheck'
class SampleGroupView {
	constructor(opts) {
		this.type = 'sampleGroupView'
		this.dom = {
			treeDiv: opts.holder,
			sampleDiv: opts.holder.append('div')
		}
		const headerDiv = this.dom.treeDiv.insert('div')
		this.dom.sampleDiv = headerDiv.insert('div').style('display', 'inline-block')
		this.dom.messageDiv = headerDiv
			.insert('div')
			.style('display', 'none')
			.style('vertical-align', 'top')
			.html('&nbsp;&nbsp;Downloading data ...')
		this.dom.table = this.dom.treeDiv.append('div').append('table')

		this.termsByCohort = {}
		this.sampleDataByTermId = {}

		setTreeRenderer(this)
		setTreeInteractivity(this)
	}

	async init(appState) {
		const config = appState.plots.find(p => p.id === this.id)
		const label = this.dom.sampleDiv
			.insert('label')
			.attr('for', 'select')
			.style('vertical-align', 'top')
			.html('&nbsp;Samples:')

		this.select = this.dom.sampleDiv
			.append('select')
			.property('multiple', true)
			.style('margin', '0px 5px')
			.attr('id', 'select')
		this.select
			.selectAll('option')
			.data(config.samples)
			.enter()
			.append('option')
			.attr('value', d => d.sampleId)
			.html((d, i) => d.sampleName)
		this.select.on('change', e => {
			const options = this.select.node().options
			const samples = []
			for (const option of options)
				if (option.selected) {
					const sampleId = Number(option.value)
					const sampleName = config.samples.find(s => s.sampleId == sampleId).sampleName
					const sample = { sampleId, sampleName }
					samples.push(sample)
				}
			this.app.dispatch({ type: 'plot_edit', id: this.id, config: { samples } })
		})

		this.dom.sampleDiv
			.insert('button')
			.text('Download data')
			.style('vertical-align', 'top')
			.on('click', e => {
				this.downloadData()
			})
	}

	getState(appState) {
		const config = appState.plots?.find(p => p.id === this.id)
		const state = {
			vocab: appState.vocab,
			activeCohort: appState.activeCohort,
			termfilter: appState.termfilter,
			termdbConfig: appState.termdbConfig,
			samples: config?.samples,
			hasVerifiedToken: this.app.vocabApi.hasVerifiedToken(),
			tokenVerificationPayload: this.app.vocabApi.tokenVerificationPayload,
			expandedTermIds: config.expandedTermIds || [root_ID]
		}

		if (appState.termdbConfig.selectCohort) {
			state.toSelectCohort = true
			const choice = appState.termdbConfig.selectCohort.values[appState.activeCohort]
			if (choice) {
				// a selection has been made
				state.cohortValuelst = choice.keys
			}
		}
		return state
	}

	async main() {
		if (this.mayRequireToken()) return
		if (this.dom.header) {
			let title = 'Samples ' + this.state.samples.map(s => s.sampleName).join(', ')
			if (title.length > 100) title = title.substring(0, 100) + '...'
			this.dom.header.html(title)
		}
		this.dom.table.selectAll('thead').remove()
		const th = this.dom.table.append('thead')
		th.append('th')
		for (const sample of this.state.samples) {
			this.sampleDataByTermId[sample.sampleId] = {}
			th.append('th').text(sample.sampleName)
		}
		const tr = this.dom.table.append('tr')
		this.termsById = this.getTermsById()
		const root = this.termsById[root_ID]
		this.dom.treeDiv.style('display', 'block')
		root.terms = await this.requestTermRecursive(root)
		this.renderBranch(root, this.dom.table)
	}

	async downloadData() {
		this.dom.messageDiv.style('display', 'inline-block')
		const filename = `samples.tsv`
		const sampleData = {}
		let lines = 'Sample'
		for (const sample of this.state.samples) {
			sampleData[sample.sampleId] = await this.app.vocabApi.getSingleSampleData({ sampleId: sample.sampleId })
			lines += `\t${sample.sampleName}`
		}
		lines += '\n'

		const sampleId = this.state.samples[0].sampleId
		for (const termId in sampleData[sampleId]) {
			const term = sampleData[sampleId][termId].term
			lines += `${term.name}`
			for (const sampleId in sampleData) {
				const data = sampleData[sampleId]
				let value = getTermValue(term, data)
				if (value == null) value = 'Missing'
				lines += `\t${value}`
			}
			lines += '\n'
		}
		const dataStr = 'data:text/tsv;charset=utf-8,' + encodeURIComponent(lines)

		const link = document.createElement('a')
		link.setAttribute('href', dataStr)
		// If you don't know the name or want to use
		// the webserver default set name = ''
		link.setAttribute('download', filename)
		document.body.appendChild(link)
		link.click()
		link.remove()
		this.dom.messageDiv.style('display', 'none')
	}

	mayRequireToken() {
		if (this.state.hasVerifiedToken) {
			this.dom.treeDiv.style('display', 'block')
			return false
		} else {
			const e = this.state.tokenVerificationPayload
			const missingAccess = e?.error == 'Missing access' && this.state.termdbConfig.dataDownloadCatch?.missingAccess
			const message = missingAccess?.message?.replace('MISSING-ACCESS-LINK', missingAccess?.links[e?.linkKey])
			const helpLink = this.state.termdbConfig.dataDownloadCatch?.helpLink
			this.dom.treeDiv
				.style('color', '#e44')
				.html(
					message ||
						(this.state.tokenVerificationMessage || 'Requires sign-in') +
							(helpLink ? ` <a href='${helpLink}' target=_blank>Tutorial</a>` : '')
				)

			return true
		}
	}
}

function setTreeInteractivity(self) {
	/*
		Set interactivity code here, for mouseovers, clicks, etc.

		Closured reference to object instance as self
		versus alternative "this" context such as DOM element

		self: a TdbTree instance
	*/
	// !!! no free-floating variable declarations here !!!
	// use self in TdbTree constructor to create properties

	self.toggleBranch = function (term) {
		//event.stopPropagation()
		if (term.isleaf) return
		const t0 = self.termsById[term.id]
		if (!t0) throw 'invalid term id'

		let expandedTermIds = [...self.state.expandedTermIds]
		const expanded = self.state.expandedTermIds.includes(term.id)
		if (!expanded) expandedTermIds.push(term.id)
		else expandedTermIds = expandedTermIds.filter(id => id != term.id)
		self.app.dispatch({ type: 'plot_edit', id: self.id, config: { expandedTermIds } })
	}
}

function setTreeRenderer(self) {
	self.renderBranch = (term, div, button) => {
		if (!term || !term.terms) return

		self.included_terms = []

		self.included_terms.push(...term.terms)

		if (!(term.id in self.termsById) || !self.included_terms.length) {
			div.style('display', 'none')
			return
		}

		const expandedTermIds = self.state.expandedTermIds
		if (!expandedTermIds.includes(term.id)) {
			div.style('display', 'none')
			if (button) button.text('+')
			return
		}
		div.style('display', 'block')
		if (button) button.text('-')

		const divs = div.selectAll('.' + cls_termdiv).data(self.included_terms, self.bindKey)

		divs.exit().each(self.hideTerm)

		divs.each(self.updateTerm)

		divs.enter().append('tr').append('td').each(self.addTerm)

		for (const child of term.terms) {
			if (expandedTermIds.includes(child.id)) {
				self.renderBranch(
					child,
					div.selectAll('.' + cls_termchilddiv).filter(i => i.id == child.id),
					div.selectAll('.' + cls_termbtn).filter(i => i.id == child.id)
				)
			}
		}
	}

	self.requestTermRecursive = async function (term) {
		const data = await self.app.vocabApi.getTermChildren(
			term,
			self.state.toSelectCohort ? self.state.cohortValuelst : null
		)
		if (data.error) throw data.error
		if (!data.lst || data.lst.length == 0) {
			// do not throw exception; its children terms may have been filtered out
			return []
		}
		const terms = []
		for (const t of data.lst) {
			const copy = Object.assign({}, t)
			terms.push(copy)
			// rehydrate expanded terms as needed
			// fills in termsById, for recovering tree

			if (self.state.expandedTermIds.includes(copy.id)) {
				copy.terms = await self.requestTermRecursive(copy)
				if (self.state.samples) await self.fillSampleData(copy.terms)
			} else {
				// not an expanded term
				// if it's collapsing this term, must add back its children terms for toggle button to work
				// see flag TERMS_ADD_BACK
				const t0 = self.termsById[copy.id]
				if (self.state.samples) await self.fillSampleData([copy])

				if (t0 && t0.terms) {
					copy.terms = t0.terms
				}
			}

			self.termsById[copy.id] = copy
		}
		return terms
	}

	self.getTermsById = function () {
		if (!(self.state.activeCohort in self.termsByCohort)) {
			self.termsByCohort[self.state.activeCohort] = {
				[root_ID]: {
					id: root_ID,
					__tree_isroot: true // must not delete this flag
				}
			}
		}
		return self.termsByCohort[self.state.activeCohort]
	}

	self.fillSampleData = async function (terms) {
		const term_ids = []
		for (const term of terms) term_ids.push(term.id)
		for (const sample of self.state.samples) {
			const data = await self.app.vocabApi.getSingleSampleData({ sampleId: sample.sampleId, term_ids })

			if ('error' in data) throw data.error
			for (const id in data) self.sampleDataByTermId[sample.sampleId][id] = data[id]
		}
	}

	self.bindKey = function (term) {
		return term.id
	}

	self.hideTerm = function (term) {
		if (term.id in self.termsById && self.state.expandedTermIds.includes(term.id)) return
		select(this).style('display', 'none')
	}

	self.updateTerm = function (term) {
		const div = select(this)
		if (!(term.id in self.termsById)) {
			div.style('display', 'none')
			return
		}

		div.style('display', '')
		const isExpanded = self.state.expandedTermIds.includes(term.id)
		div.select('.' + cls_termbtn).text(isExpanded ? '-' : '+')

		// update other parts if needed, e.g. label
		div.select('.' + cls_termchilddiv).style('display', isExpanded ? 'block' : 'none')
	}
	self.addTerm = async function (term) {
		const div = select(this)
			.attr('class', cls_termdiv)
			.style('margin', term.isleaf ? '' : '2px')
			.style('padding', '0px 5px')
		if (self.state.samples) div.style('margin', '0px')
		if (!term.isleaf)
			div
				.insert('div')
				.attr('class', 'sja_menuoption ' + cls_termbtn)
				.style('display', 'inline-block')
				.style('padding', '5px 9px')
				.style('font-family', 'courier')
				.text('+')

				// always allow show/hide children even this term is already in use
				.on('click', event => {
					event.stopPropagation()
					self.toggleBranch(term)
				})
		if (self.expandAll) self.toggleBranch(term)

		let text = term.name

		const labeldiv = div
			.insert('div')
			.attr('class', cls_termlabel)
			.style('display', 'inline-block')
			.style('padding', '5px')
			.style('margin', '1.4px')
			.text(text)

		let infoIcon_div //Empty div for info icon if termInfoInit is called
		if (term.hashtmldetail) {
			infoIcon_div = div.append('div').style('display', 'inline-block')
		}

		//Creates the info icon and description div from termInfo.js
		if (term.hashtmldetail) {
			termInfoInit({
				vocabApi: self.app.vocabApi,
				icon_holder: infoIcon_div,
				content_holder: div.append('div'),
				id: term.id,
				state: { term }
			})
		}

		if (!term.isleaf) {
			div.append('div').attr('class', cls_termchilddiv).style('padding-left', childterm_indent)
		}
	}

	self.getTermValue = function (term, data) {
		let value = data[term.id]?.value
		if (value == null) return null
		if (term.type == 'float' || term.type == 'integer') {
			value = term.values?.[value]?.label || term.values?.[value]?.key || value
			if (isNaN(value)) return value
			return value % 1 == 0 ? value.toString() : value.toFixed(2).toString()
		}

		if (term.type == 'categorical') return term.values[value]?.label || term.values[value]?.key
		if (term.type == 'condition') {
			const values = value.toString().split(' ')
			let [years, status] = values
			status = term.values[status].label || term.values[status].key
			return `Max grade: ${status}, Time to event: ${Number(years).toFixed(1)} years`
		}
		if (term.type == 'survival') {
			const values = value.split(' ')
			let [years, status] = values
			status = term.values?.[status]?.label || term.values?.[status]?.key || status
			return `${status} after ${Number(years).toFixed(1)} years`
		}
		return null
	}
}

export const sampleGroupViewInit = getCompInit(SampleGroupView)
export const componentInit = sampleGroupViewInit

export function getPlotConfig(opts, app) {
	// currently, there are no configurations options for
	// the dictionary tree; may add appearance, styling options later
	const config = {}
	// may apply overrides to the default configuration
	return copyMerge(config, opts)
}
