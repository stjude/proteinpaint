/*
Module for running rust binaries

Arguments:
	- <binfile>: [string] name of the rust binary file.
	- <input_data>: [string|Buffer|ReadableStream] input data for the rust binary.
	- <args>: [array] arguments for the rust binary (optional).

Input data is streamed into the standard input of the rust binary.
Standard output of the rust binary is returned.

When the node permission model does not allow a child process, such as in an image without the rust binaries, a binary
that has a wasm32-wasip1 module, see wasm/Cargo.toml, is run in this process instead. It is instantiated with only
the WASI functions in wasiImports(), not node:wasi, so that no --allow-wasi permission is needed: its stdin, stdout
and stderr are in memory, and it has no other file, no env vars, no args, no network, and cannot start a process. A
module that imports any other function does not instantiate. A module runs synchronously, and blocks the event loop
until it exits.
*/

// Import necessary modules
import fs from "fs"
import path from "path"
import { spawn } from "child_process"
import { Readable } from "stream"

const __dirname = import.meta.dirname // set __dirname for consistency with cjs code

// a child process is allowed without the permission model
const useWasm = process.permission ? !process.permission.has("child") : false

// Check if rust binary directory, or else the wasm module directory, exists and is not empty. The rust binaries are
// optional, so that a missing one does not stop the server: a run_rust() call of it fails with the spawn error, or the
// missing wasm module error, instead.
const binaryDir = path.join(__dirname, "/target/release/")
const wasmDir = path.join(__dirname, "/target/wasm/wasm32-wasip1/release/")
{
	const dir = useWasm ? wasmDir : binaryDir
	if (!fs.existsSync(dir) || !fs.readdirSync(dir).length)
		console.warn(
			`WARNING: missing or empty rust ${
				useWasm ? "wasm module" : "binary"
			} directory='${dir}', requests that need rust will fail`
		)
}

// the file name of a binary or wasm module
const binaryName = /^[A-Za-z0-9_][A-Za-z0-9_-]*$/

export function run_rust(binfile, input_data, args = [], { signal } = {}) {
	if (useWasm) return run_wasm(binfile, input_data, args, { signal })
	return new Promise((resolve, reject) => {
		const binpath = path.join(__dirname, "/target/release/", binfile)

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
			signal.addEventListener("abort", onAbort, { once: true })
			ps.on("close", () => signal.removeEventListener("abort", onAbort))
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
		ps.stdin.on("error", (err) => {
			stdinError = err
		})

		try {
			Readable.from(input_data).pipe(ps.stdin)
		} catch (error) {
			ps.kill()
			let errmsg = error
			if (stderr.length)
				errmsg += `killed run_rust('${binfile}'), stderr: ${stderr
					.join("")
					.trim()}`
			reject(errmsg)
		}

		ps.stdout.on("data", (data) => stdout.push(data))
		ps.stderr.on("data", (data) => stderr.push(data))
		ps.on("error", (err) => {
			if (stderr.length)
				console.log(`run_rust('${binfile}') ps.on('error') stderr:`, stderr)
			reject(err)
		})
		ps.on("close", (code) => {
			try {
				resolve(
					getOutput(binfile, code, stdout.join(""), stderr.join(""), stdinError)
				)
			} catch (e) {
				reject(e)
			}
		})
	})
}

// returns the stdout of a binary or wasm module that exited, or throws a message with its stderr
function getOutput(binfile, code, stdout, stderr, stdinError) {
	if (code !== 0)
		throw `spawned '${binfile}' exited with a non-zero status and this stderr:\n${stderr}`
	if (stderr.length) {
		// handle rust stderr
		throw `run_rust('${binfile}') emitted standard error\n stderr: ${stderr.trim()}`
	}
	if (stdinError) {
		// exited cleanly but never read all of its input, so it did not act on the full request:
		// the stdout it did produce is computed from a truncated payload, not a valid result
		throw `run_rust('${binfile}'): could not write input, ${
			stdinError.message || stdinError
		}`
	}
	// When bigfile is not found, the promise should be rejected with message given below
	if (stdout.includes("Cannot read bigWig file")) throw stdout
	return stdout
}

// the compiled wasm module of each binary, by name
const wasmModules = new Map()

