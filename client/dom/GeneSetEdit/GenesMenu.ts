import { Menu } from '../menu'
import { Div } from '../../types/d3'
import { addButton } from './addButton.ts'
import { GeneArgumentEntry } from '../../shared/types/dataset.ts'
import { make_one_checkbox } from '../checkbox.js'

type GenesMenuArgs = {
	tip: Menu
	params: { param: GeneArgumentEntry; input?: any }[]
	api: any
	callback: (f?: number) => void
}

export class GenesMenu {
	tip: Menu
	params: { param: GeneArgumentEntry; input?: any }[]
	api: any
	callback: (f?: number) => void

	constructor(opts: GenesMenuArgs) {
		this.tip = opts.tip
		this.params = opts.params
		this.api = opts.api
		this.callback = opts.callback

		this.tip.d.style('padding', '15px')

		this.render()
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
				calGenesBtn.property('disabled', true)
				const wait = this.tip.d.append('div').style('display', 'inline-block').text('Loading...')
				await this.callback()
				wait.remove()
				this.tip.hide()
			}
		})
	}

	addParameter(param, div: Div) {
		let input
		if (param.type == 'boolean') {
			input = div.append('input').attr('type', 'checkbox').attr('id', param.id)
			if (param.value) input.property('checked', param.value)
			this.addLabels(div, 'label', param)
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
		}
		return input
	}

	addLabels(div: Div, elem: string, param: GeneArgumentEntry) {
		if (!param.sublabel) div.append(elem).html(param.label).attr('for', param.id)
		else {
			const labelDiv = div.append('div').style('display', 'inline-block').style('vertical-align', 'middle')
			labelDiv
				.append(elem)
				.style('display', 'block')
				.style('padding-top', '3px')
				.html(param.label)
				.attr('for', param.id)
			labelDiv.append('span').style('display', 'block').style('font-size', '0.75em').html(param.sublabel)
		}
	}
}
