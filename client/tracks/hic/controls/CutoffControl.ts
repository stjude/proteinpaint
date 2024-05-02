import { Elem } from '../../../types/d3'

export class CutoffControl {
	holder: Elem
	value: number
	callback: (f: string | number) => void

	constructor(holder: Elem, value: number, callback: (f: string | number) => void) {
		this.holder = holder
		this.value = value
		this.callback = callback
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
			.on('keyup', async (event: KeyboardEvent) => {
				if (event.code != 'Enter') return
				const v: any = (event.target as HTMLInputElement).value
				this.callback(v)
			})
		return cutoffDiv
	}
}
