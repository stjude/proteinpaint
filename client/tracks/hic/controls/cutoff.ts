import { Input, Elem } from '../../../types/d3'
import { debounce } from 'debounce'

export class CutoffControl {
	app: any
	view: any
	holder: Elem
	value: number

	constructor(app: any, state: any, holder: Elem, value: number) {
		this.app = app
		this.view = state[state.currView]
		this.holder = holder
		this.value = value
	}

	render() {
		const cutoffDiv = this.holder
			.style('margin-right', '10px')
			.append('input')
			.attr('type', 'number')
			.style('width', '80px')
			.style('margin-left', '0px')
			.attr('type', 'number')
			.property('value', this.value)
			.on('change', async () => {
				debounce(() => {
					this.app.dispatch({
						type: 'view_update',
						view: this.view,
						config: {
							cutoff: cutoffDiv.node()!.value
						}
					})
				}, 300)
			})
	}
}
