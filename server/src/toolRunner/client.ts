import net from 'net'
import { EventEmitter } from 'events'
import { PassThrough, Writable } from 'stream'
import type { Readable } from 'stream'
import { setRStarter } from '@sjcrh/proteinpaint-r'
import { setPythonStarter } from '@sjcrh/proteinpaint-python'
import { setRustStarter } from '@sjcrh/proteinpaint-rust'
import { getCommand } from './requests.ts'
import type { ToolRequest } from './requests.ts'
import { spawnCommand } from './spawnCommand.ts'
import { FrameType, FrameReader, writeFrames, writeJson, parseJson, killSignals } from './protocol.ts'

/*
Starts every process of the server, from a request, see requests.ts:
- with a tool runner, which process.env.PP_TOOL_RUNNER_SOCKET names, the request is sent to the runner, which
  checks it again and starts the process, see runner.ts; the server process then does not need the permission to
  start a child process, and container/envHelpers.mjs starts it without that permission
- otherwise, the server process starts the command of the request itself

startProcess() returns a ToolProcess, which has the stdin, stdout, stderr, kill() and the spawn, error, exit and
close events of a child process, so that a caller handles either one the same way.

When this module is loaded, the R, python and rust packages are set to start their processes with startProcess().

connectToolRunner() must be called when the server starts, before any process is started, see app.ts.
*/

export interface ToolProcess extends EventEmitter {
	stdin: Writable
	stdout: Readable
	stderr: Readable
	killed: boolean
	exitCode: number | null
	kill(signal?: NodeJS.Signals | number): boolean
}

/** the socket of the tool runner, set by connectToolRunner() */
let socketPath: string | undefined

/** how long the server waits for the runner, which is started right before the server */
const connectTimeout = 30_000

setRStarter(({ filename, args, subdir }: { filename: string; args?: string[]; subdir: string }) => {
	// no caller passes arguments, and a runner request has none
	if (args?.length) throw 'run_R() arguments are not supported'
	return startProcess({ kind: 'R', script: filename, subdir })
})
setPythonStarter(({ pyfile }: { pyfile: string }) => startProcess({ kind: 'python', script: pyfile }))
setRustStarter(({ binfile, args }: { binfile: string; args?: string[] }) => {
	if (args?.length) throw 'run_rust() arguments are not supported'
	return startProcess({ kind: 'rust', binary: binfile })
})

/** throws for an invalid request, before anything is started */
export function startProcess(req: ToolRequest): ToolProcess {
	// also checked in the runner, but here so that an invalid request throws to the caller, as without a runner
	const cmd = getCommand(req)
	if (!socketPath) return spawnCommand(cmd)
	return new RunnerProcess(socketPath, req)
}

/** true when the processes are started by a tool runner */
export function usesToolRunner() {
	return !!socketPath
}

/** for tests: the socket of a runner to use, or undefined to start processes in this process */
export function setToolRunnerSocket(p: string | undefined) {
	socketPath = p
}

/*
Opens the control connection to the tool runner, and resolves when the runner is ready. The server process exits
when the control connection closes, such as when the runner exits, since no process could be started after that.

Without a runner, throws if this process may not start a child process, such as under the Node.js permission
model without --allow-child-process, which would otherwise only fail when a tool is first used.
*/
export async function connectToolRunner(onClose = exitOnRunnerClose) {
	// read here and not when this module is loaded, since the runner process also loads it; removed from the env so
	// that no other code reads it there
	const p = process.env.PP_TOOL_RUNNER_SOCKET
	delete process.env.PP_TOOL_RUNNER_SOCKET
	if (!p) {
		if (process.permission && !process.permission.has('child'))
			throw 'this process may not start a child process, and process.env.PP_TOOL_RUNNER_SOCKET is not set'
		return
	}
	const socket = await connectWithRetry(p, Date.now() + connectTimeout)
	await new Promise<void>((resolve, reject) => {
		let ready = false
		const reader = new FrameReader(type => {
			if (type != FrameType.ready) return socket.destroy()
			ready = true
			socketPath = p
			resolve()
		})
		socket.on('data', (chunk: Buffer) => reader.push(chunk))
		socket.on('error', () => {})
		socket.on('close', () => {
			if (!ready) reject('the tool runner closed the connection')
			else onClose()
		})
		writeFrames(socket, FrameType.hello)
	})
	console.log('the tool runner is ready')
}

function exitOnRunnerClose() {
	console.error('the tool runner has exited, so no tool can be started: exiting')
	process.exit(1)
}

