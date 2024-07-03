import { Menu } from '../menu'
import { Div } from '../../types/d3'
import { renderInputControl } from './InputControl'

type TipDom = {
	geneCountDiv: Div
	minMedianDiv: Div
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
			geneCountDiv: this.tip.d.append('div'),
			minMedianDiv: this.tip.d.append('div')
		}

		this.render()
	}

	render() {
		//TODO: get the actual value and figure out the callback
		renderInputControl({
			div: this.dom.geneCountDiv,
			label: 'Gene Count',
			value: 100,
			callback: v => {
				//TODO
			}
		})

		//TODO: get the actual value and figure out the callback
		renderInputControl({
			div: this.dom.minMedianDiv,
			label: 'Minimum median log2(uqfpkm)',
			sublabel: 'Genes with median value below the cutoff are skipped.',
			value: 1,
			callback: v => {
				//TODO
			}
		})
	}
}
