import { Elem } from '../../../types/d3'

export class MatrixTypeControl {
	app: any
	holder: Elem
	state: any
	values = [
		{ label: 'Observed', value: 'observed' },
		{ label: 'Expected', value: 'expected' },
		{ label: 'Observed/Expected', value: 'oe' },
		{ label: 'Log(Observed/Expected)', value: 'log(oe)' }
		// TODO: add server side logic to support these options
		// { label: 'Log(Observed + 1)', value: 'log(obs+1)'},
		// { label: 'Observed Pearson', value: 'op'}
	]

	constructor(app: any, holder: Elem, state: any) {
		this.app = app
		this.holder = holder
		this.state = state
	}

	render() {
		const dropdown = this.holder
			.style('margin-right', '10px')
			.append('select')
			.on('change', async () => {
				if (this.state) {
					this.app.dispatch({
						type: 'view_update',
						view: this.state.currView,
						config: {
							matrixType: dropdown.node()!.value
						}
					})
				}
			})
		for (const matrixType of this.values) {
			dropdown.append('option').text(matrixType.label).attr('value', matrixType.value)
		}
	}
}
