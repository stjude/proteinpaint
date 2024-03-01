import { Dom, Elem } from '../../../types/d3'

export class NormalizationMethodControl {
	defaultNmeth: string
	holder: Elem
	normalization: string[]
	callback: (nmeth: string) => void

	constructor(holder: Elem, normalization: string[], defaultNmeth: string, callback: (nmeth: string) => void) {
		this.holder = holder
		this.normalization = normalization
		this.defaultNmeth = defaultNmeth
		this.callback = callback
	}

	render() {
		let nmethselect
		if (!this.normalization?.length) {
			nmethselect = this.holder.text(this.defaultNmeth)
		} else {
			nmethselect = this.holder
				.style('margin-right', '10px')
				.append('select')
				.on('change', async () => {
					const nmeth = nmethselect.node()!.value
					this.callback(nmeth)
				})
			for (const n of this.normalization) {
				nmethselect.append('option').text(n)
			}
		}
	}
}
