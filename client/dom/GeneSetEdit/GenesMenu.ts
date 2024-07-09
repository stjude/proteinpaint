import { Menu } from '../menu'
import { Div } from '../../types/d3'

type GenesMenuArgs = {
	tip: Menu
	params: any
	api: any
}

export class GenesMenu {
	tip: Menu
	params: any
	api: any

	constructor(opts: GenesMenuArgs) {
		this.tip = opts.tip
		this.params = opts.params
		this.api = opts.api

		this.tip.d.style('padding', '10px')

		this.render()
	}

	render() {
		for (const param of this.params) {
			this.addParameter(param.param, this.tip.d.append('div'))
		}
	}

	addParameter(param, div: Div) {
		let input
		if (param.type == 'boolean') {
			input = div.append('input').attr('type', 'checkbox').attr('id', param.id)
			if (param.value) input.property('checked', param.value)
			div.append('label').html(param.label).attr('for', param.id)
		}
		//The parameter value will be used as the input value if the option is checked
		else if (param.type == 'string' && param.value) {
			input = div.append('input').attr('type', 'checkbox').attr('id', param.id)
			input.property('checked', true)
			div.append('label').html(param.label).attr('for', param.id)
		} else if (param.type == 'number') {
			input = div.append('input').attr('type', 'number').style('width', '40px').attr('id', param.id)
			if (param.value) input.attr('value', param.value)
			div.append('span').html(param.label)
		}
	}
}
