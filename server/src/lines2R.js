/*
Stream JavaScript data into and out of R.

Arguments:
	- <Rscript>: [string] path to R script.
	- <lines>: [array] data lines.
	- <args>: [array] R script arguments.

Given an R script and a JavaScript array of input data lines, the data lines are streamed into the standard input of the R script. The standard output of the R script is then returned as a JavaScript array of output data lines.
*/

import fs from 'fs'
import path from 'path'
import serverconfig from './serverconfig'
import { spawn } from 'child_process'
import { Readable } from 'stream'

export default async function lines2R(Rscript, lines, args = []) {
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
			try {
				const table = lines.join('\n') + '\n'
				Readable.from(table).pipe(sp.stdin)
			} catch (error) {
				sp.kill()
				let errmsg = error
				if (stderr.length > 0) errmsg += `\nR stderr: ${stderr.join('').trim()}`
				reject(errmsg)
			}
		}
		sp.stdout.on('data', data => stdout.push(data))
		sp.stderr.on('data', data => stderr.push(data))
		sp.on('error', err => reject(err))
		sp.on('close', code => {
			if (code !== 0) {
				// handle non-zero exit status
				let errmsg = `R process exited with non-zero status code=${code}`
				if (stdout.length > 0) errmsg += `\nR stdout: ${stdout.join('').trim()}`
				if (stderr.length > 0) errmsg += `\nR stderr: ${stderr.join('').trim()}`
				reject(errmsg)
			}
			if (stderr.length > 0) {
				// handle R stderr
				const err = stderr.join('').trim()
				const errmsg = `R process emitted standard error\nR stderr: ${err}`
				reject(errmsg)
			}
			const out = stdout.join('').trim().split('\n')
			resolve(out)
		})
	})
}
