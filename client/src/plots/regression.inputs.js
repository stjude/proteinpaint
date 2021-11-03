import { deepEqual } from '../common/rx.core'
import { select } from 'd3-selection'
import { InputTerm } from './regression.inputs.term'

/*
outcome and independent are two sections sharing same structure
"inputs[]" collect one or multiple variables for each section
"input" tracks attributes from a variable

**** function cascade ****

constructor
	createSectionConfigs
	initUI
		submit (by clicking button)
		addSection
main
	mayUpdateSandboxHeader
	setDisableTerms
	renderSection
		updateInputs
		removeInput
		addInput

FIXME submit button toggling is broken
should be disabled when:
1. click run analysis button
2. 
*/

export class RegressionInputs {
	constructor(opts) {
		this.opts = opts
		this.app = opts.app
		// reference to the parent component's mutable instance (not its API)
		this.parent = opts.parent
		this.regressionType = this.opts.regressionType

		setInteractivity(this)
		setRenderers(this)

		this.createSectionConfigs()
		this.initUI()
	}

	createSectionConfigs() {
		/*
			Create configuration data for each section of the input UI
			
			section{}
				.parent: reference to this RegressionInputs instance, to make it easy to access 
								its state, config, app, and other properties from non-rx descendant components

				-----  static configuration  -----
				.heading
					string heading for the section

				.selectPrompt           
					string label to prompt a user to select a new input variable
				
				.configKey        
					["outcome" | "independent"], string configuration key (attribute name)
					the configuration that receives the selected terms
					will also be used to find a section's selected terms from state.config  
				
				.limit
					maximum number inputs that can be selected for this section
				
				.exclude_types    
					term types that cannot be selected as inputs for this section
					// FIXME: should group these handler-specific options by input.varClass
				
				-----  dynamic configuration data  -----

				.inputs[ input{} ]
					from state config.outcome or config.independent
					a cache of input configurations and rendered DOM elements 
					for each selected variable. Removed inputs will be deleted 
					from this object, and newly selected inputs will be added.

					created in updateInputs()

					.input.section
						reference to this section
						for making this section config accessible to downstream logic handling this input, e.g. pill.js
					
					.input.dom{}
						created in addInput()
						.holder
						.err_div
						.* other DOM elements added depending on variable class

					.input.varClass
						the input's variable class, like "term"

					.input[input.varClass]
						the input data for this given varClass	

					.input.handler
						created in addInput()
						the function/object/class instance that will handle
						the variable selection, one for each varClass;
						.update()
							called in main()
						.remove()
						.hasError


				------ tracker for this section's DOM elements -----
				*** each element is added when it is created/appended ***
				.dom{} 
					.holder // allow to selectively hide independent section
					.headingDiv
					.inputsDiv 
		*/

		// configuration for the outcome variable section
		this.outcome = {
			parent: this,
			/*** static configuration ***/
			heading: 'Outcome variable',
			selectPrompt:
				this.opts.regressionType == 'linear'
					? // FIXME use plain text, termsetting should style this with hover effect
					  '<u>Select continuous outcome variable</u>'
					: '<u>Select outcome variable</u>',
			placeholderIcon: '',
			configKey: 'outcome',
			limit: 1,
			exclude_types: this.opts.regressionType == 'linear' ? ['condition', 'categorical', 'survival'] : ['survival'],

			/*** dynamic configuration ***/
			inputs: [],

			/*** tracker for this section's DOM elements ***/
			dom: {}
		}

		// configuration for the independent variable section
		this.independent = {
			parent: this,
			/*** static configuration ***/
			heading: 'Independent variable(s)',
			selectPrompt: '<u>Add independent variable</u>',
			placeholderIcon: '',
			configKey: 'independent',
			limit: 10,
			exclude_types: ['condition', 'survival'],

			/*** dynamic configuration ***/
			inputs: [],

			/*** tracker for this section's DOM elements ***/
			dom: {}
		}

		// track sections in an array, for convenience in loops
		// but not for use in `d3.data()`
		this.sections = [this.outcome, this.independent]

		// track reference category values or groups by term ID
		// k: variable id
		// v: reference group name
		this.refGrpByTermId = {}
		this.totalSampleCount = undefined
	}

	async main() {
		try {
			this.config = this.parent.config
			this.state = this.parent.state
			this.mayUpdateSandboxHeader()
			this.hasError = false
			this.setDisableTerms()
			const updates = []
			for (const section of this.sections) {
				await this.renderSection(section)
				for (const input of section.inputs) {
					input.dom.holder.style('border-left', input[input.varClass] ? '1px solid #bbb' : '')
					if (input.handler) updates.push(input.handler.update(input))
				}
			}
			await Promise.all(updates)
			for (const section of this.sections) {
				for (const input of section.inputs) {
					if ((input.term && input.term.error) || (input.handler && input.handler.hasError)) {
						this.hasError = true
						this.parent.results.dom.holder.style('display', 'none')
					}
				}
			}
			//this.updateSubmitButton(true)
		} catch (e) {
			this.hasError = true
			// FIXME: does not seem right to modify results dom from the inputs code here
			this.parent.results.dom.holder.style('display', 'none')
			throw e
		}
	}

