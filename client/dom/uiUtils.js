import { selectAll as d3selectAll } from 'd3-selection'

/*

Functions commonly used in UIs.

-------EXPORTED-------
isURL()
	Checks if str input is URL and returns boolean
    - path: STR

makeGenomeDropDown()
	Creates general dropdwon from a provided array of options
	- div
	- options: []

makeGenomeDropDown()
	Creates genomes dropdown from available genomes 
    - div
    - genomes: *genomes must be an arg in the ui init() and passed to this fn

makeTextInput()
	Creates input box for text, filepaths, etc.
    - div
    - placeholder (optional): STR
	- size (optional): INT

makeTextAreaInput({})
	Creates a text area, mainly for copying and pasting data
    - div
    - placeholder (optional): STR
	- rows (optional): INT, number of rows to display
	- cols (optional): INT, number of columns to display

makeFileUpload()
	Creates upload input for files
    - div

makeBtn({})
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

makeResetBtn()
	Button to clear a form/UI
	- div
	- obj{}
	- selector: STR, class selector to clear

detectDelimiter()
	Returns the delimiter based on the file name
	-fileName: STR

-------Internal-------

*/

export function isURL(path) {
	const checkpath = path.toLowerCase()
	if (checkpath.startsWith('https://') || checkpath.startsWith('http://') || checkpath.startsWith('ftp://')) return true
}

export function makeDropDown(div, options) {
	/**
	 * div: node
	 * options: []
	 */
	const row = div.append('div')

	const select = row
		.append('select')
		.style('border-radius', '5px')
		.style('padding', '5px 10px')
		.style('margin', '1px 20px 1px 10px')
	options.forEach(n => {
		select.append('option').text(n)
	})
	return select
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
		.attr('size', size || 50)
		.style('border-radius', '5px')
		.style('padding', '5px 20px')
		.style('margin', '1px 20px 1px 10px')
	if (placeholder) {
		text.attr('placeholder', placeholder)
	}

	return text
}

export function makeTextAreaInput(args) {
	const textarea = args.div
		.append('textarea')
		.attr('rows', args.rows || '5')
		.attr('cols', args.cols || '70')
		.style('border-radius', '5px')
		.attr('placeholder', args.placeholder || '')

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

export function makeBtn(args) {
	const btn = args.div
		.append('button')
		.html(args.text)
		.style('color', args.color || 'black')
		.style('background-color', args.backgroundColor || '#F2F2F2')
		.style('border', args.border || '2px solid #999')
		.style('padding', args.padding || '5px 10px')
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

export function makeResetBtn(div, obj, selector) {
	const reset = makeBtn({
		div,
		text: '&#8634;',
		backgroundColor: 'white',
		color: 'grey',
		padding: '0px 6px 1px 6px'
	})
	reset
		.style('font-size', '1.5em')
		.style('display', 'inline-block')
		.attr('type', 'reset')
		.on('click', async () => {
			d3selectAll(selector).property('value', '')
			if (obj.data) {
				obj.data = typeof obj.data == 'string' ? '' : Array.isArray(obj.data) ? [] : {}
			}
		})

	return reset
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

export function getTooltipDiv(holder, text) {
	if (!text) throw 'No text provided for tooltip'
	const div = holder.append('div').attr('class', 'tooltip').style('cursor', 'pointer')
	div.append('div').attr('class', 'tooltiptext').text(text).style('left', '30px').style('top', '40px')
	const innerDiv = div.append('div')
	return innerDiv
}
