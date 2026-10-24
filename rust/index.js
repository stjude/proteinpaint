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
system access, its stdin, stdout and stderr are in memory, so no file is written, no network, no env vars, and cannot start a process. A module runs synchronously, and blocks the event
loop until it exits.
*/

// Import necessary modules
import fs from 'fs'
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
			`WARNING: missing or empty rust ${
				useWasm ? 'wasm module' : 'binary'
			} directory='${dir}', requests that need rust will fail`
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

// runs the wasm module of a binary in this process, with its stdin, stdout and stderr in memory, so that no file is
// written, such as when the node permission model allows no write path; node:wasi only takes file descriptors for
// these, so the fd_read and fd_write imports of fds 0, 1 and 2 are replaced instead
async function run_wasm(binfile, input_data, args, { signal } = {}) {
	if (signal?.aborted) throw new Error(`run_rust('${binfile}'): aborted before start`)
	if (typeof binfile != 'string' || !binaryName.test(binfile)) throw `invalid rust binary name`
	const modpath = path.join(wasmDir, binfile + '.wasm')
	if (!wasmModules.has(binfile)) {
		if (!fs.existsSync(modpath)) {
			// the details are only logged, and the response has a neutral error
			console.warn(
				`run_rust('${binfile}'): no wasm module, and the node permission model does not allow a child process`
			)
			throw 'this server build does not support this data computation request'
		}
		const compiled = WebAssembly.compile(fs.readFileSync(modpath))
		// a failed compile is not cached, so that a later call compiles the module again
		compiled.catch(() => {
			if (wasmModules.get(binfile) === compiled) wasmModules.delete(binfile)
		})
		wasmModules.set(binfile, compiled)
	}
	// the module is ready before a stream input is read, so that a failed setup does not leave the input being read
	const [wasmModule, { WASI }] = await Promise.all([
		wasmModules.get(binfile),
		// imported only when used, since the import logs an experimental feature warning
		import('node:wasi')
	])
	if (signal?.aborted) throw new Error(`run_rust('${binfile}'): aborted`)
	const input = await readInput(input_data, signal, binfile)
	// a long input may still arrive after an abort
	if (signal?.aborted) throw new Error(`run_rust('${binfile}'): aborted`)

	// no preopens and no env
	const wasi = new WASI({ version: 'preview1', args: [binfile, ...args], env: {}, returnOnExit: true })
	const stdio = { stdin: Buffer.isBuffer(input) ? input : Buffer.from(input), offset: 0, stdout: [], stderr: [] }
	const imports = wasi.getImportObject()
	let memory
	imports.wasi_snapshot_preview1 = {
		...imports.wasi_snapshot_preview1,
		...stdioImports(imports.wasi_snapshot_preview1, stdio, () => memory)
	}
	const instance = await WebAssembly.instantiate(wasmModule, imports)
	memory = instance.exports.memory
	let code
	try {
		code = wasi.start(instance)
	} catch (e) {
		// a rust panic is a wasm trap, which throws instead of an exit code; the panic message is in stderr
		code = `${e.message || e}`
	}
	return getOutput(
		binfile,
		code,
		Buffer.concat(stdio.stdout).toString('utf8'),
		Buffer.concat(stdio.stderr).toString('utf8')
	)
}

const WASI_ESUCCESS = 0
const WASI_EBADF = 8

// the fd_read import reads fd 0 from stdio.stdin, and the fd_write import appends fds 1 and 2 to stdio.stdout and
// stdio.stderr; an iovec is a {buf: u32 pointer, buf_len: u32} pair in the module memory, and the byte count is
// written at the u32 pointer of the last argument. Other fds use the node:wasi imports, which find no open file
// without a preopened dir.
function stdioImports(wasiImports, stdio, getMemory) {
	const iovecs = (iovs, iovsLen) => {
		const view = new DataView(getMemory().buffer)
		const lst = []
		for (let i = 0; i < iovsLen; i++) {
			const p = iovs + i * 8
			lst.push(new Uint8Array(getMemory().buffer, view.getUint32(p, true), view.getUint32(p + 4, true)))
		}
		return lst
	}
	const setCount = (ptr, n) => new DataView(getMemory().buffer).setUint32(ptr, n, true)
	return {
		fd_read(fd, iovs, iovsLen, nreadPtr) {
			if (fd > 2) return wasiImports.fd_read(fd, iovs, iovsLen, nreadPtr)
			if (fd != 0) return WASI_EBADF
			let n = 0
			for (const buf of iovecs(iovs, iovsLen)) {
				const chunk = stdio.stdin.subarray(stdio.offset, stdio.offset + buf.length)
				buf.set(chunk)
				stdio.offset += chunk.length
				n += chunk.length
				if (chunk.length < buf.length) break
			}
			setCount(nreadPtr, n)
			return WASI_ESUCCESS
		},
		fd_write(fd, iovs, iovsLen, nwrittenPtr) {
			if (fd > 2) return wasiImports.fd_write(fd, iovs, iovsLen, nwrittenPtr)
			if (fd == 0) return WASI_EBADF
			let n = 0
			for (const buf of iovecs(iovs, iovsLen)) {
				// a copy, since the module may reuse its buffer
				;(fd == 1 ? stdio.stdout : stdio.stderr).push(Buffer.from(buf))
				n += buf.length
			}
			setCount(nwrittenPtr, n)
			return WASI_ESUCCESS
		}
	}
}

// collects a stream input; an abort stops a stream that does not end, and destroys it, as the native path ends the
// input of the killed process
async function readInput(input_data, signal, binfile) {
	if (typeof input_data == 'string' || Buffer.isBuffer(input_data)) return input_data
	const stream = Readable.from(input_data)
	const onAbort = () => {
		const err = new Error(`run_rust('${binfile}'): aborted`)
		stream.destroy(err)
		if (typeof input_data?.destroy == 'function') input_data.destroy()
	}
	signal?.addEventListener('abort', onAbort, { once: true })
	try {
		const chunks = []
		for await (const chunk of stream) chunks.push(typeof chunk == 'string' ? Buffer.from(chunk) : chunk)
		return Buffer.concat(chunks)
	} finally {
		signal?.removeEventListener('abort', onAbort)
	}
}
