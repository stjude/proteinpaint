import { Elem } from '../../../types/d3'

export class NormalizationMethodControl {
	app: any
	state: any
	defaultNmeth: string
	holder: Elem
	normalization: string[]
	nmethselect: any

	constructor(app: any, dom: any, normalization: string[], state?: any) {
		this.app = app
		this.state = state
		this.defaultNmeth = state.defaultNmeth || `NONE`
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
					const nmeth = this.nmethselect.node().value
					if (this.state) {
						this.app.dispatch({
							type: 'view_update',
							view: this.state.currView,
							config: {
								nmeth: nmeth
							}
						})
					} else {
						//stateless response
					}
				})
			for (const n of this.normalization) {
				this.nmethselect.append('option').text(n)
			}
		}
	}
}
