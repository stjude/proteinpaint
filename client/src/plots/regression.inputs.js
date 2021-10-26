import { select } from 'd3-selection'
import { setPillMethods } from './regression.pill'
import { setValuesTableMethods } from './regression.valuesTable'

export class RegressionInputs {
	constructor(opts) {
		this.opts = opts
		this.app = opts.app
		// reference to the parent component's mutable instance (not its API)
		this.parent = opts.parent
		this.regressionType = this.opts.regressionType

		setInteractivity(this)
		setRenderers(this)
		setPillMethods(this)
		setValuesTableMethods(this)

		this.createSectionConfigs()
		this.initUI()
	}

	createSectionConfigs() {
		/*
			Create configuration data for each section of the input UI
			
			section{}
				-----  static configuration  -----
				.heading
					string heading for the section

				.selectPrompt           
					string label to prompt a user to select a new input variable
				
				.configKey        
					["term" | "independent"], string configuration key (attribute name)
					the configuration that receives the selected terms
					will also be used to find a section's selected terms from state.config  
					TODO rename "term" to "outcome"
				
				.limit
					maximum number inputs that can be selected for this section
				
				.exclude_types    
					term types that cannot be selected as inputs for this section
				
				
				-----  dynamic configuration data  -----
				*** recomputed on each updateSection() ***  

				.selected[] 
					a copy of state.config[section.configKey]
					either [config.term] or config.independent
					each element is {id, term, q}
					TODO later expands to this format for an element: {type:'term', term: {id, term, q}}

				.inputs {[term.id]: {*input*}}
					a cache of input configurations and rendered DOM elements 
					for each selected variable. Removed inputs will be deleted 
					from this object, and newly selected inputs will be added.

					TODO may convert to an array of same length, so that .inputs[i] and .selected[i] refer to the same thing

					.input.section
						reference to this section
						for making this section config accessible to downstream logic handling this input, e.g. pill.js
					
					.input.term {id, term, q}
						may be empty initially
					
					.input.pill
						termsetting pill API
					
					.input.valuesTable
						table to show sample counts for each term value/bin/category and to select refGrp

					.input.update()
						created in addInput(), run in triggerUpdate()

					.input.dom{}
						.holder
						.pillDiv
						.err_div
						.infoDiv

					.input.*
						support non-term input variables in the future

				.inputConfigs[]
					values of .inputs{}, arranged into the order of .selected[]
					drives d3 data/enter/update


				------ tracker for this section's DOM elements -----
				*** each element is added when it is created/appended ***
				.dom{} 
					.holder // allow to selectively hide independent section
					.headingDiv
					.inputsDiv 
		*/

		// configuration for the outcome variable section
		this.outcome = {
			/*** static configuration ***/
			heading: 'Outcome variable',
			selectPrompt:
				this.opts.regressionType == 'linear'
					? // FIXME use plain text, termsetting should style this with hover effect
					  '<u>Select continuous outcome variable</u>'
					: '<u>Select outcome variable</u>',
			placeholderIcon: '',
			configKey: 'term',
			limit: 1,
			exclude_types: this.opts.regressionType == 'linear' ? ['condition', 'categorical', 'survival'] : ['survival'],

			/*** dynamic configuration ***/
			selected: [],
			inputs: {},

			/*** tracker for this section's DOM elements ***/
			dom: {}
		}

		// configuration for the independent variable section
		this.independent = {
			/*** static configuration ***/
			heading: 'Independent variable(s)',
			selectPrompt: '<u>Add independent variable</u>',
			placeholderIcon: '',
			configKey: 'independent',
			limit: 10,
			exclude_types: ['condition', 'survival'],

			/*** dynamic configuration ***/
			selected: [],
			inputs: {},

			/*** tracker for this section's DOM elements ***/
			dom: {}
		}

		// track sections in an array, for convenience in loops
		// but not for use in `d3.data()`
		this.sections = [this.outcome, this.independent]

		// track reference category values or groups by term ID
		this.refGrpByTermId = {}
		this.totalSampleCount = undefined
	}

	async main() {
		try {
			this.hasError = false
			// share the writable config copy
			this.config = this.parent.config
			this.state = this.parent.state
			await this.triggerUpdate()
		} catch (e) {
			this.hasError = true
			throw e
		}
	}

	async triggerUpdate() {
		this.setSectionInputConfigs()
		this.setDisableTerms()
		const updates = []
		for (const section of this.sections) {
			await this.renderSection(section)

			for (const id in section.inputs) {
				const input = section.inputs[id]
				input.dom.err_div.style('display', 'none').text('')
				updates.push(input.update())
			}
		}
		await Promise.all(updates)
		this.updateSubmitButton()
	}

