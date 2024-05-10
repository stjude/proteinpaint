import { Elem } from '../../../types/d3'

export class MatrixTypeControl {
	holder: Elem
	values = [
		{ label: 'Observed', value: 'observed' },
		{ label: 'Expected', value: 'expected' },
		{ label: 'Observed/Expected', value: 'oe' },
		{ label: 'Log(Observed/Expected)', value: 'log(oe)' }
		// TODO: add server side logic to support these options
		// { label: 'Log(Observed + 1)', value: 'log(obs+1)'},
		// { label: 'Observed Pearson', value: 'op'}
	]
	callback: (value: string, prop: 'matrixType') => void
	matrixSelect: any

	constructor(holder: Elem, callback: (value: string, prop: 'matrixType') => void) {
		this.holder = holder
		this.callback = callback
	}

	render() {
		this.matrixSelect = this.holder
			.style('margin-right', '10px')
			.append('select')
			.on('change', async () => {
				this.callback(this.matrixSelect.node().value, 'matrixType')
			})
		for (const matrixType of this.values) {
			this.matrixSelect.append('option').text(matrixType.label).attr('value', matrixType.value)
		}
	}

	update(option: any) {
		const options = this.matrixSelect.node().options
		if (!options) return //When only 'NONE' is available
		const selectedNmeth = Array.from(options).find((o: any) => o.value === option) as HTMLOptionElement
		if (!selectedNmeth) throw `Invalid normalization method: ${option}`
		selectedNmeth.selected = true
	}
}
