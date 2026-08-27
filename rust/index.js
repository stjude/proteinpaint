/*
Module for running rust binaries

Arguments:
	- <binfile>: [string] name of the rust binary file.
	- <input_data>: [string|Buffer|ReadableStream] input data for the rust binary.
	- <args>: [array] arguments for the rust binary (optional).

Input data is streamed into the standard input of the rust binary.
Standard output of the rust binary is returned.
*/

// Import necessary modules
import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { Readable } from 'stream'

const __dirname = import.meta.dirname // set __dirname for consistency with cjs code

// Check if rust binary directory exists and is not empty
const binaryDir = path.join(__dirname, '/target/release/')
if (!fs.existsSync(binaryDir)) throw `missing rust binary directory='${binaryDir}'`
if (!fs.readdirSync(binaryDir).length) throw `empty rust binary directory='${binaryDir}'`

export function run_rust(binfile, input_data, args = [], { signal } = {}) {
	return new Promise((resolve, reject) => {
		const binpath = path.join(__dirname, '/target/release/', binfile)

		if (signal?.aborted) {
			reject(new Error(`run_rust('${binfile}'): aborted before start`))
			return
		}

		const ps = spawn(binpath, args)
		const stdout = []
		const stderr = []

		if (signal) {
			const onAbort = () => {
				if (!ps.killed) {
					ps.kill()
					reject(new Error(`run_rust('${binfile}'): aborted`))
				}
			}
			signal.addEventListener('abort', onAbort, { once: true })
			ps.on('close', () => signal.removeEventListener('abort', onAbort))
		}

		/* A child that dies before reading its input -- missing binary, dynamic-loader failure,
		immediate panic -- leaves the write below on a closed pipe. An 'error' event with no listener
		throws, and the server registers no process-level uncaughtException handler, so without this
		the whole node process exits: the client gets a gateway 502 instead of an error message, and
		the child's stderr is destroyed along with the process, hiding why it died in the first place.
		The try/catch below does not cover this -- the error is emitted asynchronously on the stream,
		not thrown by .pipe().

		Recorded rather than rejected here, because ps.on('close') fires immediately after with the
		child's exit code and stderr, which is the actual cause; EPIPE on its own says nothing useful. */
		let stdinError
		ps.stdin.on('error', err => {
			stdinError = err
		})

		try {
			Readable.from(input_data).pipe(ps.stdin)
		} catch (error) {
			ps.kill()
			let errmsg = error
			if (stderr.length) errmsg += `killed run_rust('${binfile}'), stderr: ${stderr.join('').trim()}`
			reject(errmsg)
		}

		ps.stdout.on('data', data => stdout.push(data))
		ps.stderr.on('data', data => stderr.push(data))
		ps.on('error', err => {
			if (stderr.length) console.log(`run_rust('${binfile}') ps.on('error') stderr:`, stderr)
			reject(err)
		})
		ps.on('close', code => {
			if (code !== 0) reject(`spawned '${binfile}' exited with a non-zero status and this stderr:\n${stderr.join('')}`)
			else if (stderr.length) {
				// handle rust stderr
				const err = stderr.join('').trim()
				const errmsg = `run_rust('${binfile}') emitted standard error\n stderr: ${err}`
				reject(errmsg)
			} else if (stdinError) {
				// exited cleanly but never read all of its input, so it did not act on the full request:
				// the stdout it did produce is computed from a truncated payload, not a valid result
				reject(`run_rust('${binfile}'): could not write input, ${stdinError.message || stdinError}`)
			} else if (stdout.join('').includes('Cannot read bigWig file') == true) {
				// When bigfile is not found, the promise should be rejected with message given below
				reject(stdout.join(''))
			} else {
				//console.log("stdout:",stdout)
				resolve(stdout.join(''))
			}
		})
	})
}
