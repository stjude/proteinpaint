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

export default async function run_R(path, data, args) {
	try {
		await fs.promises.stat(path)
	} catch (_e) {
		throw `${path} does not exist`
	}

	return new Promise((resolve, reject) => {
		const _stdout = []
		const _stderr = []
		// spawn R child process
		const sp = spawn(serverconfig.Rscript, args ? [path, ...args] : [path])

		// Handle process errors
		sp.on('error', err => {
			sp.stdin.end() // Ensure stdin is closed
			reject(err)
		})

		if (data) {
			// stream input data into R
			try {
				// Create input stream from data array
				const input = data.endsWith('\n') ? data : data + '\n' // R expects a final end-of-line marker
				// At this point we know data is an array due to validation above
				// const input = data.join('\n') + '\n'
				const readableStream = Readable.from(input)

				// Handle stream errors
				readableStream.on('error', err => {
					sp.stdin.end()
					reject(err)
				})

				// Pipe with proper error handling
				readableStream.pipe(sp.stdin)

				// Handle pipe finish
				readableStream.on('end', () => {
					sp.stdin.end()
				})
			} catch (e) {
				sp.stdin.end()
				sp.kill()
				let errmsg = e
				const stderr = _stderr.join('').trim()
				if (stderr) errmsg += `\nR stderr: ${stderr}`
				reject(errmsg)
			}
		} else if (args && args.length > 0) {
			try {
				const fileContent = fs.readFileSync(args[0], 'utf8')
				sp.stdin.write(fileContent)
				sp.stdin.end() // Explicitly end stdin after writing
			} catch (_e) {
				sp.stdin.end()
				sp.kill()
				reject(`Error reading file: ${_e.message}`)
			}
		} else {
			// No input data - close stdin immediately
			sp.stdin.end()
		}

		// Collect output
		sp.stdout.on('data', data => _stdout.push(data))
		sp.stderr.on('data', data => _stderr.push(data))

		// Handle process completion
		sp.on('close', code => {
			const stdout = _stdout.join('').trim()
			const stderr = _stderr.join('').trim()

			if (code !== 0) {
				let errmsg = `R process exited with non-zero status code=${code}`
				if (stdout) errmsg += `\nR stdout: ${stdout}`
				if (stderr) errmsg += `\nR stderr: ${stderr}`
				return reject(errmsg)
			}

			if (stderr) {
				return reject(`R process emitted standard error\nR stderr: ${stderr}`)
			}

			resolve(stdout ? stdout.split('\n') : [])
		})
	})
}
