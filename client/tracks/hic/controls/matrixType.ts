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
	callback: (matrixType: string) => void

	constructor(holder: Elem, callback: (matrixType: string) => void) {
		this.holder = holder
		this.callback = callback
	}

	render() {
		const dropdown = this.holder
			.style('margin-right', '10px')
			.append('select')
			.on('change', async () => {
				this.callback(dropdown.node()!.value)
			})
		for (const matrixType of this.values) {
			dropdown.append('option').text(matrixType.label).attr('value', matrixType.value)
		}

		return dropdown
	}
}