	setSectionInputConfigs() {
		for (const section of this.sections) {
			// get the terms or variables for config.term or config.independent
			const v = this.config[section.configKey]

			// force config.term into an array for ease of handling
			// the config.independent array will be used as-is
			section.selected = Array.isArray(v) ? v : v ? [v] : []

			// process each selected term
			const inputConfigs = []
			for (const term of section.selected) {
				if (!(term.id in section.inputs)) {
					// create an input config cache for this term.id, if none exists
					section.inputs[term.id] = { section, term }
				}
				inputConfigs.push(section.inputs[term.id])
			}

			// detect if a blank input needs to be created
			if (inputConfigs.length < section.limit && !inputConfigs.find(input => !input.term)) {
				// create or reuse a blank pill to prompt a new term selection
				if (!section.inputs.undefined) section.inputs.undefined = { section }
				inputConfigs.push(section.inputs.undefined)
			}

			// will use this later as part of rendering a section
			section.inputConfigs = inputConfigs
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
		const controls = self.opts.holder.append('div').style('display', 'block')

		self.dom = {
			div: self.opts.holder, //.style('margin', '10px 0px'),
			controls,
			body: controls.append('div'),
			foot: controls.append('div')
		}

		self.dom.submitBtn = self.dom.foot
			.style('margin', '3px 15px')
			.style('padding', '3px 5px')
			.append('button')
			.style('display', 'none')
			.style('padding', '5px 15px')
			.style('border-radius', '15px')
			.text('Run analysis')
			.on('click', self.submit)

		/*
			not using d3.data() here since each section may only
			be added and re-rendered, but not removed
		*/
		for (const section of self.sections) {
			const div = self.dom.body.append('div')
			self.addSection(section, div)
		}
	}

	self.addSection = function(section, div) {
		div
			.style('display', 'none')
			.style('margin', '3px 5px')
			.style('padding', '3px 5px')

		section.dom = {
			holder: div,
			headingDiv: div
				.append('div')
				.style('margin', '3px 5px')
				.style('padding', '3px 5px')
				.style('font-size', '17px')
				.style('color', '#bbb')
				.text(section.heading),

			inputsDiv: div.append('div')
		}
	}

	/* 
		update each section's visibility,
		remove and add inputs as needed,
		and later may do more section restyling based on
		the state of inputs that are being edited
	*/
	self.renderSection = function(section) {
		// decide to show/hide this section
		// only show when this section is for outcome,
		// or this is independent and only show it when the outcome term has been selected
		// effect is to force user to first select outcome, then independent, but not to select independent first
		section.dom.holder.style('display', section.configKey == 'term' || self.config.term ? 'block' : 'none')

		const inputs = section.dom.inputsDiv
			.selectAll(':scope > div')
			// key function (2nd arg) uses (es6 shorthand?) determines datum and element are joined by term id
			.data(section.inputConfigs, input => input.term && input.term.id)

		inputs.exit().each(removeInput)

		inputs
			.enter()
			.append('div')
			.each(addInput)
	}

	async function addInput(input) {
		const config = self.config
		const div = select(this)
			.style('width', 'fit-content')
			.style('margin', '15px 15px 5px 45px')
			.style('padding', '0px 5px')

		input.dom = {
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
			for now, only 'term' variables are supported and will always create termsetting pill
			TODO support other types of input which may not need pill
		*/
		self.addPill(input)
		// for now, assume will always need a values table
		self.addValuesTable(input)

		// collect the update functions for each input
		// so that multiple input updates can be called in parallel
		// and not block each other
		input.update = async () => {
			input.dom.holder.style('border-left', input.term ? '1px solid #bbb' : '')
			/* these function calls should depend on what has been set for this input */
			if (input.pill) await self.updatePill(input)
			// the term.q is set within self.updatePill, so must await
			if (input.dom.values_table) await self.updateValuesTable(input)
		}
	}

	function removeInput(input) {
		delete input.section.inputs[input.term.id]
		for (const name in input.dom) {
			//input.dom[name].remove()
			delete input.dom[name]
		}
		const div = select(this)
		div
			.transition()
			.duration(500)
			.style('opacity', 0)
			.remove()
	}

	self.updateSubmitButton = chartRendered => {
		if (!self.dom.submitBtn) return
		const hasOutcomeTerm = self.sections.filter(s => s.configKey == 'term' && s.selected.length).length
		const hasIndependetTerm = self.sections.filter(s => s.configKey == 'independent' && s.selected.length).length
		const hasBothTerms = hasOutcomeTerm && hasIndependetTerm
		self.dom.submitBtn.text('Run analysis').style('display', hasBothTerms ? 'block' : 'none')

		if (self.hasError) {
			self.dom.submitBtn.property('disabled', true)
		} else if (chartRendered) {
			self.dom.submitBtn.property('disabled', false)
		}
	}
}

function setInteractivity(self) {
	self.editConfig = async (input, term) => {
		const c = self.config
		const key = input.section.configKey
		if (term && term.term && !('id' in term)) term.id = term.term.id
		// edit section data

		if (Array.isArray(c[key])) {
			if (!input.term) {
				if (term) c[key].push(term)
			} else {
				const i = c[key].findIndex(t => t.id === input.term.id)
				if (term) c[key][i] = term
				else c[key].splice(i, 1)
			}
		} else {
			if (term) c[key] = term
			//else delete c[key]
		}

		// edit pill data and tracker
		if (term) {
			delete input.section.inputs[input.term && input.term.id]
			input.section.inputs[term.id] = input
			input.term = term
		} // if (!term), do not delete input.term, so that it'll get handled in pillDiv.exit()

		self.triggerUpdate()
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
		self.dom.submitBtn.property('disabled', true).text('Running...')
		self.parent.app.dispatch({
			type: config.term ? 'plot_edit' : 'plot_show',
			id: self.parent.id,
			chartType: 'regression',
			config
		})
	}
}
