export function sayerror(holder, msg) {
	const div = holder.append('div').attr('class', 'sja_errorbar')
	// msg can contain injected XSS, so never do .html(msg)
	div.append('div').text(msg)
	div
		.append('div')
		.html('&#10005;')
		.on('click', () => {
			disappear(div, true)
		})
}
