/*

Functions commonly used in UIs.

-------EXPORTED-------
isURL()
	Checks if str input is URL and returns boolean
    - path: STR

makeGenomeDropDown()
	Creates genomes dropdown from available genomes 
    - div
    - genomes: *genomes must be an arg in the ui init() and passed to this fn

makeTextInput()
	Creates input box for text, filepaths, etc.
    - div
    - placeholder (optional): STR
	- size (optional): INT

makeTextAreaInput()
	Creates a text area, mainly for copying and pasting data
    - div
    - placeholder (optional): STR
	- rows (optional): INT, number of rows to display
	- cols (optional): INT, number of columns to display

makeFileUpload()
	Creates upload input for files
    - div

makeBtn()
	Simplifed button and styling for UIs
    - div
	- text: STR
	- color (optional): STR, text color
	- backgroundColor (optional): STR, background color
	- border (optional): STR, value for 'border' style

makePrompt()
	Creates text prompts for inputs. Use to quickly create small chunks of text
    - div
	- text: STR 


detectDelimiter()
	Returns the delimiter based on the file name
	-fileName: STR

-------Internal-------

*/

export function isURL(path) {
	const checkpath = path.toLowerCase()
	if (checkpath.startsWith('https://') || checkpath.startsWith('http://') || checkpath.startsWith('ftp://')) return true
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

export function makeTextInput(div, placeholder, size) {
	const text = div
		.append('input')
		.attr('type', 'text')
		.attr('size', size ? size : 50)
		.style('border-radius', '5px')
		.style('padding', '5px 20px')
		.style('margin', '1px 20px 1px 10px')
	if (placeholder) {
		text.attr('placeholder', placeholder)
	}

	return text
}

export function makeTextAreaInput(div, placeholder, rows, cols) {
	const textarea = div
		.append('textarea')
		.attr('rows', rows ? rows : '5')
		.attr('cols', cols ? cols : '70')
		.style('border-radius', '5px')
		.attr('placeholder', placeholder ? placeholder : '')

	return textarea
}

export function makeFileUpload(div) {
	const upload = div
		.append('input')
		.attr('type', 'file')
		.property('position', 'relative')
		.style('margin', '1px 20px 1px 10px')
		.style('justify-content', 'left')

	return upload
}

export function makeBtn(div, text, color, backgroundColor, border) {
	const btn = div
		.append('button')
		.text(text)
		.style('color', color ? color : 'black')
		.style('background-color', backgroundColor ? backgroundColor : '#F2F2F2')
		.style('border', border ? border : '2px solid #999')
		.style('padding', '5px 10px')
		.style('cursor', 'pointer')

	return btn
}

export function makePrompt(div, text) {
	const prompt = div
		.append('div')
		.style('display', 'inline-block')
		.style('margin', '15px')
		.style('place-items', 'center left')
		.html(text)

	return prompt
}

export function detectDelimiter(fileName) {
	const f = fileName.match(/.*(\.\w{3})$/)
	let delimiter
	switch (f[1]) {
		case '.csv':
			delimiter = ','
			break
		case '.tsv':
			delimiter = '\t'
			break
		case '.txt':
			delimiter = '\t'
			break
		default:
			delimiter = '\t'
	}
	return delimiter
}

//TODO
export function infoToolTip(div, helpText) {
	const icon = div
		.append('div')
		.html('ⓘ')
		.on('mouseenter', () => {
			//display tooltip
		})
		.on('mouseout', () => {
			//rm tooltip
		})
	return icon
}
