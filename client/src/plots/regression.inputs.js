import { getCompInit, copyMerge } from '../common/rx.core'
import { select } from 'd3-selection'
import { get_bin_label } from '../../shared/termdb.bins'
import { setPillMethods } from './regression.pill'
import { setValuesTableMethods } from './regression.valuesTable'

export class RegressionInputs {
	constructor(opts) {
		this.opts = opts
		this.app = opts.app
		// reference to the parent component's mutable instance (not its API)
		this.parent = opts.parent
		this.type = 'regressionUI'

		const regressionType = this.opts.regressionType
		this.outcome = {
			label: 'Outcome variable',
			prompt: {
				linear: '<u>Select continuous outcome variable</u>',
				logistic: '<u>Select outcome variable</u>'
			},
			placeholderIcon: '',
			configKey: 'term',
			limit: 1,
			selected: [],
			cutoffTermTypes: ['condition', 'integer', 'float'],
			exclude_types: {
				linear: ['categorical', 'survival'],
				logistic: ['survival']
			},
			// to track and recover selected term pills, info divs, other dom elements,
			// and avoid unnecessary jerky full rerenders for the same term
			items: {}
		}

		this.independent = {
			label: 'Independent variable(s)',
			prompt: {
				linear: '<u>Add independent variable</u>',
				logistic: '<u>Add independent variable</u>'
			},
			placeholderIcon: '',
			configKey: 'independent',
			limit: 10,
			selected: [],
			items: {},
			exclude_types: {
				linear: ['condition', 'survival'],
				logistic: ['condition', 'survival']
			}
		}

		this.sections = [this.outcome, this.independent]

		// track reference category values or groups by term ID
		this.refGrpByTermId = {}
		this.totalSampleCount = undefined

		const controls = this.opts.holder.append('div').style('display', 'block')
		this.dom = {
			div: this.opts.holder, //.style('margin', '10px 0px'),
			controls,
			body: controls.append('div'),
			foot: controls.append('div')
		}
		setInteractivity(this)
		setRenderers(this)
		setPillMethods(this)
		setValuesTableMethods(this)
	}

	async main() {
		try {
			this.hasError = false
			// share the writable config copy
			this.config = this.parent.config
			this.state = this.parent.state
			if (!this.dom.submitBtn) this.initUI()
			await this.render()

			const updates = []
			for (const section of this.sections) {
				/* TODO: may need to convert to section.items to an array to support non-term variables */
				for (const id in section.items) {
					const d = section.items[id]
					d.dom.err_div.style('display', 'none').text('')
					updates.push(d.update())
				}
			}
			await Promise.all(updates)
		} catch (e) {
			throw e
		}
	}

	setDisableTerms() {
		this.disable_terms = []
		if (this.config.term) this.disable_terms.push(this.config.term.id)
		if (this.config.independent) for (const term of this.config.independent) this.disable_terms.push(term.id)
	}
}

