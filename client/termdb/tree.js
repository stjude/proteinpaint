import { getCompInit } from '../rx'
import { select, selectAll } from 'd3-selection'
import { getNormalRoot } from '#filter'
import { isUsableTerm } from '#shared/termdb.usecase'
import { termInfoInit } from './termInfo'

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

/*
******************** EXPORTED
treeInit()
root_ID

******************** constructor opts{}
.holder
.click_term()
.disable_terms[]

******************** exit/update/enter
termsById{} is bound to the DOM tree, to provide:
- term label
- list of children terms for a parent term


******************* special flags
root term does not exist in the termdb, but is synthesized upon initializing instance, has the "__tree_isroot" flag



******************* Recommended Component Code Organization

(a) class (produces instance):
- all methods expected by rx.api (main, etc)
- all data processing code
(b) setRenderers(self): attaches renderer methods
(c) setInteractivity(self): attaches event handlers

*/

class TdbTree {
	/*
	Termdb Tree Component
	- api-related and data processing code
	  within this class declaration
	*/
	constructor(opts) {
		this.type = 'tree'

		// attach instance-specific methods via closure
		setInteractivity(this)
		setRenderers(this)

		// for terms waiting for server response for children terms, transient, not state
		this.loadingTermSet = new Set()
		this.termsByCohort = {}
		this.expandAll = 'expandAll' in opts ? opts.expandAll : false
		//getCompInit(TdbTree) will set this.id, .app, .opts, .api
		this.sampleDataByTermId = {}
	}

	async init(appState) {
		const header = this.opts.holder.append('div')
		if (appState.samples) for (const sample of appState.samples) this.sampleDataByTermId[sample.sampleId] = {}
		const mainDiv = this.opts.holder.append('div')
		const left = mainDiv.insert('div').style('display', 'inline-block').style('min-width', '300px')
		const right = mainDiv.insert('div').style('display', 'inline-block').style('vertical-align', 'top')
		const samplesTable = right.append('table').style('position', `relative`).style('top', `-32px`)

		this.dom = {
			holder: left.insert('div'),
			header,
			samplesTable
		}
	}

	reactsTo(action) {
		if (action.type.startsWith('tree_')) return true
		if (action.type.startsWith('filter_')) return true
		if (action.type.startsWith('cohort_')) return true
		if (action.type.startsWith('info_')) return true
		if (action.type.startsWith('submenu_')) return true
		if (action.type == 'app_refresh') return true
	}

	getState(appState) {
		const filter = getNormalRoot(appState.termfilter.filter)
		const state = {
			isVisible: !appState.submenu.term,
			activeCohort: appState.activeCohort,
			expandedTermIds: appState.tree.expandedTermIds,
			selectedTerms: appState.selectedTerms,
			termfilter: { filter },
			usecase: appState.tree.usecase,
			samples: appState.samples
		}
		// if cohort selection is enabled for the dataset, tree component needs to know which cohort is selected
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
		this.sampleDataByTermId = {}
		this.dom.header.selectAll('*').remove()
		if (this.state.samples) {
			for (const sample of this.state.samples) this.sampleDataByTermId[sample.sampleId] = {}
		}
		if (!this.state.isVisible) {
			this.dom.holder.style('display', 'none')
			return
		}

		if (this.state.toSelectCohort) {
			// dataset requires a cohort to be selected
			if (!this.state.cohortValuelst) {
				// a selection has not been made; do not render tree
				return
			}
		}
		// refer to the current cohort's termsById
		this.termsById = this.getTermsById()

		const root = this.termsById[root_ID]
		root.terms = await this.requestTermRecursive(root)
		this.dom.holder.style('display', 'block')
		this.renderBranch(root, this.dom.holder)
		this.renderSampleTable()
	}

	getTermsById() {
		if (!(this.state.activeCohort in this.termsByCohort)) {
			this.termsByCohort[this.state.activeCohort] = {
				[root_ID]: {
					id: root_ID,
					__tree_isroot: true // must not delete this flag
				}
			}
		}
		return this.termsByCohort[this.state.activeCohort]
	}

	async requestTermRecursive(term) {
		/* will request child terms for this entire branch recursively

		must synthesize request string (dataName) for every call
		and get cached result for the same dataName which has been requested before
		this is to support future features
		e.g. to show number of samples for each term that can change based on filters
		where the same child terms already loaded must be re-requested with the updated filter parameters to update

		TODO determine when to re-request cached server response as needed

		CAUTION
		will be great if tree_collapse will not trigger this function
		but hard to do given that main() has no way of telling what action was dispatched
		to prevent previously loaded .terms[] for the collapsing term from been wiped out of termsById,
		need to add it back TERMS_ADD_BACK
		*/
		const data = await this.app.vocabApi.getTermChildren(
			term,
			this.state.toSelectCohort ? this.state.cohortValuelst : null
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

			if (this.state.expandedTermIds.includes(copy.id)) {
				copy.terms = await this.requestTermRecursive(copy)
				if (this.state.samples) await this.fillSampleData(copy.terms)
			} else {
				// not an expanded term
				// if it's collapsing this term, must add back its children terms for toggle button to work
				// see flag TERMS_ADD_BACK
				const t0 = this.termsById[copy.id]
				if (this.state.samples) await this.fillSampleData([copy])

				if (t0 && t0.terms) {
					copy.terms = t0.terms
				}
			}

			this.termsById[copy.id] = copy
		}
		return terms
	}

