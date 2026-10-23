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
	throw 'r disabled'
	const filepath = path.join(__dirname, subdir, filename)
	if (!fs.existsSync(filepath)) throw `${filepath} does not exist`
	return new Promise((resolve, reject) => {
		const _stdout = []
		const _stderr = []
		// spawn R child process
		// --vanilla: use only the R installation defaults, not user or site startup files
		const sp = spawn('Rscript', ['--vanilla', filepath, ...(args || [])])
		// R may exit before it reads all of its input, such as when a library cannot be loaded, and the write to
		// the closed pipe then emits an error on sp.stdin, which would exit the node process if not listened to.
		// It is recorded and not rejected here, since sp.on('close') follows with the exit code and stderr of R,
		// which tell the actual cause.
		let stdinError
		sp.stdin.on('error', err => {
			stdinError = err
		})
		if (data) {
			// stream input data into R
			try {
				const input = data.endsWith('\n') ? data : data + '\n' // R expects a final end-of-line marker
				Readable.from(input).pipe(sp.stdin)
			} catch (e) {
				sp.kill()
				let errmsg = e
				const stderr = Buffer.concat(_stderr).toString('utf8').trim()
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
			// concatenate buffer chunks and then convert to string
			// important to do this because a multibyte UTF-8 character like ≥ (e2 89 a5)
			// may be split across chunks and it needs to be concatenated before string
			// conversion
			const stdout = Buffer.concat(_stdout).toString('utf8').trim()
			const stderr = Buffer.concat(_stderr).toString('utf8').trim()
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
			if (stdinError) {
				// R exited without an error but did not read all of its input, so its output is not a valid result
				reject(`R process did not read all of its input: ${stdinError.message || stdinError}`)
			}
			// return standard out from R
			resolve(stdout)
		})
	})
}