function setRenderers(self) {
	self.initUI = () => {
		self.dom.submitBtn = self.dom.foot
			.style('margin', '3px 15px')
			.style('padding', '3px 5px')
			.append('button')
			.style('display', 'none')
			.style('padding', '5px 15px')
			.style('border-radius', '15px')
			.html('Run analysis')
			.on('click', self.submit)

		self.updateBtns()
	}

	self.render = async () => {
		try {
			self.setDisableTerms()
			const grps = self.dom.body.selectAll(':scope > div').data(self.sections || [])

			grps.exit().remove()
			grps.each(renderSection)
			grps
				.enter()
				.append('div')
				.style('margin', '3px 5px')
				.style('padding', '3px 5px')
				.each(renderSection)

			self.updateBtns()
		} catch (e) {
			self.hasError = true
			throw e
		}
	}

	// initialize the ui sections
	function renderSection(section) {
		const div = select(this)

		// in case of an empty div
		if (!this.lastChild) {
			// firstChild
			div
				.append('div')
				.style('margin', '3px 5px')
				.style('padding', '3px 5px')
				.style('font-size', '17px')
				.style('color', '#bbb')
				.text(section.label)

			// this.lastChild
			div.append('div')
		}

		const v = self.config[section.configKey]
		section.selected = Array.isArray(v) ? v : v ? [v] : []
		const itemRefs = section.selected.map(term => {
			if (!(term.id in section.items)) {
				section.items[term.id] = { ra: this, section, term }
			}
			return section.items[term.id]
		})

		if (itemRefs.length < section.limit && !itemRefs.find(d => !d.term)) {
			// create or reuse a blank pill to prompt a new term selection
			if (!section.items.undefined) section.items.undefined = { section }
			itemRefs.push(section.items.undefined)
		}

		const inputDivs = select(this.lastChild)
			.selectAll(':scope > div')
			.data(itemRefs, d => d.term && d.term.id)
		inputDivs.exit().each(removeInput)

		/* 
			NOTE: will do the input rendering for each variable 
			after the sections are rendered, in order to properly await 
			the async update methods 
		*/
		// inputDivs.each(updateInput)

		inputDivs
			.enter()
			.append('div')
			.each(addInput)
	}

	async function addInput(d) {
		const config = self.config
		const div = select(this)
			.style('width', 'fit-content')
			.style('margin', '5px 15px 5px 45px')
			.style('padding', '3px 5px')
			.style('border-left', d.term ? '1px solid #bbb' : '')

		d.dom = {
			holder: div,
			pillDiv: div.append('div'),
			err_div: div
				.append('div')
				.style('display', 'none')
				.style('padding', '5px')
				.style('background-color', 'rgba(255,100,100,0.2)'),
			infoDiv: div.append('div')
		}

		/*
			for now, only 'term' variables are supported;
			may add logic later to support other types of variable
		*/
		// for now, assume will always need a termsetting pill
		// NOTE: future variable types (genotype, sample list) may not need a ts pill
		self.addPill(d)
		// for now, assume will always need a values table
		self.addValuesTable(d)

		// collect the update functions for each variable
		// so that multiple variable updates can be called in parallel
		// and not block each other
		d.update = async () => {
			/* these function calls should depend on what has been set for this variable */
			if (d.pill) await self.updatePill(d)
			// the term.q is set within self.updatePill, so must await
			if (d.dom.values_table) await self.updateValuesTable(d)
		}
	}

	async function updateInput(d) {
		d.dom.holder.style('border-left', d.term ? '1px solid #bbb' : '')
		d.dom.infoDiv.style('display', d.term ? 'block' : 'none')
	}

	function removeInput(d) {
		delete d.section.items[d.term.id]
		for (const name in d.dom) {
			delete d.dom[name]
		}
		const div = select(this)
		div
			.transition()
			.duration(500)
			.style('opacity', 0)
			.remove()
	}

	self.updateBtns = chartRendered => {
		if (!self.dom.submitBtn) return
		const hasOutcomeTerm = self.sections.filter(s => s.configKey == 'term' && s.selected.length).length
		const hasIndependetTerm = self.sections.filter(s => s.configKey == 'independent' && s.selected.length).length
		const hasBothTerms = hasOutcomeTerm && hasIndependetTerm
		self.dom.submitBtn.style('display', hasBothTerms ? 'block' : 'none')

		if (self.hasError) {
			self.dom.submitBtn.property('disabled', true).html('Run analysis')
		} else if (chartRendered) {
			self.dom.submitBtn.property('disabled', false).html('Run analysis')
		}
	}
}

function setInteractivity(self) {
	self.editConfig = async (d, term) => {
		const c = self.config
		const key = d.section.configKey
		if (term && term.term && !('id' in term)) term.id = term.term.id
		// edit section data
		if (Array.isArray(c[key])) {
			if (!d.term) {
				if (term) c[key].push(term)
			} else {
				const i = c[key].findIndex(t => t.id === d.term.id)
				if (term) c[key][i] = term
				else c[key].splice(i, 1)
			}
		} else {
			if (term) c[key] = term
			//else delete c[key]
		}

		// edit pill data and tracker
		if (term) {
			delete d.section.items[d.term && d.term.id]
			d.section.items[term.id] = d
			d.term = term
		} // if (!term), do not delete d.term, so that it'll get handled in pillDiv.exit()

		self.render()
	}

	self.submit = () => {
		if (self.hasError) {
			alert('Please fix the input variable errors (highlighted in red background).')
			self.dom.submitBtn.property('disabled', true)
			return
		}

		const config = JSON.parse(JSON.stringify(self.config))
		//delete config.settings
		for (const term of config.independent) {
			term.q.refGrp = term.id in self.refGrpByTermId ? self.refGrpByTermId[term.id] : 'NA'
		}
		if (config.term.id in self.refGrpByTermId) config.term.q.refGrp = self.refGrpByTermId[config.term.id]
		// disable submit button on click, reenable after rendering results
		self.dom.submitBtn.property('disabled', true).html('Running...')
		self.parent.app.dispatch({
			type: config.term ? 'plot_edit' : 'plot_show',
			id: self.parent.id,
			chartType: 'regression',
			config
		})
	}
}
