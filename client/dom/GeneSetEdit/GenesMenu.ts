import { Menu } from '../menu'
import { Div, Elem } from '../../types/d3'
import { addButton } from './addButton.ts'
import { GeneArgumentEntry } from '../../shared/types/dataset.ts'
import { make_one_checkbox } from '../checkbox.js'
import { makeRadiosWithContentDivs } from './radioWithContent.ts'

type GenesMenuArgs = {
	/** tip holder for displaying the Menu */
	tip: Menu
	/** object sent from the view model
	 * .param is the defined arg from the dataset
	 * .input is the element created in addParameter and returned
	 * to the view model
	 */
	params: { param: GeneArgumentEntry; input?: Elem }[]
	/** Called when 'Calculate genes' is clicked */
	callback: (f?: number) => void
	/** Adds nested .options: [] for parameters back to opts
	 * after rendering to avoid duplicate elements
	 */
	addOptionalParams: ({ param, input }) => void
}

export class GenesMenu {
	tip: Menu
	params: { param: GeneArgumentEntry; input?: Elem }[]
	callback: (f?: number) => void
	addOptionalParams: ({ param, input }) => void
	/** Collects nested param .options:[]. */
	readonly params2Add: { param: GeneArgumentEntry; input: Elem }[] = []

	constructor(opts: GenesMenuArgs) {
		this.tip = opts.tip
		this.params = opts.params
		this.callback = opts.callback
		this.addOptionalParams = opts.addOptionalParams

		this.tip.d.style('padding', '15px')
		this.render()

		for (const param of this.params2Add) this.addOptionalParams(param)
	}

	render() {
		for (const param of this.params) {
			const input = this.addParameter(param.param, this.tip.d.append('div'))
			param.input = input
		}

		//Submits all the inputs from the menu to the callback
		const calGenesBtn = addButton({
			div: this.tip.d.append('div').style('padding', '20px').style('display', 'inline-block'),
			text: 'Calculate genes',
			callback: async () => {
				calGenesBtn.property('disabled', true).text('Loading...')
				await this.callback()
				this.tip.hide()
			}
		})
	}

	addParameter(param, div: Div) {
		let input
		if (param.type == 'boolean') {
			if (param?.options?.length) {
				/* Use for checkboxes that expand to show additional options when checked. */
				const holder = div
					.append('div')
					.style('margin', '10px 0px')
					.on('mousedown', (event: Event) => {
						event.stopPropagation()
					})
				input = holder.append('input').attr('type', 'checkbox').attr('id', param.id)
				this.addLabels(holder, 'label', param)

				const contentDiv = div.append('div').style('padding-left', '20px')
				for (const option of param.options) {
					const optionInput = this.addParameter(option, contentDiv.append('div'))
					this.params2Add.push({ param: option, input: optionInput })
				}
				if (param.value) {
					input.property('checked', param.value)
					contentDiv.style('display', 'block')
				} else contentDiv.style('display', 'none')

				input.on('change', () => {
					contentDiv.style('display', input.property('checked') ? 'block' : 'none')
				})
			} else {
				input = div.append('input').style('padding', '2px').attr('type', 'checkbox').attr('id', param.id)
				if (param.value) input.property('checked', param.value)
				this.addLabels(div, 'label', param)
			}
		}
		//The parameter value will be used as the input value if the option is checked
		else if (param.type == 'string' && param.value) {
			input = make_one_checkbox({
				holder: div,
				id: param.id,
				checked: true,
				labeltext: param.label,
				callback: () => {
					//Not used but required for func
				}
			})
		} else if (param.type == 'number') {
			input = div
				.append('input')
				.attr('type', 'number')
				.style('width', '50px')
				.style('padding', '5px')
				.attr('id', param.id)
			if (param.value) input.attr('value', param.value)
			this.addLabels(div, 'span', param)
		} else if (param.type == 'radio') {
			const hasChecked = param.options.find((d: any) => d.checked)
			if (!hasChecked) param.options[0].checked = true
			input = div.append('div').attr('id', param.id)
			input.append('p').style('font-size', '0.8em').style('opacity', 0.75).text(param.label)
			makeRadiosWithContentDivs(param.options, input as any)
		}
		return input
	}

	addLabels(div: Div, elem: string, param: GeneArgumentEntry) {
		if (!param.sublabel) div.append(elem).html(param.label!).attr('for', param.id)
		else {
			const labelDiv = div.append('div').style('display', 'inline-block').style('vertical-align', 'middle')
			labelDiv
				.append(elem)
				.style('display', 'block')
				.style('padding-top', '3px')
				.html(param.label!)
				.attr('for', param.id)
			labelDiv.append('span').style('display', 'block').style('font-size', '0.75em').html(param.sublabel)
		}
	}
}
