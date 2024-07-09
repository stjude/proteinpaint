/**
 * Creates a button uniform in style for the entire UI
 * @param opts
 * @param opts.div: Required: div to append button to
 * @param opts.text: Required: text to display on button
 * @param opts.callback Required: callback on click
 * @param opts.disabled Optional: default is false
 * @returns uniform button
 */
export function addButton(opts) {
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
