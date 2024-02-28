import { Elem } from '../../../types/d3'

export class NormalizationMethodControl {
	app: any
	state: any
	defaultNmeth: string
	holder: Elem
	normalization: string[]
	nmethselect: any

	constructor(app: any, state: any, dom: any, normalization: string[]) {
		this.app = app
		this.state = state
		this.defaultNmeth = state.defaultNmeth
		this.holder = dom
		this.normalization = normalization
	}

	render() {
		if (!this.normalization?.length) {
			this.nmethselect = this.holder.text(this.defaultNmeth)
		} else {
			this.nmethselect = this.holder
				.style('margin-right', '10px')
				.append('select')
				.on('change', async () => {
					this.app.dispatch({
						type: 'view_update',
						view: this.state.currView
					})
				})
			for (const n of this.normalization) {
				this.nmethselect.append('option').text(n)
			}
		}
	}
}