// runs the wasm module of a binary in this process, with its stdin, stdout and stderr in memory, so that no file is
// written, such as when the node permission model allows no write path
async function run_wasm(binfile, input_data, args, { signal } = {}) {
	if (signal?.aborted)
		throw new Error(`run_rust('${binfile}'): aborted before start`)
	if (typeof binfile != "string" || !binaryName.test(binfile))
		throw `invalid rust binary name`
	const modpath = path.join(wasmDir, binfile + ".wasm")
	if (!wasmModules.has(binfile)) {
		if (!fs.existsSync(modpath)) {
			// the details are only logged, and the response has a neutral error
			console.warn(
				`run_rust('${binfile}'): no wasm module, and the node permission model does not allow a child process`
			)
			throw "this server build does not support this data computation request"
		}
		const compiled = WebAssembly.compile(fs.readFileSync(modpath))
		// a failed compile is not cached, so that a later call compiles the module again
		compiled.catch(() => {
			if (wasmModules.get(binfile) === compiled) wasmModules.delete(binfile)
		})
		wasmModules.set(binfile, compiled)
	}
	// the module is ready before a stream input is read, so that a failed setup does not leave the input being read
	const wasmModule = await wasmModules.get(binfile)
	if (signal?.aborted) throw new Error(`run_rust('${binfile}'): aborted`)
	const input = await readInput(input_data, signal, binfile)
	// a long input may still arrive after an abort
	if (signal?.aborted) throw new Error(`run_rust('${binfile}'): aborted`)

	const stdio = {
		stdin: Buffer.isBuffer(input) ? input : Buffer.from(input),
		offset: 0,
		stdout: [],
		stderr: [],
	}
	let memory
	// a module that imports any other function fails to instantiate, with a LinkError; both levels of the import
	// object have no prototype, so that an import name cannot resolve to an inherited property, such as toString
	const imports = Object.assign(Object.create(null), {
		wasi_snapshot_preview1: wasiImports(stdio, () => memory),
	})
	const instance = await WebAssembly.instantiate(wasmModule, imports)
	memory = instance.exports.memory
	let code = 0
	try {
		instance.exports._start()
	} catch (e) {
		// a rust panic is a wasm trap, which throws instead of an exit code; the panic message is in stderr
		code = e instanceof WasiExit ? e.code : `${e.message || e}`
	}
	return getOutput(
		binfile,
		code,
		Buffer.concat(stdio.stdout).toString("utf8"),
		Buffer.concat(stdio.stderr).toString("utf8")
	)
}

// thrown by proc_exit, to stop the module with its exit code
class WasiExit {
	constructor(code) {
		this.code = code
	}
}

const WASI_ESUCCESS = 0
const WASI_EBADF = 8
const WASI_ESPIPE = 70

// The WASI preview1 functions that the modules use: fd 0 is read from stdio.stdin, fds 1 and 2 are appended to
// stdio.stdout and stdio.stderr, and there is no other fd and no env variable. An iovec is a {buf: u32 pointer,
// buf_len: u32} pair in the module memory, and a result, such as a byte count, is written at the pointer of the last
// argument.
function wasiImports(stdio, getMemory) {
	const view = () => new DataView(getMemory().buffer)
	const iovecs = (iovs, iovsLen) => {
		const lst = []
		for (let i = 0; i < iovsLen; i++) {
			const p = iovs + i * 8
			lst.push(
				new Uint8Array(
					getMemory().buffer,
					view().getUint32(p, true),
					view().getUint32(p + 4, true)
				)
			)
		}
		return lst
	}
	const isStdio = (fd) => fd === 0 || fd === 1 || fd === 2
	return Object.assign(Object.create(null), {
		fd_read(fd, iovs, iovsLen, nreadPtr) {
			if (fd !== 0) return WASI_EBADF
			let n = 0
			for (const buf of iovecs(iovs, iovsLen)) {
				const chunk = stdio.stdin.subarray(
					stdio.offset,
					stdio.offset + buf.length
				)
				buf.set(chunk)
				stdio.offset += chunk.length
				n += chunk.length
				if (chunk.length < buf.length) break
			}
			view().setUint32(nreadPtr, n, true)
			return WASI_ESUCCESS
		},
		fd_write(fd, iovs, iovsLen, nwrittenPtr) {
			if (fd !== 1 && fd !== 2) return WASI_EBADF
			let n = 0
			for (const buf of iovecs(iovs, iovsLen)) {
				// a copy, since the module may reuse its buffer
				;(fd == 1 ? stdio.stdout : stdio.stderr).push(Buffer.from(buf))
				n += buf.length
			}
			view().setUint32(nwrittenPtr, n, true)
			return WASI_ESUCCESS
		},
		// a 24-byte fdstat: filetype unknown, no flags, and only the read or write right
		fd_fdstat_get(fd, statPtr) {
			if (!isStdio(fd)) return WASI_EBADF
			new Uint8Array(getMemory().buffer, statPtr, 24).fill(0)
			// the fd_read right is bit 1, and the fd_write right is bit 6
			view().setBigUint64(statPtr + 8, fd === 0 ? 1n << 1n : 1n << 6n, true)
			return WASI_ESUCCESS
		},
		fd_seek: (fd) => (isStdio(fd) ? WASI_ESPIPE : WASI_EBADF),
		fd_close: (fd) => (isStdio(fd) ? WASI_ESUCCESS : WASI_EBADF),
		environ_sizes_get(countPtr, sizePtr) {
			view().setUint32(countPtr, 0, true)
			view().setUint32(sizePtr, 0, true)
			return WASI_ESUCCESS
		},
		environ_get: () => WASI_ESUCCESS,
		proc_exit(code) {
			throw new WasiExit(code)
		},
	})
}

// collects a stream input; an abort stops a stream that does not end, and destroys it, as the native path ends the
// input of the killed process
async function readInput(input_data, signal, binfile) {
	if (typeof input_data == "string" || Buffer.isBuffer(input_data))
		return input_data
	const stream = Readable.from(input_data)
	const onAbort = () => {
		const err = new Error(`run_rust('${binfile}'): aborted`)
		stream.destroy(err)
		if (typeof input_data?.destroy == "function") input_data.destroy()
	}
	signal?.addEventListener("abort", onAbort, { once: true })
	try {
		const chunks = []
		for await (const chunk of stream)
			chunks.push(typeof chunk == "string" ? Buffer.from(chunk) : chunk)
		return Buffer.concat(chunks)
	} finally {
		signal?.removeEventListener("abort", onAbort)
	}
}
