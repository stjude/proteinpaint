/*
Module for running R

Arguments:
	- <filename>: [string] name of R script.
	- <data>: [string] input data for R script.
	- <args>: [array] arguments for R script.
	- <subdir>: [string] subdirectory containing R script (defaults to src/).

Input data is streamed into the standard input of the R script.
Standard output of the R script is returned.

getRCommand() returns the command that runs a script, and setRStarter() replaces how the command is started,
such as by the server, which may start it through another process.
*/

import fs from 'fs'
import { spawn } from 'child_process'
import { Readable } from 'stream'
import path from 'path'

const __dirname = import.meta.dirname // set __dirname for consistency with cjs code

// the dirs of the R scripts, and the file name of a script
const subdirs = ['src', 'utils']
const scriptName = /^[A-Za-z0-9_][A-Za-z0-9_.-]*\.R$/

let startR = ({ filename, args, subdir }) => {
	const { file, args: argv } = getRCommand(filename, args, subdir)
	return spawn(file, argv)
}

/** start({filename, args, subdir}) returns a child process, or an object with the same streams, events and kill() */
export function setRStarter(start) {
	startR = start
}

/** returns {file, args} of the command that runs the R script, or throws */
export function getRCommand(filename, args, subdir = 'src') {
	if (!subdirs.includes(subdir)) throw `invalid R script dir`
	if (typeof filename != 'string' || !scriptName.test(filename)) throw `invalid R script name`
	const filepath = path.join(__dirname, subdir, filename)
	if (!fs.existsSync(filepath)) throw `${filepath} does not exist`
	// --vanilla: use only the R installation defaults, not user or site startup files
	return { file: 'Rscript', args: ['--vanilla', filepath, ...(args || [])] }
}

export async function run_R(filename, data, args, subdir = 'src') {
	// throws before the script is started, such as for a script that does not exist
	getRCommand(filename, args, subdir)
	return new Promise((resolve, reject) => {
		const _stdout = []
		const _stderr = []
		const sp = startR({ filename, args, subdir })
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
			// return standard out from R
			resolve(stdout)
		})
	})
}
