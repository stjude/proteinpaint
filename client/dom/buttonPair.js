export function make_select_btn_pair(holder) {
	// a click button triggering a <select> menu
	const btn = holder
		.append('div')
		.attr('class', 'sja_filter_tag_btn')
		.style('position', 'absolute')
	const select = holder
		.append('select')
		.style('opacity', 0)
		.on('mouseover', () => {
			btn.style('opacity', '0.8').style('cursor', 'default')
		})
		.on('mouseout', () => {
			btn.style('opacity', '1')
		})
	return [select, btn]
}
