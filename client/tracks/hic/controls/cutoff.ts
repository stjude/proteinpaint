import { Elem } from '../../../types/d3'
export class CutoffControl {
	view: any
	holder: Elem
	value: number

	constructor(state: any, holder: Elem, value: number) {
		this.view = state[state.currView]
		this.holder = holder
		this.value = value
	}

	render() {
		this.holder
			.style('margin-right', '10px')
			.append('input')
			.attr('type', 'number')
			.style('width', '80px')
			.style('margin-left', '0px')
			.attr('type', 'number')
			//Replace with view value
			.property('value', 0)
			.on('change', async () => {
				//Replace with get_data() -> app.dispatch()
			})
	}
}
