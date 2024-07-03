import { Div } from '../../types/d3'

type InputControlOpts = {
	/** holder */
	div: Div
	/** Label for the input  */
	label: string
	/** Second line of text that appears underneath the label */
	sublabel?: string
	/** Value of the input */
	value: number
	/** callback for input change */
	callback: (v: string) => void
}

export function renderInputControl(opts: InputControlOpts) {
	opts.div
		.append('input')
		.append('input')
		.attr('type', 'number')
		.property('value', opts.value)
		.on('keyup', async event => {
			if (event.code != 'Enter') return
			const v = (event.target as HTMLInputElement).value
			opts.callback(v)
		})
	if (!opts.sublabel) {
		opts.div.append('span').style('margin-right', '10px').text(opts.label)
	} else {
		const label = opts.div.append('div').style('margin-right', '10px').append('p').text(opts.label)

		label.append('p').text(opts.sublabel).style('font-size', '0.8em')
	}
}
