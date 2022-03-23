/*
Stream JavaScript data into and out of R.

Arguments:
	- <Rscript>: [string] path to R script.
	- <lines>: [array] data lines.
	- <args>: [array] R script arguments.

Given an R script and a JavaScript array of input data lines, the data lines are streamed into the standard input of the R script. The standard output of the R script is then returned as a JavaScript array of output data lines.
*/

const path = require('path')
const fs = require('fs')
const spawn = require('child_process').spawn
const Readable = require('stream').Readable
const serverconfig = require('./serverconfig')

module.exports = async function lines2R(Rscript, lines, args = []) {
	try {
		await fs.promises.stat(Rscript)
	} catch (e) {
		throw `${Rscript} does not exist`
	}
	const stdout = []
	const stderr = []
	return new Promise((resolve, reject) => {
		const sp = spawn(serverconfig.Rscript, [Rscript, ...args])
		if (lines && lines.length > 0) {
			// if data lines are present, then data will be streamed into R
			// otherwise, data will be read into R using an argument
			const table = lines.join('\n') + '\n'
			Readable.from(table)
				.pipe(sp.stdin)
				.on('error', () => {
					console.log('\nR stderr: ' + stderr.join(''))
					reject('input data could not be streamed into R')
				})
		}
		sp.stdout.on('data', data => stdout.push(data))
		sp.stderr.on('data', data => stderr.push(data))
		sp.on('error', err => reject(err))
		sp.on('close', code => {
			if (code !== 0) {
				console.log('\nR stdout: ' + stdout.join(''))
				console.log('\nR stderr: ' + stderr.join(''))
				reject(`R process exited with non-zero status code=${code}`)
			}
			const out = stdout
				.join('')
				.trim()
				.split('\n')
			if (stderr.length > 0) {
				const e = stderr.join('').trim()
				console.log('\nR stderr: ' + e)
				reject('R process emitted standard error')
			}
			resolve(out)
		})
	})
}
