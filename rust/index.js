/*
Module for running rust binaries

Arguments:
	- <binfile>: [string] name of the rust binary file.
	- <input_data>: [string|Buffer|ReadableStream] input data for the rust binary.
	- <args>: [array] arguments for the rust binary (optional).

Input data is streamed into the standard input of the rust binary.
Standard output of the rust binary is returned.

When the node permission model does not allow a child process, such as in an image without the rust binaries, a binary
that has a wasm32-wasip1 module, see wasm/Cargo.toml, is run in this process with node:wasi instead, which requires
the --allow-wasi permission. The module gets the input as its stdin and no preopened dir, so it has no other file
system access, no network, no env vars, and cannot start a process. A module runs synchronously, and blocks the event
loop until it exits.
*/

// Import necessary modules
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { Readable } from 'stream'

const __dirname = import.meta.dirname // set __dirname for consistency with cjs code

// a child process is allowed without the permission model
const useWasm = process.permission ? !process.permission.has('child') : false

// Check if rust binary directory, or else the wasm module directory, exists and is not empty. The rust binaries are
// optional, so that a missing one does not stop the server: a run_rust() call of it fails with the spawn error, or the
// missing wasm module error, instead.
const binaryDir = path.join(__dirname, '/target/release/')
const wasmDir = path.join(__dirname, '/target/wasm/wasm32-wasip1/release/')
{
	const dir = useWasm ? wasmDir : binaryDir
	if (!fs.existsSync(dir) || !fs.readdirSync(dir).length)
		console.warn(
			`WARNING: missing or empty rust ${useWasm ? 'wasm module' : 'binary'} directory='${dir}', requests that need rust will fail`
		)
}

// the file name of a binary or wasm module
const binaryName = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/

export function run_rust(binfile, input_data, args = [], { signal } = {}) {
	if (useWasm) return run_wasm(binfile, input_data, args, { signal })
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
			try {
				resolve(getOutput(binfile, code, stdout.join(''), stderr.join(''), stdinError))
			} catch (e) {
				reject(e)
			}
		})
	})
}

// returns the stdout of a binary or wasm module that exited, or throws a message with its stderr
function getOutput(binfile, code, stdout, stderr, stdinError) {
	if (code !== 0) throw `spawned '${binfile}' exited with a non-zero status and this stderr:\n${stderr}`
	if (stderr.length) {
		// handle rust stderr
		throw `run_rust('${binfile}') emitted standard error\n stderr: ${stderr.trim()}`
	}
	if (stdinError) {
		// exited cleanly but never read all of its input, so it did not act on the full request:
		// the stdout it did produce is computed from a truncated payload, not a valid result
		throw `run_rust('${binfile}'): could not write input, ${stdinError.message || stdinError}`
	}
	// When bigfile is not found, the promise should be rejected with message given below
	if (stdout.includes('Cannot read bigWig file')) throw stdout
	return stdout
}

// the compiled wasm module of each binary, by name
const wasmModules = new Map()

// runs the wasm module of a binary in this process, with the input in a file that is its stdin, and its stdout and
// stderr in files, in a new temp dir that is removed when it exits; node:wasi takes file descriptors, not streams
async function run_wasm(binfile, input_data, args, { signal } = {}) {
	if (signal?.aborted) throw new Error(`run_rust('${binfile}'): aborted before start`)
	if (typeof binfile != 'string' || !binaryName.test(binfile)) throw `invalid rust binary name`
	const modpath = path.join(wasmDir, binfile + '.wasm')
	if (!wasmModules.has(binfile)) {
		if (!fs.existsSync(modpath))
			throw `run_rust('${binfile}'): this binary has no wasm module, and a child process is not allowed`
		wasmModules.set(binfile, WebAssembly.compile(fs.readFileSync(modpath)))
	}
	const [wasmModule, input, { WASI }] = await Promise.all([
		wasmModules.get(binfile),
		readInput(input_data),
		// imported only when used, since the import logs an experimental feature warning
		import('node:wasi')
	])
	// a long input may still arrive after an abort
	if (signal?.aborted) throw new Error(`run_rust('${binfile}'): aborted`)

	const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pp-wasm-'))
	const fds = []
	try {
		const file = name => path.join(dir, name)
		fs.writeFileSync(file('stdin'), input, { mode: 0o600 })
		const [stdin, stdout, stderr] = ['stdin', 'stdout', 'stderr'].map((name, i) => {
			fds.push(fs.openSync(file(name), i ? 'w' : 'r', 0o600))
			return fds[i]
		})
		// no preopens and no env
		const wasi = new WASI({
			version: 'preview1',
			args: [binfile, ...args],
			env: {},
			stdin,
			stdout,
			stderr,
			returnOnExit: true
		})
		const instance = await WebAssembly.instantiate(wasmModule, wasi.getImportObject())
		let code
		try {
			code = wasi.start(instance)
		} catch (e) {
			// a rust panic is a wasm trap, which throws instead of an exit code; the panic message is in stderr
			code = `${e.message || e}`
		}
		for (const fd of fds.splice(0)) fs.closeSync(fd)
		return getOutput(binfile, code, fs.readFileSync(file('stdout'), 'utf8'), fs.readFileSync(file('stderr'), 'utf8'))
	} finally {
		for (const fd of fds) fs.closeSync(fd)
		fs.rmSync(dir, { recursive: true, force: true })
	}
}

async function readInput(input_data) {
	if (typeof input_data == 'string' || Buffer.isBuffer(input_data)) return input_data
	const chunks = []
	for await (const chunk of Readable.from(input_data))
		chunks.push(typeof chunk == 'string' ? Buffer.from(chunk) : chunk)
	return Buffer.concat(chunks)
}
