import { Button, Div } from 'types/d3'

type AddBtnOpts = {
	/** div to append the button */
	div: Div
	/** text to display on button */
	text: string
	/** callback on click */
	callback: () => void
	/** Optional: default is false */
	disabled?: boolean
}
/**
 * Creates a button uniform in style for the entire UI
 */
export function addButton(opts: AddBtnOpts): Button {
	if (!opts.div || !opts.text || !opts.callback) throw new Error('Missing required parameters')
	return opts.div
		.append('button')
		.property('disabled', opts.disabled || false)
		.style('border', 'none')
		.style('border-radius', '20px')
		.style('padding', '10px 15px')
		.text(opts.text)
		.on('click', () => {
			opts.callback()
		})
}
