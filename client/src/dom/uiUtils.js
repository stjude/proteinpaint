/*

-------EXPORTED-------
makeGenomeDropDown
    - div: element to append select element
    - genomes: genome must be an arg in the ui init() and passed to this fn
isURL
    - path: checks if str input is URL and returns boolean

-------Internal-------

*/

export function isURL(path) {
	const checkpath = path.toLowerCase()
	if (checkpath.startsWith('https://' || 'http://')) return true
	else return false
}

export function makeGenomeDropDown(div, genomes) {
	const g_row = div.append('div')

	const select = g_row
		.append('select')
		.style('border', '1px solid rgb(138, 177, 212)')
		.style('border-radius', '5px')
		.style('padding', '5px 10px')
		.style('margin', '1px 20px 1px 10px')
	for (const n in genomes) {
		select.append('option').text(n)
	}
	return select
}

export function textInput(div, placeholder) {
	const text = div
		.append('input')
		.attr('type', 'text')
		.style('border', '1px solid rgb(138, 177, 212)')
		.style('border-radius', '5px')
		.style('padding', '5px 10px')
		.style('margin', '1px 20px 1px 10px')
	if (placeholder) {
		text.attr('placeholder', placeholder)
	}

	return text
}
