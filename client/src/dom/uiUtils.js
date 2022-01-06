/*

-------EXPORTED-------
isURL
    - path: checks if str input is URL and returns boolean

makeGenomeDropDown
    - div: element to append select element
    - genomes: genome must be an arg in the ui init() and passed to this fn

makeTextInput
    - div: element to append input element
    - placeholder (optional)

makeTextAreaInput
    - div: element to append textarea element
    - placeholder (optional)

-------Internal-------

*/

export function isURL(path) {
	const checkpath = path.toLowerCase()
	if (checkpath.startsWith('https://' || 'http://' || 'ftp://')) return true
	else return false
}

export function makeGenomeDropDown(div, genomes) {
	const g_row = div.append('div')

	const select = g_row
		.append('select')
		.style('border-radius', '5px')
		.style('padding', '5px 10px')
		.style('margin', '1px 20px 1px 10px')
	for (const n in genomes) {
		select.append('option').text(n)
	}
	return select
}

export function makeTextInput(div, placeholder) {
	const text = div
		.append('input')
		.attr('type', 'text')
		.style('border-radius', '5px')
		.style('padding', '5px 20px')
		.style('margin', '1px 20px 1px 10px')
	if (placeholder) {
		text.attr('placeholder', placeholder)
	}

	return text
}

export function makeTextAreaInput(div, placeholder) {
	const textarea = div
		.append('textarea')
		.attr('rows', '5')
		.attr('cols', '70')
		.style('border-radius', '5px')
	if (placeholder) {
		textarea.attr('placeholder', placeholder)
	}

	return textarea
}