	setDisableTerms() {
		this.disable_terms = []
		if (this.config.outcome && this.config.outcome.varClass == 'term') this.disable_terms.push(this.config.outcome.id)
		if (this.config.independent) {
			for (const term of this.config.independent) {
				if (term.varClass == 'term') this.disable_terms.push(term.id)
			}
		}
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
		section.dom.holder.style('display', section.configKey == 'outcome' || self.config.outcome ? 'block' : 'none')

		updateInputs(section)
		// section.inputs[] is now synced with plot config

		const inputs = section.dom.inputsDiv
			.selectAll(':scope > div')
			// key function (2nd arg) uses a function to determine how datum and element are joined by term id
			.data(section.inputs, input => input.varClass && input[input.varClass] && input[input.varClass].id)

		inputs.exit().each(removeInput)

		inputs
			.enter()
			.append('div')
			.each(addInput)
	}

	function updateInputs(section) {
		// get the input variables from config.outcome or config.independent
		const selected = self.config[section.configKey]

		// force the outcome variable into an array for ease of handling
		// the independent variables array will be used as-is
		const selectedArray = Array.isArray(selected) ? selected : selected ? [selected] : []

		// process each selected variable
		for (const variable of selectedArray) {
			const varClass = variable.varClass
			if (!varClass) throw 'varClass missing on an input from config'

			const input = section.inputs.find(
				input => input.varClass == varClass && input[varClass] && input[varClass].id == variable.id
			)
			if (!input) {
				section.inputs.push({
					section,
					varClass, // varClass = "term" | "..."
					[varClass]: variable // example: input["term"] = {id, term, q}
				})
			}
		}

		// detect if a blank input needs to be created
		const blankInput = section.inputs.find(input => input.varClass && !input[input.varClass])
		if (section.inputs.length < section.limit && !blankInput) {
			if (!blankInput) {
				/*** TODO: should determine varClass by context/parent menu choice? ***/
				// FIXME should not set varClass=term on blankinput but will allow to choose a varClass supported by this dataset
				// e.g. termdbConfig should tell if this dataset has genetic data, supports samplelst etc
				section.inputs.push({ section, varClass: 'term' })
			}
		}
	}

	async function addInput(input) {
		const inputDiv = select(this)
			.style('width', 'fit-content')
			.style('margin', '15px 15px 5px 45px')
			.style('padding', '0px 5px')

		input.dom = {
			holder: inputDiv
		}

		if (input.varClass == 'term') {
			input.handler = new InputTerm({
				holder: inputDiv.append('div'),
				input
			})
		} else {
			throw 'addInput: unknown varClass'
		}
	}

	function removeInput(input) {
		/* NOTE: editConfig deletes this input from the section.inputs array */
		input.handler.remove()
		for (const key in input.dom) {
			//input.dom[key].remove()
			delete input.dom[key]
		}
		const div = select(this)
		div
			.transition()
			.duration(500)
			.style('opacity', 0)
			.remove()
	}

	self.resetSubmitButton = () => {
		// do not disable button upon ui error. only disable after clicking button and analysis is running
		self.dom.submitBtn
			.text('Run analysis')
			.style('display', self.config.outcome && self.config.independent.length ? 'block' : 'none')
			.property('disabled', false)
	}

	self.mayUpdateSandboxHeader = () => {
		if (!self.parent.dom.header) return
		// based on data in config state, but not section
		const o = self.config.outcome
		self.parent.dom.header.html(
			(o ? o[o.varClass].name : '') +
				'<span style="opacity:.6;font-size:.7em;margin-left:10px;">' +
				self.opts.regressionType.toUpperCase() +
				' REGRESSION</span>'
		)
	}
}

function setInteractivity(self) {
	self.editConfig = async (input, variable) => {
		if (!variable) {
			const i = input.section.inputs.findIndex(d => d === input)
			if (i == -1) throw `deleting an unknown input`
			// delete this input
			input.section.inputs.splice(i, 1)
		} else if (input.varClass == 'term') {
			const term = variable
			input.term = term
			// fill in missing attributes in term = {id, term, q, varClass}
			if (!('id' in term)) term.id = term.term.id
			if (!variable.varClass) variable.varClass = input.varClass
		} else {
			throw `unknown input.varClass *** TODO: support non-term input classes ***`
		}

		const key = input.section.configKey

		const selected = input.section.inputs
			// get only non-empty inputs
			.filter(input => input.varClass && input[input.varClass])
			.map(input => input[input.varClass])

		// the target config to fill-in/replace/delete may hold
		// either one or more selected input variables
		self.config[key] = Array.isArray(self.config[key]) ? selected : selected[0]
		self.config.hasUnsubmittedEdits = true

		self.app.dispatch({
			type: 'plot_edit',
			id: self.parent.id,
			chartType: 'regression',
			config: JSON.parse(JSON.stringify(self.config))
		})
	}

	self.submit = () => {
		// disable button upon clicking to prevent double-clicking
		self.dom.submitBtn.property('disabled', true)
		if (self.hasError) {
			alert('Please fix the input variable errors (highlighted in red background).')
			return
		}

		const config = JSON.parse(JSON.stringify(self.config))
		config.hasUnsubmittedEdits = false

		for (const term of config.independent) {
			term.refGrp = term.id in self.refGrpByTermId ? self.refGrpByTermId[term.id] : 'NA'
		}
		if (config.outcome.id in self.refGrpByTermId) {
			config.outcome.refGrp = self.refGrpByTermId[config.outcome.id]
		}

		self.app.dispatch({
			type: 'plot_edit',
			id: self.parent.id,
			chartType: 'regression',
			config
		})
	}
}
