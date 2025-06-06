/*
Module for running R

Arguments:
	- <filename>: [string] name of R script.
	- <data>: [string] input data for R script.
	- <args>: [array] arguments for R script.
	- <subdir>: [string] subdirectory containing R script (defaults to src/).

Input data is streamed into the standard input of the R script.
Standard output of the R script is returned.
*/

import fs from 'fs'
import { spawn } from 'child_process'
import { Readable } from 'stream'
import path from 'path'

const __dirname = import.meta.dirname // set __dirname for consistency with cjs code

export async function run_R(filename, data, args, subdir = 'src') {
	const filepath = path.join(__dirname, subdir, filename)
	if (!fs.existsSync(filepath)) throw `${filepath} does not exist`
	return new Promise((resolve, reject) => {
		const _stdout = []
		const _stderr = []
		// spawn R child process
		const sp = spawn('Rscript', args ? [filepath, ...args] : [filepath])
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
			resolve(stdout)
		})
	})
}
