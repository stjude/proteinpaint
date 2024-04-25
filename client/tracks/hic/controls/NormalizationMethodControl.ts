import { Elem, Div } from '../../../types/d3'

export class NormalizationMethodControl {
	defaultNmeth: string
	holder: Elem | Div
	normalization: string[]
	callback: (nmeth: string) => void
	nmethSelect: any

	constructor(holder: Elem | Div, normalization: string[], defaultNmeth: string, callback: (nmeth: string) => void) {
		this.holder = holder
		this.normalization = normalization
		this.defaultNmeth = defaultNmeth
		this.callback = callback
	}

	render() {
		if (!this.normalization?.length) {
			this.nmethSelect = this.holder.text(this.defaultNmeth)
		} else {
			this.nmethSelect = this.holder
				.style('margin-right', '10px')
				.append('select')
				.on('change', async () => {
					const nmeth = this.nmethSelect.node().value
					this.callback(nmeth)
				})
			for (const n of this.normalization) {
				this.nmethSelect.append('option').text(n)
			}
		}
	}

	update(option: any) {
		const options = this.nmethSelect.node().options
		if (!options) return //When only 'NONE' is available
		const selectedNmeth = Array.from(options).find((o: any) => o.value === option) as HTMLOptionElement
		if (!selectedNmeth) throw `Invalid normalization method: ${option}`
		selectedNmeth.selected = true
	}
}
