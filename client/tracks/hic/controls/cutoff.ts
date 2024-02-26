import { Elem } from '../../../types/d3'

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
		this.holder
			.style('margin-right', '10px')
			.append('input')
			.attr('type', 'number')
			.style('width', '80px')
			.style('margin-left', '0px')
			.attr('type', 'number')
			//Replace with view value or passed value
			.property('value', 0)
			.on('change', async () => {
				//Replace with get_data() -> app.dispatch()
				//Maybe add setTimeout or Apply button for this?
				//Probably a good idea to add a debounce function or Apply button for both cutoffs
			})
	}
}
