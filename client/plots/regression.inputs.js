import { deepEqual } from '../rx'
import { select } from 'd3-selection'
import { InputTerm } from './regression.inputs.term'

/*
outcome and independent are two sections sharing same structure
"inputLst[]" collect one or multiple variables for each section
"input" tracks attributes from a variable
blank input: a blank input is a termsetting instance. once a term is created for it, the term is filled to the same instance, and a new blank input may need to be created (for independent section)

**** function cascade ****

constructor
	createSectionConfigs
	initUI
		addSection
		submit (by clicking button)
		editConfig (by termsetting callback)
main
	mayUpdateSandboxHeader
	setDisableTerms
	renderSection
		syncInputsWithConfig
			InputTerm
			mayAddBlankInput
				InputTerm
		removeInput
		addInput
*/

// non-dictionary term types to use as independent variable
// check against allowedTermTypes from a dataset
const allNonDictionaryTerms = [
	{
		termtype: 'snplst',
		//html: 'A list of SNPs <span style="font-size:.7em">All SNPs are analyzed in one model</span>'
		html: 'A list of variants'
	},

	{
		termtype: 'snplocus',
		//html: 'Variants in a locus <span style="font-size:.7em">Variants are analyzed individually</span>'
		html: 'Variants in a locus'
	},
	{
		termtype: 'prs',
		text: 'Polygenic risk score'
	}
]

export class RegressionInputs {
	constructor(opts) {
		this.opts = opts
		this.app = opts.app
		// reference to the parent component's mutable instance (not its API)
		this.parent = opts.parent

		setInteractivity(this)
		setRenderers(this)

		this.createSectionConfigs()
		this.initUI()
	}

	createSectionConfigs() {
		/* Create configuration data for each section of the input UI
		see google doc "Regression UI"
		*/

		// configuration for the outcome variable section
		this.outcome = {
			/*** static configuration ***/
			heading: 'Outcome variable',
			selectPrompt:
				this.opts.regressionType == 'linear' ? 'Select continuous outcome variable' : 'Select outcome variable',
			placeholderIcon: '',
			configKey: 'outcome',
			limit: 1,
			usecase: { target: 'regression', regressionType: this.opts.regressionType, detail: 'outcome' },

			/*** dynamic configuration ***/
			inputLst: [],

			/*** tracker for this section's DOM elements ***/
			dom: {}
		}

		// configuration for the independent variable section
		this.independent = {
			/*** static configuration ***/
			heading: 'Independent variable(s)',
			selectPrompt: 'Add independent variable',
			placeholderIcon: '',
			configKey: 'independent',
			limit: 10,
			usecase: { target: 'regression', regressionType: this.opts.regressionType, detail: 'independent' },

			/*** dynamic configuration ***/
			inputLst: [],

			/*** tracker for this section's DOM elements ***/
			dom: {}
		}

		// track sections in an array, for convenience in loops
		// but not for use in `d3.data()`
		this.sections = [this.outcome, this.independent]
	}

	async main() {
		try {
			this.config = this.parent.config
			this.state = this.parent.state
			this.hasError = false
			this.setDisableTerms()
			const updates = []
			for (const section of this.sections) {
				await this.renderSection(section)
				for (const input of section.inputLst) {
					input.dom.holder.style('border-left', input.term ? '1px solid #bbb' : '')
					updates.push(input.main())
				}
			}
			await Promise.all(updates)
			for (const section of this.sections) {
				for (const input of section.inputLst) {
					if ((input.term && input.term.error) || input.hasError) {
						this.hasError = true
					}
				}
			}
		} catch (e) {
			this.hasError = true
			throw e
		}
	}

	setDisableTerms() {
		this.disable_terms = []
		if (this.config.outcome && this.config.outcome.term) this.disable_terms.push(this.config.outcome.term.id)
		if (this.config.independent) {
			for (const vb of this.config.independent) {
				this.disable_terms.push(vb.term.id)
			}
		}
	}

	handleError() {
		this.hasError = true
		this.dom.submitBtn.property('disabled', true)
	}

