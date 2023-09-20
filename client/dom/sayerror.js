import { disappear } from './animation'

/*
---------Exported---------
sayerror()
	- Displays error message in new, closable, red div OR error message.

throwMsgWithFilePathAndFnName()
	- Generic throw message that includes the file and function name in this format: `Message [fileName functionName()]
*/

export function sayerror(holder, o) {
	// 2nd argument is a string or an Error object
	let msg // string message for display
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

export function throwMsgWithFilePathAndFnName(message) {
	try {
		throw new Error()
	} catch (error) {
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
