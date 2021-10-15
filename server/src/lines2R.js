/*
Stream JavaScript data into and out of R.

Arguments:
    - <Rscript>: path to R script.
    - <lines>: array of JavaScript data lines.
    - <args>: array of R script arguments.
	- <terminateAtWarnings>: boolean for whether to terminate this module if R gives a warning message (default: true).

Given an R script and a JavaScript array of input data lines the data lines are streamed into the standard input of the R script. The standard output of the R script is then returned as a JavaScript array of output data lines.
*/

const path = require('path')
const fs = require('fs')
const spawn = require('child_process').spawn
const Readable = require('stream').Readable

module.exports = async function lines2R(Rscript, lines, args = [], terminateAtWarnings = true) {
	try {
		await fs.promises.stat(Rscript)
	} catch (e) {
		throw `${Rscript} does not exist`
	}
	const table = lines.join('\n') + '\n'
	const stdout = []
	const stderr = []
	return new Promise((resolve, reject) => {
		const sp = spawn('Rscript', [Rscript, ...args])
		Readable.from(table).pipe(sp.stdin)
		sp.stdout.on('data', data => stdout.push(data))
		sp.stderr.on('data', data => stderr.push(data))
		sp.on('error', err => reject(`this is an error: ${err}`))
		sp.on('close', code => {
			if (code !== 0) {
				reject(`R process exited with non-zero status code=${code}` + '\n' + stdout.join('') + '\n' + stderr.join(''))
			}
			if (stderr.length > 0) {
				const e = stderr.join('')
				if (e.includes('warning')) {
					if (terminateAtWarnings) {
						reject(e)
					}
				} else {
					reject(e)
				}
			}
			resolve(
				stdout
					.join('')
					.trim()
					.split('\n')
			)
		})
	})
}
