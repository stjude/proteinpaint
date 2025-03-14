/*
Module for running R

Arguments:
	- <path>: [string] path to R script.
	- <data>: [string] input data for R script.
	- <args>: [array] arguments for R script.

Input data is streamed into the standard input of the R script.
Standard output of the R script is returned.
*/

import fs from 'fs'
import serverconfig from './serverconfig.js'
import { spawn } from 'child_process'
import { Readable } from 'stream'

// hardcoded debug line marker, to identify which lines of Rscript stdout are debugging/diagnostic and to be separated from actual output e.g. stringified JSON
// NOTE that a debugging line must ends with line break
const debugLineMarker = 'debug:'

export default async function run_R(path, data, args) {
	try {
		await fs.promises.stat(path)
	} catch (e) {
		throw `${path} does not exist`
	}
	return new Promise((resolve, reject) => {
		const _stdout = []
		const _stderr = []
		// spawn R child process
		const sp = spawn(serverconfig.Rscript, args ? [path, ...args] : [path])
		if (data) {
			// stream input data into R
			try {
				const input = data.endsWith('\n') ? data : data + '\n' // R expects a final end-of-line marker
				Readable.from(input).pipe(sp.stdin)
			} catch (e) {
				sp.kill()
				let errmsg = e
				const stderr = _stderr.join('').trim()
				if (stderr) errmsg += `\nR stderr: ${stderr}`
				reject(errmsg)
			}
		}
		// store stdout and stderr from R
		sp.stdout.on('data', data => _stdout.push(data))
		sp.stderr.on('data', data => _stderr.push(data))
		sp.on('error', err => reject(err))
		// return stdout and stderr when R process closes
		sp.on('close', code => {
			const stdout = _stdout.join('').trim()
			const stderr = _stderr.join('').trim()
			if (code !== 0) {
				// handle non-zero exit status
				let errmsg = `R process exited with non-zero status code=${code}`
				if (stdout) errmsg += `\nR stdout: ${stdout}`
				if (stderr) errmsg += `\nR stderr: ${stderr}`
				reject(errmsg)
			}
			if (stderr) {
				// handle R stderr
				const errmsg = `R process emitted standard error\nR stderr: ${stderr}`
				reject(errmsg)
			}
			// return standard out from R
			if (serverconfig.debugmode) {
				/* at dev environment, split stdout into lines, and check for debugging lines, and exclude them from actual output
				********
				* NOTE *
				********
				such debugging lines must not show up in prod environment
				*/
				const actualOutputLines = []
				for (const line of stdout.split('\n')) {
					if (line.startsWith(debugLineMarker)) {
						// line begins with hardcoded marker and will be excluded
						console.log('<R>', line)
						continue
					}
					// line doesn't begin with marker and is kept
					actualOutputLines.push(line)
				}
				resolve(actualOutputLines.join('\n'))
			} else {
				// not dev environment; do this detection to guard against accidental introduction of debug lines
				if (stdout.indexOf(debugLineMarker) != -1) {
					reject(
						'Debugging line found in R output and this is not allowd in prod environment; make sure to comment off such lines in R script'
					)
				}
				resolve(stdout)
			}
		})
	})
}
