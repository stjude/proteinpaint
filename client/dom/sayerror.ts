import { disappear } from './animation'

/*
---------Exported---------
sayerror()
	- Displays error message in new, closable, red div OR error message.

throwMsgWithFilePathAndFnName()
	- Generic throw message that includes the file and function name in this format: `Message [fileName functionName()]

showErrorWithCounter
	- Displays the error message with a counter in a red div. 
*/

export function sayerror(holder: any, o: any) {
	// 2nd argument is a string or an Error object
	let msg: any // string message for display
	if (typeof o == 'string') {
		msg = o
	} else {
		msg = o.message || o.error
		if (o.stack) console.log(o.stack) // print out stack
	}
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

export function throwMsgWithFilePathAndFnName(message: string) {
	try {
		throw new Error()
	} catch (error: any) {
		const stackLines = error.stack.split('\n')
		const callerLine = stackLines[2].trim()

		// Extract the file name and function name
		const regex = /\s*at\s+(.*)\s+\((.*).proteinpaint.js:(\d+):(\d+)\)/
		const match = callerLine.match(regex)

		if (match) {
			const functionName = match[1]
			const fileName = match[2]
				.replace(/^.*\/bin\//, '') //remove window.origin
				.replace(/_([^_]+)$/, '.$1') //readable file extension
				.replaceAll(/_/g, '/') //readable file path pattern
			const errorMsg = `${message} [${fileName} ${functionName}()]`
			throw new Error(errorMsg)
		} else {
			throw new Error(message)
		}
	}
}

export function showErrorsWithCounter(errs: string | string[], holder: any) {
	if (typeof errs == 'string') return sayerror(holder, errs)
	if (errs.length === 0) return
	if (errs.length === 1) return sayerror(holder, errs[0])

	const wrapper = holder.selectAll('.sja_errorbar').data([1])

	let showErrors = false
	const wrapperEnter = wrapper
		.enter()
		.append('div')
		.attr('class', 'sja_errorbar')
		.on('click', () => {
			showErrors = !showErrors
			errorsDiv.style('display', showErrors ? 'block' : 'none')
		})

	// Counter
	const counterTextDiv = wrapperEnter.append('div').style('display', 'inline-block')

	counterTextDiv
		.append('div')
		.style('display', 'inline-block')
		.style('color', 'white')
		.style('background-color', 'red')
		.style('border-radius', '100px')
		.style('padding', '1px 4px')
		.text(errs.length)

	// Text
	counterTextDiv.append('div').text('errors found.').style('padding', '3px').style('display', 'inline-block')

	// Close button
	wrapperEnter
		.append('div')
		.style('display', 'inline-block')
		.style('float', 'right')
		.html('&#10005;')
		.on('click', () => {
			disappear(holder, true)
		})

	//Error messages
	const errorsDiv = wrapperEnter.append('div').style('display', 'none').style('margin-left', '10px')

	for (const err of errs) {
		errorsDiv.append('div').text(err)
	}

	wrapper.exit().remove()
}
