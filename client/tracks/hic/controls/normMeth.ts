import { Elem } from '../../../types/d3'

export class NormalizationMethodControl {
	defaultNmeth: string
	holder: Elem
	normalization: string[]
	nmethselect: any

	constructor(state: any, dom: any, normalization: string[]) {
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