	getNoTermPromptOptions(section) {
		// only for independent section
		if (section.configKey != 'independent') return
		// return an array, each ele is an item in the mini menu at termsetting prompt
		// okay for the array to be empty
		// need to check if the dataset allows this
		// if so, add to this array, to be shown as mini menu
		const lst = []
		for (const item of allNonDictionaryTerms) {
			// TODO do this via vocab api
			if (!this.state.allowedTermTypes.includes(item.termtype)) {
				// not allowed by this dataset
				continue
			}
			if (section.inputLst.find(i => i.term && i.term.term.type == item.termtype)) {
				// same term is already present in this section, do not add a second
				continue
			}
			lst.push(item)
		}
		if (lst.length) {
			// added at least one non-dict term type
			// for the mini menu in termsetting prompt to show both dict- and non-dict-terms, add dict option
			lst.unshift({
				isDictionary: true,
				text: 'Dictionary variable'
			})
		}
		return lst
	}
}

function setRenderers(self) {
	self.initUI = () => {
		const controls = self.opts.holder.append('div').style('display', 'block')

		self.dom = {
			div: self.opts.holder, //.style('margin', '10px 0px'),
			controls,
			body: controls.append('div'),
			foot: controls
				.append('div')
				.style('margin', '0px 20px')
				.style('display', 'flex')
				.style('align-items', 'center')
				.style('gap', '20px')
		}

		self.dom.submitBtn = self.dom.foot
			.append('div')
			.append('button')
			.style('display', 'none')
			.style('padding', '5px 15px')
			.style('border-radius', '15px')
			.style('cursor', 'pointer')
			.text('Run analysis')
			.on('click', self.submit)

		self.dom.submitMsg = self.dom.foot
			.append('div')
			.style('display', 'none')
			.style('color', '#cc0000')
			.style('font-style', 'italic')
			.style('font-size', '0.8em')
		/*
			not using d3.data() here since each section may only
			be added and re-rendered, but not removed
		*/
		for (const section of self.sections) {
			const div = self.dom.body.append('div')
			self.addSection(section, div)
		}
	}

	self.addSection = function (section, div) {
		div.style('display', 'none').style('margin', '3px 5px').style('padding', '3px 5px')

		section.dom = {
			holder: div,
			headingDiv: div
				.append('div')
				.style('margin', '3px 5px 20px 5px')
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
	self.renderSection = function (section) {
		// decide to show/hide this section
		// only show when this section is for outcome,
		// or this is independent and only show it when the outcome has been selected
		// effect is to force user to first select outcome, then independent, but not to select independent first
		section.dom.holder.style('display', section.configKey == 'outcome' || self.config.outcome ? 'block' : 'none')

		syncInputsWithConfig(section)
		// section.inputLst[] is now synced with plot config

		const inputs = section.dom.inputsDiv
			.selectAll(':scope > div')
			// key function (2nd arg) uses a function to determine how datum and element are joined by variable id
			.data(section.inputLst, input => input.term && input.term.term.id)

		inputs.exit().each(removeInput)

		inputs.enter().append('div').each(addInput)
	}

	function syncInputsWithConfig(section) {
		// get the input variables from config.outcome or config.independent
		const selected = self.config[section.configKey]

		// force the outcome variable into an array for ease of handling
		// the independent variables array will be used as-is
		const selectedArray = Array.isArray(selected) ? selected : selected ? [selected] : []

		// process each selected variable
		for (const variable of selectedArray) {
			if (section.configKey == 'independent') {
				if (!variable.interactions) variable.interactions = []
				for (const id of variable.interactions) {
					const tw = selected.find(i => i.term.id == id)
					if (!tw) throw 'interacting partner not found in independents: ' + id
					if (!tw.interactions) tw.interactions = []
					if (!tw.interactions.includes(variable.term.id)) tw.interactions.push(variable.term.id)
				}
			}

			const input = section.inputLst.find(input => input.term && input.term.term.id == variable.term.id)
			if (!input) {
				section.inputLst.push(
					new InputTerm({
						section,
						term: variable,
						parent: self
					})
				)
			} else {
				// reassign the variable reference to the mutable variable copy
				// from state.config.outcome | .independent
				input.term = variable
			}
		}

		mayAddBlankInput(section, self)
	}

	async function addInput(input) {
		await input.init(
			select(this).style('width', 'fit-content').style('margin', '0px 15px 35px 25px').style('padding', '0px 5px')
		)
	}

	function removeInput(input) {
		/* NOTE: editConfig deletes this input from the section.inputLst array */
		input.remove()
		for (const key in input.dom) {
			//input.dom[key].remove()
			delete input.dom[key]
		}
		const div = select(this)
		div.transition().duration(500).style('opacity', 0).remove()
	}

	self.resetSubmitButton = () => {
		// do not disable button upon ui error. only disable after clicking button and analysis is running
		self.dom.submitBtn
			.text('Run analysis')
			.style('display', self.config.outcome && self.config.independent.length ? 'block' : 'none')
			.property('disabled', self.hasError)
	}
}

function setInteractivity(self) {
	/* this function is called when any change is made to a term of an input
	e.g. by termsetting callback
	*/
	self.editConfig = async (input, variable) => {
		if (!variable) {
			// the variable has been deleted from this input; will delete this input from section
			const i = input.section.inputLst.findIndex(d => d === input)
			if (i == -1) throw `deleting an unknown input`
			// delete this input
			input.section.inputLst.splice(i, 1)
			if (input.term) {
				// if the input.term has interaction pairs, then
				// delete this term.id from those other input term.interactions
				for (const other of input.section.inputLst) {
					if (!other.term || !other.term.interactions) continue
					const i = other.term.interactions.indexOf(input.term.term.id)
					if (i != -1) other.term.interactions.splice(i, 1)
				}
			}
		} else {
			// variable is selected for this input

			const prevTerm = input.term

			/*
				For a new term (replacing a blank input), the refGrp will be missing.
				In that case, updateTerm() in regression.inputs.term.js will assign a
				default refGrp based on sample counts. 

				For a replacement term that happens to match the previous term's ID, 
				for example adjusting a group other than the refGrp, the refGrp may be 
				reused if there happen to be sample counts for it.
			*/
			if (prevTerm && variable.term.id === prevTerm.term.id) {
				for (const k in prevTerm) {
					// reapply any unedited key-values to the variable, such as refGrp
					if (!(k in variable)) variable[k] = prevTerm[k]
				}
			}
			input.term = variable

			if (variable.q.mode == 'spline' && variable.interactions) {
				// this is a spline term, delete existing interactions with this term
				for (const other of input.section.inputLst) {
					if (!other.term || !other.term.interactions) continue
					const i = other.term.interactions.indexOf(input.term.term.id)
					if (i != -1) other.term.interactions.splice(i, 1)
				}
				variable.interactions = []
			}
		}

		const selected = []
		for (const i of input.section.inputLst) {
			if (i.term) selected.push(i.term)
		}
		const key = input.section.configKey
		// the target config to fill-in/replace/delete may hold one or more selected input variables
		// config.outcome is not an array (exactly one selected variable)
		// config.independent is an array (0 or more selected variables)
		const configValue = Array.isArray(self.config[key]) ? selected : selected[0]

		self.app.dispatch({
			type: 'plot_edit',
			id: self.parent.id,
			chartType: 'regression',
			config: {
				hasUnsubmittedEdits: true,
				// replace config.outcome or config.independent
				[key]: JSON.parse(JSON.stringify(configValue))
			}
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

		self.app.dispatch({
			type: 'plot_edit',
			id: self.parent.id,
			chartType: 'regression',
			config
		})
	}
}

/*
section is one of this.sections[]
decide if a blank input needs to be added to this section
for outcome section, there can just be one input, it's either blank or filled
for independent, there should always be one blank input, among other filled inputs
*/
function mayAddBlankInput(section, self) {
	if (section.inputLst.length >= section.limit) {
		// number of inputs in this section is beyond limit, do not create more
		return
	}
	const blankInput = section.inputLst.find(i => !i.term)
	if (blankInput) {
		// this section already have a blank input (without .term{})
		// as a section is limited to have only one blank input, do not add a new one
		const noTermPromptOptions = self.getNoTermPromptOptions(section)
		if (noTermPromptOptions) {
			// will need to update noTermPromptOptions on this input
			// due to the fact that we don't want two snplst or snplocus terms in one model
			blankInput.pill.main({ noTermPromptOptions })
		}
		return
	}
	// now add a blank input to this section
	section.inputLst.push(
		new InputTerm({
			section,
			parent: self,
			noTermPromptOptions: self.getNoTermPromptOptions(section)
		})
	)
}
