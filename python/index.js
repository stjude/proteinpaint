import path from 'path'
import fs from 'fs'
import { spawn } from 'child_process'
import { Readable } from 'stream'

const __dirname = import.meta.dirname

// the file name of a script in src/
const scriptName = /^[A-Za-z0-9_][A-Za-z0-9_.-]*\.py$/

let python = 'python3'
// This should be called at the beginning of the server runtime code,
// so that the same binpath will be reused throughoutt the server lifetime.
// TODO: may limit the reset to once?
export function setPythonBinPath(binpath) {
	if (!fs.existsSync(binpath)) throw `invalid python binpath='${binpath}'`
	python = binpath
}

let startPython = ({ pyfile }) => {
	const { file, args } = getPythonCommand(pyfile)
	return spawn(file, args)
}

/** start({pyfile}) returns a child process, or an object with the same streams, events and kill(); such as for
 * the server, which may start the command of getPythonCommand() through another process */
export function setPythonStarter(start) {
	startPython = start
}

/** returns {file, args} of the command that runs the python script in src/, or throws */
export function getPythonCommand(pyfile) {
	if (typeof pyfile != 'string' || !scriptName.test(pyfile)) throw `invalid python script name`
	const pypath = path.join(__dirname, '/src/', pyfile)
	if (!fs.existsSync(pypath)) throw `${pypath} does not exist`
	// -E -s: use only the interpreter defaults, not PYTHON* env variables or the user site dir;
	// not -I, which also removes the script dir from sys.path that the sibling-module imports need
	return { file: python, args: ['-E', '-s', pypath] }
}

export function run_python(pyfile, input_data, { signal } = {}) {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			reject(new Error(`run_python('${pyfile}'): aborted before start`))
			return
		}

		const ps = startPython({ pyfile })
		const stdout = []
		const stderr = []

		let aborted = false
		if (signal) {
			const onAbort = () => {
				if (!ps.killed) {
					aborted = true
					ps.kill()
					reject(new Error(`run_python('${pyfile}'): aborted`))
				}
			}
			signal.addEventListener('abort', onAbort, { once: true })
			ps.on('close', () => signal.removeEventListener('abort', onAbort))
		}

		// Handle stdin errors (e.g. EPIPE)
		ps.stdin.on('error', err => {
			if (err.code === 'EPIPE') {
				console.warn(`run_python('${pyfile}'): EPIPE error on stdin, Python may have exited early`)
			} else {
				console.error(`run_python('${pyfile}'): stdin error:`, err)
			}
		})

		try {
			Readable.from(input_data).pipe(ps.stdin)
		} catch (error) {
			ps.kill()
			const stderrStr = stderr.join('').trim()
			let errmsg = `run_python('${pyfile}'): Failed to pipe input: ${error.message}`
			if (stderrStr) errmsg += `\nstderr: ${stderrStr}`
			reject(new Error(errmsg))
			return
		}

		ps.stdout.on('data', data => stdout.push(data))
		ps.stderr.on('data', data => {
			stderr.push(data)
			if (!aborted) console.log(`run_python('${pyfile}'): stderr: ${data.toString().trim()}`)
		})
		ps.on('error', err => {
			const stderrStr = stderr.join('').trim()
			let errmsg = `run_python('${pyfile}'): Process error: ${err.message}`
			if (stderrStr) errmsg += `\nstderr: ${stderrStr}`
			reject(new Error(errmsg))
		})
		ps.on('close', code => {
			if (aborted) return // already rejected in onAbort; suppress noise from expected termination
			const stderrStr = stderr.join('').trim()
			if (code !== 0) {
				const errorMessage = `spawned '${pyfile}' exited with code ${code} and stderr:\n${stderr.join('')}`
				console.error('Python error:', errorMessage) // Log full error
				reject(errorMessage)
			} else if (stderr.length) {
				// python stderr
				const err = stderr.join('').trim()
				const errmsg = `run_python('${pyfile}') emitted standard error\n stderr: ${err}`
				reject(err)
			} else {
				if (pyfile === 'plotBrainImaging.py') {
					// Handle binary data
					const imageBuffer = Buffer.concat(stdout)
					const base64Data = imageBuffer.toString('base64')
					const imgUrl = `data:image/png;base64,${base64Data}`
					resolve(imgUrl)
				} else {
					// Handle text data
					resolve(stdout.join(''))
				}
			}
		})
	})
}
