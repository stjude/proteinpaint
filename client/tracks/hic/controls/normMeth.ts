import { Elem } from '../../../types/d3'

export class NormalizationMethodControl {
	app: any
	defaultNmeth: string
	holder: Elem
	normalization: string[]
	nmethselect: any

	constructor(app: any, state: any, dom: any, normalization: string[]) {
		this.app = app
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
					//Replace with get_data() -> app.dispatch()
				})
			for (const n of this.normalization) {
				this.nmethselect.append('option').text(n)
			}
		}
	}
}