/** retries while the socket file does not exist yet or is not listened on yet */
function connectWithRetry(p: string, deadline: number): Promise<net.Socket> {
	return new Promise((resolve, reject) => {
		const attempt = () => {
			const socket = net.connect(p)
			socket.once('connect', () => {
				socket.removeAllListeners('error')
				resolve(socket)
			})
			socket.once('error', (e: NodeJS.ErrnoException) => {
				if ((e.code == 'ENOENT' || e.code == 'ECONNREFUSED') && Date.now() < deadline) setTimeout(attempt, 100)
				else reject(`unable to connect to the tool runner: ${e.code || e.message}`)
			})
		}
		attempt()
	})
}

/*
A process that the runner starts. The events are in the same order as for a child process: spawn when started,
error when the request is rejected or the process cannot be started, exit, and close after stdout and stderr end.
*/
class RunnerProcess extends EventEmitter implements ToolProcess {
	stdin: Writable
	stdout = new PassThrough()
	stderr = new PassThrough()
	killed = false
	exitCode: number | null = null
	#socket: net.Socket
	#closed = false
	#exited = false

	constructor(p: string, req: ToolRequest) {
		super()
		const socket = net.connect(p)
		this.#socket = socket
		this.stdin = new Writable({
			write: (chunk: Buffer, _enc, cb) => this.#writeStdin(chunk, cb),
			final: cb => {
				if (!socket.destroyed) writeFrames(socket, FrameType.stdinEnd)
				cb()
			}
		})
		const reader = new FrameReader((type, payload) => this.#onFrame(type, payload))
		socket.on('data', (chunk: Buffer) => {
			try {
				reader.push(chunk)
			} catch (e: any) {
				this.#fail({ message: String(e?.message || e) })
				socket.destroy()
			}
		})
		socket.on('error', (e: NodeJS.ErrnoException) => this.#fail({ message: e.message, code: e.code }))
		socket.on('close', () => this.#close(null, null))
		// written once connected, and before any stdin frame, since the socket keeps the order of writes
		writeJson(socket, FrameType.request, req)
		this.stdout.on('drain', () => socket.resume())
	}

	kill(signal: NodeJS.Signals | number = 'SIGTERM') {
		const name = typeof signal == 'number' ? 'SIGTERM' : signal
		if (!killSignals.includes(name) || this.#exited || this.#socket.destroyed) return false
		writeJson(this.#socket, FrameType.kill, name)
		this.killed = true
		return true
	}

	#writeStdin(chunk: Buffer, cb: (e?: Error | null) => void) {
		if (this.#socket.destroyed) return cb(stdinError({ message: 'the process has exited', code: 'EPIPE' }))
		if (writeFrames(this.#socket, FrameType.stdin, chunk)) cb()
		else this.#socket.once('drain', () => cb())
	}

	#onFrame(type: number, payload: Buffer) {
		if (type == FrameType.started) this.emit('spawn')
		else if (type == FrameType.stdout) this.#push(this.stdout, payload)
		else if (type == FrameType.stderr) this.#push(this.stderr, payload)
		// like the stdin of a child process, which is destroyed with the error, such as EPIPE when the process exits
		// before it reads all its input
		else if (type == FrameType.stdinError) this.stdin.destroy(stdinError(parseJson(payload) as ErrorInfo))
		else if (type == FrameType.failed) this.#fail(parseJson(payload) as ErrorInfo)
		else if (type == FrameType.exit) {
			const { code, signal } = parseJson(payload) as { code: number | null; signal: NodeJS.Signals | null }
			this.#close(code, signal)
		}
	}

	#push(stream: PassThrough, payload: Buffer) {
		// a copy, since the payload may be a view of a larger buffer of the reader
		const ok = stream.write(Buffer.from(payload))
		// only stdout pauses the socket when its buffer is full, since a caller that does not read the stderr, which
		// is usually short, would otherwise also stop the stdout
		if (!ok && stream === this.stdout) this.#socket.pause()
	}

	#fail(info: ErrorInfo) {
		if (this.#closed) return
		this.emit('error', Object.assign(new Error(info.message), info.code ? { code: info.code } : {}))
	}

	#close(code: number | null, signal: NodeJS.Signals | null) {
		if (this.#closed) return
		this.#closed = true
		if (code !== null || signal !== null) {
			this.#exited = true
			this.exitCode = code
			this.emit('exit', code, signal)
		}
		this.#socket.end()
		// like a child process, an output stream that no code reads, such as after readline.close(), is resumed so that
		// it ends; a stream that is read, such as by a pipe that waits for its destination, ends after its data is read
		let pending = 2
		for (const s of [this.stdout, this.stderr]) {
			s.once('end', () => {
				if (--pending == 0) this.emit('close', code, signal)
			})
			if (!s.listenerCount('data') && !s.listenerCount('readable')) s.resume()
			s.end()
		}
	}
}

type ErrorInfo = { message: string; code?: string }

function stdinError(info: ErrorInfo) {
	return Object.assign(new Error(info.message), info.code ? { code: info.code } : {})
}
