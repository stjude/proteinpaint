import { Elem } from '../../../types/d3'

export class MatrixTypeControl {
	holder: Elem
	values: { label: string; value: string }[]

	constructor(holder: Elem) {
		this.holder = holder
		this.values = [
			{ label: 'Observed', value: 'observed' },
			{ label: 'Expected', value: 'expected' },
			{ label: 'Observed/Expected', value: 'oe' },
			{ label: 'Log(Observed/Expected)', value: 'log(oe)' }
			// TODO: add server side logic to support these options
			// { label: 'Log(Observed + 1)', value: 'log(obs+1)'},
			// { label: 'Observed Pearson', value: 'op'}
		]
	}

	render() {
		const dropdown = this.holder
			.style('margin-right', '10px')
			.append('select')
			.on('change', async () => {
				//Replace with get_data() -> app.dispatch({type: 'view_refresh'})
				//maybe callback so there's a state and stateless version?
			})
		for (const matrixType of this.values) {
			dropdown.append('option').text(matrixType.label).attr('value', matrixType.value)
		}
	}
}