	async fillSampleData(terms) {
		const term_ids = []
		for (const term of terms) term_ids.push(term.id)
		for (const sample of this.state.samples) {
			const data = await this.app.vocabApi.getSingleSampleData({ sampleId: sample.sampleId, term_ids })
			if ('error' in data) throw data.error
			for (const id in data) this.sampleDataByTermId[sample.sampleId][id] = data[id]
		}
	}

	bindKey(term) {
		return term.id
	}
}

export const treeInit = getCompInit(TdbTree)

function setRenderers(self) {
	/*
		Set static renderer code here for HTML, SVGs, etc 

		Closured reference to object instance as self
		versus alternative "this" context such as DOM element

		self: a TdbTree instance
	*/
	// !!! no free-floating variable declarations here !!!
	// set properties within the class declarations

	/*
	term{}
		must be from termsById
		.terms[]
			list of children terms
	div
		the childdiv of this term
	button
		optional, the toggle button
	*/
	self.renderBranch = (term, div, button) => {
		if (!term || !term.terms) return

		if (term.terms.length >= minTermCount2scroll && !self.state.samples) {
			// too many children. scroll
			if (div.classed('sjpp_hide_scrollbar')) {
				// already scrolling. the style has been applied from a previous click. do not reset
			} else {
				div.style('max-height', scrollDivMaxHeight)
				div.style('padding', '10px').style('resize', 'vertical').classed('sjpp_hide_scrollbar', true)

				/***************************
				remaining issues

				1. if there's a way to make scrollbar always visible, as a clear indication you need to scroll to see more hidden stuff
				*/
			}
		}

		// add disabled terms to opts.disable_terms
		if (self.opts.disable_terms) {
			term.terms.forEach(t => {
				if (t.disabled) self.opts.disable_terms.push(t.id)
			})
		}

		self.included_terms = []
		if (self.state.usecase) {
			for (const t of term.terms) {
				if (isUsableTerm(t, self.state.usecase).size) {
					t.parent = term
					self.included_terms.push(t)
				}
			}
		} else {
			self.included_terms.push(...term.terms)
		}

		if (!(term.id in self.termsById) || !self.included_terms.length) {
			div.style('display', 'none')
			return
		}

		if (self.loadingTermSet.has(term.id)) {
			self.loadingTermSet.delete(term.id)
			div.select('.' + cls_termloading).remove()
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

		divs.enter().append('div').each(self.addTerm)

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

	// this == the d3 selected DOM node
	self.hideTerm = function (term) {
		if (term.id in self.termsById && self.state.expandedTermIds.includes(term.id)) return
		select(this).style('display', 'none')
	}

	self.renderSampleTable = function () {
		const openBranches = [self.state.samples]
		this.dom.holder.selectAll('.termdiv').each(function (d) {
			if (select(this).style('display') != 'none') openBranches.push(d)
			select(this).style('background-color', '#fafafa')
		})
		const trs = this.dom.samplesTable
			.style('display', openBranches.length ? 'inline-block' : 'none')
			.selectAll('tr')
			.data(openBranches)
		trs.exit().remove()
		trs.each(self.renderTr)
		trs.enter().append('tr').each(self.renderTr)
	}

	self.renderTr = function (branchData, trIndex) {
		const tds = select(this)
			.selectAll('td')
			.data(self.state.samples.map(sample => ({ sample, branchData, trIndex })))
		tds.exit().remove()
		tds.each(self.renderTd)
		const height = self.dom.holder.select('.termlabel').node().getBoundingClientRect().height //; console.log(495, height)
		tds
			.enter()
			.append('td')
			.style('height', `${height}px`)
			.style('color', 'gray')
			.style('background-color', '#fafafa')
			.style('padding', '0 16px')
			.style('text-align', 'end')
			.style('border', '1px solid white')

			.each(self.renderTd)
	}

	self.renderTd = function (d, i) {
		const sampleId = Number(d.sample.sampleId)
		const data = self.sampleDataByTermId[sampleId]
		const term = d.branchData
		select(this).html(d.trIndex === 0 ? d.sample.sampleName : getTermValue(term, data))
	}

	self.updateTerm = function (term) {
		const div = select(this)
		if (!(term.id in self.termsById)) {
			div.style('display', 'none')
			return
		}
		const termIsDisabled = self.opts.disable_terms?.includes(term.id)
		const uses = isUsableTerm(term, self.state.usecase)

		div.style('display', '')
		const isExpanded = self.state.expandedTermIds.includes(term.id)
		div.select('.' + cls_termbtn).text(isExpanded ? '-' : '+')

		// update other parts if needed, e.g. label
		div.select('.' + cls_termchilddiv).style('display', isExpanded ? 'block' : 'none')

		const isSelected = self.state.selectedTerms.find(t => t.name === term.name && t.type === term.type)
		div
			.select('.' + cls_termlabel)
			.style(
				'background-color',
				!uses.has('plot') || termIsDisabled || self.state.samples
					? ''
					: isSelected
					? 'rgba(255, 194, 10,0.5)'
					: '#cfe2f3'
			)
		div
			.select('.' + cls_termcheck)
			.style('display', uses.has('plot') && isSelected && !termIsDisabled ? 'inline-block' : 'none')
	}
	self.addTerm = async function (term) {
		const termIsDisabled = self.opts.disable_terms?.includes(term.id)
		const uses = isUsableTerm(term, self.state.usecase)

		const div = select(this)
			.attr('class', cls_termdiv)
			.style('margin', term.isleaf ? '' : '2px')
			.style('padding', '0px 5px')
		if (self.state.samples) div.style('margin', '0px')

		if (uses.has('branch')) {
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
		}

		const isSelected = self.state.selectedTerms.find(t => t.name === term.name && t.type === term.type)
		let text = term.name

		const labeldiv = div
			.insert('div')
			.attr('class', cls_termlabel)
			.style('display', 'inline-block')
			.style('padding', '5px')
			.style('margin', '1.4px')
			.style('opacity', termIsDisabled ? 0.4 : null)
			.text(text)

		let infoIcon_div //Empty div for info icon if termInfoInit is called
		if (term.hashtmldetail) {
			infoIcon_div = div.append('div').style('display', 'inline-block')
		}
		if (uses.size > 0) {
			if (termIsDisabled) {
				labeldiv
					.attr('class', 'sja_tree_click_term_disabled ' + cls_termlabel)
					.style('padding', '5px 8px')
					.style('margin', '2px 0px')
					.style('opacity', 0.4)
			} else if (uses.has('plot') && !self.state.samples) {
				labeldiv
					// need better css class
					.style('color', 'black')
					.style('padding', '5px 8px')
					.style('border-radius', '6px')
					.style('margin', '2px 0px')
					.style('cursor', 'default')
					.on('click', () => self.clickTerm(term))
					.attr('class', 'ts_pill sja_filter_tag_btn sja_tree_click_term ' + cls_termlabel)
					.style('background-color', isSelected ? 'rgba(255, 194, 10,0.5)' : '#cfe2f3')
			}

			//show sample count for a term
			if (term.samplecount !== undefined) {
				div
					.append('div')
					.style('font-size', '.8em')
					.style('display', 'inline-block')
					.style('margin-left', '5px')
					.style('color', term.samplecount ? '#777' : '#ddd')
					.text('n=' + term.samplecount)
			}
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

		let selected_checkbox
		if (self.opts.submit_lst) {
			selected_checkbox = div
				.append('div')
				.attr('class', cls_termcheck)
				.style('color', '#008000')
				.style('display', isSelected ? 'inline-block' : 'none')
				.html('&check;')
		}

		if (!term.isleaf) {
			div.append('div').attr('class', cls_termchilddiv).style('padding-left', childterm_indent)
		}
	}
}

export function getTermValue(term, data) {
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

function setInteractivity(self) {
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

		if (!t0.terms) {
			// to load child term with request, guard against repetitive clicking
			// TERMS_ADD_BACK
			// this requires .terms[] to be added back when updated by requestTermRecursive()
			if (self.loadingTermSet.has(t0.id)) return
			self.loadingTermSet.add(t0.id)
			select(this.parentNode)
				.selectAll('.' + cls_termchilddiv)
				.filter(d => d.id === t0.id)
				.style('display', 'block')
				.append('div')
				.text('Loading...')
				.attr('class', cls_termloading)
				.style('opacity', 0.5)
				.style('padding', '5px')
		}

		const expanded = self.state.expandedTermIds.includes(term.id)
		const type = expanded ? 'tree_collapse' : 'tree_expand'
		self.app.dispatch({ type, termId: term.id })
	}

	self.clickTerm = async term => {
		if (self.opts.click_term2select_tvs) {
			self.app.dispatch({ type: 'submenu_set', submenu: { term, type: 'tvs' } })
			return
		}

		if (self.opts.click_term_wrapper) {
			self.opts.click_term_wrapper(term)
			return
		}

		if (self.opts.submit_lst) {
			const i = self.state.selectedTerms.findIndex(t => t.name === term.name)
			if (i == -1) {
				self.app.dispatch({
					type: 'app_refresh',
					state: {
						selectedTerms: [...self.state.selectedTerms, term]
					}
				})
			} else {
				const selectedTerms = self.state.selectedTerms.slice(0)
				selectedTerms.splice(i, 1)
				self.app.dispatch({
					type: 'app_refresh',
					state: { selectedTerms }
				})
			}
			return
		}

		throw 'missing term click callback'
	}
}
