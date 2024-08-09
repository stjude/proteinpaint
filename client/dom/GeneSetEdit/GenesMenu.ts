import { Menu } from '../menu'
import { Div } from '../../types/d3'
import { addButton } from './addButton.ts'
import { GeneArgumentEntry } from '../../shared/types/dataset.ts'
import { make_one_checkbox } from '../checkbox.js'
import { makeRadiosWithContentDivs } from './radioWithContent.ts'

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
		console.log('this.params:', this.params)
		// Check if maxGenes, filter_extreme_values and filter_type is defined in dataset. NOTE: This check should ONLY happen in native topVE NOT GDC. This is currently not implemented.

		if (this.params.find(i => i.param.id == 'maxGenes')) {
			//console.log("Found maxGenes")
			//maxGenes = ds_options.find(i => i.id == "maxGenes").value
		} else {
			//console.log("Did not find maxGenes")
			const pm = { id: 'maxGenes', label: 'Gene Count', type: 'number', value: 100 }
			this.params.push({ param: pm as GeneArgumentEntry, input: null })
		}

		if (this.params.find(i => i.param.id == 'filter_extreme_values')) {
			//console.log("Found filter_extreme_values")
			//maxGenes = ds_options.find(i => i.id == "maxGenes").value
		} else {
			//console.log("Did not find filter_extreme_values")
			const pm = { id: 'filter_extreme_values', label: 'Filter Extreme Values', type: 'boolean', value: true }
			this.params.push({ param: pm as GeneArgumentEntry, input: null })
		}

		if (this.params.find(i => i.param.id == 'filter_type')) {
			//console.log("Found filter_type")
			//maxGenes = ds_options.find(i => i.id == "maxGenes").value
		} else {
			//console.log("Did not find filter_type")
			const pm = {
				id: 'filter_type',
				label: 'Filter type',
				type: 'boolean',
				radiobuttons: [
					{
						type: 'boolean',
						label: 'VAR',
						value: 'var'
					},
					{
						type: 'boolean',
						label: 'IQR',
						value: 'iqr'
					}
				]
			}
			this.params.push({ param: pm as GeneArgumentEntry, input: null })
		}

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
			if (param.radiobuttons && param?.radiobuttons.length) {
				const hasChecked = param.radiobuttons.find((d: any) => d.checked)
				if (!hasChecked) param.radiobuttons[0].checked = true
				input = div.append('div').attr('id', param.id)
				input.append('p').style('font-size', '0.8em').style('opacity', 0.75).text(param.label)
				makeRadiosWithContentDivs(param.radiobuttons, input as any)
			} else {
				input = div.append('input').attr('type', 'checkbox').attr('id', param.id)
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
