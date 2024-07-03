import { Menu } from '../menu'
import { Div } from '../../types/d3'
import { renderInputControl } from './InputControl'

type TipDom = {
	cgcGenesDiv: Div
	geneCountDiv: Div
}

type MutatedGenesMenuArgs = {
	tip: Menu
}

export class MutatedGenesMenu {
	tip: Menu
	dom: TipDom

	constructor(opts: MutatedGenesMenuArgs) {
		this.tip = opts.tip
		this.dom = {
			cgcGenesDiv: this.tip.d.append('div'),
			geneCountDiv: this.tip.d.append('div')
		}

		this.render()
	}

	render() {
		//Checkbox
		this.dom.cgcGenesDiv.append('span').text('CGC Genes: ').style('font-weight', 'bold')

		//Input
		//TODO: get the actual value and figure out the callback
		renderInputControl({
			div: this.dom.geneCountDiv,
			label: 'Gene Count',
			value: 50,
			callback: v => {
				//TODO
			}
		})
	}
}
